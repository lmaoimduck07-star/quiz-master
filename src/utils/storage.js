// src/utils/storage.js
// Layer trừu tượng hoá database — giao tiếp với Firebase Firestore
// Tất cả hàm đều async (Firestore là bất đồng bộ)

import {
  collection, doc,
  getDocs, getDoc,
  setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─────────────────────────────────────────────
// DỮ LIỆU MẶC ĐỊNH (seed khi Firestore trống)
// ─────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: 'U01', fullName: 'Nguyễn Văn Admin', username: 'admin@edu.vn', password: '12345678', roles: ['Admin', 'Student'], status: 'Active', permissions: { codingAccess: true } },
  { id: 'U02', fullName: 'Trần Học Sinh', username: 'hs_tran', password: '12345678', roles: ['Student'], status: 'Active', permissions: { codingAccess: false } },
  { id: 'U03', fullName: 'Lê Học Sinh', username: 'hs_le', password: '12345678', roles: ['Student'], status: 'Locked', permissions: { codingAccess: false } },
];

const DEFAULT_SUBJECTS = [
  {
    id: 'sub_1',
    name: 'Toán học THPT',
    isActive: true,
    exams: [
      {
        id: 'ex_1',
        config: { title: 'Luyện tập: Hàm số & Đạo hàm', time: 15, password: '', shuffleQ: true, shuffleA: true },
        created: '10/07/2026',
        questions: [
          { id: 'q1_1', content: 'Đạo hàm của hàm số y = x^2 là:', options: ["y' = 2x", "y' = x", "y' = 2", "y' = x^3"], answer: 0 },
          { id: 'q1_2', content: 'Hàm số y = x^3 - 3x đồng biến trên khoảng nào?', options: ['(-1; 1)', '(-inf; -1) và (1; +inf)', '(-inf; 1)', '(-1; +inf)'], answer: 1 },
          { id: 'q1_3', content: 'Tâm đối xứng của đồ thị hàm số bậc ba y = x^3 là:', options: ['(0; 0)', '(1; 1)', '(0; 1)', '(1; 0)'], answer: 0 },
          { id: 'q1_4', content: 'Hàm số y = sin(x) tuần hoàn với chu kỳ:', options: ['pi', '2*pi', 'pi/2', '3*pi'], answer: 1 },
          { id: 'q1_5', content: 'Số điểm cực trị của hàm số y = x^4 - 2x^2 + 1 là:', options: ['1', '2', '3', '0'], answer: 2 },
        ]
      },
    ]
  },
];

// ─────────────────────────────────────────────
// HELPER: Kiểm tra collection có trống không
// ─────────────────────────────────────────────
async function isCollectionEmpty(collectionName) {
  const snap = await getDocs(query(collection(db, collectionName), limit(1)));
  return snap.empty;
}

// ─────────────────────────────────────────────
// SEED: Đưa dữ liệu mặc định lên Firestore (chỉ chạy lần đầu)
// ─────────────────────────────────────────────
let seedDone = false;

export async function ensureSeeded() {
  if (seedDone) return;
  try {
    const usersEmpty = await isCollectionEmpty('users');
    if (usersEmpty) {
      console.log('[Storage] Seeding default users...');
      const batch = writeBatch(db);
      DEFAULT_USERS.forEach(user => {
        batch.set(doc(db, 'users', user.id), user);
      });
      await batch.commit();
      console.log('[Storage] Users seeded ✓');
    }

    const subjectsEmpty = await isCollectionEmpty('subjects');
    if (subjectsEmpty) {
      console.log('[Storage] Seeding default subjects...');
      const batch = writeBatch(db);
      DEFAULT_SUBJECTS.forEach(subject => {
        batch.set(doc(db, 'subjects', subject.id), subject);
      });
      await batch.commit();
      console.log('[Storage] Subjects seeded ✓');
    }

    seedDone = true;
    console.log('[Storage] Firestore ready ✓');
  } catch (e) {
    console.error('[Storage] Seed failed (will retry on next call):', e);
  }
}

// Chạy seed ngay khi module load (background)
ensureSeeded();

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('[Storage] loadUsers ->', users.length, 'users');
    return users;
  } catch (e) {
    console.error('[Storage] loadUsers error:', e);
    return [];
  }
}

async function saveUsers(users) {
  try {
    const batch = writeBatch(db);
    // Lấy IDs hiện có để xóa user bị remove
    const existing = await getDocs(collection(db, 'users'));
    const existingIds = new Set(existing.docs.map(d => d.id));
    const newIds = new Set(users.map(u => u.id));

    // Xóa user không còn trong list
    existing.docs.forEach(d => {
      if (!newIds.has(d.id)) batch.delete(doc(db, 'users', d.id));
    });

    // Upsert tất cả users
    users.forEach(user => {
      batch.set(doc(db, 'users', user.id), user, { merge: true });
    });

    await batch.commit();
    console.log('[Storage] saveUsers -> saved', users.length, 'users');
  } catch (e) {
    console.error('[Storage] saveUsers FAILED:', e);
  }
}

