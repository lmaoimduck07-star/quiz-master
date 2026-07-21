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

    // 1. Detect phím F12
    const handleKeyDown = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        handleViolation();
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (Chrome DevTools shortcuts)
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' ||
                                      e.key === 'J' || e.key === 'j' ||
                                      e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u')) // View source
      ) {
        e.preventDefault();
        handleViolation();
      }
    };

    // 2. Detect DevTools mở qua kích thước cửa sổ
    let devtoolsOpen = false;
    const THRESHOLD = 160; // px

    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const isOpen = widthDiff > THRESHOLD || heightDiff > THRESHOLD;

      if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true;
        handleViolation();
      } else if (!isOpen) {
        devtoolsOpen = false;
      }
    };

    const devtoolsInterval = setInterval(checkDevTools, 1000);

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(devtoolsInterval);
    };
  }, [enabled, currentUser, handleViolation]);

  // Trả về số lần vi phạm hiện tại để UI có thể hiển thị nếu cần
  return { attempts: getAttempts(), maxAttempts: MAX_ATTEMPTS };
}
