// src/pages/coding/CodingDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import {
  LogOut, Terminal, ArrowLeft, Code2, Sparkles,
  X, ChevronDown, AlertCircle, BookOpen
} from 'lucide-react';
import { getSession, createSession, clearSession, getSessionRedirectPath } from '../../utils/codingSession';
import { storage } from '../../utils/storage';

const LANG_LABELS = {
  python: 'Python 3',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
};

export default function CodingDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  const [showLangModal, setShowLangModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [chosenLang, setChosenLang] = useState('python');
  const [activeSession, setActiveSession] = useState(null);
  const [problems, setProblems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const subjectId = location.state?.subjectId;

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      // Đọc session hiện tại
      const session = getSession(currentUser?.id || currentUser?.uid);
      setActiveSession(session);

      const targetSubjectId = subjectId || session?.subjectId;

      // Tải danh sách môn học từ Firestore
      const allSubjects = await storage.loadSubjects();

      let data = [];
      if (targetSubjectId) {
        data = storage.loadSubjectCodingProblems(targetSubjectId, allSubjects);
      }

      // Nếu không chỉ định subjectId hoặc chưa có trong môn học đó,
      // tìm môn học lập trình bất kỳ (status='developer') có codingProblems
      if (data.length === 0) {
        const codingSub = allSubjects.find(
          s => s.status === 'developer' && Array.isArray(s.codingProblems) && s.codingProblems.length > 0
        );
        if (codingSub) {
          data = storage.loadSubjectCodingProblems(codingSub.id, allSubjects);
          if (data.length === 0) data = codingSub.codingProblems;
        }
      }

      // Cuối cùng thử collection coding_problems riêng
      if (data.length === 0) {
        data = await storage.loadCodingProblems();
      }

      data = data.filter(p => p.id !== 'two_sum' && p.id !== 'prime_check' && p.id !== 'longest_word');
      setProblems(data);
      setIsLoading(false);
    }

    loadData();
  }, [currentUser, subjectId]);

  const handleStartExam = (problem) => {
    if (activeSession) return;
    setSelectedProblem(problem);
    setChosenLang('python');
    setShowLangModal(true);
  };

  const handleConfirmLang = () => {
    setShowLangModal(false);
    const userId = currentUser?.id || currentUser?.uid;
    const targetSubjectId = subjectId || selectedProblem?.subjectId;
    const session = createSession(userId, {
      problem: selectedProblem,
      selectedLang: chosenLang,
      subjectId: targetSubjectId,
    });
    setActiveSession(session);
    navigate('/coding/workspace');
  };

  const handleResumeSession = () => {
    const userId = currentUser?.id || currentUser?.uid;
    const path = getSessionRedirectPath(userId);
    if (path) navigate(path);
  };

  const handleCancelSession = () => {
    const userId = currentUser?.id || currentUser?.uid;
    clearSession(userId);
    setActiveSession(null);
  };

  const diffColor = (d) =>
    d === 'Dễ' ? 'bg-emerald-500/15 text-emerald-400' :
    d === 'Trung bình' ? 'bg-amber-500/15 text-amber-400' :
    'bg-red-500/15 text-red-400';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 px-8 flex items-center justify-between sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => navigate('/client/dashboard')}
            className="text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl bg-transparent border-transparent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-black text-blue-400 flex items-center gap-2 m-0">
            <Code2 className="h-6 w-6" /> Coding Portal
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-bold text-slate-200 text-sm">{currentUser?.fullName}</div>
            <div className="text-xs text-blue-400 font-medium">Lập trình viên</div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
            {(currentUser?.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <Button
            variant="ghost" size="icon"
            onClick={() => { logout(); navigate('/login'); }}
            className="text-red-400 hover:bg-red-950/20 hover:text-red-500 h-9 w-9 rounded-xl bg-transparent border-transparent"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-8">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 p-8 rounded-3xl border border-blue-900/20 shadow-lg">
          <h1 className="text-3xl font-black text-white flex items-center gap-2 mb-2">
            Chào mừng đến với Coding Portal <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
          </h1>
          <p className="text-slate-400 font-medium">
            Chọn một bài toán, viết code, chạy thử — sau đó thi vấn đáp 5 câu cùng Giám khảo AI.
          </p>
        </div>

        {/* Session đang dở */}
        {activeSession && (
          <Card className="border-blue-500/30 bg-blue-950/20 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl shrink-0">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">Bạn đang có bài thi dang dở</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Đề bài: <strong className="text-white">{activeSession.problem?.title}</strong>
                      {' · '}
                      Ngôn ngữ: <strong className="text-blue-400">{LANG_LABELS[activeSession.selectedLang] || activeSession.selectedLang}</strong>
                      {' · '}
                      Giai đoạn: <strong className="text-yellow-400">
                        {activeSession.stage === 'workspace' ? 'Làm bài code' :
                         activeSession.stage === 'viva' ? 'Thi vấn đáp' : 'Xem kết quả'}
                      </strong>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancelSession}
                    className="font-bold text-xs rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border-transparent"
                  >
                    Hủy bài
                  </Button>
                  <Button
                    onClick={handleResumeSession}
                    className="font-bold text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                  >
                    Tiếp tục →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danh sách bài */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-400 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-400" /> Danh sách đề thi lập trình
          </h2>

          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="h-52 rounded-3xl bg-slate-900 animate-pulse" />
              ))}
            </div>
          ) : problems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
              <AlertCircle className="h-12 w-12 text-slate-700" />
              <p className="font-bold">Chưa có đề thi nào</p>
              <p className="text-xs">Admin chưa thêm bài thi lập trình cho môn học này.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {problems.map((problem) => (
                <Card key={problem.id} className="border-slate-800 hover:border-blue-900/40 hover:shadow-lg hover:shadow-blue-950/10 transition-all duration-200 rounded-3xl overflow-hidden bg-slate-900">
                  <CardContent className="p-6 flex flex-col justify-between h-full space-y-5">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                          {problem.category}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${diffColor(problem.difficulty)}`}>
                          {problem.difficulty}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white leading-snug">{problem.title}</h3>
                      <p
                        className="text-xs text-slate-400 line-clamp-3 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: problem.description }}
                      />
                    </div>

                    <Button
                      onClick={() => handleStartExam(problem)}
                      disabled={!!activeSession}
                      className={`w-full font-bold h-11 rounded-xl shadow-md flex items-center justify-center gap-1.5 border-transparent ${
                        activeSession
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {activeSession ? 'Đang có bài thi khác' : 'Bắt đầu làm bài'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal chọn ngôn ngữ */}
      {showLangModal && selectedProblem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-950 px-8 py-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-black text-white m-0 flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-400" /> Chọn ngôn ngữ làm bài
              </h2>
              <button onClick={() => setShowLangModal(false)} className="text-slate-400 hover:text-slate-200 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="p-8 space-y-6">
              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đề bài đã chọn</div>
                <div className="font-bold text-white">{selectedProblem.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{selectedProblem.category}</div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Ngôn ngữ lập trình
                </label>
                <div className="relative">
                  <select
                    value={chosenLang}
                    onChange={(e) => setChosenLang(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm font-bold rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
                  >
                    <option value="python">Python 3</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="bg-slate-950 px-8 py-5 border-t border-slate-800 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowLangModal(false)}
                className="rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-800 bg-transparent border-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleConfirmLang}
                className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white px-6 border-transparent"
              >
                Bắt đầu thi →
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
