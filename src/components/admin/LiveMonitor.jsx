// src/components/admin/LiveMonitor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import {
  Activity, Clock, ShieldAlert, AlertTriangle, Lock, MessageSquare,
  BookOpen, UserCheck, RefreshCw, Eye, Search, X, CheckCircle, FileText,
  Code2, Users, Radio, Monitor, Send, Trash2, Copy, ChevronDown, LayoutGrid
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatOnlineDuration(onlineSinceIso) {
  if (!onlineSinceIso) return 'Online < 1 phút';
  const start = new Date(onlineSinceIso).getTime();
  if (isNaN(start)) return 'Online < 1 phút';
  const diffMs = Math.max(0, Date.now() - start);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Online < 1 phút';
  if (diffMins < 60) return `Online ${diffMins} phút`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `Online ${hours} giờ ${mins} phút` : `Online ${hours} giờ`;
}

function formatTime(isoString) {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTimeLeft(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function getModeConfig(mode) {
  if (mode === 'simulation') return { label: 'Khảo thí', icon: '🎯', color: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (mode === 'practice') return { label: 'Luyện tập', icon: '📚', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (mode === 'coding') return { label: 'Lập trình', icon: '💻', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  return { label: mode || 'Khác', icon: '📄', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────

function ToastStack({ queue, onRemove }) {
  if (!queue.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2 items-end pointer-events-none">
      {queue.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl font-black text-xs border animate-in slide-in-from-bottom-4 duration-300 max-w-sm ${
            t.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : t.type === 'error'
                ? 'bg-red-500 text-white border-red-400'
                : 'bg-amber-500 text-slate-950 border-amber-300'
          }`}
        >
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <ShieldAlert className="h-4 w-4 shrink-0 animate-bounce" />
          }
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 hover:opacity-70 transition shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

function ActionModal({ modal, onClose, onConfirm, onBulkConfirm }) {
  const [message, setMessage] = useState('Chú ý tập trung làm bài, không chuyển tab!');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (modal) {
      setIsReady(false);
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [modal]);

  if (!modal) return null;

  const { type, session, sessions } = modal;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (type === 'terminate') {
    const modeConfig = getModeConfig(session.mode);
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleOverlayClick}>
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="bg-red-50 dark:bg-red-950/40 px-6 py-4 border-b border-red-100 dark:border-red-900/50 flex items-center gap-3">
            <div className="p-2 bg-red-500/15 rounded-xl"><Lock className="h-5 w-5 text-red-500" /></div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white m-0">Xác nhận Khóa Bài Thi</h3>
              <p className="text-xs text-slate-500 m-0">Hành động này không thể hoàn tác</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-2 border border-slate-200 dark:border-slate-800 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Học sinh:</span>
                <span className="font-black text-slate-800 dark:text-white">{session.studentName || session.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Bài thi:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 text-right max-w-[180px] truncate">{session.examTitle || 'Bài thi'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Chế độ:</span>
                <span className={`text-[10px] font-black uppercase tracking-wider border px-2 py-0.5 rounded-lg ${getModeConfig(session.mode).color}`}>
                  {getModeConfig(session.mode).icon} {getModeConfig(session.mode).label}
                </span>
              </div>
              {(session.warningCount > 0) && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Vi phạm:</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">{session.warningCount} lần</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Học sinh sẽ không thể tiếp tục làm bài sau khi bị khóa.
            </p>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 font-bold text-xs h-10 rounded-xl bg-transparent">Hủy</Button>
            <Button disabled={!isReady} onClick={() => onConfirm('terminate', session)} className="flex-1 font-bold text-xs h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white border-transparent flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Lock className="h-3.5 w-3.5" /> Xác nhận Khóa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'delete') {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleOverlayClick}>
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-slate-500/10 rounded-xl"><Trash2 className="h-5 w-5 text-slate-500" /></div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white m-0">Xóa Thẻ Phiên Thi</h3>
              <p className="text-xs text-slate-500 m-0">Chỉ xóa khỏi màn hình, không ảnh hưởng dữ liệu</p>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Bạn muốn xóa thẻ phiên thi của <strong className="text-slate-800 dark:text-white">{session.studentName || session.userId}</strong> khỏi danh sách?
            </p>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 font-bold text-xs h-10 rounded-xl bg-transparent">Hủy</Button>
            <Button disabled={!isReady} onClick={() => onConfirm('delete', session)} className="flex-1 font-bold text-xs h-10 rounded-xl bg-slate-700 hover:bg-slate-600 text-white border-transparent flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 className="h-3.5 w-3.5" /> Xóa thẻ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'sendMsg') {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleOverlayClick}>
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="bg-amber-50 dark:bg-amber-950/30 px-6 py-4 border-b border-amber-100 dark:border-amber-900/50 flex items-center gap-3">
            <div className="p-2 bg-amber-500/15 rounded-xl"><MessageSquare className="h-5 w-5 text-amber-500" /></div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white m-0">Gửi Cảnh Báo</h3>
              <p className="text-xs text-slate-500 m-0">Đến: <strong>{session.studentName || session.userId}</strong></p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Nội dung tin nhắn</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              autoFocus
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400 dark:focus:border-amber-600 resize-none transition"
              placeholder="Nhập nội dung cảnh báo..."
            />
            <p className="text-[10px] text-slate-400">Tin nhắn sẽ xuất hiện dưới dạng popup ngay trên màn hình làm bài của học sinh.</p>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 font-bold text-xs h-10 rounded-xl bg-transparent">Hủy</Button>
            <Button
              onClick={() => message.trim() && onConfirm('sendMsg', session, message.trim())}
              disabled={!message.trim()}
              className="flex-1 font-bold text-xs h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white border-transparent flex items-center justify-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Gửi ngay
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'bulkTerminate') {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleOverlayClick}>
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="bg-red-50 dark:bg-red-950/40 px-6 py-4 border-b border-red-100 dark:border-red-900/50 flex items-center gap-3">
            <div className="p-2 bg-red-500/15 rounded-xl"><Lock className="h-5 w-5 text-red-500" /></div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white m-0">Khóa Hàng Loạt</h3>
              <p className="text-xs text-slate-500 m-0">{sessions?.length} học sinh sẽ bị khóa bài thi</p>
            </div>
          </div>
          <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
            {sessions?.map(s => (
              <div key={s.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <div className="font-black text-sm text-slate-800 dark:text-white">{s.studentName || s.userId}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[220px]">{s.examTitle}</div>
                </div>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg shrink-0">
                  {s.warningCount} vi phạm
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 font-bold text-xs h-10 rounded-xl bg-transparent">Hủy</Button>
            <Button disabled={!isReady} onClick={() => onBulkConfirm(sessions)} className="flex-1 font-bold text-xs h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white border-transparent flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Lock className="h-3.5 w-3.5" /> Khóa {sessions?.length} học sinh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveMonitor() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterExamTitle, setFilterExamTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [toastQueue, setToastQueue] = useState([]);
  const [actionModal, setActionModal] = useState(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [, setTick] = useState(0);

  const prevWarningsRef = useRef({});
  const toastTimersRef = useRef({});

  // ── Toast helpers ──
  const addToast = (msg, type = 'warning') => {
    const id = Date.now() + Math.random();
    setToastQueue(prev => [...prev.slice(-4), { id, msg, type }]);
    const timer = setTimeout(() => removeToast(id), 5000);
    toastTimersRef.current[id] = timer;
  };

  const removeToast = (id) => {
    setToastQueue(prev => prev.filter(t => t.id !== id));
    clearTimeout(toastTimersRef.current[id]);
    delete toastTimersRef.current[id];
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // Timer cập nhật thời gian online mỗi 10s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe Firestore realtime
  useEffect(() => {
    setLoading(true);
    const unsubscribe = storage.subscribeActiveSessions((data) => {
      const rawList = data || [];
      const now = Date.now();

      // Dọn dẹp presence cũ > 90s
      rawList.forEach(s => {
        if ((s.mode === 'presence' || s.id?.startsWith('presence_')) && s.lastActive) {
          const lastMs = new Date(s.lastActive).getTime();
          if (!isNaN(lastMs) && (now - lastMs > 90000)) {
            storage.removeActiveSession(s.id);
          }
        }
      });

      // Dedup: 1 session per user per mode
      const uniqueMap = new Map();
      rawList.forEach(s => {
        const key = `${s.userId || 'guest'}_${s.mode || 'presence'}`;
        const existing = uniqueMap.get(key);
        if (!existing || new Date(s.lastActive || 0) > new Date(existing.lastActive || 0)) {
          uniqueMap.set(key, s);
        }
      });

      const activeList = Array.from(uniqueMap.values());

      // Detect vi phạm mới → toast
      activeList.forEach(s => {
        const prevW = prevWarningsRef.current[s.id] || 0;
        const currentW = s.warningCount || 0;
        if (currentW > prevW && currentW >= 1) {
          const name = s.studentName || s.userId || 'Học sinh';
          addToast(`⚠️ ${name} vừa vi phạm rời tab (Lần ${currentW}) — ${s.examTitle || 'Bài thi'}`, 'warning');
        }
        prevWarningsRef.current[s.id] = currentW;
      });

      setSessions(activeList);
      setLoading(false);
    });

    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // ── Action handlers ──
  const handleActionConfirm = async (type, session, extra) => {
    if (type === 'terminate') {
      await storage.terminateActiveSessionRemotely(session.id);
      addToast(`✅ Đã khóa bài thi của ${session.studentName || session.userId} từ xa!`, 'success');
    } else if (type === 'delete') {
      await storage.deleteActiveSessionRemotely(session.id);
      addToast(`🗑️ Đã xóa thẻ phiên của ${session.studentName || session.userId}`, 'success');
    } else if (type === 'sendMsg') {
      await storage.sendAdminAlertToStudent(session.id, extra);
      addToast(`💬 Đã gửi cảnh báo đến ${session.studentName || session.userId}`, 'success');
    }
    setActionModal(null);
    // Cập nhật detail modal nếu đang mở session này
    if (selectedSessionDetail?.id === session.id) {
      if (type === 'delete') setSelectedSessionDetail(null);
      else setSelectedSessionDetail(prev => ({ ...prev, status: type === 'terminate' ? 'terminated' : prev?.status }));
    }
  };

  const handleBulkTerminate = async (sessionList) => {
    const names = [];
    for (const s of sessionList) {
      await storage.terminateActiveSessionRemotely(s.id);
      names.push(s.studentName || s.userId);
    }
    addToast(`✅ Đã khóa ${sessionList.length} học sinh: ${names.join(', ')}`, 'success');
    setActionModal(null);
  };

  // ── Phân loại sessions ──
  const PRESENCE_TIMEOUT_MS = 45000;
  const nowTime = Date.now();

  const presenceSessions = sessions.filter(s => {
    const isPresence = s.mode === 'presence' || s.id?.startsWith('presence_');
    if (!isPresence) return false;
    if (!s.lastActive) return true;
    const lastMs = new Date(s.lastActive).getTime();
    return isNaN(lastMs) || (nowTime - lastMs) < PRESENCE_TIMEOUT_MS;
  });

  const examSessions = sessions.filter(s => s.mode !== 'presence' && !s.id?.startsWith('presence_') && s.status !== 'deleted');

  // ── Metrics ──
  const onlineAccountsCount = presenceSessions.length;
  const activeExamsCount = examSessions.filter(s => s.status !== 'terminated' && s.status !== 'submitted').length;
  const warningCountTotal = examSessions.filter(s => (s.warningCount || 0) > 0 && s.status !== 'terminated').length;
  const terminatedCount = examSessions.filter(s => s.status === 'terminated').length;
  const submittedCount = examSessions.filter(s => s.status === 'submitted').length;

  // ── Unique exam titles for filter dropdown ──
  const uniqueExamTitles = [...new Set(
    examSessions.map(s => s.examTitle || s.title).filter(Boolean)
  )];

  // ── Filtered exam sessions ──
  const filteredExamSessions = examSessions.filter(s => {
    const studentName = (s.studentName || s.userId || '').toLowerCase();
    const title = (s.examTitle || s.title || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    if (query && !studentName.includes(query) && !title.includes(query)) return false;
    if (filterExamTitle && (s.examTitle || s.title) !== filterExamTitle) return false;
    if (filterType === 'warning') return (s.warningCount || 0) > 0 && s.status !== 'terminated';
    if (filterType === 'active') return s.status !== 'terminated' && s.status !== 'submitted';
    if (filterType === 'terminated') return s.status === 'terminated';
    if (filterType === 'submitted') return s.status === 'submitted';
    return true;
  });

  // ── Các session đang vi phạm (cho bulk terminate) ──
  const violatingSessions = examSessions.filter(s => (s.warningCount || 0) > 0 && s.status !== 'terminated' && s.status !== 'submitted');

  // ── Copy raw JSON helper ──
  const copyRawJson = () => {
    if (!selectedSessionDetail) return;
    navigator.clipboard.writeText(JSON.stringify(selectedSessionDetail, null, 2)).then(() => {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    });
  };

  // ── Refresh detail modal từ sessions state ──
  const refreshDetail = () => {
    if (!selectedSessionDetail) return;
    const fresh = sessions.find(s => s.id === selectedSessionDetail.id);
    if (fresh) setSelectedSessionDetail(fresh);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-200 relative">
      {/* Toast Stack */}
      <ToastStack queue={toastQueue} onRemove={removeToast} />

      {/* Action Modal */}
      <ActionModal
        modal={actionModal}
        onClose={() => setActionModal(null)}
        onConfirm={handleActionConfirm}
        onBulkConfirm={handleBulkTerminate}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5 m-0">
            <Activity className="h-6 w-6 text-emerald-500 animate-pulse" /> Live Monitor & Online Tracker
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 m-0">
            Giám sát tài khoản Online · Phiên thi Realtime · Hành động từ xa
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {violatingSessions.length > 0 && (
            <Button
              onClick={() => setActionModal({ type: 'bulkTerminate', sessions: violatingSessions })}
              className="font-bold text-xs h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white border-transparent flex items-center gap-1.5 shadow-sm"
            >
              <Lock className="h-3.5 w-3.5" /> Khóa tất cả vi phạm ({violatingSessions.length})
            </Button>
          )}
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            🔴 Realtime Sync Active
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Online */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đang Online</div>
              <div className="text-2xl font-black text-emerald-500 mt-0.5">{onlineAccountsCount}</div>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl"><Users className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        {/* Đang thi */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-blue-400 transition" onClick={() => setFilterType('active')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đang làm bài</div>
              <div className="text-2xl font-black text-blue-500 mt-0.5">{activeExamsCount}</div>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl"><UserCheck className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        {/* Vi phạm */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-amber-400 transition" onClick={() => setFilterType('warning')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vi phạm</div>
              <div className="text-2xl font-black text-amber-500 mt-0.5">{warningCountTotal}</div>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl"><AlertTriangle className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        {/* Đã nộp */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-purple-400 transition" onClick={() => setFilterType('submitted')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đã nộp bài</div>
              <div className="text-2xl font-black text-purple-500 mt-0.5">{submittedCount}</div>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl"><CheckCircle className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        {/* Đã khóa */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm cursor-pointer hover:border-red-400 transition" onClick={() => setFilterType('terminated')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đã khóa</div>
              <div className="text-2xl font-black text-red-500 mt-0.5">{terminatedCount}</div>
            </div>
            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl"><Lock className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Presence */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
            <Users className="h-5 w-5 text-emerald-500" /> 1. Tài khoản đang Online ({presenceSessions.length})
          </h3>
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" /> Tự động cập nhật
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
                {presenceSessions.map(usr => {
                  const name = usr.studentName || usr.userId || 'Tài khoản';
                  const role = usr.role === 'Admin' ? 'Admin / Giám thị' : 'Học sinh';
                  const isAdmin = usr.role === 'Admin';
                  const durationText = formatOnlineDuration(usr.onlineSince || usr.lastActive);
                  const sinceTime = formatTime(usr.onlineSince);

                  return (
                    <div
                      key={usr.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between space-y-3 hover:border-emerald-400 transition"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className={`font-black text-sm ${isAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-white'}`}>
                            {name}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{role}</div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Online
                        </span>
                      </div>
                      <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-blue-400" />
                          <strong className="text-emerald-600 dark:text-emerald-400">{durationText}</strong>
                        </span>
                        {sinceTime !== '--:--' && (
                          <span className="text-slate-400 text-[10px]">Từ {sinceTime}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />

      {/* Section 2: Exam Sessions */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
            <BookOpen className="h-5 w-5 text-blue-500" /> 2. Phiên thi đang diễn ra ({filteredExamSessions.length})
          </h3>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên học sinh, bài thi..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Exam title filter dropdown */}
            {uniqueExamTitles.length > 1 && (
              <div className="relative">
                <select
                  value={filterExamTitle}
                  onChange={e => setFilterExamTitle(e.target.value)}
                  className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 cursor-pointer"
                >
                  <option value="">Tất cả đề thi</option>
                  {uniqueExamTitles.map(t => (
                    <option key={t} value={t}>{t.length > 28 ? t.slice(0, 28) + '…' : t}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* Status filters */}
            <button
              onClick={() => setFilterType('all')}
              className={`text-xs font-bold h-8 px-3 rounded-lg border transition-all outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white border-slate-700 shadow-sm dark:bg-slate-200 dark:text-slate-900 dark:border-slate-300'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              Tất cả ({examSessions.length})
            </button>
            <button
              onClick={() => setFilterType('active')}
              className={`text-xs font-bold h-8 px-3 rounded-lg border transition-all outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-400 ${
                filterType === 'active'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:border-emerald-500'
              }`}
            >
              🟢 Đang thi ({activeExamsCount})
            </button>
            <button
              onClick={() => setFilterType('warning')}
              className={`text-xs font-bold h-8 px-3 rounded-lg border transition-all outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-400 ${
                filterType === 'warning'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:border-amber-500'
              }`}
            >
              ⚠️ Vi phạm ({warningCountTotal})
            </button>
            <button
              onClick={() => setFilterType('submitted')}
              className={`text-xs font-bold h-8 px-3 rounded-lg border transition-all outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-400 ${
                filterType === 'submitted'
                  ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800 hover:border-purple-500'
              }`}
            >
              ✅ Đã nộp ({submittedCount})
            </button>
            <button
              onClick={() => setFilterType('terminated')}
              className={`text-xs font-bold h-8 px-3 rounded-lg border transition-all outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-400 ${
                filterType === 'terminated'
                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 hover:border-red-500'
              }`}
            >
              🔒 Đã khóa ({terminatedCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Đang nạp dữ liệu Realtime...
          </div>
        ) : filteredExamSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            Không có phiên thi nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredExamSessions.map(session => {
              const studentName = session.studentName || session.userId || 'Học sinh';
              const examTitle = session.examTitle || session.title || 'Bài thi';
              const totalQ = session.totalQuestions || 1;
              const answeredCount = session.answeredCount || 0;
              const percent = Math.min(100, Math.round((answeredCount / totalQ) * 100));
              const warnings = session.warningCount || 0;
              const isTerminated = session.status === 'terminated';
              const isSubmitted = session.status === 'submitted';
              const isCoding = session.mode === 'coding';
              const modeConfig = getModeConfig(session.mode);
              const sinceTime = formatTime(session.onlineSince || session.lastActive);
              const timeLeftFmt = formatTimeLeft(session.timeLeft);

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
                  <CardContent className="p-5 space-y-3.5">
                    {/* Header: tên + badges */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">{studentName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5" title={examTitle}>{examTitle}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {/* Mode badge */}
                        <span className={`text-[9px] font-black uppercase tracking-widest border px-1.5 py-0.5 rounded-md ${modeConfig.color}`}>
                          {modeConfig.icon} {modeConfig.label}
                        </span>

                        {/* Status badge */}
                        {isTerminated ? (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-lg shadow-sm">🔒 Khóa</span>
                        ) : isSubmitted ? (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white px-2 py-0.5 rounded-lg shadow-sm">✓ Nộp</span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Live
                          </span>
                        )}

                        {/* Xóa thẻ */}
                        <button
                          onClick={e => { e.stopPropagation(); setActionModal({ type: 'delete', session }); }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-lg transition"
                          title="Xóa thẻ phiên thi này khỏi màn hình"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tiến độ & thời gian */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-400">
                          {isCoding ? (
                            <>Ngôn ngữ: <strong className="text-blue-400 uppercase">{session.codeLanguage || 'Python'}</strong></>
                          ) : (
                            <>Đã làm: <strong className="text-primary dark:text-blue-400">{answeredCount}/{totalQ} câu</strong> <span className="text-slate-400">({percent}%)</span></>
                          )}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.timeLeft != null ? timeLeftFmt : 'Tự do'}
                        </span>
                      </div>
                      {!isCoding && (
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                      {sinceTime !== '--:--' && (
                        <div className="text-[10px] text-slate-400 font-medium">⏰ Vào thi lúc {sinceTime}</div>
                      )}
                    </div>

                    {/* Cảnh báo vi phạm */}
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500 dark:text-slate-400">Vi phạm rời tab:</span>
                      {warnings > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800">
                          <ShieldAlert className="h-3 w-3" /> {warnings} lần
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0 (An toàn)</span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="outline"
                        onClick={() => { setSelectedSessionDetail(session); setDetailTab('overview'); }}
                        className="flex-1 font-bold text-xs h-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 bg-transparent flex items-center justify-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> Xem chi tiết
                      </Button>
                      {!isTerminated && !isSubmitted && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setActionModal({ type: 'sendMsg', session }); }}
                            className="font-bold text-xs h-9 px-3 rounded-xl border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 bg-transparent flex items-center justify-center gap-1"
                            title="Gửi tin nhắn nhắc nhở"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setActionModal({ type: 'terminate', session }); }}
                            className="font-bold text-xs h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center justify-center gap-1 border-transparent"
                            title="Khóa bài thi từ xa"
                          >
                            <Lock className="h-3.5 w-3.5" />
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

      {/* Detail Modal */}
      {selectedSessionDetail && (() => {
        const s = selectedSessionDetail;
        const isTerminated = s.status === 'terminated';
        const isSubmitted = s.status === 'submitted';
        const modeConfig = getModeConfig(s.mode);
        const answeredCount = s.answeredCount || 0;
        const totalQ = s.totalQuestions || 1;
        const percent = Math.min(100, Math.round((answeredCount / totalQ) * 100));
        const flaggedCount = s.answeredGrid
          ? Object.values(s.answeredGrid).filter(v => v === 'flagged').length
          : 0;

        const TABS = [
          { id: 'overview', label: 'Tổng quan', icon: <Monitor className="h-3.5 w-3.5" /> },
          { id: 'grid', label: 'Ma trận', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
          { id: 'logs', label: 'Nhật ký', icon: <Activity className="h-3.5 w-3.5" /> },
          { id: 'raw', label: 'Raw JSON', icon: <Code2 className="h-3.5 w-3.5" /> },
        ];

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl border-slate-800 bg-slate-900 text-slate-100 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-black text-white m-0 flex items-center gap-2 flex-wrap">
                    <UserCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="truncate">{s.studentName || s.userId}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wider border px-1.5 py-0.5 rounded-md ${modeConfig.color}`}>
                      {modeConfig.icon} {modeConfig.label}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 m-0 mt-0.5 truncate">{s.examTitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={refreshDetail}
                    className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg"
                    title="Refresh dữ liệu"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSelectedSessionDetail(null)} className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-950/50">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
                      detailTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

                {/* Tab: Tổng quan */}
                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'ID Phiên', value: s.id, mono: true },
                        { label: 'Thời gian vào thi', value: formatTime(s.onlineSince || s.lastActive) },
                        { label: 'Thời gian còn lại', value: s.timeLeft != null ? formatTimeLeft(s.timeLeft) : 'Tự do' },
                        { label: 'Trạng thái', value: isTerminated ? '🔒 Đã khóa' : isSubmitted ? '✅ Đã nộp' : '🟢 Đang làm bài' },
                        { label: 'Số câu đã làm', value: `${answeredCount} / ${totalQ} câu (${percent}%)` },
                        { label: 'Câu gắn cờ', value: `${flaggedCount} câu` },
                        { label: 'Vi phạm rời tab', value: `${s.warningCount || 0} lần` },
                        s.codeLanguage ? { label: 'Ngôn ngữ', value: s.codeLanguage.toUpperCase() } : null,
                      ].filter(Boolean).map(({ label, value, mono }) => (
                        <div key={label} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">{label}</div>
                          <div className={`text-sm font-bold text-slate-200 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar trong overview */}
                    {!s.mode?.includes('coding') && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-400">
                          <span>Tiến độ hoàn thành</span><span>{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Action buttons ngay trong modal */}
                    {!isTerminated && !isSubmitted && (
                      <div className="flex gap-2 pt-2 border-t border-slate-800">
                        <Button
                          variant="outline"
                          onClick={() => setActionModal({ type: 'sendMsg', session: s })}
                          className="flex-1 font-bold text-xs h-9 rounded-xl border-amber-800 text-amber-400 hover:bg-amber-950/30 bg-transparent flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Gửi cảnh báo
                        </Button>
                        <Button
                          onClick={() => setActionModal({ type: 'terminate', session: s })}
                          className="flex-1 font-bold text-xs h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white border-transparent flex items-center justify-center gap-1.5"
                        >
                          <Lock className="h-3.5 w-3.5" /> Khóa bài thi
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Ma trận câu hỏi */}
                {detailTab === 'grid' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 m-0">
                      <FileText className="h-4 w-4 text-blue-400" /> Ma trận ô câu hỏi Realtime
                    </h4>
                    {s.answeredGrid ? (
                      <>
                        <div className="flex flex-wrap gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                          {Object.keys(s.answeredGrid).map(qNum => {
                            const status = s.answeredGrid[qNum];
                            const isCurrent = parseInt(qNum) === s.currentQuestion;
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
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-semibold">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đã trả lời</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Gắn cờ</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Đang xem</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Chưa làm</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-500 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                        Không có dữ liệu ma trận câu hỏi.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Nhật ký */}
                {detailTab === 'logs' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 m-0">
                      <Activity className="h-4 w-4 text-emerald-400" /> Dòng thời gian thao tác
                    </h4>
                    {s.actionLogs && s.actionLogs.length > 0 ? (
                      <div className="space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 max-h-64 overflow-y-auto">
                        {s.actionLogs.map((log, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-mono border-b border-slate-800/60 pb-1.5 last:border-0">
                            <span className="text-slate-500">{log.time}</span>
                            <span className="text-slate-200 font-sans font-medium text-right">{log.detail}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                        Chưa có nhật ký thao tác.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Raw JSON */}
                {detailTab === 'raw' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 m-0">
                        <Code2 className="h-4 w-4 text-emerald-400" /> Raw Firestore Document
                      </h4>
                      <button
                        onClick={copyRawJson}
                        className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition ${
                          copiedRaw
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <Copy className="h-3 w-3" />
                        {copiedRaw ? 'Đã copy!' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre className="bg-black/60 text-emerald-400 text-[11px] leading-relaxed p-4 rounded-2xl border border-slate-800 overflow-auto max-h-[45vh] font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(s, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
