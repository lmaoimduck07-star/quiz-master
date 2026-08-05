import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

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

async function inspectExams() {
  const subSnap = await getDocs(collection(db, 'subjectsV2'));
  const subjects = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('SUBJECTS:', subjects);

  const examSnap = await getDocs(collection(db, 'examsV2'));
  const exams = examSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('EXAMS:', exams);

  process.exit(0);
}

inspectExams();
