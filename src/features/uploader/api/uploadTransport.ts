export const UPLOAD_URL = '/api/upload';

const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

export type UploadedFile = Readonly<{ id: string; name: string; size: number; duplicate: boolean }>;

// Errors are values, not rejections: the queue switches on `kind` and a transport never throws.
export type UploadOutcome =
  | Readonly<{ kind: 'success'; file: UploadedFile }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{ kind: 'aborted' }>;

export type UploadRequest = Readonly<{
  file: File;
  idempotencyKey: string;
  signal: AbortSignal;
  /** Fraction of the body sent, from 0 to 1. */
  onProgress: (fraction: number) => void;
}>;

// The queue depends on this signature only, so tests inject a controllable fake.
export type UploadTransport = (request: UploadRequest) => Promise<UploadOutcome>;

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'duplicate' in value &&
    typeof value.duplicate === 'boolean'
  );
}

function parseUploadedFile(responseText: string): UploadedFile | null {
  try {
    const parsed: unknown = JSON.parse(responseText);
    return isUploadedFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// XMLHttpRequest rather than fetch: fetch still has no upload progress events in browsers,
// and per-file progress is a requirement. AbortSignal keeps the same cancel API as fetch.
export const xhrUploadTransport: UploadTransport = ({ file, idempotencyKey, signal, onProgress }) =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ kind: 'aborted' });
      return;
    }
    const xhr = new XMLHttpRequest();
    const handleAbortSignal = (): void => {
      xhr.abort();
    };
    const settle = (outcome: UploadOutcome): void => {
      signal.removeEventListener('abort', handleAbortSignal);
      resolve(outcome);
    };

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status < HTTP_SUCCESS_MIN || xhr.status > HTTP_SUCCESS_MAX) {
        settle({ kind: 'error', message: `Server responded ${xhr.status}` });
        return;
      }
      const uploaded = parseUploadedFile(xhr.responseText);
      settle(
        uploaded === null
          ? { kind: 'error', message: 'Unexpected server response' }
          : { kind: 'success', file: uploaded },
      );
    });
    xhr.addEventListener('error', () => {
      settle({ kind: 'error', message: 'Network error' });
    });
    xhr.addEventListener('abort', () => {
      settle({ kind: 'aborted' });
    });
    signal.addEventListener('abort', handleAbortSignal, { once: true });

    xhr.open('POST', UPLOAD_URL);
    xhr.setRequestHeader('Idempotency-Key', idempotencyKey);
    // Header values must be ASCII, so the name is percent-encoded and decoded by the server.
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type === '' ? 'application/octet-stream' : file.type);
    xhr.send(file);
  });
