import { useState, useEffect } from 'react';

/**
 * useDevice — Tự động nhận diện loại thiết bị hiện tại.
 *
 * Chỉ dùng User-Agent + maxTouchPoints để phân loại thiết bị.
 * KHÔNG dùng window.innerWidth breakpoint để tránh nhận diện nhầm khi
 * người dùng thu nhỏ cửa sổ trình duyệt desktop xuống kích thước tablet.
 *
 * Đặc biệt xử lý iPad mới (iPadOS 13+) vì chúng dùng UA giống macOS Safari
 * nhưng có navigator.maxTouchPoints > 1.
 *
 * Returns:
 *  - isMobile     : boolean — Điện thoại di động (UA là phone)
 *  - isTablet     : boolean — Máy tính bảng (UA là tablet, hoặc iPad mới)
 *  - isDesktop    : boolean — Desktop/Laptop (không phải mobile, không phải tablet)
 *  - isTouchDevice: boolean — Thiết bị cảm ứng (touch capable)
 *  - orientation  : 'portrait' | 'landscape'
 */
export function useDevice() {
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;

    // ── User-Agent detection ──────────────────────────────────────────────────
    const uaIsMobile = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    // Android tablet: có "Android" nhưng KHÔNG có "Mobile"
    const uaIsAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
    // iPad cũ (UA chứa "iPad")
    const uaIsIPad = /iPad/i.test(ua);
    // iPad mới (iPadOS 13+): UA giống macOS Safari, nhưng touch và màn hình nhỏ
    // Nhận ra bằng: UA là "Macintosh" + maxTouchPoints > 1
    const uaIsMac = /Macintosh/i.test(ua);
    const maxTouch = navigator.maxTouchPoints ?? 0;
    const isNewIPad = uaIsMac && maxTouch > 1;

    // ── Phân loại thiết bị (chỉ dựa vào UA + touchPoints, không dùng width) ──
    const isMobile = uaIsMobile;
    const isTablet = !uaIsMobile && (uaIsIPad || uaIsAndroidTablet || isNewIPad);
    const isDesktop = !isMobile && !isTablet;

    // ── Touch detection ───────────────────────────────────────────────────────
    const isTouchDevice =
      'ontouchstart' in window ||
      maxTouch > 0 ||
      (navigator.msMaxTouchPoints ?? 0) > 0;

    // ── Orientation ───────────────────────────────────────────────────────────
    const orientation =
      window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    return { isMobile, isTablet, isDesktop, isTouchDevice, orientation };
  };

  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo);

  useEffect(() => {
    // Chỉ cập nhật orientation khi resize, không re-classify thiết bị
    const handleResize = () =>
      setDeviceInfo((prev) => ({
        ...prev,
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
      }));

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
}
