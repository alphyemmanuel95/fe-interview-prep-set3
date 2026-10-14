import { Activity, StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UploadOutcome, UploadRequest, UploadTransport } from './api/uploadTransport';
import { ACTION_SWAP_GUARD_MS } from './hooks/useActionSwapGuard';
import { saveQueue } from './model/persistence';
import { MAX_ATTEMPTS, MAX_CONCURRENT_UPLOADS, RETRY_DELAYS_MS } from './model/uploadQueue';
import { UploaderPage } from './UploaderPage';

type PendingUpload = Readonly<{
  request: UploadRequest;
  settle: (outcome: UploadOutcome) => void;
  isSettled: () => boolean;
}>;

// A transport the test resolves by hand, counting how many uploads are in flight at once.
function createControllableTransport() {
  const uploads: PendingUpload[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const transport: UploadTransport = (request) =>
    new Promise((resolve) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      let isSettled = false;
      const settle = (outcome: UploadOutcome): void => {
        if (!isSettled) {
          isSettled = true;
          inFlight -= 1;
          resolve(outcome);
        }
      };
      request.signal.addEventListener('abort', () => {
        settle({ kind: 'aborted' });
      });
      uploads.push({ request, settle, isSettled: () => isSettled });
    });

  return {
    transport,
    uploads,
    getInFlight: () => inFlight,
    getMaxInFlight: () => maxInFlight,
  };
}

const LAST_MODIFIED = 1_700_000_000_000;
const SERVER_ERROR: UploadOutcome = { kind: 'error', message: 'Server responded 500' };

function createFiles(count: number): File[] {
  return Array.from({ length: count }, (_, index) => new File(['x'], `file-${index + 1}.txt`));
}

function nameOf(upload: PendingUpload | undefined): string | undefined {
  return upload?.request.file.name;
}

// Testing Library drains its async wrapper with setTimeout(0) and only advances fake timers when it
// detects Jest. Exposing Vitest's clock under that name lets userEvent and act run on plain fake
// timers, so every backoff boundary is exact instead of racing real time.
function enableDeterministicTimers(): void {
  vi.useFakeTimers();
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
}

