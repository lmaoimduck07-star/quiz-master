// src/utils/storage.js
// Layer trừu tượng hoá database — giao tiếp với Firebase Firestore
// Tất cả hàm đều async (Firestore là bất đồng bộ)

import {
  collection, doc,
  getDocs, getDoc,
  setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, writeBatch,
  serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─────────────────────────────────────────────
// DỮ LIỆU MẶC ĐỊNH (seed khi Firestore trống)
// ─────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: 'U01', fullName: 'Nguyễn Văn Admin', username: 'admin@edu.vn', password: '12345678', roles: ['Admin', 'Student'], status: 'Active', permissions: { codingAccess: true } }
];

const DEFAULT_SUBJECTS = [];

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
    const users = snap.docs.map(d => ({ ...d.data(), id: d.id }));
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
      const normalizedUser = { ...user, id: user.id };
      batch.set(doc(db, 'users', user.id), normalizedUser, { merge: true });
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
      // Đảm bảo có trường status mặc định
      if (!data.status) {
        data.status = 'normal';
      }
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

let cachedIpInfo = {
  publicIpv4: 'Fetching...',
  publicIpv6: 'Fetching...',
  localIp: 'Fetching...'
};

let cachedLocInfo = {
  cityName: '',
  regionName: '',
  countryName: '',
  zipCode: '',
  latitude: null,
  longitude: null,
  timeZone: ''
};

// 1. Lấy IP cục bộ (Local IP) qua WebRTC leak
const getLocalIpHelper = () => {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const parts = ice.candidate.candidate.split(' ');
        const ip = parts[4];
        if (ip && (ip.includes('.') || ip.includes(':'))) {
          if (ip.endsWith('.local')) {
            resolve('Ẩn (mDNS Security)');
          } else {
            resolve(ip);
          }
          pc.close();
        }
      };
      setTimeout(() => {
        pc.close();
        resolve('Ẩn (mDNS Security)');
      }, 1000);
    } catch (_) {
      resolve('Bị chặn bởi trình duyệt');
    }
  });
};

getLocalIpHelper().then(ip => {
  cachedIpInfo.localIp = ip;
});

