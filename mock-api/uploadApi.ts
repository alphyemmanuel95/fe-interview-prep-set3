import type { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { createUploadRegistry, pickUploadOutcome } from './uploadRegistry.ts';
import type { UploadRegistry } from './uploadRegistry.ts';

// Served by Vite itself (dev and preview servers only, not the static build) so uploads are real
// HTTP requests in the Network tab, without a separate backend process or a service worker.
export const UPLOAD_ROUTE = '/api/upload';

// Reading the body at a capped rate applies real TCP back-pressure, so the browser's upload
// progress events advance gradually instead of jumping straight to 100% on localhost.
const READ_BYTES_PER_MS = 1_000;
const MIN_PROCESSING_MS = 1_000;
const MAX_PROCESSING_MS = 2_500;
const FALLBACK_FILE_NAME = 'untitled';

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_INTERNAL_ERROR = 500;

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function readHeader(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

// The client percent-encodes the name because header values must be ASCII.
function decodeFileName(encoded: string | null): string {
  if (encoded === null) {
    return FALLBACK_FILE_NAME;
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    return FALLBACK_FILE_NAME;
  }
}

function handleUpload(
  request: IncomingMessage,
  response: ServerResponse,
  registry: UploadRegistry,
): void {
  const idempotencyKey = readHeader(request, 'idempotency-key');
  if (idempotencyKey === null) {
    sendJson(response, HTTP_BAD_REQUEST, { error: 'Idempotency-Key header is required' });
    return;
  }
  const name = decodeFileName(readHeader(request, 'x-file-name'));
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const schedule = (callback: () => void, delayMs: number): void => {
    const timerId = setTimeout(() => {
      timers.delete(timerId);
      callback();
    }, delayMs);
    timers.add(timerId);
  };
  let receivedBytes = 0;

  request.on('data', (chunk: Buffer) => {
    receivedBytes += chunk.length;
    request.pause();
    schedule(() => request.resume(), chunk.length / READ_BYTES_PER_MS);
  });

  request.on('end', () => {
    const processingMs =
      MIN_PROCESSING_MS + Math.random() * (MAX_PROCESSING_MS - MIN_PROCESSING_MS);
    schedule(() => {
      const outcome = pickUploadOutcome(Math.random);
      if (outcome === 'fail-before-store') {
        sendJson(response, HTTP_INTERNAL_ERROR, { error: 'Simulated failure' });
        return;
      }
      const { record, isDuplicate } = registry.register(idempotencyKey, {
        name,
        size: receivedBytes,
      });
      if (outcome === 'fail-after-store') {
        sendJson(response, HTTP_INTERNAL_ERROR, { error: 'Simulated failure after storing' });
        return;
      }
      sendJson(response, isDuplicate ? HTTP_OK : HTTP_CREATED, {
        ...record,
        duplicate: isDuplicate,
      });
    }, processingMs);
  });

  // A cancelled upload closes the socket: stop reading and never store a half-received file.
  response.on('close', () => {
    for (const timerId of timers) {
      clearTimeout(timerId);
    }
    timers.clear();
  });
}

function createUploadMiddleware(registry: UploadRegistry): Connect.NextHandleFunction {
  return (request, response) => {
    // Connect strips the mount path, so anything but "/" is an unknown sub-path.
    const subPath = (request.url ?? '/').split('?')[0];
    if (subPath !== '/') {
      sendJson(response, HTTP_NOT_FOUND, { error: 'Not found' });
      return;
    }
    if (request.method === 'POST') {
      handleUpload(request, response, registry);
      return;
    }
    // Lists what the server holds, so a retry can be checked not to have stored a duplicate.
    if (request.method === 'GET') {
      sendJson(response, HTTP_OK, { files: registry.list() });
      return;
    }
    response.setHeader('Allow', 'GET, POST');
    sendJson(response, HTTP_METHOD_NOT_ALLOWED, { error: 'Method not allowed' });
  };
}

export function uploadApi(): Plugin {
  const middleware = createUploadMiddleware(createUploadRegistry());
  return {
    name: 'mock-upload-api',
    configureServer(server) {
      server.middlewares.use(UPLOAD_ROUTE, middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(UPLOAD_ROUTE, middleware);
    },
  };
}
