import { useState, useEffect } from 'react';
import ExamCard from './ExamCard';
import RandomExamModal from './RandomExamModal';
import { ArrowLeft, Check, Dices, Download, Folder, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { storageV2 } from '../../utils/storageV2';

export default function ExamManager({ subject, onBack, onUpdateSubject, onOpenEditor, onPlayExam }) {
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [exams, setExams] = useState([]);

  useEffect(() => {
    if (!subject || !subject.id) {
      setExams([]);
      return;
    }
    const unsub = storageV2.subscribeExamsV2(subject.id, setExams);
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [subject?.id]);
  
  const handleRenameSubject = () => {
    const newName = prompt("Nhập tên mới cho môn học này:", subject.name);
    if (newName !== null && newName.trim() !== "" && newName.trim() !== subject.name) {
      onUpdateSubject({ ...subject, name: newName.trim() });
    }
  };

  // Hàm xử lý việc xóa đề thi
  const handleDeleteExam = async (examId) => {
    if (confirm("Bạn có chắc chắn muốn xóa đề thi này không?")) {
      await storageV2.deleteExamV2(examId);
    }
  };

  // Hàm xử lý chung cho Edit: Nếu có newConfig (Title mới) thì update ngay, nếu không thì mở màn hình Editor
  const handleEditExam = async (examId, newConfig) => {
    if (newConfig) {
      const exam = exams.find(e => e.id === examId);
      if (exam) {
        await storageV2.saveExamV2({ ...exam, config: newConfig });
      }
    } else {
      onOpenEditor(examId);
    }
  };

  // Hàm khóa / mở khóa đề thi
  const handleToggleLock = async (examId, currentIsLocked) => {
    await storageV2.toggleExamLockV2(examId, currentIsLocked);
  };

  // Hàm bật / tắt bảo trì đề thi
  const handleToggleMaintenance = async (examId, currentIsMaintenance) => {
    await storageV2.toggleExamMaintenanceV2(examId, currentIsMaintenance);
  };

  // Hàm dọn dẹp ghost documents (đề thi bị xóa nhưng còn "xác" trong Firestore)
  const handleCleanupGhostDocs = async () => {
    if (!confirm('Quét và xóa các ghost document (đề thi đã xóa còn sót lại trong database)?\nThao tác này không thể hoàn tác!')) return;
    try {
      // Load TẤT CẢ exams (không lọc theo môn) để tìm orphan
      const all = await storageV2.loadExamsV2();
      const ghosts = all.filter(e => !e.subjectId || !e.title);
      if (ghosts.length === 0) { alert('✅ Database sạch, không có ghost document nào!'); return; }
      let deleted = 0;
      for (const g of ghosts) {
        await storageV2.deleteExamV2(g.id);
        deleted++;
      }
      alert(`✅ Đã xóa ${deleted} ghost document thành công!`);
    } catch (e) {
      alert('❌ Lỗi khi dọn dẹp: ' + e.message);
    }
  };

  // Hàm đánh dấu hoàn thành môn (Khóa môn, không cho sửa điểm / đề thi nữa)
  const handleCompleteSubject = () => {
    if(confirm("Xác nhận chốt sổ môn này? Bạn sẽ không thể sửa đề thi hoặc điểm được nữa!")) {
      onUpdateSubject({ ...subject, isCompleted: true });
    }
  }

  // Hàm nhập hàng loạt đề thi từ các file HTML đã xuất
  const handleImportHtml = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const importedExams = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const htmlContent = e.target.result;
          
          const metaRegex = /<meta\s+id="quiz-data"\s+content="([^"]+)"/;
          const match = htmlContent.match(metaRegex);
          
          if (!match) {
            resolve({ success: false, fileName: file.name, error: "File HTML không chứa dữ liệu đề thi hợp lệ" });
            return;
          }
          
          const rawData = match[1];
          let payload = null;

          try {
            const b64_to_utf8 = (str) => decodeURIComponent(escape(window.atob(str)));
            payload = JSON.parse(b64_to_utf8(rawData));
          } catch (err) {
            resolve({ success: false, fileName: file.name, error: "Dữ liệu bị hỏng hoặc sai định dạng" });
            return;
          }

          if (payload && payload.config && payload.data) {
            const subjCode = subject.code || 'MON';
            const examCode = `${subjCode}_BAI_${String(importedExams.length + 1).padStart(2, '0')}`;
            const examId = examCode.toLowerCase();

            const normalizedQuestions = payload.data.map((q, qIdx) => {
              return {
                id: `q_${String(qIdx + 1).padStart(3, '0')}`,
                type: q.type || 'single',
                question: q.question || '',
                options: q.options || [],
                answer: q.answer !== undefined ? q.answer : 0,
                explanation: q.explanation || '',
                pairs: q.pairs || [],
                groups: q.groups || [],
                answers: q.answers || [],
                corrects: q.corrects || [],
                correct: q.correct !== undefined ? q.correct : true,
                items: q.items || []
              };
            });

            importedExams.push({
              id: examId,
              subjectId: subject.id,
              subjectCode: subjCode,
              code: examCode,
              title: payload.config.title || file.name.replace('.html', ''),
              config: {
                title: payload.config.title || file.name.replace('.html', ''),
                subject: payload.config.subject || subject.name,
                time: payload.config.time || 15,
                passScore: payload.config.passScore || 50,
                shuffle: payload.config.shuffle || false,
                mode: payload.config.mode || 'practice'
              },
              questions: normalizedQuestions
            });
            resolve({ success: true, fileName: file.name });
          } else {
            resolve({ success: false, fileName: file.name, error: "Cấu trúc file HTML không đúng chuẩn QuizMaster" });
          }
        };
        reader.onerror = () => {
          resolve({ success: false, fileName: file.name, error: "Lỗi đọc file" });
        };
        reader.readAsText(file);
      });

      if (result.success) {
        // Nạp thêm đề vừa import vào mảng tạm
      } else {
        errors.push(`${result.fileName}: ${result.error}`);
      }
    }

    if (importedExams.length > 0) {
      for (const ex of importedExams) {
        const { questions, ...examMeta } = ex;
        await storageV2.saveExamV2(examMeta);
        if (questions && questions.length > 0) {
          await storageV2.saveQuestionsV2(examMeta.id, questions);
        }
      }
    }

    let successMsg = importedExams.length > 0 ? `✅ Đã nhập thành công ${importedExams.length} đề thi!\n` : '';
    let errorMsg = errors.length > 0 ? `❌ Có ${errors.length} file bị lỗi:\n` + errors.join('\n') : '';
    alert(successMsg + errorMsg);

    // Reset file input
    event.target.value = null;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      
      {/* --- NÚT QUAY LẠI --- */}
      <Button 
        variant="outline"
        onClick={onBack}
        className="font-bold py-2 px-4 rounded-xl mb-6 flex items-center gap-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-850 text-xs transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại Trang chủ
      </Button>

      {/* --- BANNER THÔNG TIN MÔN HỌC --- */}
      <div className={`border p-5 md:p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 transition-colors ${subject.isCompleted ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 dark:bg-amber-950/30 p-3 rounded-xl shadow-inner text-amber-600 dark:text-amber-400 shrink-0">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 m-0 leading-tight flex items-center gap-2.5 flex-wrap">
              <span>{subject?.name || 'Môn học'}</span>
              <button
                type="button"
                onClick={handleRenameSubject}
                className="text-slate-400 hover:text-amber-500 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg p-1.5 transition cursor-pointer"
                title="Sửa tên môn học"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {subject.isCompleted && <span className="text-xs bg-emerald-500 text-white px-2.5 py-0.5 rounded-md font-semibold border-transparent">Đã chốt sổ</span>}
            </h1>
          </div>
        </div>
        
        {!subject.isCompleted && (
          <Button 
            variant="success"
            onClick={handleCompleteSubject}
            className="h-10 px-5 rounded-xl font-bold shadow-md gap-1.5 text-xs border-transparent shrink-0"
          >
            <Check className="h-4 w-4" /> Đánh Dấu Hoàn Thành
          </Button>
        )}
      </div>

      {/* --- DANH SÁCH ĐỀ THI --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-xl font-black text-slate-800 dark:text-white m-0 border-l-4 border-primary pl-3">
          Danh Sách Đề Thi
        </h3>
        
        {!subject.isCompleted && (
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setIsRandomModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-sm hover:shadow text-xs flex items-center gap-1.5 border-transparent cursor-pointer"
            >
              <Dices className="h-4 w-4" /> TRỘN ĐỀ NGẪU NHIÊN
            </button>
            <label className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-sm hover:shadow text-xs cursor-pointer flex items-center gap-1.5 border-transparent">
              <Download className="h-4 w-4" /> NHẬP HÀNG LOẠT (HTML)
              <input 
                type="file" 
                accept=".html" 
                multiple
                onChange={handleImportHtml} 
                className="hidden" 
              />
            </label>
            <Button 
              onClick={() => onOpenEditor(null)}
              className="h-9 px-4 rounded-xl font-bold shadow-sm text-xs gap-1.5 border-transparent"
            >
              <Plus className="h-4 w-4" /> SOẠN ĐỀ THI MỚI
            </Button>
            <button
              onClick={handleCleanupGhostDocs}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2.5 px-3 rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer"
              title="Xóa các ghost document (bài thi đã xóa còn sót trong DB)"
            >
              <Trash2 className="h-4 w-4" /> Dọn DB
            </button>
          </div>
        )}
      </div>

      {/* Render Lưới chứa Đề Thi */}
      <div className="flex flex-col gap-5">
        {!exams || exams.length === 0 ? (
          <div className="text-center p-16 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/50 text-lg transition-colors">
            Môn học này chưa có đề thi nào. Hãy bấm nút Soạn Đề bên trên!
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {exams.map(exam => (
              <ExamCard 
                key={exam.id} 
                exam={exam} 
                isCompleted={subject.isCompleted}
                onDelete={handleDeleteExam}
                onEdit={handleEditExam}
                onPlay={onPlayExam}
                onToggleLock={handleToggleLock}
                onToggleMaintenance={handleToggleMaintenance}
              />
            ))}
          </div>
        )}
      </div>

      <RandomExamModal 
        isOpen={isRandomModalOpen}
        onClose={() => setIsRandomModalOpen(false)}
        subject={subject}
        onUpdateSubject={onUpdateSubject}
      />

    </div>
  );
}