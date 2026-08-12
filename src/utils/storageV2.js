import { db } from '../firebase/config';
import { 
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, onSnapshot, writeBatch, serverTimestamp 
} from 'firebase/firestore';

// ─────────────────────────────────────────────
// SUBJECTS V2 (Không chứa exams/questions)
// ─────────────────────────────────────────────
export async function loadSubjectsV2() {
  try {
    const snap = await getDocs(collection(db, 'subjectsV2'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[StorageV2] loadSubjects error:', e);
    return [];
  }
}

export async function saveSubjectV2(subject) {
  try {
    await setDoc(doc(db, 'subjectsV2', subject.id), subject, { merge: true });
  } catch (e) {
    console.error('[StorageV2] saveSubject error:', e);
  }
}

export async function deleteSubjectV2(subjectId) {
  try {
    await deleteDoc(doc(db, 'subjectsV2', subjectId));
  } catch (e) {
    console.error('[StorageV2] deleteSubject error:', e);
  }
}

export function subscribeSubjectsV2(callback) {
  return onSnapshot(collection(db, 'subjectsV2'), (snap) => {
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(subjects);
  }, (err) => console.error('[StorageV2] subscribeSubjects error:', err));
}

/**
 * subscribeSubjectsWithExams — Lắng nghe realtime đồng thời subjectsV2 & examsV2.
 * Tự động merge exams vào subject tương ứng.
 * Mỗi khi Admin toggle isLocked / isMaintenance, callback sẽ được gọi lại ngay lập tức.
 */
export function subscribeSubjectsWithExams(callback) {
  let latestSubjects = [];
  let latestExams = [];

  const merge = () => {
    const merged = latestSubjects.map(s => ({
      ...s,
      exams: latestExams.filter(e => e.subjectId === s.id),
    }));
    callback(merged);
  };

  const unsubSubjects = onSnapshot(collection(db, 'subjectsV2'), (snap) => {
    latestSubjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    merge();
  }, (err) => console.error('[StorageV2] subscribeSubjectsWithExams (subjects) error:', err));

  const unsubExams = onSnapshot(collection(db, 'examsV2'), (snap) => {
    latestExams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    merge();
  }, (err) => console.error('[StorageV2] subscribeSubjectsWithExams (exams) error:', err));

  // Trả về hàm unsubscribe hủy cả 2 listener
  return () => {
    unsubSubjects();
    unsubExams();
  };
}

// ─────────────────────────────────────────────
// EXAMS V2 (Top-level, tham chiếu subjectId)
// ─────────────────────────────────────────────
export async function loadExamsV2(subjectId = null) {
  try {
    let q = collection(db, 'examsV2');
    if (subjectId) {
      q = query(q, where('subjectId', '==', subjectId));
    }
    const snap = await getDocs(q);
    let exams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (subjectId) {
      exams = exams.filter(ex => ex.subjectId === subjectId);
    }
    return exams;
  } catch (e) {
    console.error('[StorageV2] loadExams error:', e);
    return [];
  }
}

/** Fetch tươi 1 exam document từ Firestore — dùng để verify lock/maintenance ngay trước khi bắt đầu thi */
export async function getExamV2(examId) {
  try {
    const snap = await getDoc(doc(db, 'examsV2', examId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    console.error('[StorageV2] getExam error:', e);
    return null;
  }
}

export async function saveExamV2(exam) {
  try {
    await setDoc(doc(db, 'examsV2', exam.id), exam, { merge: true });
  } catch (e) {
    console.error('[StorageV2] saveExam error:', e);
  }
}

export async function toggleExamLockV2(examId, currentIsLocked) {
  try {
    await setDoc(doc(db, 'examsV2', examId), { isLocked: !currentIsLocked }, { merge: true });
  } catch (e) {
    console.error('[StorageV2] toggleExamLock error:', e);
  }
}

export async function toggleExamMaintenanceV2(examId, currentIsMaintenance) {
  try {
    await setDoc(doc(db, 'examsV2', examId), { isMaintenance: !currentIsMaintenance }, { merge: true });
  } catch (e) {
    console.error('[StorageV2] toggleExamMaintenance error:', e);
  }
}

export async function deleteExamV2(examId) {
  try {
    // 1. Xóa toàn bộ questions trong subcollection trước
    //    (nếu không xóa, Firestore để lại ghost document)
    const qCol = collection(db, 'examsV2', examId, 'questions');
    const existing = await getDocs(qCol);
    if (existing.size > 0) {
      const batch = writeBatch(db);
      existing.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    // 2. Xóa document exam cha
    await deleteDoc(doc(db, 'examsV2', examId));
  } catch (e) {
    console.error('[StorageV2] deleteExam error:', e);
  }
}

export function subscribeExamsV2(subjectId, callback) {
  let q = collection(db, 'examsV2');
  if (subjectId) {
    q = query(q, where('subjectId', '==', subjectId));
  }
  return onSnapshot(q, (snap) => {
    let exams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (subjectId) {
      exams = exams.filter(ex => ex.subjectId === subjectId);
    }
    callback(exams);
  }, (err) => console.error('[StorageV2] subscribeExams error:', err));
}

// ─────────────────────────────────────────────
// QUESTIONS V2 (Subcollection của Exam)
// ─────────────────────────────────────────────
export async function loadQuestionsV2(examId) {
  try {
    const snap = await getDocs(collection(db, 'examsV2', examId, 'questions'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[StorageV2] loadQuestions error:', e);
    return [];
  }
}

export async function saveQuestionsV2(examId, questions) {
  try {
    const batch = writeBatch(db);
    const qCol = collection(db, 'examsV2', examId, 'questions');
    
    // 1. Get existing to delete removed ones
    const existing = await getDocs(qCol);
    existing.forEach(d => batch.delete(d.ref));
    
    // 2. Add new with formatted question IDs
    questions.forEach((q, idx) => {
      const qId = (q.id && typeof q.id === 'string' && q.id.startsWith('q_')) ? q.id : `q_${String(idx + 1).padStart(3, '0')}`;
      const qRef = doc(qCol, qId);
      batch.set(qRef, { ...q, id: qId });
    });

    // 3. Update questionCount on exam document
    const examRef = doc(db, 'examsV2', examId);
    batch.set(examRef, { questionCount: questions.length }, { merge: true });
    
    await batch.commit();
  } catch (e) {
    console.error('[StorageV2] saveQuestions error:', e);
  }
}

export function subscribeQuestionsV2(examId, callback) {
  return onSnapshot(collection(db, 'examsV2', examId, 'questions'), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => console.error('[StorageV2] subscribeQuestions error:', err));
}

// ─────────────────────────────────────────────
// ACTIVE SESSIONS V2 (Heartbeat & Delta Sync)
// ─────────────────────────────────────────────
export async function updateActiveSessionV2(sessionId, sessionData) {
  try {
    const safeData = {
      ...sessionData,
      lastActive: new Date().toISOString()
    };
    await setDoc(doc(db, 'active_sessionsV2', sessionId), safeData, { merge: true });
  } catch (e) {
    console.warn('[StorageV2] updateActiveSession error:', e);
  }
}

// Hàm lưu từng đáp án vào Subcollection để tránh Mega-document
export async function saveAnswerDeltaV2(sessionId, questionId, answerData) {
  try {
    const ref = doc(db, 'active_sessionsV2', sessionId, 'answers', questionId);
    await setDoc(ref, { 
      answerData, 
      updatedAt: serverTimestamp() 
    }, { merge: true });
  } catch (e) {
    console.error('[StorageV2] saveAnswerDelta error:', e);
  }
}

export function subscribeSingleSessionV2(sessionId, callback) {
  return onSnapshot(doc(db, 'active_sessionsV2', sessionId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
}

export async function deleteFullSessionV2(sessionId) {
  if (!sessionId) return;
  try {
    const ansSnap = await getDocs(collection(db, 'active_sessionsV2', sessionId, 'answers'));
    if (!ansSnap.empty) {
      const batch = writeBatch(db);
      ansSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'active_sessionsV2', sessionId));
  } catch (e) {
    console.warn('[StorageV2] deleteFullSessionV2 error:', e);
  }
}

// ─────────────────────────────────────────────
// CODING PROBLEMS V2 (Top-level Collection)
// ─────────────────────────────────────────────
export async function loadCodingProblemsV2(subjectId = null) {
  try {
    let q = collection(db, 'coding_problemsV2');
    if (subjectId) {
      q = query(q, where('subjectId', '==', subjectId));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[StorageV2] loadCodingProblems error:', e);
    return [];
  }
}

export async function saveCodingProblemV2(problem) {
  try {
    await setDoc(doc(db, 'coding_problemsV2', problem.id), problem, { merge: true });
  } catch (e) {
    console.error('[StorageV2] saveCodingProblem error:', e);
  }
}

export async function deleteCodingProblemV2(problemId) {
  try {
    await deleteDoc(doc(db, 'coding_problemsV2', problemId));
  } catch (e) {
    console.error('[StorageV2] deleteCodingProblem error:', e);
  }
}

// ─────────────────────────────────────────────
// EXPORT TẠM THỜI (Migration)
// ─────────────────────────────────────────────
export const storageV2 = {
  loadSubjectsV2, saveSubjectV2, deleteSubjectV2, subscribeSubjectsV2,
  subscribeSubjectsWithExams,
  loadExamsV2, saveExamV2, deleteExamV2, getExamV2, subscribeExamsV2,
  toggleExamLockV2, toggleExamMaintenanceV2,
  loadQuestionsV2, saveQuestionsV2, subscribeQuestionsV2,
  loadCodingProblemsV2, saveCodingProblemV2, deleteCodingProblemV2,
  updateActiveSessionV2, saveAnswerDeltaV2, subscribeSingleSessionV2, deleteFullSessionV2,
  runMigrationOnce, runCodeNormalization
};

export async function runMigrationOnce() {
  try {
    const v2Snap = await getDocs(collection(db, 'subjectsV2'));
    if (!v2Snap.empty) {
      console.log('[StorageV2] Đã migrate rồi, skip.');
      return;
    }
    
    console.log('[StorageV2] Đang chạy DB Migration sang V2...');
    const oldSnap = await getDocs(collection(db, 'subjects'));
    for (const d of oldSnap.docs) {
      const oldSub = { id: d.id, ...d.data() };
      
      const subV2 = {
        id: oldSub.id,
        name: oldSub.name || '',
        description: oldSub.description || '',
        status: oldSub.status || 'normal',
        isCompleted: oldSub.isCompleted || false
      };
      await setDoc(doc(db, 'subjectsV2', subV2.id), subV2);
      
      const exams = oldSub.exams || [];
      for (const ex of exams) {
        const examId = ex.id || `exam_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const exV2 = {
          id: examId,
          subjectId: subV2.id,
          title: ex.title || (ex.config ? ex.config.title : 'Đề thi'),
          config: ex.config || { time: 15, password: '', shuffleQ: true, shuffleA: true }
        };
        await setDoc(doc(db, 'examsV2', examId), exV2);
        
        const qs = ex.questions || [];
        if (qs.length > 0) {
          const batch = writeBatch(db);
          qs.forEach(q => {
            const qId = q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            batch.set(doc(db, 'examsV2', examId, 'questions', qId), { ...q, id: qId });
          });
          await batch.commit();
        }
      }
    }

    // Tự động dọn dẹp các Collection V1 cũ khỏi Firebase
    try {
      const oldCols = ['subjects', 'coding_problems', 'active_sessions'];
      for (const colName of oldCols) {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          console.log(`[StorageV2] Đã xóa dọn dẹp Collection V1 cũ: ${colName}`);
        }
      }
    } catch (e) {
      console.warn('[StorageV2] Dọn dẹp V1 warning:', e);
    }

    console.log('[StorageV2] Migration & Clean V1 hoàn tất!');
  } catch (e) {
    console.error('[StorageV2] Migration lỗi:', e);
  }
}

export async function runCodeNormalization() {
  try {
    const subSnap = await getDocs(collection(db, 'subjectsV2'));
    const subjectCodeMap = new Map();

    for (const d of subSnap.docs) {
      const data = d.data();
      let code = data.code;
      if (!code || !code.trim()) {
        const clean = (data.name || 'MON')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .split(' ').filter(Boolean);
        code = clean.length === 1 ? clean[0].slice(0, 4).toUpperCase() : clean.map(w => w[0].toUpperCase()).join('').slice(0, 6);
        await setDoc(doc(db, 'subjectsV2', d.id), { code }, { merge: true });
      }
      subjectCodeMap.set(d.id, code);
    }

    const examSnap = await getDocs(collection(db, 'examsV2'));
    const subjectExamsCounter = new Map();

    for (const d of examSnap.docs) {
      const data = d.data();
      let code = data.code;
      const subjId = data.subjectId;
      const subjCode = subjectCodeMap.get(subjId) || 'MON';
      const updates = {};

      if (!code || !code.trim()) {
        const currentCount = (subjectExamsCounter.get(subjId) || 0) + 1;
        subjectExamsCounter.set(subjId, currentCount);
        code = `${subjCode}_BAI_${String(currentCount).padStart(2, '0')}`;
        updates.code = code;
        updates.subjectCode = subjCode;
      }

      if (data.questionCount === undefined) {
        try {
          const qSnap = await getDocs(collection(db, 'examsV2', d.id, 'questions'));
          updates.questionCount = qSnap.size;
        } catch {
          updates.questionCount = 0;
        }
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(doc(db, 'examsV2', d.id), updates, { merge: true });
      }
    }
    console.log('[StorageV2] Normalized Subject, Exam codes & question counts successfully ✓');
  } catch (e) {
    console.warn('[StorageV2] runCodeNormalization warning:', e);
  }
}

