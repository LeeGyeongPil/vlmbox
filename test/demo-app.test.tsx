// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../demo/src/App.js';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const maxError = () => screen.getByTestId('max-error').textContent;
const readAs = (value: string) => fireEvent.change(screen.getByLabelText('Read as'), { target: { value } });
const chooseExample = (value: string) => fireEvent.change(screen.getByLabelText('Example response'), { target: { value } });

describe('demo comparison (AC-8)', () => {
  it('shows the practice-example notice', () => {
    render(<App />);
    expect(screen.getByRole('note').textContent).toContain('Practice examples');
    expect(screen.getByRole('note').textContent).toContain('not live model output');
  });

  it('reading the Qwen2.5-VL example as qwen3-vl shows 894.7 px and a warning, switching back shows 0.0 px', () => {
    render(<App />);
    chooseExample('qwen2.5-vl');
    expect(maxError()).toBe('0.0 px');

    readAs('qwen3-vl');
    expect(screen.getByText('894.7 px')).toBeTruthy();
    const warnings = screen.getByTestId('warnings');
    expect(warnings.textContent).toContain('Warnings');
    expect(warnings.textContent).toContain('clamped');

    readAs('qwen2.5-vl');
    expect(screen.getByText('0.0 px')).toBeTruthy();
  });

  it('Gemini read x-first is off by 480.0 px and the frame mistake by 9.0 px', () => {
    render(<App />);
    chooseExample('gemini');
    expect(maxError()).toBe('0.0 px');
    readAs('x-first-1000');
    expect(maxError()).toBe('480.0 px');

    chooseExample('qwen2.5-vl');
    readAs('qwen2.5-vl-no-resize');
    expect(maxError()).toBe('9.0 px');
  });

  it('the correct Qwen2.5-VL reading explains where the frame came from', () => {
    render(<App />);
    expect(screen.getByTestId('warnings').textContent).toContain('1932×1092');
  });

  it('smart_resize panel shows both roundings for 1918x1078', () => {
    render(<App />);
    expect(screen.getByText('Python round (half-even): 1904×1064')).toBeTruthy();
    expect(screen.getByText('Math.round: 1932×1092')).toBeTruthy();
  });

  it('smart_resize panel reports an impossible size instead of crashing', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '20100' } });
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '100' } });
    expect(screen.getByText(/Cannot resize this size/)).toBeTruthy();
  });

  it('every example reads to 0.0 px with its own convention', () => {
    render(<App />);
    const select = screen.getByLabelText('Example response') as HTMLSelectElement;
    const ids = Array.from(select.options).map((o) => o.value);
    expect(ids.length).toBe(13);
    for (const id of ids) {
      chooseExample(id);
      const value = Number.parseFloat(maxError() ?? 'NaN');
      // florence-2 is within one bin (0.96 px); everything else is exact
      expect(value, id).toBeLessThanOrEqual(id === 'florence-2' ? 1 : 0.05);
    }
  });

  it('an edited response that has nothing to read shows the warning, not a crash', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Model response (editable)'), { target: { value: 'no objects here' } });
    expect(screen.getByTestId('warnings').textContent).toContain('No boxes or points were found');
    expect(screen.getByText('The result does not contain the expected items')).toBeTruthy();
  });

  it('shows Korean texts for the same flow', () => {
    window.localStorage.setItem('vlmbox.demo.lang', 'ko');
    render(<App />);
    fireEvent.change(screen.getByLabelText('다음 규약으로 읽기'), { target: { value: 'qwen3-vl' } });
    expect(screen.getByText('894.7 px')).toBeTruthy();
    expect(screen.getByTestId('warnings').textContent).toContain('이미지 안으로 잘랐습니다');
    expect(screen.getByText('Math.round: 1932×1092')).toBeTruthy();
  });
});
