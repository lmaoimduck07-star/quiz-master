import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getMistakesBySubject,
  getMistakesByExam,
  removeMistakesByIds,
  clearExamMistakes,
  clearSubjectMistakes,
} from '../../utils/mistakeManager';
import { storageV2 } from '../../utils/storageV2';
import { storage } from '../../utils/storage';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import {
  Clock, Flag, CheckCircle2, XCircle, BookOpen, Trash2, RotateCcw, Trophy, BookMarked, AlertTriangle
} from 'lucide-react';

const formatQuestionText = (text) => {
  if (!text) return '';
  return text.replace(/\n/g, '<br>');
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkAnswer(q, userAnswer) {
  const qType = q.type || 'single';
  if (qType === 'single') {
    const correct = q.correctAnswer !== undefined ? q.correctAnswer : (q.answer !== undefined ? q.answer : q.correct);
    return { isCorrect: userAnswer === correct, correctAnswer: correct };
  }
  if (qType === 'multiselect') {
    const correct = q.correctAnswer || q.corrects || [];
    const uArr = userAnswer || [];
    return {
      isCorrect: uArr.length === correct.length && uArr.every(x => correct.includes(x)),
      correctAnswer: correct,
    };
  }
  if (qType === 'fill') {
    const correct = (q.correctAnswer !== undefined ? q.correctAnswer : q.answer) || '';
    return {
      isCorrect: userAnswer !== undefined && userAnswer !== null &&
        userAnswer.toString().trim().toLowerCase() === correct.toString().trim().toLowerCase(),
      correctAnswer: correct,
    };
  }
  if (qType === 'truefalse') {
    const correct = q.correctAnswer !== undefined ? q.correctAnswer : q.correct;
    return { isCorrect: userAnswer === correct, correctAnswer: correct };
  }
  return { isCorrect: false, correctAnswer: q.correctAnswer || null };
}

const OPT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function MistakePractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subjectId } = useParams();
  const { currentUser } = useAuth();

  const examId = location.state?.examId || null;
  const examTitle = location.state?.examTitle || '';

  const [subjectName, setSubjectName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [qState, setQState] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [finished, setFinished] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Load môn học + câu sai (theo bài hoặc theo môn)
  useEffect(() => {
    if (!currentUser?.id || !subjectId) { setIsLoading(false); return; }

    let mistakes = [];
    if (examId) {
      mistakes = getMistakesByExam(currentUser.id, subjectId, examId);
      // Fallback: nếu câu cũ chưa được tag examId thì kiểm tra
      if (mistakes.length === 0) {
        const allSubMistakes = getMistakesBySubject(currentUser.id, subjectId);
        mistakes = allSubMistakes.filter(q => q.examId === examId || !q.examId);
      }
    } else {
      mistakes = getMistakesBySubject(currentUser.id, subjectId);
    }

    setQuestions(shuffle(mistakes));

    setIsLoading(true);
    storageV2.subscribeSubjectsWithExams((subjects) => {
      const found = subjects.find(s => s.id === subjectId);
      if (found) setSubjectName(found.name);
      setIsLoading(false);
    });
  }, [currentUser?.id, subjectId, examId]);

  const currentQ = questions[currentIdx];
  const cs = qState[currentIdx] || {};

  const setAnswer = (ans) => {
    if (cs.checked) return;
    setQState(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], answer: ans } }));
  };

  const handleCheck = () => {
    if (!currentQ) return;
    const ans = cs.answer;
    if (ans === undefined || ans === null || (Array.isArray(ans) && ans.length === 0)) return;
    const { isCorrect, correctAnswer } = checkAnswer(currentQ, ans);
    setQState(prev => ({
      ...prev,
      [currentIdx]: { ...prev[currentIdx], checked: true, isCorrect, correctAnswer },
    }));
  };

  const handleFinish = useCallback(() => {
    if (finished) return;
    setFinished(true);

    const correctQuestionIds = [];
    questions.forEach((q, idx) => {
      const s = qState[idx] || {};
      const { isCorrect } = s.checked
        ? { isCorrect: s.isCorrect }
        : checkAnswer(q, s.answer);
      if (isCorrect && q.id) {
        correctQuestionIds.push(q.id);
      }
    });

    // Xóa những câu đã làm đúng khỏi sổ tay của môn/bài
    if (correctQuestionIds.length > 0) {
      removeMistakesByIds(currentUser?.id, subjectId, correctQuestionIds, examId);
    }

    storage.addAuditLog({
      user: currentUser?.username || 'student',
      role: 'Student',
      category: 'Exam',
      action: `Luyện câu sai: ${subjectName || subjectId}${examTitle ? ` (${examTitle})` : ''} | Đúng: ${correctQuestionIds.length}/${questions.length}`,
      severity: 'Info',
    });
  }, [finished, questions, qState, currentUser, subjectId, subjectName, examTitle]);

  const handleClearMistakes = () => {
    if (examId) {
      clearExamMistakes(currentUser?.id, subjectId, examId);
    } else {
      clearSubjectMistakes(currentUser?.id, subjectId);
    }
    setShowClearConfirm(false);
    navigate('/client/dashboard');
  };

  const toggleFlag = (idx) => {
    setFlagged(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  if (!currentUser?.id || !subjectId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Không tìm thấy thông tin luyện tập</h2>
        <Button onClick={() => navigate('/client/dashboard')} className="mt-4 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          Về trang chủ
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <BookOpen className="h-10 w-10 animate-pulse text-violet-400 mr-3" />
        <p className="font-bold text-slate-400">Đang nạp sổ tay câu sai...</p>
      </div>
    );
  }

  if (questions.length === 0 && !finished) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-5">
          <Trophy className="h-10 w-10 text-violet-500 dark:text-violet-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">Sổ tay trống!</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          Bạn chưa có câu sai nào được ghi nhận cho môn <strong>{subjectName}</strong>.
        </p>
        <Button onClick={() => navigate('/client/dashboard')} className="mt-6 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6">
          Về trang chủ
        </Button>
      </div>
    );
  }

  // Kết quả sau khi nộp
  if (finished) {
    const correctCount = Object.values(qState).filter(s => s?.isCorrect).length;
    const score = parseFloat(((correctCount / questions.length) * 10).toFixed(1));
    const allCorrect = correctCount === questions.length;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
          <div className={`px-8 py-10 text-center space-y-3 ${allCorrect ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-violet-500 to-purple-700'}`}>
            <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto">
              {allCorrect ? <Trophy className="h-9 w-9 text-white" /> : <BookMarked className="h-9 w-9 text-white" />}
            </div>
            <h2 className="text-2xl font-extrabold text-white">{allCorrect ? 'Hoàn hảo! 🎉' : 'Đã hoàn thành'}</h2>
            <p className="text-white/80 text-sm">{subjectName}</p>
            <div className="text-5xl font-black text-white">{score}<span className="text-2xl font-bold text-white/60">/10</span></div>
            <p className="text-white/90 font-semibold">{correctCount}/{questions.length} câu đúng</p>
          </div>
          <CardContent className="p-6 space-y-3">
            {!allCorrect && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-semibold text-center">
                Còn <strong>{questions.length - correctCount} câu sai</strong> đã được giữ lại trong sổ tay.
              </div>
            )}
            {allCorrect && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-semibold text-center">
                Tất cả câu sai đã được xóa khỏi sổ tay! 🧹
              </div>
            )}
            <Button
              onClick={() => { setFinished(false); setCurrentIdx(0); setQState({}); setQuestions(shuffle(questions)); }}
              className="w-full font-bold h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white border-transparent gap-2"
              disabled={allCorrect}
            >
              <RotateCcw className="h-4 w-4" /> Luyện lại câu sai
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/client/dashboard')}
              className="w-full font-bold h-11 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-transparent"
            >
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render Options ──
  const renderQuestion = () => {
    const qType = currentQ?.type || 'single';

    if (qType === 'single' || qType === 'multiselect') {
      const opts = Array.isArray(currentQ.options) ? currentQ.options : [];
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 content-start">
          {opts.map((opt, i) => {
            const optText = typeof opt === 'string' ? opt : opt?.text || opt;
            const isSelected = qType === 'multiselect'
              ? Array.isArray(cs.answer) && cs.answer.includes(i)
              : cs.answer === i;
            const correctAns = cs.correctAnswer !== undefined ? cs.correctAnswer : currentQ.correctAnswer;
            const isCorrectOpt = cs.checked
              ? (qType === 'multiselect'
                ? Array.isArray(correctAns) && correctAns.includes(i)
                : correctAns === i)
              : false;

            let borderBg = 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700';
            let labelBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

            if (cs.checked) {
              if (isCorrectOpt) {
                borderBg = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30';
                labelBadge = 'bg-emerald-500 text-white';
              } else if (isSelected && !isCorrectOpt) {
                borderBg = 'border-red-500 bg-red-50 dark:bg-red-950/30';
                labelBadge = 'bg-red-500 text-white';
              }
            } else if (isSelected) {
              borderBg = 'border-violet-500 bg-violet-50 dark:bg-violet-950/30';
              labelBadge = 'bg-violet-600 text-white';
            }

            return (
              <div
                key={i}
                onClick={() => {
                  if (cs.checked) return;
                  if (qType === 'multiselect') {
                    const prev = Array.isArray(cs.answer) ? cs.answer : [];
                    setAnswer(prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
                  } else {
                    setAnswer(i);
                  }
                }}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition ${borderBg} ${cs.checked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 transition ${labelBadge}`}>
                  {OPT_LABELS[i] || (i + 1)}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: optText || '' }} />
                {cs.checked && isCorrectOpt && (
                  <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md uppercase ml-auto self-center">
                    Đúng
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (qType === 'truefalse') {
      const correctAns = cs.correctAnswer !== undefined ? cs.correctAnswer : currentQ.correctAnswer;
      return (
        <div className="flex gap-4">
          {[true, false].map(val => {
            const isSelected = cs.answer === val;
            const isCorrectOpt = cs.checked ? correctAns === val : false;
            let borderBg = 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700';
            if (cs.checked) {
              if (isCorrectOpt) borderBg = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 font-bold';
              else if (isSelected) borderBg = 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 font-bold';
            } else if (isSelected) {
              borderBg = 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 font-bold';
            }
            return (
              <div
                key={String(val)}
                onClick={() => { if (!cs.checked) setAnswer(val); }}
                className={`flex-1 flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition ${borderBg} ${cs.checked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className="text-base font-extrabold">{val ? 'ĐÚNG' : 'SAI'}</span>
                {cs.checked && isCorrectOpt && <span className="text-xs font-bold text-emerald-600 mt-1">✓ Đáp án đúng</span>}
              </div>
            );
          })}
        </div>
      );
    }

    if (qType === 'fill') {
      return (
        <div className="space-y-3">
          <input
            type="text"
            disabled={cs.checked}
            value={cs.answer || ''}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Nhập câu trả lời của bạn..."
            className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus:border-violet-500 focus:outline-none font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 transition-colors"
          />
          {cs.checked && !cs.isCorrect && (
            <div className="p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✓ Đáp án đúng: <span className="font-black">{cs.correctAnswer}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-sm text-center">
        Dạng câu này ({qType}) không hỗ trợ phản hồi tức thì.
      </div>
    );
  };

  const totalAnswered = questions.reduce((count, _, i) => {
    const s = qState[i];
    return (s?.answer !== undefined && s.answer !== '' && (Array.isArray(s.answer) ? s.answer.length > 0 : true)) ? count + 1 : count;
  }, 0);
  const totalUnanswered = questions.length - totalAnswered;
  const totalFlagged = flagged.length;

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors duration-200">
      {/* ─── Header ─── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-violet-500 uppercase tracking-wider">
            📘 SỔ TAY CÂU SAI: {subjectName}
          </span>
          <span className="font-extrabold text-slate-800 dark:text-white text-base">
            {examTitle ? examTitle : 'Luyện lại các câu chưa nắm vững'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800 transition"
            title="Xóa câu sai"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{examId ? 'Xóa câu sai bài này' : 'Xóa sổ tay'}</span>
          </button>
          <Button
            variant="danger"
            className="font-bold px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-sm border-transparent"
            onClick={() => setShowSubmitModal(true)}
          >
            Hoàn thành
          </Button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation list (w-80) */}
        <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col transition-colors">
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">
              DANH SÁCH CÂU HỎI ({questions.length})
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const s = qState[i] || {};
                const isAnswered = s.answer !== undefined && s.answer !== '' && (Array.isArray(s.answer) ? s.answer.length > 0 : true);
                const isCurrent = currentIdx === i;
                const isFlag = flagged.includes(i);

                let btnClass = "h-10 w-10 rounded-xl font-bold text-xs transition-all border flex items-center justify-center relative ";
                if (isFlag) {
                  btnClass += "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20 font-black ";
                } else if (isCurrent) {
                  btnClass += "border-violet-600 ring-2 ring-violet-500/30 scale-105 bg-violet-50 dark:bg-violet-950/50 text-violet-600 font-extrabold ";
                } else if (s.checked && s.isCorrect) {
                  btnClass += "bg-emerald-500 text-white border-emerald-500 shadow-sm ";
                } else if (s.checked && !s.isCorrect) {
                  btnClass += "bg-red-500 text-white border-red-500 shadow-sm ";
                } else if (isAnswered) {
                  btnClass += "bg-violet-600 text-white border-violet-600 shadow-sm ";
                } else {
                  btnClass += "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 ";
                }

                return (
                  <button
                    key={i}
                    className={btnClass}
                    onClick={() => setCurrentIdx(i)}
                  >
                    {i + 1}
                    {isFlag && <span className="absolute -top-1 -right-1 text-[10px]">🚩</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Question display */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-50 dark:bg-slate-950/60 transition-colors">
          <Card className="w-full flex-1 flex flex-col border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="flex-1 flex flex-col overflow-hidden pt-6">
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider">
                  CÂU {currentIdx + 1} / {questions.length}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFlag(currentIdx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    flagged.includes(currentIdx)
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flagged.includes(currentIdx) ? 'Đã cắm cờ 🚩' : 'Cần xem lại 🚩'}
                </button>
              </div>

              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 leading-relaxed flex-shrink-0">
                <span dangerouslySetInnerHTML={{ __html: formatQuestionText(currentQ?.text || currentQ?.content || currentQ?.question || '') }} />
              </h2>

              {currentQ?.image && (
                <div className="mb-4 flex-shrink-0 flex justify-center">
                  <img
                    src={currentQ.image}
                    alt="Question Graphic"
                    onClick={() => setPreviewImage(currentQ.image)}
                    className="max-w-full max-h-80 md:max-h-96 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-md object-contain cursor-zoom-in hover:shadow-lg transition-transform bg-white dark:bg-slate-900 p-1.5"
                    title="Bấm vào để phóng to hình ảnh"
                  />
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {renderQuestion()}

                <div className="mt-4 space-y-3">
                  {cs.checked ? (
                    <>
                      <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${
                        cs.isCorrect
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
                      }`}>
                        {cs.isCorrect
                          ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                          : <XCircle className="h-6 w-6 text-red-500 shrink-0" />}
                        <span className={`font-extrabold text-sm ${cs.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                          {cs.isCorrect ? 'Chính xác! Câu này sẽ được xóa khỏi sổ tay. 🎉' : 'Chưa đúng. Câu này sẽ tiếp tục được lưu để luyện thêm.'}
                        </span>
                      </div>

                      {/* Hiển thị đáp án đúng chi tiết */}
                      {!cs.isCorrect && qType === 'groupdrag' && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
                          <div className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                            ✓ Đáp án phân nhóm chính xác:
                          </div>
                          {(currentQ.groups || []).map((g, idx) => (
                            <div key={idx} className="text-sm bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                              <span className="font-extrabold text-indigo-700 dark:text-blue-400">{g.name}: </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{(g.items || []).join(' • ')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!cs.isCorrect && qType === 'drag' && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
                          <div className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                            ✓ Cặp ghép chính xác:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(currentQ.pairs || []).map((p, idx) => (
                              <div key={idx} className="text-sm bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center justify-between">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{p.left}</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">➔ {p.right}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={handleCheck}
                      disabled={cs.answer === undefined || cs.answer === null || (Array.isArray(cs.answer) && cs.answer.length === 0)}
                      className="w-full md:w-auto font-black rounded-xl h-11 px-8 text-sm bg-violet-600 hover:bg-violet-700 text-white border-transparent disabled:opacity-40 shadow-sm"
                    >
                      Kiểm tra đáp án
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <nav className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)] flex">
        <div className="w-80 shrink-0 hidden lg:flex items-center px-6 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              <span className="w-2.5 h-2.5 rounded-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shrink-0"></span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-200">{totalUnanswered}</span>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">chưa làm</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0"></span>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{totalAnswered}</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">đã làm</span>
            </div>
            {totalFlagged > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40">
                <span className="text-xs leading-none">🚩</span>
                <span className="text-xs font-black text-red-600 dark:text-red-400">{totalFlagged}</span>
                <span className="text-xs font-medium text-red-500 dark:text-red-500">cần xem</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-50 dark:bg-violet-950 border-2 border-violet-500 shrink-0"></span>
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">đang xem</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-4 px-6 py-4">
          <Button
            variant="outline"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="rounded-xl font-bold h-12 px-6 border-slate-200 dark:border-slate-700 bg-transparent shrink-0 flex items-center gap-1.5 text-base text-slate-700 dark:text-slate-300"
          >
            ← Câu trước
          </Button>

          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Câu {currentIdx + 1} / {questions.length}
            </span>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <Button
            disabled={currentIdx === questions.length - 1}
            onClick={() => setCurrentIdx(prev => prev + 1)}
            className="rounded-xl font-bold h-12 px-6 shrink-0 flex items-center gap-1.5 text-base bg-violet-600 hover:bg-violet-700 text-white border-transparent"
          >
            Câu tiếp theo →
          </Button>
        </div>
      </nav>

      {/* ─── Submit Confirmation Modal ─── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <BookMarked className="h-8 w-8 text-violet-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Hoàn thành phiên luyện tập?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
                Các câu trả lời đúng sẽ được tự động xóa khỏi sổ tay câu sai. Các câu chưa đúng sẽ tiếp tục được giữ lại.
              </p>
              <div className="flex gap-3 justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitModal(false)}
                  className="w-full font-bold h-11 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-transparent"
                >
                  Tiếp tục làm
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowSubmitModal(false);
                    handleFinish();
                  }}
                  className="w-full font-bold h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white border-transparent"
                >
                  Xác nhận nộp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Clear Confirm Modal ─── */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm border-none shadow-2xl rounded-3xl bg-white dark:bg-slate-900">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="h-14 w-14 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto">
                <Trash2 className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-white text-lg">Xóa sổ tay câu sai?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Toàn bộ {questions.length} câu sai của môn <strong>{subjectName}</strong> sẽ bị xóa vĩnh viễn.</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-transparent text-slate-600 dark:text-slate-300"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleClearMistakes}
                  className="flex-1 font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white border-transparent"
                >
                  Xóa tất cả
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* ─── Lightbox Zoom Image Modal ─── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={previewImage}
              alt="Phóng to"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20 bg-white"
            />
            <span className="mt-3 text-white/80 text-xs font-semibold bg-black/40 px-4 py-1.5 rounded-full border border-white/10">
              Nhấp bất kỳ đâu để đóng
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
