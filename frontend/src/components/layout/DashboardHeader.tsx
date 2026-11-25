import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

interface Props {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function DashboardHeader({ title, subtitle, children }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-gray-200">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Logout
        </button>
      </div>
    </div>
  );
}