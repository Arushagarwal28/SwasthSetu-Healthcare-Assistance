import type { ExplanationLanguage, SummaryExplanation } from '../types';
import { LANGUAGE_LABEL } from '../labels';

export function LanguageToggle({
  value,
  onChange,
}: {
  value: ExplanationLanguage;
  onChange: (language: ExplanationLanguage) => void;
}) {
  const languages: ExplanationLanguage[] = ['en', 'hi'];

  return (
    <div
      role="group"
      aria-label="Explanation language"
      className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5"
    >
      {languages.map((language) => {
        const active = value === language;
        return (
          <button
            key={language}
            type="button"
            aria-pressed={active}
            lang={language}
            onClick={() => onChange(language)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {LANGUAGE_LABEL[language]}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  summary: SummaryExplanation | null;
  language: ExplanationLanguage;
}

/**
 * Plain-language overview of the whole report, in the selected language.
 * Every statement here comes from the explanation service; none is composed
 * in the browser.
 */
export default function SummaryBlock({ summary, language }: Props) {
  if (!summary) {
    return (
      <p className="text-sm text-slate-600">
        A plain-language summary is not available in{' '}
        {LANGUAGE_LABEL[language]}. The results below are still shown as printed.
      </p>
    );
  }

  return (
    <div lang={language} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{summary.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{summary.overview}</p>
      </div>

      {summary.key_points.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900">What stands out</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {summary.key_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.next_steps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900">What you can do next</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {summary.next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.disclaimers.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Please note
          </h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
            {summary.disclaimers.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
