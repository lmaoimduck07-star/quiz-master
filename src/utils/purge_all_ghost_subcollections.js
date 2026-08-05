import { initializeApp } from 'firebase/app';
import { initializeFirestore, collectionGroup, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDsGhx8kdy1JA0BgWs5PgpKXpnHRTlRWsQ",
  authDomain: "du-an-7ea99.firebaseapp.com",
  projectId: "du-an-7ea99",
  storageBucket: "du-an-7ea99.firebasestorage.app",
  messagingSenderId: "622007853587",
  appId: "1:622007853587:web:935a2f8bc32398f0bcd5e6"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

async function purgeGhostSubcollections() {
  console.log('📌 QUÉT TẤT CẢ SUBCOLLECTION ANSWERS BẰNG COLLECTIONGROUP...');
  
  const groupSnap = await getDocs(collectionGroup(db, 'answers'));
  console.log(`Tìm thấy tổng cộng ${groupSnap.size} documents trong tất cả các subcollection 'answers'.`);

  let purgedCount = 0;
  for (const d of groupSnap.docs) {
    // d.ref.parent.parent là doc session cha
    const sessionRef = d.ref.parent.parent;
    if (sessionRef) {
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists() || sessionSnap.data()?.status === 'deleted') {
        console.log(`🗑️ Đang xóa answer rác thuộc session đã bị xóa (Session ID: ${sessionRef.id}, Answer ID: ${d.id})`);
        await deleteDoc(d.ref);
        purgedCount++;
      }
    }
  }

  console.log(`🎉 ĐÃ XÓA TRIỆT ĐỂ ${purgedCount} DỮ LIỆU RÁC SUBCOLLECTION TRÊN FIREBASE!`);
  process.exit(0);
}

purgeGhostSubcollections();
