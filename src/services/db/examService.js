/**
 * examService.js — CRUD chuẩn hóa cho Subjects, Exams, Questions
 *
 * Điểm quan trọng:
 * - ExamID luôn theo format `[mã_môn]_bai_[01..99]`
 * - Cascade Delete: xóa môn học sẽ tự xóa tất cả đề thi và câu hỏi liên quan
 * - saveBulkQuestions: tự chia batch khi câu hỏi > 450 items
 */
import {
  collection, doc,
  getDocs, getDoc,
  setDoc, updateDoc, deleteDoc,
  query, where, writeBatch, onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sanitize, chunkArray, batchWrite, nowISO, dbError } from './baseService';

const SUBJECTS_COL = 'subjectsV2';
const EXAMS_COL = 'examsV2';

// ── Sinh mã môn học từ tên ────────────────────────────────────────────────────
export function generateSubjectCode(name) {
  const clean = (name || 'MON')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean);
  if (clean.length === 1) return clean[0].slice(0, 6).toUpperCase();
  return clean.map(w => w[0].toUpperCase()).join('').slice(0, 6);
}

// ── Sinh ExamID chuẩn: `[mã_môn]_bai_[01..99]` ──────────────────────────────
export async function generateExamId(subjectId, subjectCode) {
  const existingExams = await loadExams(subjectId);
  // Lấy danh sách số thứ tự đã dùng trong môn này
  const usedNums = new Set(
    existingExams
      .map(e => {
        const m = e.id?.match(/_bai_(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(n => n !== null)
  );
  let num = 1;
  while (usedNums.has(num)) num++;
  const padded = String(num).padStart(2, '0');
  return `${subjectCode.toLowerCase()}_bai_${padded}`;
}

// ── SUBJECTS ──────────────────────────────────────────────────────────────────
export async function loadSubjects() {
  try {
    const snap = await getDocs(collection(db, SUBJECTS_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { dbError('Exam', 'loadSubjects', e); return []; }
}

export async function saveSubject(subject) {
  try {
    // Tự động sinh mã code nếu chưa có
    const code = subject.code || generateSubjectCode(subject.name);
    await setDoc(doc(db, SUBJECTS_COL, subject.id), sanitize({ ...subject, code }), { merge: true });
    return true;
  } catch (e) { dbError('Exam', 'saveSubject', e); return false; }
}

/** Cascade Delete: xóa môn → xóa tất cả exam + câu hỏi con */
export async function deleteSubject(subjectId) {
  try {
    // 1. Lấy tất cả exams của môn này
    const q = query(collection(db, EXAMS_COL), where('subjectId', '==', subjectId));
    const examSnap = await getDocs(q);

    // 2. Xóa tất cả questions subcollection của mỗi exam
    for (const examDoc of examSnap.docs) {
      await deleteExam(examDoc.id, /* skipSubjectCheck */ true);
    }

    // 3. Xóa document môn học
    await deleteDoc(doc(db, SUBJECTS_COL, subjectId));
    return true;
  } catch (e) { dbError('Exam', 'deleteSubject', e); return false; }
}

export function subscribeSubjects(callback) {
  return onSnapshot(
    collection(db, SUBJECTS_COL),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { dbError('Exam', 'subscribeSubjects', err); callback([]); }
  );
}

// ── EXAMS ─────────────────────────────────────────────────────────────────────
export async function loadExams(subjectId = null) {
  try {
    let q = subjectId
      ? query(collection(db, EXAMS_COL), where('subjectId', '==', subjectId))
      : collection(db, EXAMS_COL);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { dbError('Exam', 'loadExams', e); return []; }
}

/**
 * Tạo hoặc cập nhật đề thi.
 * Nếu không có examId hoặc examId có dạng random → tự sinh ID chuẩn.
 */
export async function saveExam(exam, questions = null) {
  try {
    const subject = await getDoc(doc(db, SUBJECTS_COL, exam.subjectId));
    const subjectData = subject.exists() ? subject.data() : {};
    const subjectCode = subjectData.code || generateSubjectCode(subjectData.name || exam.subjectId);

    // Sinh examId chuẩn nếu chưa có hoặc không đúng format
    let examId = exam.id;
    const isStandardId = examId && /^[a-z0-9]+_bai_\d{2}$/.test(examId);
    if (!examId || !isStandardId) {
      examId = await generateExamId(exam.subjectId, subjectCode);
    }

    const examCode = exam.code || `${subjectCode.toUpperCase()}_BAI_${examId.split('_bai_')[1] || '01'}`;
    const cleanExam = sanitize({
      ...exam,
      id: examId,
      code: examCode,
      subjectCode,
      updatedAt: nowISO(),
    });

    await setDoc(doc(db, EXAMS_COL, examId), cleanExam, { merge: true });

    // Lưu câu hỏi nếu có
    if (questions && questions.length > 0) {
      await saveBulkQuestions(examId, questions);
    }

    return examId;
  } catch (e) { dbError('Exam', 'saveExam', e); return null; }
}

export async function deleteExam(examId) {
  try {
    // Xóa subcollection questions trước
    const qCol = collection(db, EXAMS_COL, examId, 'questions');
    const qSnap = await getDocs(qCol);
    if (!qSnap.empty) {
      const ops = qSnap.docs.map(d => batch => batch.delete(d.ref));
      await batchWrite(ops);
    }
    // Xóa exam document
    await deleteDoc(doc(db, EXAMS_COL, examId));
    return true;
  } catch (e) { dbError('Exam', 'deleteExam', e); return false; }
}

export async function getExam(examId) {
  try {
    const snap = await getDoc(doc(db, EXAMS_COL, examId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { dbError('Exam', 'getExam', e); return null; }
}

export async function updateExamField(examId, fields) {
  try {
    await setDoc(doc(db, EXAMS_COL, examId), sanitize({ ...fields, updatedAt: nowISO() }), { merge: true });
    return true;
  } catch (e) { dbError('Exam', 'updateExamField', e); return false; }
}

export function subscribeExams(subjectId, callback) {
  const q = subjectId
    ? query(collection(db, EXAMS_COL), where('subjectId', '==', subjectId))
    : collection(db, EXAMS_COL);
  return onSnapshot(
    q,
    snap => {
      let exams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (subjectId) exams = exams.filter(e => e.subjectId === subjectId);
      callback(exams);
    },
    err => { dbError('Exam', 'subscribeExams', err); callback([]); }
  );
}

// ── QUESTIONS (Subcollection) ─────────────────────────────────────────────────
export async function loadQuestions(examId) {
  try {
    const snap = await getDocs(collection(db, EXAMS_COL, examId, 'questions'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { dbError('Exam', 'loadQuestions', e); return []; }
}

/** Lưu hàng loạt câu hỏi — tự động chia batch khi > 450 items */
export async function saveBulkQuestions(examId, questions) {
  try {
    const qCol = collection(db, EXAMS_COL, examId, 'questions');

    // Xóa câu hỏi cũ
    const existing = await getDocs(qCol);
    if (!existing.empty) {
      const deleteOps = existing.docs.map(d => batch => batch.delete(d.ref));
      await batchWrite(deleteOps);
    }

    // Ghi câu hỏi mới (chia batch nếu > 450)
    const chunks = chunkArray(questions);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((q, idx) => {
        const qId = (q.id && typeof q.id === 'string' && q.id.startsWith('q_'))
          ? q.id
          : `q_${String(idx + 1).padStart(3, '0')}`;
        batch.set(doc(qCol, qId), sanitize({ ...q, id: qId }));
      });
      await batch.commit();
    }

    // Cập nhật questionCount trên exam document
    await setDoc(doc(db, EXAMS_COL, examId), { questionCount: questions.length }, { merge: true });
    return true;
  } catch (e) { dbError('Exam', 'saveBulkQuestions', e); return false; }
}

// ── Chuẩn hóa toàn bộ ExamID đang bị random trong Firestore ──────────────────
export async function normalizeAllExamIds() {
  try {
    const subSnap = await getDocs(collection(db, SUBJECTS_COL));
    const subjectCodeMap = new Map();

    // Bước 1: Đảm bảo mỗi môn có code
    for (const d of subSnap.docs) {
      const data = d.data();
      let code = data.code;
      if (!code?.trim()) {
        code = generateSubjectCode(data.name);
        await setDoc(doc(db, SUBJECTS_COL, d.id), { code }, { merge: true });
      }
      subjectCodeMap.set(d.id, code.toLowerCase());
    }

    // Bước 2: Kiểm tra từng exam
    const examSnap = await getDocs(collection(db, EXAMS_COL));
    let fixed = 0;
    const counterMap = new Map(); // subjId → số thứ tự tiếp theo

    // Sắp xếp: exam có ID chuẩn trước để không bị đụng số thứ tự
    const standardExams = [];
    const randomExams = [];
    for (const d of examSnap.docs) {
      if (/^[a-z0-9]+_bai_\d{2}$/.test(d.id)) standardExams.push(d);
      else randomExams.push(d);
    }

    // Đăng ký số thứ tự đã dùng bởi exam chuẩn
    for (const d of standardExams) {
      const data = d.data();
      const m = d.id.match(/_bai_(\d+)$/);
      if (m) {
        const subjId = data.subjectId;
        const num = parseInt(m[1], 10);
        const current = counterMap.get(subjId) || new Set();
        current.add(num);
        counterMap.set(subjId, current);
      }
    }

    // Đổi ID cho các exam random
    for (const d of randomExams) {
      const data = d.data();
      const subjId = data.subjectId;
      if (!subjId) continue;
      const subjCode = subjectCodeMap.get(subjId) || 'mon';

      // Tìm số thứ tự tiếp theo chưa dùng
      const used = counterMap.get(subjId) || new Set();
      let num = 1;
      while (used.has(num)) num++;
      used.add(num);
      counterMap.set(subjId, used);

      const newId = `${subjCode}_bai_${String(num).padStart(2, '0')}`;
      const newCode = `${subjCode.toUpperCase()}_BAI_${String(num).padStart(2, '0')}`;

      // Lấy câu hỏi từ ID cũ
      const oldQSnap = await getDocs(collection(db, EXAMS_COL, d.id, 'questions'));

      // Tạo document mới
      await setDoc(doc(db, EXAMS_COL, newId), sanitize({
        ...data,
        id: newId,
        code: data.code || newCode,
        subjectCode: subjCode.toUpperCase(),
        normalizedAt: nowISO(),
      }));

      // Di chuyển câu hỏi sang ID mới
      if (!oldQSnap.empty) {
        const batch = writeBatch(db);
        oldQSnap.docs.forEach(qDoc => {
          batch.set(doc(db, EXAMS_COL, newId, 'questions', qDoc.id), qDoc.data());
        });
        await batch.commit();

        // Xóa câu hỏi cũ
        const delBatch = writeBatch(db);
        oldQSnap.docs.forEach(qDoc => delBatch.delete(qDoc.ref));
        await delBatch.commit();
      }

      // Xóa document cũ
      await deleteDoc(doc(db, EXAMS_COL, d.id));
      fixed++;
      console.log(`[DB:Exam] Chuẩn hóa ID: ${d.id} → ${newId}`);
    }

    console.log(`[DB:Exam] Chuẩn hóa hoàn tất! Đã chuyển đổi ${fixed} exam ID.`);
    return { fixed, total: examSnap.size };
  } catch (e) { dbError('Exam', 'normalizeAllExamIds', e); return null; }
}
