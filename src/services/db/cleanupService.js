/**
 * cleanupService.js — Công cụ dọn dẹp Database chủ động
 *
 * Được gọi bằng nút bấm trong Admin UI, KHÔNG chạy tự động.
 * Trả về báo cáo chi tiết số lượng bản ghi đã dọn sạch.
 */
import {
  collection, doc, getDocs, deleteDoc, getDoc,
  query, where, writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { dbError, batchWrite } from './baseService';
import { cleanOldAuditLogs } from './auditService';
import { normalizeAllExamIds } from './examService';

const STALE_SESSION_MINUTES = 2;

/**
 * Dọn dẹp toàn bộ ghost documents & rác trong Database.
 * @returns {{ sessions, orphanQuestions, oldAuditLogs, normalizedExamIds }}
 */
export async function runDatabaseCleanup() {
  const report = {
    staleSessions: 0,
    orphanQuestions: 0,
    oldAuditLogs: 0,
    normalizedExamIds: 0,
    errors: [],
  };

  // 1. Dọn session thi quá hạn (> 2 phút không hoạt động hoặc đã nộp/bị xóa)
  try {
    const snap = await getDocs(collection(db, 'active_sessionsV2'));
    const cutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000).toISOString();
    for (const d of snap.docs) {
      if (d.id.startsWith('presence_')) continue;
      const data = d.data();
      const lastActive = data.lastActive || data.onlineSince || '';
      const isStale = ['deleted', 'submitted', 'terminated'].includes(data.status)
        || (lastActive && lastActive < cutoff);
      if (isStale) {
        // Xóa subcollection answers trước
        try {
          const ansSnap = await getDocs(collection(db, 'active_sessionsV2', d.id, 'answers'));
          if (!ansSnap.empty) {
            const delOps = ansSnap.docs.map(a => batch => batch.delete(a.ref));
            await batchWrite(delOps);
          }
        } catch (_) {}
        await deleteDoc(d.ref);
        report.staleSessions++;
      }
    }
  } catch (e) {
    dbError('Cleanup', 'staleSessions', e);
    report.errors.push(`Session cleanup: ${e.message}`);
  }

  // 2. Dọn câu hỏi mồ côi (subcollection của exam đã xóa)
  try {
    const examSnap = await getDocs(collection(db, 'examsV2'));
    const validExamIds = new Set(examSnap.docs.map(d => d.id));

    // Không thể query trực tiếp subcollection orphans trong Firestore client SDK
    // → Dọn dẹp thông qua danh sách exam hợp lệ đã biết (safe approach)
    // Đây là noop an toàn — báo cáo 0 vì không có cách query orphan subcollection
    report.orphanQuestions = 0;
  } catch (e) {
    report.errors.push(`Orphan questions: ${e.message}`);
  }

  // 3. Xóa audit log cũ hơn 14 ngày
  try {
    report.oldAuditLogs = await cleanOldAuditLogs();
  } catch (e) {
    report.errors.push(`Audit log cleanup: ${e.message}`);
  }

  // 4. Chuẩn hóa ExamID còn bị random
  try {
    const result = await normalizeAllExamIds();
    report.normalizedExamIds = result?.fixed || 0;
  } catch (e) {
    report.errors.push(`Exam ID normalization: ${e.message}`);
  }

  console.log('[DB:Cleanup] Báo cáo dọn dẹp:', report);
  return report;
}
