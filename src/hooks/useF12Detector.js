// src/hooks/useF12Detector.js
// Detect F12 / DevTools — tự động khóa tài khoản sau MAX_ATTEMPTS lần vi phạm

import { useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';

const MAX_ATTEMPTS = 2; // Số lần tối đa trước khi khóa
const SESSION_KEY = 'qm_f12_attempts'; // Lưu số lần vi phạm trong session

/**
 * useF12Detector
 * @param {Object} options
 * @param {Object|null} options.currentUser  - user hiện tại từ AuthContext
 * @param {Function}    options.onLocked     - callback gọi khi tài khoản bị khóa (thường là logout)
 * @param {boolean}     options.enabled      - bật/tắt detector (mặc định true)
 */
export function useF12Detector({ currentUser, onLocked, enabled = true }) {
  // Đọc số lần vi phạm từ sessionStorage mỗi khi mount
  const getAttempts = useCallback(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? parseInt(saved, 10) : 0;
  }, []);

  const setAttempts = useCallback((n) => {
    sessionStorage.setItem(SESSION_KEY, String(n));
  }, []);

  // Hàm xử lý khi phát hiện vi phạm
  const handleViolation = useCallback(async () => {
    if (!enabled || !currentUser) return;

    const count = getAttempts() + 1;
    setAttempts(count);

    const remaining = MAX_ATTEMPTS - count;

    if (count > MAX_ATTEMPTS) {
      // Đã xử lý rồi, bỏ qua
      return;
    }

    if (count >= MAX_ATTEMPTS) {
      // Khóa tài khoản
      console.warn(`[F12Detector] Vi phạm lần ${count}/${MAX_ATTEMPTS} — Đang khóa tài khoản...`);

      // Ghi audit log
      storage.addAuditLog({
        user: currentUser.username,
        role: currentUser.roles?.[0] || 'Student',
        category: 'Security',
        action: `Tài khoản bị khóa tự động do mở DevTools/F12 quá ${MAX_ATTEMPTS} lần`,
        severity: 'Critical',
      });

      // Khóa trên Firestore
      await storage.lockUserById(
        currentUser.id,
        `Tự động khóa: Mở DevTools/F12 quá ${MAX_ATTEMPTS} lần trong phiên làm bài`
      );

      // Cập nhật localStorage để phiên hiện tại cũng biết
      const storedUser = localStorage.getItem('qm_current_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          parsed.status = 'Locked';
          localStorage.setItem('qm_current_user', JSON.stringify(parsed));
        } catch (_) {}
      }

      // Gọi callback (thường là logout + chuyển trang)
      onLocked?.();
    } else {
      // Cảnh báo còn lần nữa
      console.warn(
        `[F12Detector] Vi phạm lần ${count}/${MAX_ATTEMPTS}. Còn ${remaining} lần trước khi bị khóa.`
      );

      storage.addAuditLog({
        user: currentUser.username,
        role: currentUser.roles?.[0] || 'Student',
        category: 'Security',
        action: `Cảnh báo: Mở DevTools/F12 lần ${count}/${MAX_ATTEMPTS}`,
        severity: 'Warning',
      });

      // Hiển thị alert cảnh báo
      alert(
        `⚠️ CẢNH BÁO BẢO MẬT\n\n` +
        `Bạn đã mở DevTools/F12 lần thứ ${count}.\n` +
        `Nếu tiếp tục thêm ${remaining} lần nữa, tài khoản của bạn sẽ bị khóa tự động.\n\n` +
        `Vui lòng đóng DevTools ngay lập tức.`
      );
    }
  }, [enabled, currentUser, getAttempts, setAttempts, onLocked]);

  useEffect(() => {
    if (!enabled || !currentUser) return;

    // 1. Chặn phím tắt (Function keys & DevTools shortcuts)
    const handleKeyDown = (e) => {
      // Nhận diện phím Function (F1 -> F12)
      // e.code của các phím này thường là 'F1', 'F2', ..., 'F12'
      const isFunctionKey = e.code && e.code.startsWith('F') && e.code.length > 1 && !isNaN(e.code.slice(1));

      // Ctrl+Shift+I / J / C (Chrome/Edge DevTools Windows)
      const isDevToolsShortcut = e.ctrlKey && e.shiftKey && 
        (e.code === 'KeyI' || e.code === 'KeyJ' || e.code === 'KeyC');
      
      // Ctrl+U (View Source)
      const isViewSourceShortcut = e.ctrlKey && e.code === 'KeyU';

      if (isFunctionKey || isDevToolsShortcut || isViewSourceShortcut) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation();
      }
    };

    // 2. Chặn chuột phải (Context menu)
    const handleContextMenu = (e) => {
      e.preventDefault();
      // Yêu cầu: CHỈ CHẶN, KHÔNG TÍNH VI PHẠM (tránh ấn nhầm)
    };

    // Sử dụng capture: true để bắt sự kiện trước khi bị các phần tử khác chặn (stopPropagation)
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [enabled, currentUser, handleViolation]);

  // Trả về số lần vi phạm hiện tại để UI có thể hiển thị nếu cần
  return { attempts: getAttempts(), maxAttempts: MAX_ATTEMPTS };
}
