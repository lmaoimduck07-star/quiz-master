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

  // 1. Kiểm tra mảng roles: user.roles = ['Admin', 'Student', ...]
  const rolesArray = Array.isArray(user.roles) ? user.roles : [];
  const hasAdminRole = rolesArray.some(r => {
    const s = String(r || '').toLowerCase();
    return s === 'admin' || s === 'unlimited';
  });
  if (hasAdminRole) {
    _clearUserCooldownIfExempt(user.id);
    return true;
  }

  // 2. Kiểm tra chuỗi role đơn
  const roleStr = String(user.role || '').toLowerCase();
  if (roleStr === 'admin' || roleStr === 'unlimited') {
    _clearUserCooldownIfExempt(user.id);
    return true;
  }

  // 3. Kiểm tra activeRole trong localStorage
  try {
    const activeRole = String(localStorage.getItem('qm_active_role') || '').toLowerCase();
    if (activeRole === 'admin') {
      _clearUserCooldownIfExempt(user.id);
      return true;
    }
  } catch (_) {}

  // 4. Kiểm tra flag isUnlimited / unlimited (boolean, string, number)
  if (
    user.isUnlimited === true ||
    user.isUnlimited === 'true' ||
    user.isUnlimited === 1 ||
    user.unlimited === true ||
    user.unlimited === 'true' ||
    user.unlimited === 1
  ) {
    _clearUserCooldownIfExempt(user.id);
    return true;
  }

  // 5. Kiểm tra trong permissions object
  if (
    user.permission === 'unlimited' ||
    user.permissions?.unlimited === true ||
    user.permissions?.unlimited === 'true' ||
    user.permissions?.isUnlimited === true ||
    user.permissions?.isUnlimited === 'true'
  ) {
    _clearUserCooldownIfExempt(user.id);
    return true;
  }

  return false;
}

/**
 * Xóa cache cooldown trong LocalStorage nếu user là Unlimited
 */
function _clearUserCooldownIfExempt(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(`qm_practice_cooldown_${userId}`);
  } catch (_) {}
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
      localStorage.removeItem(`qm_practice_cooldown_${userId}`);
      return 0;
    }
    return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  } catch (e) {
    console.error('[cooldownManager] Error reading cooldown:', e);
    return 0;
  }
}

/**
 * Xóa thủ công cooldown cho một user
 */
export function clearPracticeCooldown(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(`qm_practice_cooldown_${userId}`, '0');
    localStorage.removeItem(`qm_practice_cooldown_${userId}`);
  } catch (_) {}
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
