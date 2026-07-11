import { useState, useEffect } from 'react';
import { X, Shuffle, Flame } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function RandomExamModal({ isOpen, onClose, subject, onUpdateSubject }) {
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [questionCount, setQuestionCount] = useState(50);
  const [examTitle, setExamTitle] = useState('');
  const [examTime, setExamTime] = useState(60);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Mặc định chọn tất cả đề thi hiện có
      const allIds = (subject.exams || []).map(e => e.id);
      setSelectedExamIds(allIds);
      setExamTitle(`Đề Thi Tổng Hợp Ngẫu Nhiên - ${subject.name}`);
      setExamTime(60);
      
      // Tính tổng số câu hỏi từ các đề
      const totalQ = (subject.exams || []).reduce((sum, e) => sum + (e.questions || []).length, 0);
      setQuestionCount(Math.min(50, totalQ));
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, subject]);

  if (!isOpen) return null;

  // Tính số câu hỏi tối đa dựa trên các đề đã chọn
  const selectedExams = (subject.exams || []).filter(e => selectedExamIds.includes(e.id));
  const totalAvailableQuestions = selectedExams.reduce((sum, e) => sum + (e.questions || []).length, 0);

  const handleToggleExam = (id) => {
    let newSelection;
    if (selectedExamIds.includes(id)) {
      newSelection = selectedExamIds.filter(x => x !== id);
    } else {
      newSelection = [...selectedExamIds, id];
    }
    setSelectedExamIds(newSelection);

    // Cập nhật lại số câu hỏi mong muốn nếu nó lớn hơn số câu hỏi khả dụng mới
    const newTotal = (subject.exams || [])
      .filter(e => newSelection.includes(e.id))
      .reduce((sum, e) => sum + (e.questions || []).length, 0);
    
    if (questionCount > newTotal) {
      setQuestionCount(newTotal);
    } else if (questionCount === 0 && newTotal > 0) {
      setQuestionCount(Math.min(50, newTotal));
    }
  };

  const handleSelectAll = () => {
    const allIds = (subject.exams || []).map(e => e.id);
    setSelectedExamIds(allIds);
    const totalQ = (subject.exams || []).reduce((sum, e) => sum + (e.questions || []).length, 0);
    setQuestionCount(Math.min(50, totalQ));
  };

  const handleDeselectAll = () => {
    setSelectedExamIds([]);
    setQuestionCount(0);
  };

  // Thuật toán xáo trộn Fisher-Yates
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const handleCreate = () => {
    if (selectedExamIds.length === 0) {
      alert("⚠️ Vui lòng chọn ít nhất một đề thi để lấy nguồn câu hỏi!");
      return;
    }

    if (questionCount <= 0) {
      alert("⚠️ Số lượng câu hỏi phải lớn hơn 0!");
      return;
    }

    if (questionCount > totalAvailableQuestions) {
      alert(`⚠️ Số lượng câu hỏi yêu cầu (${questionCount}) vượt quá tổng số câu hỏi hiện có (${totalAvailableQuestions})!`);
      return;
    }

    if (!examTitle.trim()) {
      alert("⚠️ Vui lòng nhập tiêu đề cho đề thi mới!");
      return;
    }

    // Gom tất cả câu hỏi từ các đề thi đã chọn
    let allQuestions = [];
    selectedExams.forEach(exam => {
      if (exam.questions) {
        // Sao chép sâu hoặc cẩn thận để tránh tham chiếu gốc
        allQuestions.push(...exam.questions.map(q => ({ ...q })));
      }
    });

    if (allQuestions.length === 0) {
      alert("⚠️ Không tìm thấy câu hỏi nào trong các đề thi được chọn!");
      return;
    }

    // Xáo trộn và lấy ra số câu hỏi mong muốn
    const shuffledQuestions = shuffleArray(allQuestions);
    const selectedQuestions = shuffledQuestions.slice(0, questionCount);

    // Tạo đề thi mới
    const newExam = {
      id: 'ex_' + Date.now(),
      config: {
        title: examTitle.trim(),
        time: parseInt(examTime) || 0,
        password: "",
        shuffleQ: true,
        shuffleA: true,
        encrypt: false,
        limitAttempts: 0,
        strictMode: false
      },
      questions: selectedQuestions
    };

    // Lưu đề mới vào subject
    const updatedExams = [newExam, ...(subject.exams || [])];
    onUpdateSubject({ ...subject, exams: updatedExams });

    alert(`🎲 Tạo đề thi ngẫu nhiên gồm ${questionCount} câu thành công!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full p-8 relative border border-slate-100 dark:border-slate-800 animate-fadeIn my-8 transition-colors">
        
        {/* Nút đóng */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition focus:outline-none bg-transparent"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <Shuffle className="h-8 w-8 text-indigo-500 dark:text-indigo-400" /> Trộn Đề Ngẫu Nhiên
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium text-sm">
          Hệ thống sẽ gom toàn bộ câu hỏi từ các đề đã chọn, xáo trộn ngẫu nhiên và lọc ra số lượng câu hỏi bạn mong muốn.
        </p>

        {/* 1. Nhập tiêu đề đề mới */}
        <div className="mb-5">
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">
            Tiêu đề đề thi mới
          </label>
          <Input 
            type="text"
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            placeholder="Nhập tiêu đề đề thi..."
            className="w-full text-base font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          />
        </div>

        {/* 2. Cấu hình câu hỏi & thời gian */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">
              Số câu hỏi ({totalAvailableQuestions} khả dụng)
            </label>
            <Input 
              type="number"
              min="1"
              max={totalAvailableQuestions}
              value={questionCount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setQuestionCount(Math.min(val, totalAvailableQuestions));
              }}
              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">
              Thời gian làm bài (phút)
            </label>
            <Input 
              type="number"
              min="0"
              value={examTime}
              onChange={(e) => setExamTime(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0 (Không giới hạn)"
              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        {/* 3. Lựa chọn nguồn đề thi */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-slate-700 dark:text-slate-300 font-bold text-sm uppercase tracking-wider">
              Chọn nguồn đề thi để lấy câu hỏi
            </span>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={handleSelectAll}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-350 font-bold bg-transparent"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button 
                type="button" 
                onClick={handleDeselectAll}
                className="text-xs text-rose-500 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-350 font-bold bg-transparent"
              >
                Bỏ chọn hết
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col gap-2 transition-colors">
            {(!subject.exams || subject.exams.length === 0) ? (
              <div className="text-center text-slate-400 dark:text-slate-500 py-6 font-semibold">
                Không tìm thấy đề thi nào trong môn này.
              </div>
            ) : (
              subject.exams.map(exam => {
                const qLen = (exam.questions || []).length;
                return (
                  <label 
                    key={exam.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition select-none shadow-sm transition-colors bg-transparent"
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={selectedExamIds.includes(exam.id)}
                        onChange={() => handleToggleExam(exam.id)}
                        className="w-5 h-5 accent-indigo-600 dark:accent-indigo-400 cursor-pointer"
                      />
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                        {exam.config.title}
                      </span>
                    </div>
                    <span className="text-xs bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-450 font-bold px-2.5 py-1 rounded-lg transition-colors">
                      {qLen} câu
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* 4. Nhóm nút điều khiển */}
        <div className="flex gap-4">
          <Button 
            variant="outline"
            onClick={onClose}
            className="flex-1 font-bold text-slate-600 dark:text-slate-350 border-slate-300 dark:border-slate-800 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
          >
            Hủy Bỏ
          </Button>
          <Button 
            onClick={handleCreate}
            className="flex-1 font-black shadow-md gap-2"
          >
            <Flame className="h-5 w-5" /> TẠO ĐỀ THI
          </Button>
        </div>

      </div>
    </div>
  );
}
