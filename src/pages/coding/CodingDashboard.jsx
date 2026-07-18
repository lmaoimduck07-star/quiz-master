// src/pages/coding/CodingDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { BookOpen, LogOut, Terminal, ArrowLeft, Key, Code2, Sparkles, CheckCircle2, X, ChevronDown } from 'lucide-react';
import { hasGeminiApiKey, saveGeminiApiKey } from '../../utils/gemini';
import { getSession, createSession, clearSession, getSessionRedirectPath } from '../../utils/codingSession';
import { storage } from '../../utils/storage';

export default function CodingDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [chosenLang, setChosenLang] = useState('java');
  const [activeSession, setActiveSession] = useState(null);
  const [problems, setProblems] = useState([]);

  const subjectId = location.state?.subjectId;

  useEffect(() => {
    setHasKey(hasGeminiApiKey());
    // Kiểm tra session đang hoạt động
    if (currentUser?.uid) {
      const session = getSession(currentUser.uid);
      setActiveSession(session);
    }
    // Tải danh sách đề thi lập trình từ LocalStorage
    if (subjectId) {
      let data = storage.loadSubjectCodingProblems(subjectId);
      if (data.length === 0) {
        // Tự động seed các đề thi mặc định nếu môn học mới bật chế độ Code và chưa có đề
        data = storage.loadCodingProblems();
        storage.saveSubjectCodingProblems(subjectId, data);
      }
      setProblems(data);
    } else {
      setProblems(storage.loadCodingProblems());
    }
  }, [currentUser, subjectId]);

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (apiKey.trim()) {
      saveGeminiApiKey(apiKey.trim());
      setHasKey(true);
      setApiKey('');
      setKeySavedMessage(true);
      setTimeout(() => setKeySavedMessage(false), 3000);
    }
  };

  const handleStartExam = (problem) => {
    // Nếu đã có session đang chạy thì không cho tạo mới
    if (activeSession) return;
    setSelectedProblem(problem);
    setShowLangModal(true);
    setChosenLang('java');
  };

  const handleConfirmLang = () => {
    setShowLangModal(false);
    // Tạo session mới
    const session = createSession(currentUser.uid, {
      problem: selectedProblem,
      selectedLang: chosenLang
    });
    setActiveSession(session);
    navigate('/coding/workspace');
  };

  const handleResumeSession = () => {
    const redirectPath = getSessionRedirectPath(currentUser.uid);
    if (redirectPath) navigate(redirectPath);
  };

  const handleCancelSession = () => {
    clearSession(currentUser.uid);
    setActiveSession(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 px-8 flex items-center justify-between sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/client/dashboard')}
            className="text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl bg-transparent border-transparent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-black text-blue-500 flex items-center gap-2 m-0">
            <Code2 className="h-6 w-6" /> Coding Portal
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="font-bold text-slate-200 text-sm">{currentUser?.fullName}</div>
              <div className="text-xs text-blue-400 font-medium">Lập trình viên</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
              {(currentUser?.fullName || 'P').charAt(0).toUpperCase()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="text-red-400 hover:bg-red-950/20 hover:text-red-500 h-9 w-9 rounded-xl bg-transparent border-transparent"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 p-8 rounded-3xl border border-blue-900/20 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              Chào mừng bạn đến với Môi trường Lập trình! <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
            </h1>
            <p className="text-slate-400 font-medium">
              Lựa chọn một bài toán bên dưới để khởi tạo máy ảo biên dịch và làm bài thi tự luận kèm vấn đáp 5 câu với Giám khảo AI.
            </p>
          </div>
        </div>

        {/* API Key Setup */}
        {!import.meta.env.VITE_GEMINI_API_KEY && (
          <Card className="border-slate-800 bg-slate-900/60 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-yellow-500/10 text-yellow-400 rounded-xl shrink-0 mt-0.5">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">Cấu hình Giám khảo AI (Gemini API Key)</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      Hệ thống sử dụng AI Gemini để tổ chức thi vấn đáp lập trình.
                      {hasKey ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5 inline" /> Đã cấu hình API Key (sẵn sàng vấn đáp).
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold mt-1 block">
                          Chưa cấu hình API Key. Vui lòng nhập khóa bên dưới để làm bài vấn đáp.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveKey} className="flex gap-2 w-full md:w-auto">
                  <input
                    type="password"
                    placeholder="Nhập Gemini API Key..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-full md:w-64"
                  />
                  <Button type="submit" className="font-bold text-xs shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700">
                    Lưu Key
                  </Button>
                </form>
              </div>
              {keySavedMessage && (
                <div className="mt-3 text-xs text-emerald-400 font-bold animate-in fade-in duration-200">
                  ✓ Lưu API Key thành công!
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Session đang hoạt động */}
        {activeSession && (
          <Card className="border-blue-500/30 bg-blue-950/20 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl shrink-0 mt-0.5">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">Bạn đang có bài thi dang dở</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Đề bài: <strong className="text-white">{activeSession.problem?.title}</strong>
                      {' • '}
                      Ngôn ngữ: <strong className="text-blue-400">{activeSession.selectedLang?.toUpperCase()}</strong>
                      {' • '}
                      Giai đoạn: <strong className="text-yellow-400">
                        {activeSession.stage === 'workspace' ? 'Làm bài code' : activeSession.stage === 'viva' ? 'Thi vấn đáp' : 'Xem kết quả'}
                      </strong>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancelSession}
                    className="font-bold text-xs rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border-transparent"
                  >
                    Hủy bài thi
                  </Button>
                  <Button
                    onClick={handleResumeSession}
                    className="font-bold text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Tiếp tục làm bài →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coding Problems list */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-400 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-blue-400" /> Danh sách đề thi lập trình
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {problems.map((problem) => (
              <Card key={problem.id} className="border-slate-800 hover:border-blue-900/40 hover:shadow-lg hover:shadow-blue-950/10 transition duration-200 rounded-3xl overflow-hidden bg-slate-900">
                <CardContent className="p-6 flex flex-col justify-between h-full space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                        {problem.category}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        problem.difficulty === 'Dễ' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {problem.difficulty}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white">{problem.title}</h3>
                    <p 
                      className="text-xs text-slate-400 line-clamp-3 leading-relaxed" 
                      dangerouslySetInnerHTML={{ __html: problem.description }}
                    />
                  </div>

                  <Button
                    onClick={() => handleStartExam(problem)}
                    disabled={!!activeSession}
                    className={`w-full font-bold h-11 rounded-xl shadow-md flex items-center justify-center gap-1.5 ${
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
        </div>
      {/* Modal chọn ngôn ngữ lập trình */}
      {showLangModal && selectedProblem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-slate-800 bg-slate-900 text-slate-100 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-950 px-8 py-5 border-b border-slate-850 flex justify-between items-center">
              <h2 className="text-lg font-black text-white m-0 flex items-center gap-2">
                <Code2 className="h-5.5 w-5.5 text-blue-400" />
                Chọn ngôn ngữ làm bài
              </h2>
              <button
                onClick={() => setShowLangModal(false)}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <CardContent className="p-8 space-y-6">
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Bài thi: <strong className="text-white">{selectedProblem.title}</strong>
                <br />
                Vui lòng lựa chọn ngôn ngữ lập trình bạn muốn sử dụng để hoàn thành bài thi tự luận này.
              </p>

              {/* Language selection dropdown */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ngôn ngữ lập trình</label>
                <div className="relative">
                  <select
                    value={chosenLang}
                    onChange={(e) => setChosenLang(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-805 text-slate-300 text-xs font-bold rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-blue-500 cursor-pointer font-sans appearance-none"
                  >
                    <option value="java">Java</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="bg-slate-950 px-8 py-5 border-t border-slate-850 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowLangModal(false)}
                className="rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-800 bg-transparent border-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleConfirmLang}
                className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                Khởi tạo Môi trường thi
              </Button>
            </div>
          </Card>
        </div>
      )}
      </main>
    </div>
  );
}
