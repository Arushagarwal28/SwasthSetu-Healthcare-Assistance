import { NavLink } from 'react-router-dom';

export interface VaccinationNavItem {
  label: string;
  /** Absolute path, e.g. /helper/vaccination/children */
  to: string;
  /** True for the module's index route so it is not active on every sub-page. */
  end?: boolean;
}

interface Props {
  items: VaccinationNavItem[];
}

/**
 * Section tabs for the vaccination module. Uses NavLink so the active section
 * is conveyed with aria-current as well as colour.
 */
export default function VaccinationNav({ items }: Props) {
  return (
    <nav
      aria-label="Vaccination tracker sections"
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}