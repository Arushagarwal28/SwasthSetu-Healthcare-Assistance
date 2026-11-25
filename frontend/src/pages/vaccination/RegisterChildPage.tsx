import { Link, useNavigate } from 'react-router-dom';
import type { ChildProfile } from '../../types/vaccination';
import ChildRegistrationForm from '../../components/vaccination/ChildRegistrationForm';

interface Props {
  /** Vaccination module root, e.g. `/helper/vaccination` or `/hospital/vaccination`. */
  basePath: string;
}

export default function RegisterChildPage({ basePath }: Props) {
  const navigate = useNavigate();

  const handleRegistered = (child: ChildProfile) => {
    navigate(`${basePath}/children?created=${encodeURIComponent(child.recordNumber)}`, {
      replace: true,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`${basePath}/children`}
          className="text-sm text-slate-600 hover:text-slate-900 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          ← Back to children
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Register a child</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          The full dose schedule is generated from the date of birth, gender and JE endemic flag.
        </p>
      </div>

      <ChildRegistrationForm
        basePath={basePath}
        onRegistered={handleRegistered}
        onCancel={() => navigate(`${basePath}/children`)}
      />
    </div>
  );
}