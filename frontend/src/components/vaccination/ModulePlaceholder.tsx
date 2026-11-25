interface Props {
  title: string;
  description: string;
  /** The build phase that replaces this placeholder, e.g. "Phase 3". */
  phase: string;
  bullets?: string[];
}

/**
 * TEMPORARY SCAFFOLDING.
 *
 * Every route in the vaccination module exists from Phase 2 onwards so the
 * navigation and access control can be verified early. Routes without an
 * implementation yet render this component. It is deleted route by route as
 * the real page lands; nothing else in the app depends on it.
 */
export default function ModulePlaceholder({ title, description, phase, bullets }: Props) {
  return (
    <section className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          Planned — {phase}
        </span>
      </div>

      {bullets && bullets.length > 0 && (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-400">
        This section is not implemented yet. It will be replaced when {phase} is added.
      </p>
    </section>
  );
}