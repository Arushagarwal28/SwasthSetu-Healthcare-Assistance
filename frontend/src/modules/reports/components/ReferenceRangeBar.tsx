interface Props {
  value: number | null;
  low: number | null;
  high: number | null;
  unit: string | null;
  /** Sentence describing the value in words, e.g. "above the printed range". */
  caption: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Where the result sits inside the range printed on the report.
 *
 * This is deliberately only drawn when the report itself printed a numeric
 * interval and the value is numeric: no range is invented, and no chart is
 * shown for qualitative or unreadable results.
 */
export default function ReferenceRangeBar({ value, low, high, unit, caption }: Props) {
  if (value === null || low === null || high === null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (high <= low) return null;

  const span = high - low;
  const domainLow = low - span;
  const domainHigh = high + span;
  const position = (input: number) => ((input - domainLow) / (domainHigh - domainLow)) * 100;

  const marker = clamp(position(value), 1.5, 98.5);
  const bandStart = clamp(position(low), 0, 100);
  const bandEnd = clamp(position(high), 0, 100);

  const format = (number: number) =>
    Math.abs(number) >= 100 ? number.toFixed(0) : String(Number(number.toFixed(2)));

  return (
    <figure className="mt-3">
      <div className="relative h-6" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-200"
          style={{ left: `${bandStart}%`, width: `${Math.max(1, bandEnd - bandStart)}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-blue-700"
          style={{ left: `${marker}%` }}
        />
        <div
          className="absolute top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-white"
          style={{ left: `${marker}%`, top: '50%' }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-slate-500" aria-hidden="true">
        <span>Printed low {format(low)}</span>
        <span>Printed high {format(high)}</span>
      </div>

      <figcaption className="mt-1 text-xs text-slate-600">
        Your value <span className="font-medium text-slate-900">{format(value)}</span>
        {unit ? ` ${unit}` : ''} is {caption}. The highlighted band is the range printed on
        the report, not a target set by SwasthSetu.
      </figcaption>
    </figure>
  );
}
