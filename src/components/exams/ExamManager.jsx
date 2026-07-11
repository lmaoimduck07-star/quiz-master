import { useState } from 'react';
import ExamCard from './ExamCard';
import RandomExamModal from './RandomExamModal';
import { ArrowLeft, Check, Dices, Download, Folder, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ExamManager({ subject, onBack, onUpdateSubject, onOpenEditor, onPlayExam }) {
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  
  // Hàm xử lý việc xóa đề thi
  const handleDeleteExam = (examId) => {
    if (confirm("Bạn có chắc chắn muốn xóa đề thi này không?")) {
      const newExams = subject.exams.filter(e => e.id !== examId);
      // Gửi Cấu trúc Môn học mới (chứa mảng exams đã bị xóa) lên App.jsx
      onUpdateSubject({ ...subject, exams: newExams });
    }
  };

  // Hàm xử lý chung cho Edit: Nếu có newConfig (Title mới) thì update ngay, nếu không thì mở màn hình Editor
  const handleEditExam = (examId, newConfig) => {
    if (newConfig) {
      const newExams = subject.exams.map(e => e.id === examId ? { ...e, config: newConfig } : e);
      onUpdateSubject({ ...subject, exams: newExams });
    } else {
      onOpenEditor(examId);
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

    // Helper functions giải mã đồng bộ với template
    const b64_to_utf8 = (str) => {
      try {
        return decodeURIComponent(escape(window.atob(str)));
      } catch (err) {
        throw new Error("Giải mã Base64 thất bại");
      }
    };
    
    const xorDecrypt = (text, key) => {
      let res = '';
      for (let i = 0; i < text.length; i++) {
        res += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return res;
    };

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
            const decryptedText = b64_to_utf8(rawData);
            payload = JSON.parse(decryptedText);
          } catch (err) {
            const password = prompt(`🔒 Đề thi "${file.name}" được khóa bằng mật khẩu. Vui lòng nhập mật khẩu:`);
            if (password === null) {
              resolve({ success: false, fileName: file.name, error: "Người dùng hủy nhập" });
              return;
            }
            
            try {
              const base64Decoded = b64_to_utf8(rawData);
              const decryptedText = xorDecrypt(base64Decoded, password);
              payload = JSON.parse(decryptedText);
            } catch (err2) {
              resolve({ success: false, fileName: file.name, error: "Sai mật khẩu hoặc dữ liệu bị hỏng" });
              return;
            }
          }

          if (payload && payload.config && payload.data) {
            const normalizedQuestions = payload.data.map(q => {
              if (q.type === 'fill') {
                const hasAnswers = Array.isArray(q.answers) && q.answers.length > 0;
                const hasAnswer = q.answer !== undefined && q.answer !== null && q.answer !== '';
                
                if (hasAnswers && !hasAnswer) {
                  return { ...q, answer: q.answers[0] };
                } else if (hasAnswer && !hasAnswers) {
                  return { ...q, answers: [q.answer] };
                }
              }
              return q;
            });

            const newExam = {
              id: 'ex_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 5),
              config: payload.config,
              questions: normalizedQuestions
            };
            resolve({ success: true, fileName: file.name, exam: newExam });
          } else {
            resolve({ success: false, fileName: file.name, error: "Cấu trúc dữ liệu đề thi không hợp lệ" });
          }
        };
        reader.onerror = () => {
          resolve({ success: false, fileName: file.name, error: "Lỗi đọc file" });
        };
        reader.readAsText(file);
      });

      if (result.success) {
        importedExams.push(result.exam);
      } else {
        errors.push(`${result.fileName}: ${result.error}`);
      }
    }

    if (importedExams.length > 0) {
      const newExams = [...importedExams, ...(subject.exams || [])];
      onUpdateSubject({ ...subject, exams: newExams });
    }

    const successMsg = importedExams.length > 0 
      ? `📥 Đã nhập thành công ${importedExams.length}/${files.length} đề thi!` 
      : `❌ Nhập đề thi thất bại!`;
      
    const errorMsg = errors.length > 0 
      ? `\n\nChi tiết lỗi:\n${errors.join('\n')}` 
      : '';

    alert(successMsg + errorMsg);

    // Reset file input
    event.target.value = null;
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      
      {/* --- NÚT QUAY LẠI --- */}
      <Button 
        variant="outline"
        onClick={onBack}
        className="font-bold py-2.5 px-6 rounded-xl mb-8 flex items-center gap-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" /> Quay lại Trang chủ
      </Button>

      {/* --- BANNER THÔNG TIN MÔN HỌC --- */}
      <div className={`border p-8 rounded-3xl shadow-sm flex justify-between items-center mb-10 transition-colors ${subject.isCompleted ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-6">
          <div className="bg-amber-100 dark:bg-amber-950/30 p-5 rounded-2xl shadow-inner text-amber-600 dark:text-amber-400">
            <Folder className="h-12 w-12" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 m-0 leading-tight mb-2 flex items-center">
              {subject.name}
              {subject.isCompleted && <span className="ml-4 text-xl bg-emerald-500 text-white px-3 py-1 rounded-lg shadow-sm font-semibold border-transparent">Đã chốt sổ</span>}
            </h1>

          </div>
        </div>
        
        {!subject.isCompleted && (
          <Button 
            variant="success"
            onClick={handleCompleteSubject}
            className="h-14 px-8 rounded-2xl font-bold shadow-lg gap-2 text-lg border-transparent"
          >
            <Check className="h-6 w-6" /> Đánh Dấu Hoàn Thành
          </Button>
        )}
      </div>

      {/* --- DANH SÁCH ĐỀ THI --- */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-black text-slate-800 dark:text-white m-0 border-l-4 border-primary pl-4">
          Danh Sách Đề Thi
        </h3>
        
        {!subject.isCompleted && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsRandomModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md hover:shadow-lg flex items-center gap-2 border-transparent"
            >
              <Dices className="h-5 w-5" /> TRỘN ĐỀ NGẪU NHIÊN
            </button>
            <label className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2 border-transparent">
              <Download className="h-5 w-5" /> NHẬP HÀNG LOẠT (HTML)
              <input 
                type="file" 
                accept=".html" 
                multiple
                onChange={handleImportHtml} 
                className="hidden" 
              />
            </label>
            <Button 
              onClick={() => onOpenEditor(null)} // Truyền null để báo là Tạo đề mới
              className="h-14 px-8 rounded-xl font-bold shadow-md gap-2 border-transparent"
            >
              <Plus className="h-5 w-5" /> SOẠN ĐỀ THI MỚI
            </Button>
          </div>
        )}
      </div>

      {/* Render Lưới chứa Đề Thi */}
      <div className="flex flex-col gap-5">
        {!subject.exams || subject.exams.length === 0 ? (
          <div className="text-center p-16 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/50 text-lg transition-colors">
            Môn học này chưa có đề thi nào. Hãy bấm nút Soạn Đề bên trên!
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {subject.exams.map(exam => (
              <ExamCard 
                key={exam.id} 
                exam={exam} 
                isCompleted={subject.isCompleted}
                onDelete={handleDeleteExam}
                onEdit={handleEditExam}
                onPlay={onPlayExam}
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