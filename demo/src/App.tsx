import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EXAMPLES, TRUTH, truthBoxes, type Example } from '../../fixtures/index.js';
import {
  parseGrounding,
  RESIZE_PRESETS,
  smartResize,
  VlmboxError,
  type Box,
  type GroundingResult,
  type GroundingWarning,
  type ParseOptions,
  type ResizePresetName,
  type Size,
} from '../../src/index.js';
import { GroundingOverlay } from '../../src/react/index.js';
import { initialFromSearch } from './query.js';
import { useLang, type Lang, type Translate } from './i18n.js';
import type { MessageKey } from './messages/en.js';

const READ_AS = [
  'gemini',
  'qwen2-vl',
  'qwen2.5-vl',
  'qwen3-vl',
  'paligemma',
  'florence-2',
  'moondream',
  'auto',
  'x-first-1000',
  'qwen2.5-vl-no-resize',
] as const;
type ReadAs = (typeof READ_AS)[number];

const FITS = ['contain', 'cover', 'fill'] as const;
const RULES: ResizePresetName[] = ['qwen2.5-vl', 'qwen2-vl-processor-default', 'qwen3-vl'];

/** Turn a "read as" menu value into parseGrounding options. */
function optionsFor(readAs: ReadAs, image: Size, label: string): ParseOptions {
  if (readAs === 'x-first-1000') return { model: { axis: 'xy', unit: 'normalized', scale: 1000 }, image, label };
  if (readAs === 'qwen2.5-vl-no-resize') return { model: 'qwen2.5-vl', image, frame: image, label };
  return { model: readAs, image, label };
}

type Outcome = { result: GroundingResult } | { error: string };

/** Largest coordinate difference to the ground truth in pixels, or null when items are missing. */
function maxError(result: GroundingResult, example: Example): number | null {
  const wantBoxes = truthBoxes(example);
  const wantPoints = example.expect === 'points' ? TRUTH.points : [];
  let max = 0;
  for (const want of wantBoxes) {
    const got = result.boxes.find((b: Box) => b.label === want.label);
    if (!got) return null;
    for (const k of ['x1', 'y1', 'x2', 'y2'] as const) max = Math.max(max, Math.abs(got[k] - want[k]));
  }
  for (const want of wantPoints) {
    const got = result.points[0];
    if (!got) return null;
    max = Math.max(max, Math.abs(got.x - want.x), Math.abs(got.y - want.y));
  }
  return max;
}

/** Fill the demo's own translation for a library warning (the library message is English-only). */
function warningText(w: GroundingWarning, t: Translate): string {
  const d = (w.detail ?? {}) as Record<string, unknown>;
  const frame = (d.frame ?? {}) as Partial<Size>;
  switch (w.code) {
    case 'guessed-convention':
      return t('warn.guessed-convention', {
        guess: String(d.guess ?? ''),
        confidence: t(d.confidence === 'high' ? 'confidence.high' : 'confidence.low'),
      });
    case 'frame-from-preset':
      return t('warn.frame-from-preset', { w: frame.width ?? 0, h: frame.height ?? 0 });
    case 'clamped':
    case 'swapped-corners':
      return t(`warn.${w.code}` as MessageKey, { label: String(d.label ?? '') });
    case 'skipped-item':
      return t('warn.skipped-item', { index: Number(d.index ?? 0) + 1 });
    default:
      return t(`warn.${w.code}` as MessageKey);
  }
}

