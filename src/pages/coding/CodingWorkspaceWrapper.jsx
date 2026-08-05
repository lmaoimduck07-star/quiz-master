import { lazy } from 'react';
import { useDevice } from '../../hooks/useDevice';

// Desktop — file gốc, KHÔNG SỬA ĐỔI
const CodingWorkspaceDesktop = lazy(() => import('./CodingWorkspace'));
// Mobile
const CodingWorkspaceMobile = lazy(() => import('../mobile/CodingWorkspaceMobile'));
// Tablet
const CodingWorkspaceTablet = lazy(() => import('../tablet/CodingWorkspaceTablet'));

export default function CodingWorkspaceWrapper() {
  const { isMobile, isTablet } = useDevice();

  if (isMobile) return <CodingWorkspaceMobile />;
  if (isTablet) return <CodingWorkspaceTablet />;
  return <CodingWorkspaceDesktop />;
}
