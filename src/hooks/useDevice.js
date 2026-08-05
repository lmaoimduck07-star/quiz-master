import { useState, useEffect } from 'react';

/**
 * useDevice — Tự động nhận diện loại thiết bị hiện tại.
 * Kết hợp Window Size (Breakpoints) và User-Agent để phân loại chính xác.
 *
 * Returns:
 *  - isMobile    : boolean — Điện thoại di động (< 768px hoặc UA là phone)
 *  - isTablet    : boolean — Máy tính bảng (768px - 1199px hoặc UA là tablet)
 *  - isDesktop   : boolean — Desktop/Laptop (>= 1200px)
 *  - isTouchDevice: boolean — Thiết bị cảm ứng (touch capable)
 *  - orientation : 'portrait' | 'landscape'
 */
export function useDevice() {
  const getDeviceInfo = () => {
    const width = window.innerWidth;
    const ua = navigator.userAgent;

    // User-Agent detection
    const uaIsMobile = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const uaIsTablet = /iPad|Android(?!.*Mobile)/i.test(ua);

    // Touch detection
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;

    // Orientation
    const orientation =
      window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    // Breakpoint-based detection (ưu tiên UA trước, fallback sang width)
    const isMobile = uaIsMobile || (!uaIsTablet && width < 768);
    const isTablet = uaIsTablet || (!uaIsMobile && width >= 768 && width < 1200);
    const isDesktop = !isMobile && !isTablet;

    return { isMobile, isTablet, isDesktop, isTouchDevice, orientation };
  };

  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo);

  useEffect(() => {
    const handleResize = () => setDeviceInfo(getDeviceInfo());

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
}
