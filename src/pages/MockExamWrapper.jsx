import { lazy } from 'react';
import { useDevice } from '../hooks/useDevice';

// Desktop — file gốc, KHÔNG SỬA ĐỔI
const MockExamDesktop = lazy(() => import('./MockExam'));
// Mobile
const MockExamMobile = lazy(() => import('./mobile/MockExamMobile'));
// Tablet
const MockExamTablet = lazy(() => import('./tablet/MockExamTablet'));

export default function MockExamWrapper() {
  const { isMobile, isTablet } = useDevice();

  if (isMobile) return <MockExamMobile />;
  if (isTablet) return <MockExamTablet />;
  return <MockExamDesktop />;
}
