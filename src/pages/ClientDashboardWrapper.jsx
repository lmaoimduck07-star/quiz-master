import { lazy, Suspense } from 'react';
import { useDevice } from '../hooks/useDevice';

// Desktop — file gốc, KHÔNG SỬA ĐỔI
const ClientDashboardDesktop = lazy(() => import('./ClientDashboard'));
// Mobile
const ClientDashboardMobile = lazy(() => import('./mobile/ClientDashboardMobile'));
// Tablet
const ClientDashboardTablet = lazy(() => import('./tablet/ClientDashboardTablet'));

export default function ClientDashboardWrapper() {
  const { isMobile, isTablet } = useDevice();

  if (isMobile) return <ClientDashboardMobile />;
  if (isTablet) return <ClientDashboardTablet />;
  return <ClientDashboardDesktop />;
}
