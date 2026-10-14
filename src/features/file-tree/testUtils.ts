import { afterEach, beforeEach, vi } from 'vitest';

/**
 * jsdom has no layout engine, so `Element.prototype.scrollIntoView` does not exist there. The tree
 * calls it to reveal the selected row; install a spy for each test in the calling file.
 */
export function stubScrollIntoView(): void {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });
}
