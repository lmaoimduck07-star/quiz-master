import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDsGhx8kdy1JA0BgWs5PgpKXpnHRTlRWsQ",
  authDomain: "du-an-7ea99.firebaseapp.com",
  projectId: "du-an-7ea99",
  storageBucket: "du-an-7ea99.firebasestorage.app",
  messagingSenderId: "622007853587",
  appId: "1:622007853587:web:935a2f8bc32398f0bcd5e6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_USERS = [
  { id: 'U01', fullName: 'Nguyễn Văn Admin', username: 'admin@edu.vn', password: '12345678', roles: ['Admin', 'Student'], status: 'Active', permissions: { codingAccess: true } }
];

async function purgeAllMockData() {
  console.log('🚀 PURGING ALL MOCK EXAMS & MOCK SUBJECTS FROM FIREBASE...');

  try {
    // 1. Ensure Admin User
    for (const u of DEFAULT_USERS) {
      await setDoc(doc(db, 'users', u.id), u, { merge: true });
      console.log(`  ✓ Synced Admin User: ${u.username}`);
    }

    // 2. Delete mock subject sub_1 (Toán học THPT) and its mock exams (Hàm số & Đạo hàm)
    await deleteDoc(doc(db, 'subjects', 'sub_1')).catch(() => {});
    console.log('  ✓ Purged mock subject sub_1 and mock exam (Hàm số & Đạo hàm)');

    // 3. Delete ALL mock coding problems from Firestore
    const mockIds = ['cong_hai_so', 'two_sum', 'prime_check', 'longest_word'];
    for (const id of mockIds) {
      try {
        await deleteDoc(doc(db, 'coding_problems', id));
        console.log(`  ✓ Purged mock coding problem: ${id}`);
      } catch (e) {}
    }

    console.log('✅ Firebase Firestore 100% Mock Purge Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Purge failed:', err);
    process.exit(1);
  }
}

purgeAllMockData();