// 2. Chuỗi gọi API lấy Vị trí địa lý và IP nâng cao (thử tuần tự để tránh lỗi)
const fetchLocationInfo = async () => {
  // Thử API 1: ipwho.is (Rất nhanh, hỗ trợ CORS và HTTPS tốt)
  try {
    const res = await fetch('https://ipwho.is/');
    const data = await res.json();
    if (data && data.success) {
      cachedIpInfo.publicIpv4 = data.ip;
      cachedLocInfo = {
        cityName: data.city || '',
        regionName: data.region || '',
        countryName: data.country || '',
        zipCode: data.postal || '',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timeZone: data.timezone?.id || ''
      };
      console.log('[Storage] IP & Geolocation initialized via ipwho.is:', cachedIpInfo.publicIpv4, cachedLocInfo);
      return;
    }
  } catch (_) {}

  // Thử API 2: geolocation-db.com (Không giới hạn, rất tin cậy ở Việt Nam)
  try {
    const res = await fetch('https://geolocation-db.com/json/');
    const data = await res.json();
    if (data && data.IPv4) {
      cachedIpInfo.publicIpv4 = data.IPv4;
      cachedLocInfo = {
        cityName: data.city || '',
        regionName: data.state || '',
        countryName: data.country_name || '',
        zipCode: data.postal || '',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timeZone: ''
      };
      console.log('[Storage] IP & Geolocation initialized via geolocation-db:', cachedIpInfo.publicIpv4, cachedLocInfo);
      return;
    }
  } catch (_) {}

  // Thử API 3: ipapi.co (Fallback 2)
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data && !data.error) {
      cachedIpInfo.publicIpv4 = data.ip;
      cachedLocInfo = {
        cityName: data.city || '',
        regionName: data.region || '',
        countryName: data.country_name || '',
        zipCode: data.postal || '',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timeZone: data.timezone || ''
      };
      console.log('[Storage] IP & Geolocation initialized via ipapi.co:', cachedIpInfo.publicIpv4, cachedLocInfo);
      return;
    }
  } catch (_) {}

  // Thử API 4: freeipapi.com (Fallback 3)
  try {
    const res = await fetch('https://freeipapi.com/api/json');
    const data = await res.json();
    if (data) {
      cachedIpInfo.publicIpv4 = data.ipAddress || '127.0.0.1';
      cachedLocInfo = {
        cityName: data.cityName || '',
        regionName: data.regionName || '',
        countryName: data.countryName || '',
        zipCode: data.zipCode || '',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timeZone: data.timeZone || ''
      };
      console.log('[Storage] IP & Geolocation initialized via freeipapi.com:', cachedIpInfo.publicIpv4, cachedLocInfo);
      return;
    }
  } catch (_) {}

  // Thử API 5: Cloudflare trace (Ultimate fallback - Không thể bị chặn)
  try {
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
    const text = await res.text();
    const lines = text.split('\n');
    const traceInfo = {};
    lines.forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        traceInfo[parts[0].trim()] = parts[1].trim();
      }
    });

    if (traceInfo.ip) {
      cachedIpInfo.publicIpv4 = traceInfo.ip;
      const countryNames = { 'VN': 'Việt Nam', 'US': 'Hoa Kỳ', 'SG': 'Singapore', 'JP': 'Nhật Bản' };
      cachedLocInfo = {
        cityName: 'Truy cập qua Cloudflare CDN',
        regionName: '',
        countryName: countryNames[traceInfo.loc] || traceInfo.loc || 'Việt Nam',
        zipCode: '',
        latitude: null,
        longitude: null,
        timeZone: ''
      };
      console.log('[Storage] IP & Country initialized via Cloudflare Trace:', cachedIpInfo.publicIpv4, cachedLocInfo);
      return;
    }
  } catch (_) {}

  console.warn('[Storage] All Geolocation APIs failed. Fallback to local network defaults.');
};

fetchLocationInfo();

// 3. Lấy Public IPv6 (api64.ipify.org trả về IPv6 nếu có, ngược lại trả về IPv4)
fetch('https://api64.ipify.org?format=json')
  .then(res => res.json())
  .then(data => {
    if (data?.ip) {
      cachedIpInfo.publicIpv6 = data.ip.includes(':') ? data.ip : 'Không hỗ trợ IPv6';
    }
  })
  .catch(() => {
    cachedIpInfo.publicIpv6 = 'Không hỗ trợ IPv6';
  });

