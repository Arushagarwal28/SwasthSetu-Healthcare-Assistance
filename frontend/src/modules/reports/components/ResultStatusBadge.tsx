import type { TestStatus } from '../types';
import { TEST_STATUS_STYLE } from '../labels';

interface Props {
  status: TestStatus;
  /** Localised label from the explanation payload; falls back to the shared map. */
  label?: string;
  language?: 'en' | 'hi';
}

/**
 * Result status. The glyph, the text and the colour all carry the meaning, so
 * the status is still readable in grayscale or by a colour-blind user.
 */
export default function ResultStatusBadge({ status, label, language = 'en' }: Props) {
  const style = TEST_STATUS_STYLE[status];
  if (!style) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${style.className}`}
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {style.glyph}
      </span>
      {label || style[language]}
    </span>
  );
}