async function advanceTime(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('UploaderPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`never runs more than ${MAX_CONCURRENT_UPLOADS} of 7 uploads at once`, async () => {
    const user = userEvent.setup();
    const { transport, uploads, getInFlight, getMaxInFlight } = createControllableTransport();
    const files = createFiles(7);
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), files);

    await waitFor(() => {
      expect(uploads).toHaveLength(MAX_CONCURRENT_UPLOADS);
    });
    expect(screen.getByText('3 uploading, 4 queued.')).toBeInTheDocument();

    // Finish uploads one at a time: each completion frees exactly one slot for the next file.
    for (const [index, file] of files.entries()) {
      act(() => {
        uploads[index]?.settle({
          kind: 'success',
          file: { id: `id-${index}`, name: file.name, size: file.size, duplicate: false },
        });
      });
      const expectedStarted = Math.min(files.length, index + 1 + MAX_CONCURRENT_UPLOADS);
      await waitFor(() => {
        expect(uploads).toHaveLength(expectedStarted);
      });
      expect(getInFlight()).toBeLessThanOrEqual(MAX_CONCURRENT_UPLOADS);
    }

    expect(await screen.findByText('7 done.')).toBeInTheDocument();
    expect(screen.getByText('All uploads finished: 7 uploaded.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(getMaxInFlight()).toBe(MAX_CONCURRENT_UPLOADS);
    expect(uploads.map(nameOf)).toEqual(files.map((file) => file.name));
  });

  it(`stays within ${MAX_CONCURRENT_UPLOADS} uploads through failures, retries and cancels in StrictMode`, async () => {
    enableDeterministicTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { transport, uploads, getInFlight, getMaxInFlight } = createControllableTransport();
    const pending = (): PendingUpload[] => uploads.filter((upload) => !upload.isSettled());
    const expectWithinLimit = (): void => {
      expect(getInFlight()).toBeLessThanOrEqual(MAX_CONCURRENT_UPLOADS);
    };
    render(
      <StrictMode>
        <UploaderPage transport={transport} />
      </StrictMode>,
    );

    await user.upload(screen.getByLabelText('Choose files'), createFiles(7));
    await advanceTime(0);
    expect(uploads.map(nameOf)).toEqual(['file-1.txt', 'file-2.txt', 'file-3.txt']);

    // A failure frees its slot while the item waits out its backoff.
    act(() => {
      uploads[0]?.settle(SERVER_ERROR);
    });
    await advanceTime(0);
    expectWithinLimit();
    expect(nameOf(uploads[3])).toBe('file-4.txt');

    // Cancelling an in-flight upload frees its slot too.
    await user.click(screen.getByRole('button', { name: 'Cancel file-2.txt' }));
    await advanceTime(0);
    expectWithinLimit();
    expect(nameOf(uploads[4])).toBe('file-5.txt');

    // The retry comes due while all slots are busy: it re-queues instead of starting a 4th.
    await advanceTime(RETRY_DELAYS_MS[0]);
    expectWithinLimit();
    expect(uploads).toHaveLength(5);

    // A manual retry also has to wait for a slot.
    await user.click(screen.getByRole('button', { name: 'Retry file-2.txt' }));
    await advanceTime(0);
    expectWithinLimit();
    expect(uploads).toHaveLength(5);

    // Drain: complete whatever is in flight until nothing is left.
    for (let upload = pending()[0]; upload !== undefined; upload = pending()[0]) {
      const { name, size } = upload.request.file;
      act(() => {
        upload.settle({ kind: 'success', file: { id: name, name, size, duplicate: false } });
      });
      await advanceTime(0);
      expectWithinLimit();
    }

    expect(screen.getByText('7 done.')).toBeInTheDocument();
    expect(getMaxInFlight()).toBe(MAX_CONCURRENT_UPLOADS);
  });

  it('queues files dropped on the drop zone', async () => {
    const { transport, uploads } = createControllableTransport();
    render(<UploaderPage transport={transport} />);
    const zone = screen.getByText('Drag and drop files here, or').parentElement;
    // userEvent has no drag-and-drop API and jsdom has no DataTransfer, so dispatch it natively.
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: createFiles(2) } });

    act(() => {
      zone?.dispatchEvent(drop);
    });

    expect(drop.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(uploads.map(nameOf)).toEqual(['file-1.txt', 'file-2.txt']);
    });
  });

  it('restores the queue after a reload and resumes a re-selected file with its key', async () => {
    saveQueue([
      {
        id: 'a',
        name: 'report.pdf',
        size: 3,
        lastModified: LAST_MODIFIED,
        idempotencyKey: 'key-report',
        status: 'uploading',
      },
      {
        id: 'b',
        name: 'notes.txt',
        size: 1,
        lastModified: LAST_MODIFIED,
        idempotencyKey: 'key-notes',
        status: 'done',
      },
    ]);
    const user = userEvent.setup();
    const { transport, uploads } = createControllableTransport();
    render(<UploaderPage transport={transport} />);

    expect(screen.getByText('Needs re-select: add this file again to resume')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(uploads).toHaveLength(0);

    // Same name and size but edited since: a different file, so it must not reuse the old key.
    const edited = new File(['xyz'], 'report.pdf', { lastModified: LAST_MODIFIED + 1 });
    await user.upload(screen.getByLabelText('Choose files'), edited);
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]?.request.idempotencyKey).not.toBe('key-report');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    const original = new File(['abc'], 'report.pdf', { lastModified: LAST_MODIFIED });
    await user.upload(screen.getByLabelText('Choose files'), original);
    await waitFor(() => {
      expect(uploads[1]?.request.idempotencyKey).toBe('key-report');
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('warns before closing the tab only while uploads are running', async () => {
    const user = userEvent.setup();
    const { transport, uploads } = createControllableTransport();
    const isUnloadPrevented = (): boolean => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    render(<UploaderPage transport={transport} />);
    expect(isUnloadPrevented()).toBe(false);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(1));
    expect(isUnloadPrevented()).toBe(true);

    const stored = { id: 'f1', name: 'file-1.txt', size: 1, duplicate: false };
    act(() => {
      uploads[0]?.settle({ kind: 'success', file: stored });
    });
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(isUnloadPrevented()).toBe(false);
  });

  it('aborts the request on cancel and gives its slot to the next file', async () => {
    const user = userEvent.setup();
    const { transport, uploads, getInFlight } = createControllableTransport();
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(4));
    await waitFor(() => {
      expect(uploads).toHaveLength(3);
    });
    const firstUpload = uploads[0];
    await user.click(screen.getByRole('button', { name: 'Cancel file-1.txt' }));

    expect(firstUpload?.request.signal.aborted).toBe(true);
    await waitFor(() => {
      expect(nameOf(uploads[3])).toBe('file-4.txt');
    });
    expect(getInFlight()).toBe(3);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    // Cancel turned into Retry on the same element, so keyboard focus is kept.
    const retryButton = screen.getByRole('button', { name: 'Retry file-1.txt' });
    expect(retryButton).toHaveFocus();

    // The second half of a double-click lands on Retry right after the swap and is ignored.
    await user.click(retryButton);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(uploads).toHaveLength(4);
  });

  it('moves focus to the neighbouring row after removing one', async () => {
    saveQueue(
      ['a.txt', 'b.txt', 'c.txt'].map((name) => ({
        id: name,
        name,
        size: 1,
        lastModified: LAST_MODIFIED,
        idempotencyKey: `key-${name}`,
        status: 'done' as const,
      })),
    );
    const user = userEvent.setup();
    render(<UploaderPage transport={createControllableTransport().transport} />);

    await user.click(screen.getByRole('button', { name: 'Remove b.txt' }));
    expect(screen.getByRole('button', { name: 'Remove c.txt' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove c.txt' }));
    expect(screen.getByRole('button', { name: 'Remove a.txt' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove a.txt' }));
    expect(screen.getByLabelText('Choose files')).toHaveFocus();
  });

  it('keeps focus in the row when an upload finishes on its own', async () => {
    const user = userEvent.setup();
    const { transport, uploads } = createControllableTransport();
    render(<UploaderPage transport={transport} />);
    await user.upload(screen.getByLabelText('Choose files'), createFiles(1));
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    screen.getByRole('button', { name: 'Cancel file-1.txt' }).focus();

    act(() => {
      uploads[0]?.settle({
        kind: 'success',
        file: { id: 'f1', name: 'file-1.txt', size: 1, duplicate: false },
      });
    });

    expect(await screen.findByRole('button', { name: 'Remove file-1.txt' })).toHaveFocus();
  });

  it('retries after 1s, 2s and 4s, then fails until retried manually', async () => {
    enableDeterministicTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const transport = vi.fn<UploadTransport>(() => Promise.resolve(SERVER_ERROR));
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(1));
    await advanceTime(0);

    for (const [retryIndex, delayMs] of RETRY_DELAYS_MS.entries()) {
      const attemptsSoFar = retryIndex + 1;
      const failedAttempt = `Attempt ${attemptsSoFar} of ${MAX_ATTEMPTS} failed (Server responded 500)`;
      expect(
        screen.getByText(`${failedAttempt}. Retrying in ${delayMs / 1_000} s`),
      ).toBeInTheDocument();
      await advanceTime(delayMs - 1);
      // The countdown ticks down in the row while the retry is pending.
      expect(screen.getByText(`${failedAttempt}. Retrying in 1 s`)).toBeInTheDocument();
      expect(transport).toHaveBeenCalledTimes(attemptsSoFar);
      await advanceTime(1);
      expect(transport).toHaveBeenCalledTimes(attemptsSoFar + 1);
    }

    expect(
      screen.getByText(`Failed after ${MAX_ATTEMPTS} attempts: Server responded 500`),
    ).toBeInTheDocument();
    await advanceTime(RETRY_DELAYS_MS.at(-1) ?? 0);
    expect(transport).toHaveBeenCalledTimes(MAX_ATTEMPTS);

    await user.click(screen.getByRole('button', { name: 'Retry file-1.txt' }));
    await advanceTime(0);
    expect(transport).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1);
  });

  it('sends the same idempotency key on every retry of a file', async () => {
    enableDeterministicTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const transport = vi.fn<UploadTransport>(() => Promise.resolve(SERVER_ERROR));
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(2));
    await advanceTime(0);
    for (const delayMs of RETRY_DELAYS_MS) {
      await advanceTime(delayMs);
    }
    expect(screen.getAllByText(/^Failed after/)).toHaveLength(2);
    await advanceTime(ACTION_SWAP_GUARD_MS);
    await user.click(screen.getByRole('button', { name: 'Retry file-1.txt' }));
    await advanceTime(0);

    const keysByFile = new Map<string, Set<string>>();
    for (const [request] of transport.mock.calls) {
      const keys = keysByFile.get(request.file.name) ?? new Set();
      keysByFile.set(request.file.name, keys.add(request.idempotencyKey));
    }
    expect(transport).toHaveBeenCalledTimes(2 * MAX_ATTEMPTS + 1);
    expect([...keysByFile.values()].map((keys) => keys.size)).toEqual([1, 1]);
    expect(keysByFile.get('file-1.txt')).not.toEqual(keysByFile.get('file-2.txt'));
  });

  it('treats an abort it did not request as a failed attempt', async () => {
    enableDeterministicTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const transport = vi.fn<UploadTransport>(() => Promise.resolve({ kind: 'aborted' }));
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(1));
    await advanceTime(0);

    expect(
      screen.getByText(
        `Attempt 1 of ${MAX_ATTEMPTS} failed (Upload was interrupted). Retrying in 1 s`,
      ),
    ).toBeInTheDocument();
  });

  it('clears the backoff timer when a retrying upload is cancelled', async () => {
    enableDeterministicTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const transport = vi.fn<UploadTransport>(() => Promise.resolve(SERVER_ERROR));
    render(<UploaderPage transport={transport} />);
    await user.upload(screen.getByLabelText('Choose files'), createFiles(1));
    await advanceTime(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Cancel file-1.txt' }));
    await advanceTime(Math.max(...RETRY_DELAYS_MS));

    expect(transport).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts interrupted uploads when its effects reconnect', async () => {
    const user = userEvent.setup();
    const { transport, uploads, getInFlight } = createControllableTransport();
    const { rerender } = render(
      <Activity mode="visible">
        <UploaderPage transport={transport} />
      </Activity>,
    );
    await user.upload(screen.getByLabelText('Choose files'), createFiles(2));
    await waitFor(() => {
      expect(uploads).toHaveLength(2);
    });

    rerender(
      <Activity mode="hidden">
        <UploaderPage transport={transport} />
      </Activity>,
    );
    expect(uploads.every((upload) => upload.request.signal.aborted)).toBe(true);
    rerender(
      <Activity mode="visible">
        <UploaderPage transport={transport} />
      </Activity>,
    );

    await waitFor(() => {
      expect(uploads).toHaveLength(4);
    });
    expect(getInFlight()).toBe(2);
  });

  it('aborts requests and clears timers on unmount', async () => {
    enableDeterministicTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { transport, uploads } = createControllableTransport();
    const { unmount } = render(<UploaderPage transport={transport} />);
    await user.upload(screen.getByLabelText('Choose files'), createFiles(2));
    await advanceTime(0);
    act(() => {
      uploads[0]?.settle(SERVER_ERROR);
    });
    await advanceTime(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    await advanceTime(Math.max(...RETRY_DELAYS_MS));

    expect(uploads[1]?.request.signal.aborted).toBe(true);
    expect(uploads).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
