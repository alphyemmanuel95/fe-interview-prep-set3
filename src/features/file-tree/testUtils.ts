import { afterEach, beforeEach, vi, type Mock } from 'vitest';

/**
 * jsdom has no layout engine, so `Element.prototype.scrollIntoView` does not exist there. The tree
 * calls it to reveal the selected row. Installs a fresh spy per test; returns a getter for it.
 */
export function stubScrollIntoView(): () => Mock {
  let spy = vi.fn();

  beforeEach(() => {
    spy = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: spy,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  return () => spy;
}
