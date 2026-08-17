/**
 * baseService.js — Các hàm tiện ích dùng chung cho toàn bộ DB Service Layer
 */
import { writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

// ── Loại bỏ undefined / NaN trước khi gửi Firestore ─────────────────────────
export function sanitize(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitize).filter(v => v !== null && v !== undefined);
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      if (typeof v === 'number' && isNaN(v)) continue;
      result[k] = (v !== null && typeof v === 'object') ? sanitize(v) : v;
    }
    return result;
  }
  return obj;
}

// ── Chia nhỏ mảng thành các batch (Firestore giới hạn 500 ops / batch) ───────
export function chunkArray(arr, size = 450) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Thực thi nhiều lệnh ghi chia thành nhiều batch tự động ───────────────────
export async function batchWrite(operations) {
  const chunks = chunkArray(operations);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

// ── Timestamp chuẩn hóa ──────────────────────────────────────────────────────
export { serverTimestamp };

// ── ISO timestamp hiện tại ───────────────────────────────────────────────────
export const nowISO = () => new Date().toISOString();

// ── Error logger chuẩn ───────────────────────────────────────────────────────
export function dbError(service, fn, e) {
  console.error(`[DB:${service}] ${fn} error:`, e);
}
