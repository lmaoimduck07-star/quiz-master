// src/utils/idGenerator.js

/**
 * Sinh User ID tiếp theo dạng tự tăng.
 * - Loại mặc định (thường/admin): U01, U02, U03...
 * - Loại Google: Ugg_01, Ugg_02, Ugg_03...
 * 
 * @param {Array} existingUsers Danh sách người dùng hiện tại
 * @param {'default'|'google'} type Loại tài khoản ('google' hoặc 'default')
 * @returns {string} ID mới được định dạng chuẩn
 */
export function generateNextUserId(existingUsers = [], type = 'default') {
  const usersList = Array.isArray(existingUsers) ? existingUsers : [];

  if (type === 'google') {
    let maxNum = 0;
    usersList.forEach(u => {
      if (!u || !u.id) return;
      const strId = String(u.id);
      if (strId.startsWith('Ugg_')) {
        const numPart = strId.replace('Ugg_', '');
        const num = parseInt(numPart, 10);
        // Chỉ lấy số thứ tự < 10000 (bỏ qua các timestamp cũ nếu có)
        if (!isNaN(num) && num < 10000 && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    const padded = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    return `Ugg_${padded}`;
  } else {
    let maxNum = 0;
    usersList.forEach(u => {
      if (!u || !u.id) return;
      const strId = String(u.id);
      // Bỏ qua ID bắt đầu bằng Ugg_
      if (strId.startsWith('Ugg_')) return;

      // Khớp dạng U01, U02, U10... hoặc U_1, user_1...
      const match = strId.match(/^(?:U|_user_|user_)?0*(\d+)$/i) || strId.match(/^U(?:_)?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        // Chỉ lấy số thứ tự < 10000 (bỏ qua các timestamp cũ)
        if (!isNaN(num) && num < 10000 && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    const padded = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    return `U${padded}`;
  }
}
