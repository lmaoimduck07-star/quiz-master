import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, allowedRoles }) {
  const { currentUser, activeRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    // Nếu không có quyền, chuyển về đúng dashboard của họ
    return activeRole === 'Admin' 
      ? <Navigate to="/admin/dashboard" replace /> 
      : <Navigate to="/client/dashboard" replace />;
  }

  return children;
}
