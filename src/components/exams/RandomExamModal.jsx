import { useState, useEffect } from 'react';
import { X, Shuffle, Flame } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { storageV2 } from '../../utils/storageV2';

export default function RandomExamModal({ isOpen, onClose, subject, exams, onUpdateSubject }) {
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [questionCount, setQuestionCount] = useState(50);
  const [examTitle, setExamTitle] = useState('');
  const [examTime, setExamTime] = useState(60);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Mặc định chọn tất cả đề thi hiện có
      const allIds = (exams || []).map(e => e.id);
      setSelectedExamIds(allIds);
      setExamTitle(`Đề Thi Tổng Hợp Ngẫu Nhiên - ${subject.name}`);
      setExamTime(60);
      setQuestionCount(50);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, subject, exams]);

  if (!isOpen) return null;

  const handleToggleExam = (id) => {
    let newSelection;
    if (selectedExamIds.includes(id)) {
      newSelection = selectedExamIds.filter(x => x !== id);
    } else {
      newSelection = [...selectedExamIds, id];
    }
    setSelectedExamIds(newSelection);
  };

  const handleSelectAll = () => {
    const allIds = (exams || []).map(e => e.id);
    setSelectedExamIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedExamIds([]);
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

  const handleCreate = async () => {
    if (selectedExamIds.length === 0) {
      alert("⚠️ Vui lòng chọn ít nhất một đề thi để lấy nguồn câu hỏi! (Mã lỗi: EXAM-12)");
      return;
    }

    if (questionCount <= 0) {
      alert("⚠️ Số lượng câu hỏi phải lớn hơn 0! (Mã lỗi: EXAM-13)");
      return;
    }

    if (!examTitle.trim()) {
      alert("⚠️ Vui lòng nhập tiêu đề cho đề thi mới! (Mã lỗi: EXAM-15)");
      return;
    }

    // Tải toàn bộ câu hỏi từ các đề đã chọn (Bất đồng bộ)
    let allQuestions = [];
    for (const eid of selectedExamIds) {
      const qs = await storageV2.loadQuestionsV2(eid);
      if (qs && qs.length > 0) {
        allQuestions.push(...qs.map(q => ({ ...q })));
      }
    }

    if (allQuestions.length === 0) {
      alert("⚠️ Không tìm thấy câu hỏi nào trong các đề thi được chọn! (Mã lỗi: EXAM-16)");
      return;
    }

    if (questionCount > allQuestions.length) {
      alert(`⚠️ Số lượng câu hỏi yêu cầu (${questionCount}) vượt quá tổng số câu hỏi hiện có (${allQuestions.length})! (Mã lỗi: EXAM-14)`);
      return;
    }

    // Xáo trộn và lấy ra số câu hỏi mong muốn
    const shuffledQuestions = shuffleArray(allQuestions);
    const selectedQuestions = shuffledQuestions.slice(0, questionCount);

    const subjCode = subject.code || 'MON';
    const examCode = `${subjCode}_RANDOM_${Date.now().toString().slice(-4)}`;
    const newExamId = examCode.toLowerCase();

    const normalizedQuestions = selectedQuestions.map((q, idx) => ({
      ...q,
      id: `q_${String(idx + 1).padStart(3, '0')}`
    }));

    const newExam = {
      id: newExamId,
      subjectId: subject.id,
      subjectCode: subjCode,
      code: examCode,
      title: examTitle.trim(),
      config: {
        title: examTitle.trim(),
        time: parseInt(examTime) || 0,
        password: "",
        shuffleQ: true,
        shuffleA: true,
        encrypt: false,
        limitAttempts: 0,
        strictMode: false
      }
    };

    // Lưu đề mới vào DB
    await storageV2.saveExamV2(newExam);
    await storageV2.saveQuestionsV2(newExamId, normalizedQuestions);

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
              Số câu hỏi
            </label>
            <Input 
              type="number"
              min="1"
              value={questionCount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setQuestionCount(val);
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

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {(exams || []).map(exam => (
              <label 
                key={exam.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedExamIds.includes(exam.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <input 
                  type="checkbox"
                  checked={selectedExamIds.includes(exam.id)}
                  onChange={() => handleToggleExam(exam.id)}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {exam.config?.title || exam.title}
                  </div>
                </div>
              </label>
            ))}
            
            {(!exams || exams.length === 0) && (
              <div className="text-center p-6 text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                Môn này chưa có đề thi nào.
              </div>
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
