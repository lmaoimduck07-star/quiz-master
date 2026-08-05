import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';

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

async function purgeOrphanedSubcollections() {
  console.log('📌 KIỂM TRA VÀ DỌN DẸP SUBCOLLECTION RÁC NẰM TRONG ACTIVE_SESSIONSV2...');
  
  const snap = await getDocs(collection(db, 'active_sessionsV2'));
  console.log(`Tìm thấy ${snap.size} top-level documents trong active_sessionsV2.`);

  for (const d of snap.docs) {
    const sessionId = d.id;
    console.log(`🔍 Đang kiểm tra Session ID: ${sessionId}`);
    
    // Check answers subcollection
    const ansSnap = await getDocs(collection(db, 'active_sessionsV2', sessionId, 'answers'));
    console.log(`   Subcollection answers size = ${ansSnap.size}`);

    // If session status is deleted or user wants it deleted, purge subcollection
    if (d.data().status === 'deleted') {
      console.log(`🗑️ Đang xóa triệt để session đã bị xóa từ trước: ${sessionId}`);
      if (!ansSnap.empty) {
        const batch = writeBatch(db);
        ansSnap.docs.forEach(ansDoc => batch.delete(ansDoc.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'active_sessionsV2', sessionId));
    }
  }

  process.exit(0);
}

purgeOrphanedSubcollections();
