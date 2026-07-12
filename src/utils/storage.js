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
