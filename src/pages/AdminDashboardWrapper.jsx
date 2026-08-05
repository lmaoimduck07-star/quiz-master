import { lazy } from 'react';
import { useDevice } from '../hooks/useDevice';

// Desktop — file gốc, KHÔNG SỬA ĐỔI
const AdminDashboardDesktop = lazy(() => import('./AdminDashboard'));
// Mobile — chặn truy cập
const AdminDashboardMobile = lazy(() => import('./mobile/AdminDashboardMobile'));
// Tablet — standby
const AdminDashboardTablet = lazy(() => import('./tablet/AdminDashboardTablet'));

export default function AdminDashboardWrapper() {
  const { isMobile, isTablet } = useDevice();

  if (isMobile) return <AdminDashboardMobile />;
  if (isTablet) return <AdminDashboardTablet />;
  return <AdminDashboardDesktop />;
}
