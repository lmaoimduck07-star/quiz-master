/**
 * cooldownManager.js — Quản lý thời gian giãn cách (cooldown 10 phút) sau khi nộp bài luyện tập.
 *
 * Quy tắc:
 * 1. Admin hoặc tài khoản có role/flag 'unlimited' được miễn trừ cooldown.
 * 2. Tài khoản thường sau khi NỘP BÀI luyện tập thành công sẽ bị cooldown 10 phút
 *    cho TOÀN BỘ bài luyện tập.
 */

const COOLDOWN_MS = 10 * 60 * 1000; // 10 phút (600.000 ms)

/**
 * Kiểm tra tài khoản có được quyền Unlimited (không bị dính cooldown) hay không.
 */
export function isUserUnlimited(user) {
  if (!user) return false;
  const roleStr = String(user.role || '').toLowerCase();
  return (
    roleStr === 'admin' ||
    roleStr === 'unlimited' ||
    user.isUnlimited === true ||
    user.permission === 'unlimited'
  );
}

/**
 * Ghi nhận thời điểm người dùng vừa nộp bài luyện tập.
 */
export function setPracticeCooldown(userId) {
  if (!userId) return;
  const now = Date.now();
  try {
    localStorage.setItem(`qm_practice_cooldown_${userId}`, String(now));
  } catch (e) {
    console.error('[cooldownManager] Failed to set practice cooldown:', e);
  }
}

/**
 * Lấy số giây còn lại của thời gian cooldown 10 phút cho userId.
 * Trả về 0 nếu đã hết cooldown hoặc chưa có cooldown.
 */
export function getRemainingCooldownSeconds(userId) {
  if (!userId) return 0;
  try {
    const raw = localStorage.getItem(`qm_practice_cooldown_${userId}`);
    if (!raw) return 0;
    const lastAttempt = parseInt(raw, 10);
    if (isNaN(lastAttempt)) return 0;

    const elapsed = Date.now() - lastAttempt;
    if (elapsed >= COOLDOWN_MS) {
      return 0;
    }
    return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  } catch (e) {
    console.error('[cooldownManager] Error reading cooldown:', e);
    return 0;
  }
}

/**
 * Format số giây thành chuỗi dạng "MM:SS" (ví dụ: 09:45).
 */
export function formatCooldownTime(seconds) {
  if (!seconds || seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
