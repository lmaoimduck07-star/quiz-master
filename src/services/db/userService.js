/**
 * userService.js — Atomic CRUD cho collection `users`
 *
 * Thay thế hoàn toàn pattern ghi đè toàn bộ saveUsers(allUsers).
 * Mỗi hàm chỉ thao tác trên ĐÚNG 1 document → loại bỏ Race Condition.
 */
import {
  collection, doc,
  getDoc, getDocs,
  setDoc, updateDoc, deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sanitize, nowISO, dbError } from './baseService';

const COL = 'users';

// ── Đọc ─────────────────────────────────────────────────────────────────────
export async function getUser(userId) {
  try {
    const snap = await getDoc(doc(db, COL, userId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { dbError('User', 'getUser', e); return null; }
}

export async function getAllUsers() {
  try {
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { dbError('User', 'getAllUsers', e); return []; }
}

// ── Tạo mới ─────────────────────────────────────────────────────────────────
export async function createUser(userData) {
  try {
    const safe = sanitize({ ...userData, createdAt: nowISO() });
    await setDoc(doc(db, COL, userData.id), safe);
    return true;
  } catch (e) { dbError('User', 'createUser', e); return false; }
}

// ── Cập nhật một phần (Atomic — không ghi đè toàn bộ document) ──────────────
export async function updateUser(userId, fields) {
  try {
    const safe = sanitize({ ...fields, updatedAt: nowISO() });
    await updateDoc(doc(db, COL, userId), safe);
    return true;
  } catch (e) {
    // Nếu document chưa tồn tại thì dùng setDoc với merge
    try {
      const safe = sanitize({ ...fields, updatedAt: nowISO() });
      await setDoc(doc(db, COL, userId), safe, { merge: true });
      return true;
    } catch (e2) { dbError('User', 'updateUser', e2); return false; }
  }
}

// ── Xóa ─────────────────────────────────────────────────────────────────────
export async function deleteUser(userId) {
  try {
    await deleteDoc(doc(db, COL, userId));
    return true;
  } catch (e) { dbError('User', 'deleteUser', e); return false; }
}

// ── Khóa / mở khóa tài khoản ─────────────────────────────────────────────────
export async function setUserStatus(userId, status, reason = '') {
  try {
    const updates = {
      status,
      updatedAt: nowISO(),
      ...(status === 'Locked' ? { lockedAt: nowISO(), lockReason: reason } : { unlockedAt: nowISO() })
    };
    await updateDoc(doc(db, COL, userId), updates);
    return true;
  } catch (e) { dbError('User', 'setUserStatus', e); return false; }
}

// ── Cập nhật quyền hạn ───────────────────────────────────────────────────────
export async function updateUserPermissions(userId, permissions) {
  return updateUser(userId, { permissions });
}

// ── Realtime subscription ────────────────────────────────────────────────────
export function subscribeUsers(callback) {
  return onSnapshot(
    collection(db, COL),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { dbError('User', 'subscribeUsers', err); callback([]); }
  );
}
