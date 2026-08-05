import { db } from '../firebase/config.js';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

async function migrateDatabase() {
  console.log('🚀 BẮT ĐẦU MIGRATION DỮ LIỆU SANG V2...');
  
  try {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    let totalSubjects = 0;
    let totalExams = 0;
    let totalQuestions = 0;

    for (const subjectDoc of subjectsSnap.docs) {
      const oldSubject = { id: subjectDoc.id, ...subjectDoc.data() };
      
      // 1. Tạo subjectV2 (loại bỏ exams và codingProblems)
      const subjectV2 = {
        id: oldSubject.id,
        name: oldSubject.name || '',
        description: oldSubject.description || '',
        status: oldSubject.status || 'normal',
        isCompleted: oldSubject.isCompleted || false,
        createdAt: oldSubject.createdAt || new Date().toISOString()
      };
      
      await setDoc(doc(db, 'subjectsV2', subjectV2.id), subjectV2);
      totalSubjects++;
      console.log(`✅ Đã migrate Subject: ${subjectV2.name}`);

      // 2. Tách exams ra
      const exams = oldSubject.exams || [];
      for (const oldExam of exams) {
        const examId = oldExam.id || `exam_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const examV2 = {
          id: examId,
          subjectId: subjectV2.id,
          title: oldExam.title || (oldExam.config ? oldExam.config.title : 'Đề luyện tập'),
          config: oldExam.config || {
            time: 15,
            password: '',
            shuffleQ: true,
            shuffleA: true
          }
        };

        await setDoc(doc(db, 'examsV2', examV2.id), examV2);
        totalExams++;
        console.log(`   - Đã migrate Exam: ${examV2.title}`);

        // 3. Tách questions vào subcollection
        const questions = oldExam.questions || [];
        if (questions.length > 0) {
          const batch = writeBatch(db);
          questions.forEach(q => {
            const qId = q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const qRef = doc(db, 'examsV2', examV2.id, 'questions', qId);
            batch.set(qRef, { ...q, id: qId });
            totalQuestions++;
          });
          await batch.commit();
          console.log(`     -> Đã migrate ${questions.length} questions cho Exam này.`);
        }
      }
    }

    console.log('🎉 MIGRATION HOÀN TẤT!');
    console.log(`Thống kê: ${totalSubjects} Subjects, ${totalExams} Exams, ${totalQuestions} Questions.`);
    process.exit(0);

  } catch (error) {
    console.error('❌ LỖI KHI MIGRATION:', error);
    process.exit(1);
  }
}

migrateDatabase();
