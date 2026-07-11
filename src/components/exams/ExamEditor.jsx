import { useState, useEffect } from 'react';
import Taskbar from './Taskbar';
import QuestionForms from './QuestionForms';
import { parseWordFile } from '../../utils/wordParser'; // Nhúng bộ máy đọc Word
import QuestionList from './QuestionList';
import { FileText, Upload, Trash2, FileOutput } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ExamEditor({ subject, examId, onBack, onSaveExam }) {
  
  // 1. STATE QUẢN LÝ DỮ LIỆU ĐỀ THI
  const [config, setConfig] = useState({
    title: `Đề Thi - ${subject.name}`,
    time: 0, password: "", shuffleQ: true, shuffleA: true, encrypt: false, limitAttempts: 0, strictMode: false
  });
  
  const [questions, setQuestions] = useState([]);

  // 2. NẾU LÀ SỬA ĐỀ CŨ, LOAD DỮ LIỆU LÊN
  useEffect(() => {
    if (examId) {
      const existingExam = subject.exams.find(e => e.id === examId);
      if (existingExam) {
        setConfig(existingExam.config);
        setQuestions([...existingExam.questions]);
      }
    }
  }, [examId, subject]);

  // 3. HÀM LƯU ĐỀ THI (Gửi ra ngoài App.jsx)
  const handleSave = () => {
    if (questions.length === 0) {
      alert("⚠️ Không có câu hỏi nào để lưu!");
      return;
    }
    onSaveExam(examId, config, questions);
  };

  // 4. HÀM NHẬN CÂU HỎI TỪ QUESTION FORMS (Nhập thủ công)
  const handleAddQuestion = (newQuestion) => {
    setQuestions([...questions, newQuestion]);
  };

  // 5. HÀM XỬ LÝ IMPORT TỪ FILE WORD
  const handleWordUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Báo hiệu đang xử lý
      alert("⏳ Đang xử lý file Word. Vui lòng đợi vài giây...");
      
      // Chạy bộ máy bóc tách
      const importedQuestions = await parseWordFile(file);
      
      if (importedQuestions.length > 0) {
        // Nối mảng câu hỏi mới vào danh sách hiện tại
        setQuestions(prev => [...prev, ...importedQuestions]);
        alert(`✅ Đã nhập thành công ${importedQuestions.length} câu hỏi vào đề!`);
      } else {
        alert("❌ File không đúng định dạng nhận diện.");
      }
    } catch (err) {
      alert("❌ Có lỗi xảy ra khi đọc file Word!");
      console.error(err);
    } finally {
      // Reset input để có thể chọn lại cùng 1 file nếu cần
      e.target.value = ""; 
    }
  };

  // HÀM UPDATE CÂU HỎI KHI MODAL TRẢ VỀ
  const handleUpdateQuestion = (index, updatedQuestion) => {
    const newQuestions = [...questions];
    newQuestions[index] = updatedQuestion;
    setQuestions(newQuestions);
    alert("✅ Đã cập nhật câu hỏi!");
  };

  const handleDeleteQuestion = (index) => {
    if (confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      setQuestions(newQuestions);
    }
  };

  // Tính tổng trọng số điểm
  const totalWeight = questions.reduce((sum, q) => sum + (parseFloat(q.points) || 1), 0);

  return (
    <div className="bg-slate-50 min-h-screen pt-24 pb-20">
      
      {/* THANH CÔNG CỤ TRÊN CÙNG */}
      <Taskbar 
        config={config} 
        setConfig={setConfig} 
        onBack={onBack} 
        onSave={handleSave} 
      />

      <div className="max-w-5xl mx-auto px-4 flex flex-col gap-8">
        
        {/* COMPONENT NHẬP CÂU HỎI THỦ CÔNG */}
        <QuestionForms onAddQuestion={handleAddQuestion} />

        {/* DANH SÁCH CÂU HỎI TRONG ĐỀ */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 m-0 mb-2">Câu Hỏi Trong Đề ({questions.length})</h2>
                
                {/* NHÓM NÚT IMPORT */}
                <div className="flex gap-2">
                  <label className="cursor-pointer flex items-center gap-2 bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-500 hover:text-white font-bold py-1.5 px-3 rounded-lg transition text-sm">
                    <Upload className="h-4 w-4" /> NHẬP TỪ WORD (.docx)
                    <input 
                      type="file" 
                      accept=".docx" 
                      className="hidden" 
                      onChange={handleWordUpload} 
                    />
                  </label>
                  
                  <button className="flex items-center gap-2 bg-slate-100 border border-slate-300 text-slate-400 font-bold py-1.5 px-3 rounded-lg text-sm cursor-not-allowed">
                    <FileOutput className="h-4 w-4" /> PDF (Bảo trì)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="bg-blue-50 border border-blue-200 px-6 py-2 rounded-xl text-center min-w-[200px]">
                <div className="text-xs font-bold text-blue-500 tracking-wider mb-1">TỔNG ĐIỂM CỦA ĐỀ</div>
                <div className="text-3xl font-black text-blue-900">10 Điểm</div>
                <div className="text-xs text-blue-400">Tổng trọng số: {totalWeight}</div>
              </div>
              <Button 
                variant="outline"
                onClick={() => { if(confirm("Xóa sạch toàn bộ câu hỏi?")) setQuestions([]) }}
                className="text-red-500 bg-white border-red-200 hover:bg-red-50 hover:text-red-600 font-semibold py-1.5 px-4 rounded-lg text-sm transition flex items-center gap-2 h-auto"
              >
                <Trash2 className="h-4 w-4" /> Xóa sạch danh sách
              </Button>
            </div>
          </div>

          {/* RENDER CÁC CÂU HỎI BẰNG GIAO DIỆN */}
          <QuestionList 
            questions={questions} 
            onUpdateQuestion={handleUpdateQuestion} 
            onDeleteQuestion={handleDeleteQuestion} 
          />

        </div>
      </div>

    </div>
  );
}