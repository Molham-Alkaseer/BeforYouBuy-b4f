import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/session/useAuth';

export default function RequireAdmin() {
  const { user } = useAuth();
  return user && ['admin', 'owner'].includes(user.householdRole)
    ? <Outlet />
    : <Navigate to="/pantry" replace />;
}
