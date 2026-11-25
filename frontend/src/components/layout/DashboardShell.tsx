import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import Logo from '../brand/Logo';

interface Props {
  roleLabel: string;
  children: ReactNode;
  /**
   * Optional slot rendered in the header, left of the account email.
   * Pass a notification bell or similar here from a dashboard.
   */
  headerActions?: ReactNode;
}

export default function DashboardShell({ roleLabel, children, headerActions }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo />
            <span className="hidden sm:inline-block text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            {headerActions}
            {user?.email && (
              <span className="hidden md:block text-sm text-slate-500 truncate max-w-[220px]">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}