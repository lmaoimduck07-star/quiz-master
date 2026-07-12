import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { BookOpen, Clock, LogOut, ShieldAlert, Award, FileText, ChevronRight, Play, X, Sun, Moon, Award as AwardIcon, TrendingUp, Calendar, AlertTriangle, Loader2 } from 'lucide-react';

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout, activeRole, setActiveRole } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simSubject, setSimSubject] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [isEnteringCoding, setIsEnteringCoding] = useState(false);
  const [codingStep, setCodingStep] = useState(0);

  const handleEnterCoding = () => {
    setIsEnteringCoding(true);
    setCodingStep(0);
    
    setTimeout(() => setCodingStep(1), 800);
    setTimeout(() => setCodingStep(2), 1600);
    setTimeout(() => {
      setIsEnteringCoding(false);
      navigate('/coding/dashboard');
    }, 2400);
  };

  // Load subjects từ Firestore
  useEffect(() => {
    // Khi quay lại dashboard, đóng và xoá phiên làm bài cũ (nếu có) để lượt thi sau là mới hoàn toàn
    localStorage.removeItem('qm_active_session');

    storage.loadSubjects().then(data => {
      setSubjects(data.filter(s => s.isActive !== false));
    });
  }, []);


  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('qm_theme') || 'light');

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('qm_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };


  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchToAdmin = () => {
    setActiveRole('Admin');
    localStorage.setItem('qm_active_role', 'Admin');
    navigate('/admin/dashboard');
  };

  // Launch Practice Test
  const startPractice = (subject, exam) => {
    navigate('/client/exam', {
      state: {
        examId: exam.id,
        title: exam.config?.title || exam.title,
        questions: exam.questions,
        timeLimit: (exam.questions.length * 1.5) * 60, // 1.5 phút mỗi câu cho đề luyện tập
        mode: 'practice',
        subjectName: subject.name,
        examSessionCode: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      }
    });
  };

  // Launch Simulation Test (Khảo thí mô phỏng - Lấy 50 câu ngẫu nhiên từ toàn bộ đề trong môn)
  const startSimulation = (subject) => {
    const allQuestions = [];
    const exams = subject.exams || [];
    exams.forEach(ex => {
      if (ex.questions && ex.questions.length > 0) {
        allQuestions.push(...ex.questions);
      }
    });

    if (allQuestions.length === 0) {
      alert("Môn học này chưa có câu hỏi nào để tạo đề thi mô phỏng!");
      return;
    }

    setSimSubject(subject);
    setVerificationCode(generateVerificationCode());
    setEnteredCode('');
    setShowSimModal(true);
  };

  const handleConfirmSimulation = () => {
    if (enteredCode !== verificationCode) {
      alert("Mã xác nhận chưa chính xác!");
      return;
    }

    setShowSimModal(false);

    const allQuestions = [];
    const exams = simSubject.exams || [];
    exams.forEach(ex => {
      if (ex.questions && ex.questions.length > 0) {
        allQuestions.push(...ex.questions);
      }
    });

    // Xáo trộn ngẫu nhiên và lấy tối đa 50 câu
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    const simulationQuestions = shuffled.slice(0, 50);

    // Request fullscreen immediately under user click context!
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Fullscreen error:", err);
      });
    }

    navigate('/client/exam', {
      state: {
        examId: 'sim_' + Date.now(),
        title: 'Khảo thí mô phỏng: ' + simSubject.name,
        questions: simulationQuestions,
        timeLimit: 50 * 60, // 50 phút
        mode: 'simulation',
        subjectName: simSubject.name,
        examSessionCode: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      }
    });
  };

  const openPracticeList = (subject) => {
    setSelectedSubject(subject);
    setShowPracticeModal(true);
  };

  if (isEnteringCoding) {
    const steps = [
      "Đang tải phân hệ thi lập trình...",
      "Đang xác thực thông tin tài khoản học sinh...",
      "Thiết lập cổng kết nối bảo mật hoàn tất. Đang chuyển hướng..."
    ];
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans transition-colors duration-200">
        <Card className="max-w-md w-full border-slate-800 bg-slate-900 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-8 space-y-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Chuyển sang Cổng lập trình</h2>
              <p className="text-slate-400 text-sm font-semibold h-6 leading-relaxed">
                {steps[codingStep]}
              </p>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 animate-pulse">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((codingStep + 1) / 3) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <h2 className="text-2xl font-black text-primary dark:text-blue-500 flex items-center gap-2 m-0">
          <BookOpen className="h-7 w-7" /> Quiz Master
        </h2>

        <div className="flex items-center gap-4">
          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl border-transparent bg-transparent"
            title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-yellow-400" />}
          </Button>

          {currentUser && currentUser.roles && currentUser.roles.includes('Admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchToAdmin}
              className="font-bold border-purple-200 hover:bg-purple-50 text-purple-700 dark:border-purple-900 dark:hover:bg-purple-950/30 dark:text-purple-400 h-9 rounded-xl flex items-center gap-1.5 bg-transparent"
            >
              <ShieldAlert className="h-4 w-4" /> Admin Panel
            </Button>
          )}

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{currentUser?.fullName}</div>
              <div className="text-xs text-slate-400 font-medium">Học sinh</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-primary/10 dark:bg-blue-900/30 flex items-center justify-center text-primary dark:text-blue-400 font-bold">
              {(currentUser?.fullName || 'H').charAt(0).toUpperCase()}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 h-9 w-9 rounded-xl border-transparent bg-transparent"
            title="Đăng xuất"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Welcome banner */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Xin chào, {currentUser?.fullName || 'Học sinh'}! 👋</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Lựa chọn môn học dưới đây để bắt đầu luyện tập hoặc thi khảo thí mô phỏng.</p>
          </div>
          <div className="bg-primary/5 dark:bg-blue-955/30 px-6 py-4 rounded-2xl border border-primary/10 dark:border-blue-900/20 flex items-center gap-4">
            <Award className="h-10 w-10 text-primary dark:text-blue-400 shrink-0" />
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">Hệ thống Khảo thí mô phỏng</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Thời gian thi: 50 phút / 50 câu hỏi</div>
            </div>
          </div>
        </div>
        {/* Phân hệ thi lập trình tự luận */}
        {(() => {
          const hasCodingPermission = currentUser?.permissions?.codingAccess === true;
          return (
            <div className={`p-8 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all ${
              hasCodingPermission 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-900 dark:to-indigo-950' 
                : 'bg-gradient-to-r from-slate-500 to-slate-600 dark:from-slate-800 dark:to-slate-900'
            }`}>
              <div>
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Phân hệ Thi Lập trình & Vấn đáp AI 🤖</h2>
                <p className={`text-sm font-medium ${hasCodingPermission ? 'text-blue-100' : 'text-slate-300'}`}>
                  Môi trường thi lập trình tự luận trực tuyến, chấm điểm testcases tự động và hỏi đáp trực tiếp 1:1 với Giám khảo AI.
                </p>
                {!hasCodingPermission && (
                  <p className="mt-2 text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    🔒 Bạn chưa được cấp quyền truy cập. Vui lòng liên hệ Admin để được cấp quyền.
                  </p>
                )}
              </div>
              <Button 
                onClick={handleEnterCoding}
                disabled={!hasCodingPermission}
                className={`w-full md:w-auto font-bold h-12 px-6 rounded-xl shadow-md shrink-0 border-transparent ${
                  hasCodingPermission 
                    ? 'bg-white hover:bg-slate-50 text-blue-600' 
                    : 'bg-white/20 text-white/60 cursor-not-allowed'
                }`}
              >
                {hasCodingPermission ? 'Vào Cổng thi Lập trình' : '🔒 Chưa có quyền truy cập'}
              </Button>
            </div>
          );
        })()}

        {/* Môn học đang mở */}
        <div>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-6">Môn học đang mở</h2>

          {subjects.length === 0 ? (
            <Card className="border-0 shadow-sm rounded-3xl p-12 text-center text-slate-500 dark:bg-slate-900">
              <BookOpen className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <div className="font-bold text-lg mb-1">Không có môn học nào đang mở</div>
              <p className="text-sm">Vui lòng liên hệ Admin để kích hoạt môn học.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {subjects.map((subject) => {
                const totalExams = subject.exams ? subject.exams.length : 0;
                return (
                  <Card key={subject.id} className="border-0 shadow-sm hover:shadow-md transition duration-200 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    {/* Left: Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-primary/10 dark:bg-blue-900/20 rounded-2xl text-primary dark:text-blue-400 shrink-0 hidden sm:block">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
                            {subject.name}
                          </h3>
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold">ID: {subject.id}</div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold pt-1">
                          <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>{totalExams} đề luyện tập</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex gap-3 shrink-0 w-full md:w-auto">
                      <Button
                        variant="outline"
                        className="flex-1 md:flex-none font-bold h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-transparent"
                        disabled={totalExams === 0}
                        onClick={() => openPracticeList(subject)}
                      >
                        Luyện tập
                      </Button>
                      <Button
                        className="flex-1 md:flex-none font-bold h-11 px-6 rounded-xl gap-1.5 shadow-sm"
                        disabled={totalExams === 0}
                        onClick={() => startSimulation(subject)}
                      >
                        <Play className="h-4 w-4 fill-white" /> Thi mô phỏng
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Practice Exams Modal */}
      {showPracticeModal && selectedSubject && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">
                <FileText className="h-5.5 w-5.5 text-primary dark:text-blue-400" />
                Luyện tập: {selectedSubject.name}
              </h2>
              <button
                onClick={() => setShowPracticeModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            <CardContent className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
              {selectedSubject.exams && selectedSubject.exams.length > 0 ? (
                selectedSubject.exams.map((ex, idx) => (
                  <div
                    key={ex.id}
                    className="p-4 border border-slate-100 dark:border-slate-800 hover:border-primary/30 dark:hover:border-blue-500/30 rounded-2xl flex items-center justify-between hover:bg-primary/5 dark:hover:bg-blue-950/20 transition group cursor-pointer"
                    onClick={() => startPractice(selectedSubject, ex)}
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary dark:group-hover:text-blue-400 transition text-sm">
                        Bài {idx + 1}: {ex.config?.title || ex.title}
                      </div>
                      <div className="flex gap-4 text-xs text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> {ex.questions?.length || 0} câu hỏi
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> ~{Math.round((ex.questions?.length || 0) * 1.5)} phút
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-8">
                  Chưa có đề luyện tập nào cho môn học này.
                </div>
              )}
            </CardContent>
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <Button
                variant="ghost"
                className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent"
                onClick={() => setShowPracticeModal(false)}
              >
                Đóng lại
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Simulation Exam Confirmation Modal */}
      {showSimModal && simSubject && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-250">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-250 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">
                <ShieldAlert className="h-5.5 w-5.5 text-red-500 animate-pulse" />
                Xác nhận Khảo thí Mô phỏng
              </h2>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="bg-amber-50 dark:bg-amber-955 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-amber-850 dark:text-amber-300 text-sm leading-relaxed font-semibold">
                ⚠️ CẢNH BÁO ANTI-CHEAT: Hệ thống sẽ tự động chuyển sang chế độ TOÀN MÀN HÌNH. Mọi hành vi thoát fullscreen, chuyển tab, mở phần mềm khác hoặc rời tiêu điểm sẽ bị ghi nhận là vi phạm quy chế thi. Đạt 3 lần vi phạm, hệ thống sẽ tự động nộp bài!
              </div>

              <div className="text-slate-600 dark:text-slate-300 text-sm font-semibold">
                Bạn có chắc chắn muốn tham gia kỳ thi mô phỏng môn <strong className="text-slate-850 dark:text-slate-100">{simSubject.name}</strong> không?
                Bài thi gồm 50 câu hỏi được trộn ngẫu nhiên và giới hạn thời gian làm bài trong 50 phút.
              </div>

              <div className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nhập mã xác nhận</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Mã 6 số..."
                    value={enteredCode}
                    onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (enteredCode === verificationCode) {
                          handleConfirmSimulation();
                        }
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-lg font-black tracking-widest text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary text-center"
                  />
                </div>
                <div className="text-center bg-slate-900 dark:bg-slate-950 text-white rounded-2xl px-5 py-3 shadow-md border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans">Mã ngẫu nhiên</div>
                  <div className="text-2xl font-black tracking-widest text-emerald-400 font-mono select-none">{verificationCode}</div>
                </div>
              </div>
            </CardContent>
            <div className="bg-slate-50 dark:bg-slate-800 px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowSimModal(false)}
                className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleConfirmSimulation}
                disabled={enteredCode !== verificationCode}
                className="rounded-xl font-bold bg-primary hover:bg-primary-dark text-white px-6 shadow-sm disabled:opacity-50"
              >
                Bắt đầu làm bài
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Simple internal icon component since X is imported from lucide-react in UserModal but let's define locally for safety
function XIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );
}
