import { randomUUID } from 'node:crypto';

// Pure, framework-free core of the mock upload API so idempotency and failure injection can be
// unit-tested without starting a server.

export type StoredUpload = Readonly<{ id: string; name: string; size: number }>;

export type RegisterResult = Readonly<{ record: StoredUpload; isDuplicate: boolean }>;

export type UploadRegistry = Readonly<{
  register: (
    idempotencyKey: string,
    file: Readonly<{ name: string; size: number }>,
  ) => RegisterResult;
  list: () => readonly StoredUpload[];
}>;

// The client generates one key per file and reuses it for every retry, so a key that is already
// stored means "the server already has this file": return the existing record, never a second one.
export function createUploadRegistry(createId: () => string = randomUUID): UploadRegistry {
  const uploadsByKey = new Map<string, StoredUpload>();

  return {
    register(idempotencyKey, file) {
      const existing = uploadsByKey.get(idempotencyKey);
      if (existing !== undefined) {
        return { record: existing, isDuplicate: true };
      }
      const record: StoredUpload = { id: createId(), name: file.name, size: file.size };
      uploadsByKey.set(idempotencyKey, record);
      return { record, isDuplicate: false };
    },
    list() {
      return [...uploadsByKey.values()];
    },
  };
}

export const FAILURE_RATE = 0.25;

export type UploadOutcome = 'success' | 'fail-before-store' | 'fail-after-store';

// Half of the failures happen after the file was stored, i.e. the response is "lost". That is the
// case idempotency exists for: the client retries a request the server actually completed.
export function pickUploadOutcome(random: () => number): UploadOutcome {
  const roll = random();
  if (roll < FAILURE_RATE / 2) {
    return 'fail-before-store';
  }
  if (roll < FAILURE_RATE) {
    return 'fail-after-store';
  }
  return 'success';
}
