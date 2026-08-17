/**
 * auditService.js — Quản lý Audit Logs với Retention Policy 14 ngày
 */
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, orderBy, limit, startAfter, where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { dbError, nowISO } from './baseService';

const COL = 'auditLogs';
const RETENTION_DAYS = 14;

// ── GeoIP Cache ───────────────────────────────────────────────────────────────
let cachedIpInfo = { publicIpv4: null, publicIpv6: null, localIp: null };
let cachedLocInfo = { cityName: '', regionName: '', countryName: '' };
let ipFetched = false;

async function ensureIpFetched() {
  if (ipFetched) return;
  ipFetched = true; // Chỉ fetch 1 lần
  try {
    const r = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d?.success) {
      cachedIpInfo.publicIpv4 = d.ip;
      cachedLocInfo = {
        cityName: d.city || '',
        regionName: d.region || '',
        countryName: d.country || '',
      };
    }
  } catch (_) {}
  try {
    const r = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    if (d?.ip) cachedIpInfo.publicIpv6 = d.ip.includes(':') ? d.ip : 'Không hỗ trợ IPv6';
  } catch (_) {}
}

// Fetch IP ngay khi module load
ensureIpFetched();

// ── Thêm log mới ──────────────────────────────────────────────────────────────
export async function addAuditLog(log) {
  try {
    await ensureIpFetched();
    const flatLoc = [cachedLocInfo.cityName, cachedLocInfo.regionName, cachedLocInfo.countryName]
      .filter(Boolean).join(', ') || 'Địa phương';

    await addDoc(collection(db, COL), {
      time: new Date().toLocaleString('vi-VN'),
      timestamp: serverTimestamp(),
      ip: cachedIpInfo.publicIpv4 || '127.0.0.1',
      location: flatLoc,
      device: navigator.userAgent.includes('Windows') ? 'Chrome - Windows' : 'Mobile - Browser',
      userAgent: navigator.userAgent,
      ipInfo: { ...cachedIpInfo },
      locationInfo: { ...cachedLocInfo },
      ...log,
    });
  } catch (e) { dbError('Audit', 'addAuditLog', e); }
}

// ── Subscribe realtime (200 bản ghi gần nhất) ─────────────────────────────────
export function subscribeAuditLogs(callback) {
  const { onSnapshot } = require('firebase/firestore');
  const q = query(collection(db, COL), orderBy('timestamp', 'desc'), limit(200));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { dbError('Audit', 'subscribeAuditLogs', err); callback([]); }
  );
}

// ── Phân trang cursor-based ────────────────────────────────────────────────────
export async function loadAuditLogsPaginated({ pageSize = 50, lastDoc = null, categoryFilter = null } = {}) {
  try {
    let q = query(collection(db, COL), orderBy('timestamp', 'desc'), limit(pageSize));
    if (lastDoc) q = query(q, startAfter(lastDoc));
    if (categoryFilter) q = query(q, where('category', '==', categoryFilter));
    const snap = await getDocs(q);
    return {
      logs: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      lastDoc: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.size === pageSize,
    };
  } catch (e) { dbError('Audit', 'loadAuditLogsPaginated', e); return { logs: [], lastDoc: null, hasMore: false }; }
}

/**
 * Xóa các audit log cũ hơn RETENTION_DAYS ngày.
 * Trả về số lượng bản ghi đã xóa.
 */
export async function cleanOldAuditLogs() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // Firestore không hỗ trợ where trên serverTimestamp khi dùng string,
    // nên load 500 bản ghi cũ nhất rồi lọc phía client
    const q = query(collection(db, COL), orderBy('timestamp', 'asc'), limit(500));
    const snap = await getDocs(q);
    let deleted = 0;
    for (const d of snap.docs) {
      const ts = d.data().timestamp?.toDate?.()?.toISOString() || d.data().time || '';
      if (ts < cutoff) {
        await deleteDoc(d.ref);
        deleted++;
      } else break; // Đã sắp xếp tăng dần → gặp bản ghi mới thì dừng
    }
    console.log(`[DB:Audit] Đã dọn ${deleted} audit log cũ hơn ${RETENTION_DAYS} ngày`);
    return deleted;
  } catch (e) { dbError('Audit', 'cleanOldAuditLogs', e); return 0; }
}
