import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { toDisplay } from '../display.js';
import type { Box, FitMode, GroundingResult, Size } from '../types.js';

export type GroundingOverlayProps = {
  /** Image URL. */
  src: string;
  /** Result of parseGrounding (coordinates in original-image pixels). */
  result: GroundingResult;
  alt?: string;
  /** Same values as CSS object-fit (default "contain"). Do not put a border on the wrapper image. */
  fit?: FitMode;
  showLabels?: boolean;
  showPoints?: boolean;
  /** Stroke colors, cycled by box index. */
  colors?: string[];
  className?: string;
  style?: CSSProperties;
  onBoxClick?: (box: Box, index: number) => void;
  /** Extra boxes drawn as dashed outlines (for example ground truth), in original-image pixels. */
  referenceBoxes?: Box[];
  /** Natural image size if known up front; otherwise it is read from the loaded image. */
  imageSize?: Size;
};

const DEFAULT_COLORS = ['#e4572e', '#2e86ab', '#4caf50', '#f2a900', '#8e44ad'];

function sameSize(a: Size | null, b: Size): boolean {
  return a !== null && a.width === b.width && a.height === b.height;
}

/**
 * Draws boxes and points over an image. An SVG layer sized in CSS pixels follows the rendered
 * image through a ResizeObserver, so it stays aligned under any object-fit and any layout size
 * (CSS pixels are independent of devicePixelRatio).
 */
export function GroundingOverlay(props: GroundingOverlayProps) {
  const {
    src,
    result,
    alt = '',
    fit = 'contain',
    showLabels = true,
    showPoints = true,
    colors = DEFAULT_COLORS,
    className,
    style,
    onBoxClick,
    referenceBoxes,
    imageSize,
  } = props;
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [rendered, setRendered] = useState<Size | null>(null);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const next = { width: rect.width, height: rect.height };
    setRendered((prev) => (sameSize(prev, next) ? prev : next));
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const nat = { width: img.naturalWidth, height: img.naturalHeight };
      setNatural((prev) => (sameSize(prev, nat) ? prev : nat));
    }
  }, []);

  useEffect(() => {
    measure();
    const img = imgRef.current;
    if (!img) return undefined;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(img);
    img.addEventListener('load', measure);
    return () => {
      observer?.disconnect();
      img.removeEventListener('load', measure);
    };
  }, [measure, src]);

  const base = imageSize ?? natural;
  const ready = base !== null && rendered !== null && rendered.width > 0 && rendered.height > 0;
  const color = (i: number) => colors[i % colors.length] ?? DEFAULT_COLORS[0];

  return (
    <div className={className} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={measure}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: fit }}
      />
      {ready && (
        <svg
          width={rendered.width}
          height={rendered.height}
          viewBox={`0 0 ${rendered.width} ${rendered.height}`}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
          role="img"
          aria-label={alt || 'grounding overlay'}
        >
          {(referenceBoxes ?? []).map((ref, i) => {
            const b = toDisplay(ref, base, rendered, fit);
            return (
              <rect
                key={`ref-${i}`}
                data-vlmbox-reference={i}
                x={b.x1}
                y={b.y1}
                width={b.x2 - b.x1}
                height={b.y2 - b.y1}
                fill="none"
                stroke="#222"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            );
          })}
          {result.boxes.map((box, i) => {
            const b = toDisplay(box, base, rendered, fit);
            return (
              <g key={`box-${i}`}>
                <rect
                  data-vlmbox-box={i}
                  x={b.x1}
                  y={b.y1}
                  width={b.x2 - b.x1}
                  height={b.y2 - b.y1}
                  fill="transparent"
                  stroke={color(i)}
                  strokeWidth={2}
                  style={{ pointerEvents: onBoxClick ? 'all' : 'none', cursor: onBoxClick ? 'pointer' : undefined }}
                  onClick={onBoxClick ? () => onBoxClick(box, i) : undefined}
                />
                {showLabels && box.label !== '' && (
                  <text
                    data-vlmbox-label={i}
                    x={b.x1 + 4}
                    y={b.y1 + 16}
                    fill={color(i)}
                    fontSize={14}
                    fontFamily="system-ui, sans-serif"
                    stroke="#fff"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {box.label}
                  </text>
                )}
              </g>
            );
          })}
          {showPoints &&
            result.points.map((point, i) => {
              const p = toDisplay(point, base, rendered, fit);
              return (
                <circle key={`pt-${i}`} data-vlmbox-point={i} cx={p.x} cy={p.y} r={5} fill={color(i)} stroke="#fff" strokeWidth={2} />
              );
            })}
        </svg>
      )}
    </div>
  );
}