async function addAuditLog(log) {
  try {
    // Đợi tối đa 1.5 giây để đảm bảo có IP và Vị trí nếu là lần chạy đầu tiên
    if (cachedIpInfo.publicIpv4 === 'Fetching...' || cachedLocInfo.cityName === '') {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const flatLocParts = [cachedLocInfo.cityName, cachedLocInfo.regionName, cachedLocInfo.countryName].filter(Boolean);
    const flatLocation = flatLocParts.length > 0 ? flatLocParts.join(', ') : 'Địa phương';

    const newLog = {
      time: new Date().toLocaleString('vi-VN'),
      timestamp: serverTimestamp(), // dùng để sort
      ip: cachedIpInfo.publicIpv4 !== 'Fetching...' ? cachedIpInfo.publicIpv4 : '127.0.0.1',
      location: flatLocation,
      device: navigator.userAgent.includes('Windows') ? 'Chrome - Windows' : 'Mobile - Browser',
      userAgent: navigator.userAgent,
      // Thêm thông tin cấu trúc nâng cao để hiển thị chi tiết
      ipInfo: {
        publicIpv4: cachedIpInfo.publicIpv4,
        publicIpv6: cachedIpInfo.publicIpv6,
        localIp: cachedIpInfo.localIp
      },
      locationInfo: { ...cachedLocInfo },
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
// CODING PROBLEMS (Đã đồng bộ trực tiếp lên Firebase Firestore)
// ─────────────────────────────────────────────
const DEFAULT_CODING_PROBLEMS = [];

function filterOldTestProblems(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(p => p.id !== 'two_sum' && p.id !== 'prime_check' && p.id !== 'longest_word');
}

async function loadCodingProblems() {
  try {
    let allProblems = [];

    // 1. Tải từ collection 'coding_problems' trong Firestore
    const snap = await getDocs(collection(db, 'coding_problems'));
    if (!snap.empty) {
      snap.docs.forEach(d => {
        allProblems.push({ id: d.id, ...d.data() });
      });
    }

    // 2. Tải từ các môn học trong Firestore có chứa codingProblems
    try {
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      subjectsSnap.docs.forEach(d => {
        const sData = d.data();
        if (Array.isArray(sData.codingProblems) && sData.codingProblems.length > 0) {
          sData.codingProblems.forEach(p => {
            if (!allProblems.some(existing => existing.id === p.id)) {
              allProblems.push({ ...p, subjectId: d.id });
            }
          });
        }
      });
    } catch (e) {
      console.warn('[Storage] loadCodingProblems -> warning reading subjects coding problems:', e);
    }

    allProblems = filterOldTestProblems(allProblems);
    allProblems = allProblems.map(p => {
      if (p.templates && p.templates.javascript) {
        const { javascript, ...rest } = p.templates;
        return { ...p, templates: rest };
      }
      return p;
    });

    if (allProblems.length > 0) {
      localStorage.setItem('qm_coding_problems', JSON.stringify(allProblems));
      return allProblems;
    }

    // 3. Fallback sang LocalStorage nếu Firestore chưa có dữ liệu
    const localData = localStorage.getItem('qm_coding_problems');
    let problems = localData ? JSON.parse(localData) : DEFAULT_CODING_PROBLEMS;
    problems = filterOldTestProblems(problems);
    problems = problems.map(p => {
      if (p.templates && p.templates.javascript) {
        const { javascript, ...rest } = p.templates;
        return { ...p, templates: rest };
      }
      return p;
    });
    return problems;
  } catch (e) {
    console.error('[Storage] loadCodingProblems error:', e);
    try {
      const localData = localStorage.getItem('qm_coding_problems');
      return localData ? JSON.parse(localData) : DEFAULT_CODING_PROBLEMS;
    } catch (err) {
      return DEFAULT_CODING_PROBLEMS;
    }
  }
}

async function saveCodingProblems(problems) {
  try {
    const clean = filterOldTestProblems(problems);
    localStorage.setItem('qm_coding_problems', JSON.stringify(clean));

    // Upsert tất cả đề thi lập trình lên Firestore collection 'coding_problems'
    const batch = writeBatch(db);
    const existing = await getDocs(collection(db, 'coding_problems'));
    const existingIds = new Set(existing.docs.map(d => d.id));
    const newIds = new Set(clean.map(p => p.id));

    // Xóa đề thi không còn trong danh sách
    existing.docs.forEach(d => {
      if (!newIds.has(d.id)) batch.delete(doc(db, 'coding_problems', d.id));
    });

    // Upsert đề thi mới/sửa
    clean.forEach(prob => {
      batch.set(doc(db, 'coding_problems', prob.id), prob, { merge: true });
    });

    await batch.commit();
    console.log('[Storage] saveCodingProblems -> synced to Firestore & LocalStorage ✓', clean.length, 'problems');
  } catch (e) {
    console.error('[Storage] saveCodingProblems FAILED:', e);
  }
}


// ─────────────────────────────────────────────
// SUBJECT-SPECIFIC CODING CONFIGS (LocalStorage)
// ─────────────────────────────────────────────
function loadSubjectCodingConfig(subjectId) {
  try {
    const data = localStorage.getItem(`qm_subj_coding_${subjectId}`);
    return data ? JSON.parse(data) : { isCoding: false };
  } catch (e) {
    return { isCoding: false };
  }
}

function saveSubjectCodingConfig(subjectId, config) {
  try {
    localStorage.setItem(`qm_subj_coding_${subjectId}`, JSON.stringify(config));
  } catch (e) {
    console.error('[Storage] saveSubjectCodingConfig FAILED:', e);
  }
}

function loadSubjectCodingProblems(subjectId, subjectsList = []) {
  try {
    // 1. Kiểm tra trong subjectsList (nếu có từ Firestore)
    if (Array.isArray(subjectsList) && subjectsList.length > 0) {
      const sub = subjectsList.find(s => s.id === subjectId);
      if (sub) {
        let extractedProblems = [];
        // Tìm các field dạng bai_1, bai_2, lesson_1...
        Object.keys(sub).forEach(key => {
          if ((key.startsWith('bai_') || key.startsWith('lesson_') || key.startsWith('prob_')) && typeof sub[key] === 'object' && sub[key] !== null) {
            extractedProblems.push(sub[key]);
          }
        });
        if (extractedProblems.length === 0 && Array.isArray(sub.codingProblems)) {
          extractedProblems = sub.codingProblems;
        }
        if (extractedProblems.length > 0) {
          const clean = filterOldTestProblems(extractedProblems);
          localStorage.setItem(`qm_subj_coding_probs_${subjectId}`, JSON.stringify(clean));
          return clean;
        }
      }
    }

    // 2. Lấy từ LocalStorage
    const data = localStorage.getItem(`qm_subj_coding_probs_${subjectId}`);
    if (!data) return [];
    let problems = JSON.parse(data);
    problems = filterOldTestProblems(problems);
    problems = problems.map(p => {
      if (p.templates && p.templates.javascript) {
        const { javascript, ...rest } = p.templates;
        return { ...p, templates: rest };
      }
      return p;
    });
    return problems;
  } catch (e) {
    console.error('[Storage] loadSubjectCodingProblems error:', e);
    return [];
  }
}

async function saveSubjectCodingProblems(subjectId, problems) {
  try {
    const clean = filterOldTestProblems(problems);
    localStorage.setItem(`qm_subj_coding_probs_${subjectId}`, JSON.stringify(clean));

    // Tạo các field riêng biệt bai_1, bai_2, bai_3... trực tiếp trên Firestore Document của môn học
    const updateData = {
      codingProblems: clean,
      isCoding: true,
    };

    clean.forEach((prob, idx) => {
      const lessonNum = prob.lessonNo || (idx + 1);
      const fieldKey = `bai_${lessonNum}`;
      updateData[fieldKey] = {
        ...prob,
        lessonNo: lessonNum,
        updatedAt: new Date().toISOString()
      };
    });

    // Cập nhật lên Firestore môn học
    await setDoc(doc(db, 'subjects', subjectId), updateData, { merge: true });

    // Tạo thêm Subcollection 'lessons' trên Firestore cho từng bài
    try {
      const batch = writeBatch(db);
      clean.forEach((prob, idx) => {
        const lessonNum = prob.lessonNo || (idx + 1);
        const lessonDocId = prob.id ? prob.id : `bai_${lessonNum}`;
        batch.set(doc(db, 'subjects', subjectId, 'lessons', lessonDocId), {
          ...prob,
          lessonNo: lessonNum,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });
      await batch.commit();
      console.log(`[Storage] Synced lessons to Firestore as separate fields (bai_1, bai_2...) & subcollection ✓`);
    } catch (subErr) {
      console.warn('[Storage] Subcollection lessons sync warning:', subErr);
    }

    console.log('[Storage] saveSubjectCodingProblems -> saved to Firestore & LocalStorage ✓');
  } catch (e) {
    console.error('[Storage] saveSubjectCodingProblems FAILED:', e);
  }
}

// ─────────────────────────────────────────────
// LOCK USER (Khóa tài khoản trực tiếp qua Firestore)
// ─────────────────────────────────────────────
async function lockUserById(userId, reason = 'Vi phạm bảo mật') {
  try {
    await updateDoc(doc(db, 'users', userId), {
      status: 'Locked',
      lockedAt: new Date().toISOString(),
      lockReason: reason,
    });
    console.log(`[Storage] lockUserById -> User ${userId} đã bị khóa. Lý do: ${reason}`);
    return true;
  } catch (e) {
    console.error('[Storage] lockUserById FAILED:', e);
    return false;
  }
}

// ─────────────────────────────────────────────
// SYSTEM SETTINGS (Cấu hình hệ thống Piston & Gemini)
// ─────────────────────────────────────────────
async function loadSystemSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'config'));
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('[Storage] loadSystemSettings warning:', e);
  }
  return {
    pistonUrl: localStorage.getItem('qm_piston_url') || '',
    geminiKey: localStorage.getItem('qm_gemini_api_key') || '',
  };
}

async function saveSystemSettings(settings) {
  try {
    await setDoc(doc(db, 'settings', 'config'), settings, { merge: true });
    if (settings.pistonUrl) localStorage.setItem('qm_piston_url', settings.pistonUrl.trim());
    if (settings.geminiKey) localStorage.setItem('qm_gemini_api_key', settings.geminiKey.trim());
    console.log('[Storage] saveSystemSettings -> saved successfully');
    return true;
  } catch (e) {
    console.error('[Storage] saveSystemSettings FAILED:', e);
    return false;
  }
}

// ─────────────────────────────────────────────
// REALTIME SUBSCRIPTIONS (Lắng nghe Firestore Realtime)
// ─────────────────────────────────────────────
function subscribeSubjects(callback) {
  return onSnapshot(collection(db, 'subjects'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, (err) => console.warn('[Storage] subscribeSubjects error:', err));
}

function subscribeUsers(callback) {
  return onSnapshot(collection(db, 'users'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, (err) => console.warn('[Storage] subscribeUsers error:', err));
}

function subscribeAuditLogs(callback) {
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, (err) => console.warn('[Storage] subscribeAuditLogs error:', err));
}

function subscribeActiveSessions(callback) {
  return onSnapshot(collection(db, 'active_sessions'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, (err) => console.warn('[Storage] subscribeActiveSessions error:', err));
}

async function updateActiveSession(sessionId, sessionData) {
  try {
    const nowIso = new Date().toISOString();
    await setDoc(doc(db, 'active_sessions', sessionId), {
      ...sessionData,
      lastActive: nowIso,
      onlineSince: sessionData.onlineSince || nowIso
    }, { merge: true });
  } catch (e) {
    console.warn('[Storage] updateActiveSession error:', e);
  }
}

async function terminateActiveSessionRemotely(sessionId) {
  try {
    await updateDoc(doc(db, 'active_sessions', sessionId), {
      status: 'terminated',
      terminatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Storage] terminateActiveSessionRemotely error:', e);
  }
}

async function sendAdminAlertToStudent(sessionId, message) {
  try {
    await updateDoc(doc(db, 'active_sessions', sessionId), {
      adminMessage: message,
      adminMessageTime: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Storage] sendAdminAlertToStudent error:', e);
  }
}

async function removeActiveSession(sessionId) {
  try {
    await deleteDoc(doc(db, 'active_sessions', sessionId));
  } catch (e) {
    console.warn('[Storage] removeActiveSession error:', e);
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
  loadCodingProblems,
  saveCodingProblems,
  loadSubjectCodingConfig,
  saveSubjectCodingConfig,
  loadSubjectCodingProblems,
  saveSubjectCodingProblems,
  lockUserById,
  loadSystemSettings,
  saveSystemSettings,
  subscribeSubjects,
  subscribeUsers,
  subscribeAuditLogs,
  subscribeActiveSessions,
  updateActiveSession,
  terminateActiveSessionRemotely,
  sendAdminAlertToStudent,
  removeActiveSession,
};
