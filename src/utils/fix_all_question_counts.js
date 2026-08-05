import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

async function fixQuestionCounts() {
  console.log('📌 CẬP NHẬT TRƯỜNG QUESTIONCOUNT CHO TOÀN BỘ ĐỀ THI V2...');
  const examSnap = await getDocs(collection(db, 'examsV2'));

  for (const d of examSnap.docs) {
    const exam = { id: d.id, ...d.data() };
    const qSnap = await getDocs(collection(db, 'examsV2', exam.id, 'questions'));
    console.log(`➡️ Đề "${exam.title}" (${exam.id}): Cập nhật questionCount = ${qSnap.size}`);
    await setDoc(doc(db, 'examsV2', exam.id), { questionCount: qSnap.size }, { merge: true });
  }

  console.log('🎉 CẬP NHẬT THÀNH CÔNG SỐ LƯỢNG CÂU HỎI CHO TOÀN BỘ ĐỀ THI!');
  process.exit(0);
}

fixQuestionCounts();
