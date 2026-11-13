// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { example, TRUTH } from '../fixtures/index.js';
import { parseGrounding } from '../src/index.js';
import { GroundingOverlay } from '../src/react/index.js';

// jsdom does no layout: tell it the natural and rendered sizes ourselves.
let rendered = { width: 960, height: 960 };
let observerCallbacks: (() => void)[] = [];
let disconnects = 0;

class FakeResizeObserver {
  private cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
    observerCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    disconnects++;
    observerCallbacks = observerCallbacks.filter((c) => c !== this.cb);
  }
}

beforeEach(() => {
  rendered = { width: 960, height: 960 };
  observerCallbacks = [];
  disconnects = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1920);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1080);
  vi.spyOn(HTMLImageElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ ...rendered, x: 0, y: 0, top: 0, left: 0, right: rendered.width, bottom: rendered.height, toJSON: () => ({}) }) as DOMRect,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const result = parseGrounding(example('gemini').text, { model: 'gemini', image: TRUTH.image });
const num = (el: Element | null, attr: string) => Number(el?.getAttribute(attr));

describe('GroundingOverlay (AC-5)', () => {
  it('draws the cat rect at x=240 y=345 w=240 h=270 for contain in 960x960', () => {
    const { container } = render(<GroundingOverlay src="scene.svg" result={result} fit="contain" />);
    const rect = container.querySelector('rect[data-vlmbox-box="0"]');
    expect(num(rect, 'x')).toBeCloseTo(240, 2);
    expect(num(rect, 'y')).toBeCloseTo(345, 2);
    expect(num(rect, 'width')).toBeCloseTo(240, 2);
    expect(num(rect, 'height')).toBeCloseTo(270, 2);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 960 960');
  });

  it('shows labels and can hide them', () => {
    const { container, rerender } = render(<GroundingOverlay src="scene.svg" result={result} />);
    expect(container.querySelector('text[data-vlmbox-label="0"]')?.textContent).toBe('cat');
    expect(container.querySelector('text[data-vlmbox-label="1"]')?.textContent).toBe('cup');
    rerender(<GroundingOverlay src="scene.svg" result={result} showLabels={false} />);
    expect(container.querySelector('text')).toBeNull();
  });

  it('calls onBoxClick with the box and its index', () => {
    const onBoxClick = vi.fn();
    const { container } = render(<GroundingOverlay src="scene.svg" result={result} onBoxClick={onBoxClick} />);
    fireEvent.click(container.querySelector('rect[data-vlmbox-box="1"]') as Element);
    expect(onBoxClick).toHaveBeenCalledTimes(1);
    expect(onBoxClick.mock.calls[0]?.[0]).toMatchObject({ label: 'cup', x1: 960 });
    expect(onBoxClick.mock.calls[0]?.[1]).toBe(1);
  });

  it('draws points and reference boxes', () => {
    const withPoint = parseGrounding(example('moondream-points').text, { model: 'moondream', image: TRUTH.image, label: 'cat' });
    const { container } = render(
      <GroundingOverlay src="scene.svg" result={withPoint} referenceBoxes={TRUTH.boxes} />,
    );
    const c = container.querySelector('circle[data-vlmbox-point="0"]');
    expect(num(c, 'cx')).toBeCloseTo(360, 2);
    expect(num(c, 'cy')).toBeCloseTo(480, 2);
    expect(container.querySelectorAll('rect[data-vlmbox-reference]')).toHaveLength(2);
  });

  it('follows size changes through ResizeObserver', () => {
    const { container } = render(<GroundingOverlay src="scene.svg" result={result} />);
    expect(observerCallbacks).toHaveLength(1);
    rendered = { width: 1920, height: 1080 };
    act(() => observerCallbacks.forEach((cb) => cb()));
    const rect = container.querySelector('rect[data-vlmbox-box="0"]');
    expect(num(rect, 'x')).toBeCloseTo(480, 2);
    expect(num(rect, 'y')).toBeCloseTo(270, 2);
  });

  it('applies object-fit to the image and releases the observer on unmount', () => {
    const { container, unmount } = render(<GroundingOverlay src="scene.svg" result={result} fit="cover" />);
    expect(container.querySelector('img')?.style.objectFit).toBe('cover');
    unmount();
    expect(disconnects).toBe(1);
  });

  it('uses imageSize when the image has no natural size yet', () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(0);
    const { container } = render(<GroundingOverlay src="scene.svg" result={result} imageSize={TRUTH.image} />);
    expect(num(container.querySelector('rect[data-vlmbox-box="0"]'), 'y')).toBeCloseTo(345, 2);
  });

  it('draws nothing until the natural size is known', () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const { container } = render(<GroundingOverlay src="scene.svg" result={result} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
