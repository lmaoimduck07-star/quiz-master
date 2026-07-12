import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function PrivateRoute({ children, allowedRoles, requiredPermission }) {
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

  // Kiểm tra permission tính năng (nếu có yêu cầu)
  if (requiredPermission) {
    const userPermissions = currentUser.permissions || {};
    const hasPermission = userPermissions[requiredPermission] === true;
    // Admin luôn có quyền truy cập
    const isAdmin = activeRole === 'Admin';

    if (!hasPermission && !isAdmin) {
      return <AccessDeniedPage requiredPermission={requiredPermission} />;
    }
  }

  return children;
}

function AccessDeniedPage({ requiredPermission }) {
  const navigate = useNavigate();
  const permLabel = requiredPermission === 'codingAccess' 
    ? 'Thi Lập trình & Vấn đáp AI' 
    : requiredPermission;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="p-8 text-center space-y-5">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Không có quyền truy cập</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Tài khoản của bạn chưa được cấp quyền <strong className="text-slate-700 dark:text-slate-200">{permLabel}</strong>. 
              Vui lòng liên hệ <strong className="text-primary dark:text-blue-400">Quản trị viên (Admin)</strong> để được cấp quyền truy cập tính năng này.
            </p>
          </div>
          <button
            onClick={() => navigate('/client/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-md transition text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Quay về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
