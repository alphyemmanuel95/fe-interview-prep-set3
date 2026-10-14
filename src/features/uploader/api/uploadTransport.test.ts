import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UPLOAD_URL, xhrUploadTransport } from './uploadTransport';

const createdRequests: FakeXhr[] = [];

class FakeXhr extends EventTarget {
  readonly upload = new EventTarget();
  readonly headers = new Map<string, string>();
  method = '';
  url = '';
  body: unknown = null;
  status = 0;
  responseText = '';
  isAborted = false;

  constructor() {
    super();
    createdRequests.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  send(body: unknown): void {
    this.body = body;
  }

  abort(): void {
    this.isAborted = true;
    this.dispatchEvent(new Event('abort'));
  }

  respond(status: number, body: unknown): void {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.dispatchEvent(new Event('load'));
  }
}

function lastRequest(): FakeXhr {
  const request = createdRequests.at(-1);
  if (request === undefined) {
    throw new Error('No request was sent');
  }
  return request;
}

const file = new File(['hello'], 'résumé 1.pdf', { type: 'application/pdf' });

describe('xhrUploadTransport', () => {
  beforeEach(() => {
    createdRequests.length = 0;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });

  it('posts the file with its idempotency key and resolves with the stored file', async () => {
    const outcome = xhrUploadTransport({
      file,
      idempotencyKey: 'key-1',
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });
    const request = lastRequest();
    const stored = { id: 'f1', name: file.name, size: 5, duplicate: false };
    request.respond(201, stored);

    await expect(outcome).resolves.toEqual({ kind: 'success', file: stored });
    expect(request.method).toBe('POST');
    expect(request.url).toBe(UPLOAD_URL);
    expect(request.body).toBe(file);
    expect(request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.headers.get('X-File-Name')).toBe(encodeURIComponent(file.name));
  });

  it('reports upload progress as a fraction', () => {
    const onProgress = vi.fn();
    void xhrUploadTransport({
      file,
      idempotencyKey: 'key-1',
      signal: new AbortController().signal,
      onProgress,
    });

    lastRequest().upload.dispatchEvent(
      new ProgressEvent('progress', { lengthComputable: true, loaded: 25, total: 100 }),
    );

    expect(onProgress).toHaveBeenCalledWith(0.25);
  });

  it('resolves with an error for a failed or malformed response', async () => {
    const request = { file, idempotencyKey: 'key-1', onProgress: vi.fn() };

    const serverError = xhrUploadTransport({ ...request, signal: new AbortController().signal });
    lastRequest().respond(500, { error: 'boom' });
    const malformed = xhrUploadTransport({ ...request, signal: new AbortController().signal });
    lastRequest().respond(200, { unexpected: true });

    await expect(serverError).resolves.toEqual({ kind: 'error', message: 'Server responded 500' });
    await expect(malformed).resolves.toEqual({
      kind: 'error',
      message: 'Unexpected server response',
    });
  });

  it('aborts the underlying request when the signal is aborted', async () => {
    const controller = new AbortController();
    const outcome = xhrUploadTransport({
      file,
      idempotencyKey: 'key-1',
      signal: controller.signal,
      onProgress: vi.fn(),
    });

    controller.abort();

    await expect(outcome).resolves.toEqual({ kind: 'aborted' });
    expect(lastRequest().isAborted).toBe(true);
  });
});
