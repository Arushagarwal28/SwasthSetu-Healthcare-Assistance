import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface Props {
  allowedRoles: string[];
  children: React.ReactNode;
}

export const ProtectedRoute = ({ allowedRoles, children }: Props) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};