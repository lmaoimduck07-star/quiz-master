// src/components/admin/LiveMonitor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { 
  Activity, Clock, ShieldAlert, AlertTriangle, Lock, MessageSquare, 
  BookOpen, UserCheck, RefreshCw, Eye, Search, X, CheckCircle, FileText, Code2, Users, Radio, Monitor
} from 'lucide-react';

function formatOnlineDuration(onlineSinceIso) {
  if (!onlineSinceIso) return 'Online < 1 phút';
  const start = new Date(onlineSinceIso).getTime();
  if (isNaN(start)) return 'Online < 1 phút';
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'Online < 1 phút';
  if (diffMins < 60) return `Online ${diffMins} phút`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `Online ${hours} giờ ${mins} phút` : `Online ${hours} giờ`;
}

export default function LiveMonitor() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'warning' | 'active' | 'terminated'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);
  const [, setTick] = useState(0);

  const prevWarningsRef = useRef({});

  // Timer tự động update thời gian online & kiểm tra trạng thái mỗi 10s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);
    // Lắng nghe danh sách active_sessions trên Firestore theo thời gian thực
    const unsubscribe = storage.subscribeActiveSessions((data) => {
      const rawList = data || [];
      const now = Date.now();

      // Tự động dọn dẹp các presence sessions quá cũ (> 90 giây không nhận heartbeat)
      rawList.forEach(s => {
        if ((s.mode === 'presence' || s.id?.startsWith('presence_')) && s.lastActive) {
          const lastActiveMs = new Date(s.lastActive).getTime();
          if (!isNaN(lastActiveMs) && (now - lastActiveMs > 90000)) {
            storage.removeActiveSession(s.id);
          }
        }
      });

      // Khống chế 1 Session duy nhất per-User per-mode
      const uniqueMap = new Map();
      rawList.forEach(s => {
        const uId = s.userId || 'guest';
        const key = `${uId}_${s.mode || 'presence'}`;
        const existing = uniqueMap.get(key);
        if (!existing || new Date(s.lastActive || 0) > new Date(existing.lastActive || 0)) {
          uniqueMap.set(key, s);
        }
      });

      const activeList = Array.from(uniqueMap.values());

      // Kiểm tra vi phạm để bật Toast Notification
      activeList.forEach(s => {
        const prevW = prevWarningsRef.current[s.id] || 0;
        const currentW = s.warningCount || 0;
        if (currentW > prevW && currentW >= 1) {
          const studentName = s.studentName || s.userId || 'Học sinh';
          setToastNotification(`⚠️ CẢNH BÁO: Học sinh "${studentName}" vừa vi phạm rời tab/cửa sổ thi (Lần ${currentW})!`);
          setTimeout(() => setToastNotification(null), 5000);
        }
        prevWarningsRef.current[s.id] = currentW;
      });

      setSessions(activeList);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleTerminate = async (sessionId, studentName) => {
    if (window.confirm(`Bạn có chắc chắn muốn KHÓA BÀI THI TỪ XA của học sinh "${studentName}"?`)) {
      await storage.terminateActiveSessionRemotely(sessionId);
      alert(`✅ Đã khóa bài thi của ${studentName} từ xa!`);
    }
  };

  const handleDeleteSession = async (sessionId, studentName) => {
    if (window.confirm(`Bạn có muốn XÓA THẺ PHIÊN THI của "${studentName}" khỏi danh sách để làm sạch màn hình?`)) {
      await storage.removeActiveSession(sessionId);
    }
  };

  const handleSendAlert = async (sessionId, studentName) => {
    const msg = prompt(`Nhập nội dung tin nhắn cảnh báo gửi trực tiếp đến học sinh "${studentName}":`, "Chú ý tập trung làm bài, không chuyển tab!");
    if (msg && msg.trim()) {
      await storage.sendAdminAlertToStudent(sessionId, msg.trim());
      alert(`✅ Đã gửi cảnh báo đến học sinh ${studentName}!`);
    }
  };

  // ── 1. PHÂN CHIA RÕ RÀNG 2 LOẠI SESSION: TÀI KHOẢN vs BÀI THI ──
  const PRESENCE_TIMEOUT_MS = 45000; // Ngưỡng 45s: nếu >45s không có heartbeat thì coi như đã tắt tab / offline
  const nowTime = Date.now();

  const presenceSessions = sessions.filter(s => {
    const isPresence = s.mode === 'presence' || s.id?.startsWith('presence_');
    if (!isPresence) return false;
    if (!s.lastActive) return true;
    const lastActiveMs = new Date(s.lastActive).getTime();
    if (isNaN(lastActiveMs)) return true;
    return (nowTime - lastActiveMs) < PRESENCE_TIMEOUT_MS;
  });

  const examSessions = sessions.filter(s => s.mode !== 'presence' && !s.id?.startsWith('presence_'));

  // Metrics
  const onlineAccountsCount = presenceSessions.length;
  const activeExamsCount = examSessions.filter(s => s.status !== 'terminated' && s.status !== 'submitted').length;
  const warningCountTotal = examSessions.filter(s => (s.warningCount || 0) > 0).length;
  const terminatedCount = examSessions.filter(s => s.status === 'terminated').length;

  // Lọc bài thi theo tìm kiếm & bộ lọc
  const filteredExamSessions = examSessions.filter(s => {
    const studentName = (s.studentName || s.userId || '').toLowerCase();
    const title = (s.examTitle || s.title || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = studentName.includes(query) || title.includes(query);

    if (!matchesSearch) return false;
    if (filterType === 'warning') return (s.warningCount || 0) > 0;
    if (filterType === 'active') return s.status !== 'terminated' && s.status !== 'submitted';
    if (filterType === 'terminated') return s.status === 'terminated';
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200 relative">
      {/* Toast Notification Nổi Góc Màn Hình */}
      {toastNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-slate-950 px-5 py-3.5 rounded-2xl shadow-2xl font-black text-xs flex items-center gap-3 border border-amber-300 animate-in slide-in-from-bottom-5 duration-300">
          <ShieldAlert className="h-5 w-5 shrink-0 animate-bounce" />
          <span>{toastNotification}</span>
          <button onClick={() => setToastNotification(null)} className="ml-2 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5 m-0">
            <Activity className="h-6 w-6 text-emerald-500 animate-pulse" /> Live Monitor & Online Tracker
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 m-0">
            Giám sát tài khoản đang Online (Presence) & tiến độ lượt thi đang làm bài (Exam Sessions)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            🔴 Realtime Sync Active
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tài khoản Online</div>
              <div className="text-2xl font-black text-emerald-500 mt-0.5">{onlineAccountsCount}</div>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-blue-500 transition" onClick={() => setFilterType('active')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đang thi làm bài</div>
              <div className="text-2xl font-black text-blue-500 mt-0.5">{activeExamsCount}</div>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-amber-500 transition" onClick={() => setFilterType('warning')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cảnh báo vi phạm</div>
              <div className="text-2xl font-black text-amber-500 mt-0.5">{warningCountTotal}</div>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-red-500 transition" onClick={() => setFilterType('terminated')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đã khóa từ xa</div>
              <div className="text-2xl font-black text-red-500 mt-0.5">{terminatedCount}</div>
            </div>
            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl">
              <Lock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🟢 PHẦN 1: GIÁM SÁT SESSIONS TÀI KHOẢN ONLINE (ACCOUNT PRESENCE) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
            <Users className="h-5 w-5 text-emerald-500" /> 1. Tài khoản đang Online trên hệ thống ({presenceSessions.length})
          </h3>
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" /> Tự động cập nhật thời gian
          </span>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-sm overflow-hidden">
          <CardContent className="p-5">
            {presenceSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold text-xs">
                Chưa phát hiện tài khoản nào đang Online.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {presenceSessions.map((usr) => {
                  const name = usr.studentName || usr.userId || 'Tài khoản';
                  const role = usr.role === 'Admin' ? 'Admin / Giám thị' : 'Học sinh';
                  const durationText = formatOnlineDuration(usr.onlineSince || usr.lastActive);

                  return (
                    <div 
                      key={usr.id} 
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between space-y-3 hover:border-emerald-500 transition"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-black text-sm text-slate-800 dark:text-white">
                            {name}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                            {role}
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Online
                        </span>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-blue-400" />
                          Thời gian Online: <strong className="text-emerald-600 dark:text-emerald-400">{durationText}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="h-px bg-slate-200 dark:bg-slate-800 my-6" />

      {/* 🎯 PHẦN 2: GIÁM SÁT SESSIONS THI ĐANG LÀM BÀI (ACTIVE EXAM SESSIONS) */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
            <BookOpen className="h-5 w-5 text-blue-500" /> 2. Danh sách bài thi đang diễn ra ({filteredExamSessions.length})
          </h3>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên học sinh, bài thi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <Button
              size="sm"
              variant={filterType === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterType('all')}
              className="text-xs font-bold h-8 rounded-lg"
            >
              Tất cả ({examSessions.length})
            </Button>
            <Button
              size="sm"
              variant={filterType === 'active' ? 'default' : 'outline'}
              onClick={() => setFilterType('active')}
              className="text-xs font-bold h-8 rounded-lg text-emerald-600 dark:text-emerald-400 border-emerald-300"
            >
              🟢 Đang thi ({activeExamsCount})
            </Button>
            <Button
              size="sm"
              variant={filterType === 'warning' ? 'default' : 'outline'}
              onClick={() => setFilterType('warning')}
              className="text-xs font-bold h-8 rounded-lg text-amber-600 dark:text-amber-400 border-amber-300"
            >
              ⚠️ Vi phạm ({warningCountTotal})
            </Button>
            <Button
              size="sm"
              variant={filterType === 'terminated' ? 'default' : 'outline'}
              onClick={() => setFilterType('terminated')}
              className="text-xs font-bold h-8 rounded-lg text-red-600 dark:text-red-400 border-red-300"
            >
              🔒 Đã khóa ({terminatedCount})
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Đang nạp dữ liệu lượt thi Realtime...
          </div>
        ) : filteredExamSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            Không có lượt bài thi nào đang diễn ra phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredExamSessions.map((session) => {
              const studentName = session.studentName || session.userId || 'Học sinh';
              const examTitle = session.examTitle || session.title || 'Bài thi';
              const currentQ = session.currentQuestion || 1;
              const totalQ = session.totalQuestions || 10;
              const percent = Math.min(100, Math.round((currentQ / totalQ) * 100));
              const warnings = session.warningCount || 0;
              const isTerminated = session.status === 'terminated';
              const isSubmitted = session.status === 'submitted';
              const isCoding = session.mode === 'coding';
              const timeLeftMins = session.timeLeft ? Math.floor(session.timeLeft / 60) : 0;
              const timeLeftSecs = session.timeLeft ? session.timeLeft % 60 : 0;

              return (
                <Card 
                  key={session.id} 
                  className={`border-2 rounded-3xl overflow-hidden transition shadow-sm ${
                    isTerminated 
                      ? 'border-red-400 bg-red-50/30 dark:bg-red-950/20' 
                      : warnings > 0 
                        ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/20' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Header học sinh & badge */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>{studentName}</span>
                          {isCoding && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                              <Code2 className="h-3 w-3" /> Code
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]" title={examTitle}>
                          {examTitle}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isTerminated ? (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-lg shadow-sm">
                            🔒 Đã khóa bài
                          </span>
                        ) : isSubmitted ? (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-lg shadow-sm">
                            ✓ Đã nộp bài
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live
                          </span>
                        )}

                        {/* Nút X xóa thẻ */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id, studentName);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-lg transition"
                          title="Xóa thẻ phiên thi này khỏi màn hình"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Tiến độ làm bài & thời gian */}
                    <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-350">
                          {isCoding ? (
                            <>Ngôn ngữ: <strong className="text-blue-400 uppercase">{session.codeLanguage || 'Python'}</strong></>
                          ) : (
                            <>Tiến độ: <strong className="text-primary dark:text-blue-400">Câu {currentQ} / {totalQ}</strong></>
                          )}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {timeLeftMins > 0 || timeLeftSecs > 0 ? `${timeLeftMins}:${timeLeftSecs < 10 ? '0' : ''}${timeLeftSecs}` : 'Tự do'}
                        </span>
                      </div>

                      {/* Progress bar */}
                      {!isCoding && (
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary dark:bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Cảnh báo rời tab */}
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500 dark:text-slate-400">Vi phạm rời tab:</span>
                      {warnings > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800">
                          <ShieldAlert className="h-3.5 w-3.5" /> {warnings} lần
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0 (An toàn)</span>
                      )}
                    </div>

                    {/* Nút thao tác Admin */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedSessionDetail(session)}
                        className="flex-1 font-bold text-xs h-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 bg-transparent flex items-center justify-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> Xem chi tiết
                      </Button>
                      {!isTerminated && !isSubmitted && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => handleSendAlert(session.id, studentName)}
                            className="font-bold text-xs h-9 px-3 rounded-xl border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 bg-transparent flex items-center justify-center gap-1"
                            title="Gửi tin nhắn nhắc nhở"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleTerminate(session.id, studentName)}
                            className="font-bold text-xs h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center justify-center gap-1 border-transparent"
                            title="Khóa bài thi từ xa"
                          >
                            <Lock className="h-3.5 w-3.5" /> Khóa
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Xem Chi Tiết Ma Trận Câu Hỏi & Action Logs */}
      {selectedSessionDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl border-slate-800 bg-slate-900 text-slate-100 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white m-0 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-400" /> Chi tiết phiên thi: {selectedSessionDetail.studentName || selectedSessionDetail.userId}
                </h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">{selectedSessionDetail.examTitle}</p>
              </div>
              <button onClick={() => setSelectedSessionDetail(null)} className="text-slate-400 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Ma trận câu hỏi Answer Grid */}
              {selectedSessionDetail.answeredGrid && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 m-0">
                    <FileText className="h-4 w-4 text-blue-400" /> Ma trận ô câu hỏi Realtime
                  </h4>
                  <div className="flex flex-wrap gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    {Object.keys(selectedSessionDetail.answeredGrid).map((qNum) => {
                      const status = selectedSessionDetail.answeredGrid[qNum];
                      const isCurrent = parseInt(qNum) === selectedSessionDetail.currentQuestion;
                      return (
                        <div
                          key={qNum}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border transition ${
                            isCurrent
                              ? 'border-blue-400 ring-2 ring-blue-500/50 bg-blue-600 text-white'
                              : status === 'answered'
                                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                                : status === 'flagged'
                                  ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {qNum}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-semibold pt-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đã trả lời</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Gắn cờ</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Đang xem</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span> Chưa làm</span>
                  </div>
                </div>
              )}

              {/* Nhật ký thao tác Action Logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 m-0">
                  <Activity className="h-4 w-4 text-emerald-400" /> Dòng thời gian thao tác của học sinh
                </h4>
                {selectedSessionDetail.actionLogs && selectedSessionDetail.actionLogs.length > 0 ? (
                  <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto">
                    {selectedSessionDetail.actionLogs.map((log, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-mono border-b border-slate-800/60 pb-1.5 last:border-0">
                        <span className="text-slate-400">{log.time}</span>
                        <span className="text-slate-200 font-sans font-medium">{log.detail}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                    Chưa có nhật ký thao tác chi tiết.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
