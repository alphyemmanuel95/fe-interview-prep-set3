// Typed, versioned localStorage access. Everything read back is `unknown` until a guard narrows it,
// so corrupt, stale-shaped or tampered data falls back instead of crashing the app.

export type Guard<T> = (value: unknown) => value is T;

type Envelope = Readonly<{ version: number; data: unknown }>;

const isEnvelope = (value: unknown): value is Envelope =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'number' &&
  'data' in value;

export function loadFromStorage<T>(key: string, version: number, guard: Guard<T>, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.version !== version || !guard(parsed.data)) {
      return fallback;
    }
    return parsed.data;
  } catch {
    // Invalid JSON or storage unavailable (private mode, quota, disabled cookies).
    return fallback;
  }
}

export function saveToStorage(key: string, version: number, data: unknown): void {
  try {
    const envelope: Envelope = { version, data };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch (error: unknown) {
    // Persistence is best-effort; the in-memory state stays authoritative.
    console.warn(`Could not persist "${key}"`, error);
  }
}