export function App() {
  const { lang, setLang, t } = useLang();
  // Initial state may come from the address: ?example=<id>&readAs=<value>&fit=<value>
  const [initial] = useState(() =>
    initialFromSearch(
      window.location.search,
      { examples: EXAMPLES.map((e) => e.id), readAs: READ_AS, fits: FITS },
      'qwen2.5-vl',
    ),
  );
  const [exampleId, setExampleId] = useState(initial.exampleId);
  const example = EXAMPLES.find((e) => e.id === exampleId) ?? EXAMPLES[0]!;
  const [readAs, setReadAs] = useState<ReadAs>((initial.readAs as ReadAs | undefined) ?? example.model);
  const [text, setText] = useState(example.text);
  const [fit, setFit] = useState<(typeof FITS)[number]>((initial.fit as (typeof FITS)[number] | undefined) ?? 'contain');
  const [own, setOwn] = useState<{ url: string; size: Size } | null>(null);
  const [imageError, setImageError] = useState(false);

  const image: Size = own ? own.size : TRUTH.image;
  const src = own ? own.url : `${import.meta.env.BASE_URL}sample-scene.svg`;

  const outcome = useMemo<Outcome>(() => {
    try {
      const label = !own && example.model === 'moondream' ? 'cat' : '';
      return { result: parseGrounding(text, optionsFor(readAs, image, label)) };
    } catch (e) {
      if (e instanceof VlmboxError) return { error: e.message };
      throw e;
    }
  }, [text, readAs, image, own, example.model]);

  // Release the object URL of an uploaded image when it is replaced or the page closes.
  useEffect(() => () => (own ? URL.revokeObjectURL(own.url) : undefined), [own]);

  function chooseExample(id: string) {
    const next = EXAMPLES.find((e) => e.id === id);
    if (!next) return;
    setExampleId(id);
    setReadAs(next.model);
    setText(next.text);
  }

  function onUpload(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setImageError(false);
      setOwn({ url, size: { width: probe.naturalWidth, height: probe.naturalHeight } });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setImageError(true);
    };
    probe.src = url;
  }

  const result = 'result' in outcome ? outcome.result : null;
  const err = result && !own ? maxError(result, example) : null;

  return (
    <main className="page">
      <header className="top">
        <div>
          <h1>{t('page.title')}</h1>
          <p className="muted">{t('page.subtitle')}</p>
        </div>
        <label className="lang">
          {t('lang.label')}
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="en">{t('lang.en')}</option>
            <option value="ko">{t('lang.ko')}</option>
          </select>
        </label>
      </header>

      <p className="notice" role="note">
        {t('notice.practice')}
      </p>

      <section className="controls">
        <label>
          {t('controls.example')}
          <select value={exampleId} onChange={(e) => chooseExample(e.target.value)}>
            {EXAMPLES.map((e) => (
              <option key={e.id} value={e.id}>
                {t(`example.${e.id}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('controls.readAs')}
          <select value={readAs} onChange={(e) => setReadAs(e.target.value as ReadAs)}>
            {READ_AS.map((r) => (
              <option key={r} value={r}>
                {t(`readAs.${r}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('controls.fit')}
          <select value={fit} onChange={(e) => setFit(e.target.value as (typeof FITS)[number])}>
            {FITS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="columns">
        <section>
          <GroundingOverlay
            className="stage"
            src={src}
            alt={t('stage.alt')}
            fit={fit}
            imageSize={image}
            result={result ?? { boxes: [], points: [], warnings: [], convention: { id: 'custom', axis: 'xy', unit: '', frame: image, guessed: false } }}
            referenceBoxes={own ? [] : truthBoxes(example)}
          />
          <p className="legend muted">
            <span className="swatch parsed" /> {t('stage.legendParsed')} <span className="swatch truth" /> {t('stage.legendTruth')}
          </p>
          <p className="muted">{t('controls.imageSize', { w: image.width, h: image.height })}</p>
          <div className="upload">
            <label>
              {t('controls.upload')}
              <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
            </label>
            {own && (
              <button type="button" onClick={() => setOwn(null)}>
                {t('controls.resetImage')}
              </button>
            )}
            <p className="muted">{t('controls.uploadHint')}</p>
            {imageError && <p className="error">{t('controls.imageError')}</p>}
          </div>
        </section>

        <section>
          <label className="block">
            {t('controls.response')}
            <textarea
              value={text}
              rows={9}
              spellCheck={false}
              placeholder={t('controls.responsePlaceholder')}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <h2>{t('result.title')}</h2>
          {'error' in outcome ? (
            <p className="error">{t('result.error', { message: outcome.error })}</p>
          ) : (
            <>
              <p className="max-error">
                {t('result.maxError')}:{' '}
                {own ? (
                  <span className="muted">{t('result.noTruth')}</span>
                ) : err === null ? (
                  <span className="error">{t('result.noMatch')}</span>
                ) : (
                  <strong data-testid="max-error">{`${err.toFixed(1)} px`}</strong>
                )}
              </p>
              <p className="muted">
                {t('result.convention', {
                  id: outcome.result.convention.id,
                  axis: outcome.result.convention.axis,
                  unit: outcome.result.convention.unit,
                  w: outcome.result.convention.frame.width,
                  h: outcome.result.convention.frame.height,
                })}
              </p>
              <ResultTables result={outcome.result} t={t} />
              <div className="warnings" data-testid="warnings">
                <h3>{t('warnings.title')}</h3>
                {outcome.result.warnings.length === 0 ? (
                  <p className="muted">{t('warnings.none')}</p>
                ) : (
                  <ul>
                    {outcome.result.warnings.map((w, i) => (
                      <li key={i} title={w.message}>
                        {warningText(w, t)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <SmartResizePanel t={t} />
    </main>
  );
}

function ResultTables({ result, t }: { result: GroundingResult; t: Translate }) {
  const f = (n: number) => n.toFixed(1);
  return (
    <>
      {result.boxes.length > 0 && (
        <table>
          <caption>{t('result.boxes')}</caption>
          <thead>
            <tr>
              {(['label', 'x1', 'y1', 'x2', 'y2'] as const).map((c) => (
                <th key={c}>{t(`result.col.${c}` as MessageKey)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.boxes.map((b, i) => (
              <tr key={i}>
                <td>{b.label}</td>
                <td>{f(b.x1)}</td>
                <td>{f(b.y1)}</td>
                <td>{f(b.x2)}</td>
                <td>{f(b.y2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.points.length > 0 && (
        <table>
          <caption>{t('result.points')}</caption>
          <thead>
            <tr>
              {(['label', 'x', 'y'] as const).map((c) => (
                <th key={c}>{t(`result.col.${c}` as MessageKey)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.points.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                <td>{f(p.x)}</td>
                <td>{f(p.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.boxes.length === 0 && result.points.length === 0 && <p className="muted">{t('result.none')}</p>}
    </>
  );
}

/** Shows the same smart_resize with Python's rounding and with Math.round. */
function SmartResizePanel({ t }: { t: Translate }) {
  const [width, setWidth] = useState(1918);
  const [height, setHeight] = useState(1078);
  const [rule, setRule] = useState<ResizePresetName>('qwen2.5-vl');

  let body: ReactNode;
  try {
    const size = { width, height };
    const python = smartResize(size, rule);
    const mathRound = smartResize(size, { ...RESIZE_PRESETS[rule], rounding: 'half-up' });
    body = (
      <ul>
        <li data-testid="smart-python">{`${t('smart.python')}: ${python.width}×${python.height}`}</li>
        <li data-testid="smart-mathround">{`${t('smart.mathRound')}: ${mathRound.width}×${mathRound.height}`}</li>
      </ul>
    );
  } catch (e) {
    body = <p className="error">{t('smart.error', { message: e instanceof VlmboxError ? e.message : String(e) })}</p>;
  }

  return (
    <section className="smart">
      <h2>{t('smart.title')}</h2>
      <p className="muted">{t('smart.description')}</p>
      <div className="controls">
        <label>
          {t('smart.width')}
          <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <label>
          {t('smart.height')}
          <input type="number" min={1} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
        </label>
        <label>
          {t('smart.rule')}
          <select value={rule} onChange={(e) => setRule(e.target.value as ResizePresetName)}>
            {RULES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      {body}
    </section>
  );
}
