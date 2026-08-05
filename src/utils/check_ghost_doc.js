import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function checkGhostDoc() {
  const ghostId = 'P_U17846_NN4_161355_7LH';
  console.log(`📌 Kiểm tra Document: active_sessionsV2/${ghostId}`);
  
  const snap = await getDoc(doc(db, 'active_sessionsV2', ghostId));
  console.log(`Doc exists? ${snap.exists()}`);
  if (snap.exists()) {
    console.log('Data:', snap.data());
  }

  const ansSnap = await getDocs(collection(db, 'active_sessionsV2', ghostId, 'answers'));
  console.log(`Subcollection 'answers' size: ${ansSnap.size}`);
  ansSnap.docs.forEach(d => console.log(`  Answer ID: ${d.id}`, d.data()));

  process.exit(0);
}

checkGhostDoc();
