import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UploadOutcome, UploadRequest, UploadTransport } from './api/uploadTransport';
import { saveQueue } from './model/persistence';
import { MAX_ATTEMPTS, MAX_CONCURRENT_UPLOADS, RETRY_DELAYS_MS } from './model/uploadQueue';
import { UploaderPage } from './UploaderPage';

type PendingUpload = Readonly<{
  request: UploadRequest;
  settle: (outcome: UploadOutcome) => void;
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
      uploads.push({ request, settle });
    });

  return {
    transport,
    uploads,
    getInFlight: () => inFlight,
    getMaxInFlight: () => maxInFlight,
  };
}

const SERVER_ERROR: UploadOutcome = { kind: 'error', message: 'Server responded 500' };
// Fake timers also advance with real time, so "not yet retried" is checked a little early.
const TIMER_MARGIN_MS = 100;

function createFiles(count: number): File[] {
  return Array.from({ length: count }, (_, index) => new File(['x'], `file-${index + 1}.txt`));
}

function nameOf(upload: PendingUpload | undefined): string | undefined {
  return upload?.request.file.name;
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
    expect(getMaxInFlight()).toBe(MAX_CONCURRENT_UPLOADS);
    expect(uploads.map(nameOf)).toEqual(files.map((file) => file.name));
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
      { id: 'a', name: 'report.pdf', size: 3, idempotencyKey: 'key-report', status: 'uploading' },
      { id: 'b', name: 'notes.txt', size: 1, idempotencyKey: 'key-notes', status: 'done' },
    ]);
    const user = userEvent.setup();
    const { transport, uploads } = createControllableTransport();
    render(<UploaderPage transport={transport} />);

    expect(screen.getByText('Needs re-select: add this file again to resume')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(uploads).toHaveLength(0);

    await user.upload(screen.getByLabelText('Choose files'), new File(['abc'], 'report.pdf'));

    await waitFor(() => {
      expect(uploads[0]?.request.idempotencyKey).toBe('key-report');
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
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
    expect(screen.getByRole('button', { name: 'Retry file-1.txt' })).toHaveFocus();
  });

  it('retries after 1s, 2s and 4s, then fails until retried manually', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const transport = vi.fn<UploadTransport>(() => Promise.resolve(SERVER_ERROR));
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(1));
    expect(await screen.findByText('Server responded 500. Retrying in 1 s')).toBeInTheDocument();

    for (const [retryIndex, delayMs] of RETRY_DELAYS_MS.entries()) {
      const attemptsSoFar = retryIndex + 1;
      await advanceTime(delayMs - TIMER_MARGIN_MS);
      expect(transport).toHaveBeenCalledTimes(attemptsSoFar);
      await advanceTime(TIMER_MARGIN_MS);
      expect(transport).toHaveBeenCalledTimes(attemptsSoFar + 1);
    }

    expect(
      await screen.findByText(`Failed after ${MAX_ATTEMPTS} attempts: Server responded 500`),
    ).toBeInTheDocument();
    await advanceTime(RETRY_DELAYS_MS.at(-1) ?? 0);
    expect(transport).toHaveBeenCalledTimes(MAX_ATTEMPTS);

    await user.click(screen.getByRole('button', { name: 'Retry file-1.txt' }));
    expect(transport).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1);
  });

  it('sends the same idempotency key on every retry of a file', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const transport = vi.fn<UploadTransport>(() => Promise.resolve(SERVER_ERROR));
    render(<UploaderPage transport={transport} />);

    await user.upload(screen.getByLabelText('Choose files'), createFiles(2));
    for (const delayMs of RETRY_DELAYS_MS) {
      await advanceTime(delayMs);
    }
    await screen.findAllByText(/^Failed after/);
    await user.click(screen.getByRole('button', { name: 'Retry file-1.txt' }));

    const keysByFile = new Map<string, Set<string>>();
    for (const [request] of transport.mock.calls) {
      const keys = keysByFile.get(request.file.name) ?? new Set();
      keysByFile.set(request.file.name, keys.add(request.idempotencyKey));
    }
    expect(transport).toHaveBeenCalledTimes(2 * MAX_ATTEMPTS + 1);
    expect([...keysByFile.values()].map((keys) => keys.size)).toEqual([1, 1]);
    expect(keysByFile.get('file-1.txt')).not.toEqual(keysByFile.get('file-2.txt'));
  });
});