// ─────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────
async function loadSubjects() {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    const subjects = snap.docs.map(d => {
      const data = { id: d.id, ...d.data() };
      // Đảm bảo mỗi exam có config đúng định dạng
      const exams = (data.exams || []).map(ex => {
        if (!ex.config) {
          return {
            ...ex,
            config: {
              title: ex.title || 'Đề luyện tập',
              time: ex.time || 15,
              password: '',
              shuffleQ: true,
              shuffleA: true
            }
          };
        }
        return ex;
      });
      return { ...data, exams };
    });
    return subjects;
  } catch (e) {
    console.error('[Storage] loadSubjects error:', e);
    return [];
  }
}

async function saveSubjects(subjects) {
  try {
    const batch = writeBatch(db);

    // Xóa subjects không còn trong list
    const existing = await getDocs(collection(db, 'subjects'));
    const newIds = new Set(subjects.map(s => s.id));
    existing.docs.forEach(d => {
      if (!newIds.has(d.id)) batch.delete(doc(db, 'subjects', d.id));
    });

    // Upsert tất cả subjects
    subjects.forEach(subject => {
      batch.set(doc(db, 'subjects', subject.id), subject, { merge: true });
    });

    await batch.commit();
  } catch (e) {
    console.error('[Storage] saveSubjects FAILED:', e);
  }
}

// ─────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────
async function loadAuditLogs() {
  try {
    const snap = await getDocs(
      query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(200))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[Storage] loadAuditLogs error:', e);
    return [];
  }
}

let cachedUserIp = 'Fetching...';
let cachedUserLoc = 'Địa phương';

// Tự động gọi API lấy IP công cộng và vị trí khi script được load
try {
  fetch('https://freeipapi.com/api/json')
    .then(res => res.json())
    .then(data => {
      if (data?.ipAddress) {
        cachedUserIp = data.ipAddress;
        const locParts = [data.cityName, data.regionName, data.countryName].filter(Boolean);
        cachedUserLoc = locParts.length > 0 ? locParts.join(', ') : 'Không rõ';
      }
    })
    .catch(() => {
      cachedUserIp = '127.0.0.1';
      cachedUserLoc = 'Địa phương';
    });
} catch (_) {
  cachedUserIp = '127.0.0.1';
  cachedUserLoc = 'Địa phương';
}

async function addAuditLog(log) {
  try {
    let finalIp = cachedUserIp;
    let finalLoc = cachedUserLoc;
    
    // Nếu chưa fetch kịp thì thử fetch nhanh với timeout 2 giây
    if (finalIp === 'Fetching...') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch('https://freeipapi.com/api/json', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        if (data?.ipAddress) {
          finalIp = data.ipAddress;
          const locParts = [data.cityName, data.regionName, data.countryName].filter(Boolean);
          finalLoc = locParts.length > 0 ? locParts.join(', ') : 'Không rõ';
          cachedUserIp = data.ipAddress;
          cachedUserLoc = finalLoc;
        } else {
          finalIp = '127.0.0.1';
          finalLoc = 'Địa phương';
        }
      } catch (_) {
        finalIp = '127.0.0.1';
        finalLoc = 'Địa phương';
      }
    }

    const newLog = {
      time: new Date().toLocaleString('vi-VN'),
      timestamp: serverTimestamp(), // dùng để sort
      ip: finalIp,
      location: finalLoc,
      device: navigator.userAgent.includes('Windows') ? 'Chrome - Windows' : 'Mobile - Browser',
      userAgent: navigator.userAgent,
      ...log
    };
    await addDoc(collection(db, 'auditLogs'), newLog);
  } catch (e) {
    console.error('[Storage] addAuditLog FAILED:', e);
  }
}

// ─────────────────────────────────────────────
// EXAM RESULTS
// ─────────────────────────────────────────────
async function saveExamResult(result) {
  try {
    await addDoc(collection(db, 'examResults'), {
      ...result,
      savedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[Storage] saveExamResult FAILED:', e);
  }
}

async function loadExamResults(userId) {
  try {
    const snap = await getDocs(
      query(collection(db, 'examResults'), orderBy('savedAt', 'desc'), limit(100))
    );
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return userId ? all.filter(r => r.userId === userId) : all;
  } catch (e) {
    console.error('[Storage] loadExamResults error:', e);
    return [];
  }
}

// ─────────────────────────────────────────────
// EXPORT — giữ nguyên interface cũ để không phá vỡ code hiện có
// ─────────────────────────────────────────────
export const storage = {
  loadUsers,
  saveUsers,
  loadSubjects,
  saveSubjects,
  loadAuditLogs,
  addAuditLog,
  saveExamResult,
  loadExamResults,
};
