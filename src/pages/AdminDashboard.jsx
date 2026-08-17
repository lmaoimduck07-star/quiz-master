// Trigger HMR Rebuild
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { LayoutDashboard, Users, FileText, Activity, LogOut, Upload, Search, ChevronLeft, ChevronRight, BookOpen, Sun, Moon, Code2, Settings, Database, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import SubjectManager from '../components/exams/SubjectManager';
import ExamManager from '../components/exams/ExamManager';
import ExamEditor from '../components/exams/ExamEditor';
import UserManager from '../components/users/UserManager';
import AuditLogManager from '../components/audit/AuditLogManager';
import CodingProblemManager from '../components/exams/CodingProblemManager';
import SystemSettingsManager from '../components/settings/SystemSettingsManager';
import LiveMonitor from '../components/admin/LiveMonitor';
import { storage } from '../utils/storage';
import { storageV2 } from '../utils/storageV2';
import { generateExamId, runDatabaseCleanup, normalizeAllExamIds } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, currentUser, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState('live_monitor'); // Mặc định mở Live Monitor hoặc 'subjects'

  // Theme State
  const { theme, toggleTheme } = useTheme();

  const [subjects, setSubjects] = useState([]);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [editingExamId, setEditingExamId] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  // DB Cleanup state
  const [dbCleanupOpen, setDbCleanupOpen] = useState(false);
  const [dbCleanupLoading, setDbCleanupLoading] = useState(false);
  const [dbCleanupResult, setDbCleanupResult] = useState(null);
  // Normalize IDs state
  const [normalizeLoading, setNormalizeLoading] = useState(false);

  useEffect(() => {
    setDataLoading(true);

    // Lắng nghe Realtime môn học V2
    const unsubSubj = storageV2.subscribeSubjectsV2((s) => {
      setSubjects(s || []);
      // Nếu đang mở 1 môn, cần update lại currentSubject để có thông tin mới nhất
      setCurrentSubject(prev => {
        if (!prev || !prev.id) return null;
        return s.find(subj => subj.id === prev.id) || null;
      });
      setDataLoading(false);
    });

    // Lắng nghe Realtime tài khoản
    const unsubUsers = storage.subscribeUsers((u) => {
      setUsers(u || []);
    });

    // Lắng nghe Realtime nhật ký
    const unsubLogs = storage.subscribeAuditLogs((l) => {
      setLogs(l || []);
    });

    // Lắng nghe Realtime kết quả thi (toàn bộ)
    const unsubResults = storage.subscribeExamResults(null, (res) => {
      setExamResults(res || []);
    });

    // Dọn dẹp session rác cũ định kỳ
    storage.cleanStaleSessions();
    const staleTimer = setInterval(() => {
      storage.cleanStaleSessions();
    }, 30000);

    return () => {
      if (typeof unsubSubj === 'function') unsubSubj();
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubLogs === 'function') unsubLogs();
      if (typeof unsubResults === 'function') unsubResults();
      clearInterval(staleTimer);
    };
  }, []);

  // Không có auto-save saveUsers nữa — Atomic CRUD gỏi trực tiếp Firestore khi có thay đổi.

  const addLog = async (category, action, severity, payload = null) => {
    const newLog = {
      user: currentUser?.username || 'admin',
      role: activeRole || 'Admin',
      category,
      action,
      severity,
      ...(payload ? { payload } : {})
    };
    await storage.addAuditLog(newLog);
    const updated = await storage.loadAuditLogs();
    setLogs(updated);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleExportData = async () => {
    const [u, s, l] = await Promise.all([
      storage.loadUsers(),
      storage.loadSubjects(),
      storage.loadAuditLogs(),
    ]);
    const backupData = {
      users: u, subjects: s, logs: l,
      exportedAt: new Date().toLocaleString('vi-VN')
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "quiz_master_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addLog('System', 'Xuất bản sao lưu dữ liệu hệ thống thành công', 'Info');
    alert("✅ Dữ liệu hệ thống đã được xuất! Vui lòng lưu file 'quiz_master_backup.json'.");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      {/* Sidebar */}
      {editingExamId === null && (
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex fixed top-0 bottom-0 left-0 z-30 border-r border-slate-800">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-black flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <LayoutDashboard className="h-4 w-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Admin Panel</span>
            </h2>
          </div>
          <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
            {[
              { tab: 'live_monitor', icon: <Activity className="h-5 w-5" />, label: 'Live Monitor', badge: <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> },
              { tab: 'subjects', icon: <BookOpen className="h-5 w-5" />, label: 'Quản lý môn học' },
              { tab: 'users', icon: <Users className="h-5 w-5" />, label: 'Quản lý tài khoản' },
              { tab: 'audit', icon: <Activity className="h-5 w-5" />, label: 'Audit Log' },
              { tab: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Cấu hình hệ thống' },
            ].map(({ tab, icon, label, badge }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all duration-150 text-sm ${activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
              >
                <span className="flex items-center gap-3">{icon} {label}</span>
                {badge}
              </button>
            ))}

            <div className="h-px bg-slate-800 my-3" />

            <button
              onClick={() => setDbCleanupOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors hover:bg-slate-800 hover:text-amber-400 text-slate-500 text-sm"
              title="Dọn dẹp Ghost Documents và chuẩn hóa ID"
            >
              <Database className="h-5 w-5" /> Dọn dẹp Database
            </button>

            <button
              onClick={async () => {
                if (!confirm('Chuẩn hóa toàn bộ Exam ID không đúng format?\nCác ID lạ sẽ được đổi sang [mã_môn]_bai_[01..99]\nThao tác này không thể hoàn tác!')) return;
                setNormalizeLoading(true);
                try {
                  const result = await normalizeAllExamIds();
                  addLog('System', `Chuẩn hóa Exam ID: sửa ${result?.fixed || 0} ID, xóa ${result?.ghostDeleted || 0} ghost doc (tổng ${result?.total || 0} đề thi)`, 'Info');
                  alert(`✅ Hoàn tất!\n• Đã chuẩn hóa: ${result?.fixed || 0} Exam ID\n• Đã xóa ghost: ${result?.ghostDeleted || 0} doc`);
                } catch (e) {
                  alert('❌ Lỗi: ' + e.message);
                } finally {
                  setNormalizeLoading(false);
                }
              }}
              disabled={normalizeLoading}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors hover:bg-slate-800 hover:text-violet-400 text-slate-500 text-sm disabled:opacity-50"
              title="Chuẩn hóa Exam ID sang format [mã_môn]_bai_[01..99]"
            >
              {normalizeLoading
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Đang chạy...</>
                : <><CheckCircle className="h-5 w-5" /> Chuẩn hóa Exam ID</>
              }
            </button>

            <button
              onClick={handleExportData}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors hover:bg-slate-800 hover:text-white text-slate-500 text-sm"
              title="Tải về bản sao lưu dữ liệu hệ thống"
            >
              <Upload className="h-5 w-5 rotate-180" /> Sao lưu dữ liệu
            </button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-red-400 hover:text-red-300 hover:bg-slate-800 transition-colors text-sm"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" /> Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 ${editingExamId === null ? 'md:pl-64' : ''}`}>
        {editingExamId === null && (
          <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between md:justify-end items-center transition-colors shadow-sm">
            <div className="md:hidden">
              <h2 className="text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-1.5 m-0">
                <LayoutDashboard className="h-5 w-5 text-blue-600" /> Admin Panel
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/client/dashboard')}
                className="font-bold text-xs h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-transparent flex items-center gap-1.5 transition-colors"
                title="Chuyển sang giao diện Học sinh"
              >
                <Users className="h-4 w-4" /> Giao diện Học sinh
              </button>
              <button
                onClick={toggleTheme}
                className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl flex items-center justify-center transition-colors"
                title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-yellow-400" />}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:block">{currentUser?.fullName || 'Admin'}</span>
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {(currentUser?.fullName || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-y-auto ${editingExamId === null ? 'p-6' : 'p-0'}`}>
          {activeTab === 'live_monitor' && (
            <LiveMonitor />
          )}

          {activeTab === 'subjects' && (
            <div className="space-y-6">
              {(() => {
                const handleAddSubject = (newSubj) => {
                  storageV2.saveSubjectV2(newSubj);
                  addLog('System', `Đã tạo môn học mới: "${newSubj.name}"`, 'info');
                };

                const handleDeleteSubject = (subjId) => {
                  storageV2.deleteSubjectV2(subjId);
                  if (currentSubject && currentSubject.id === subjId) {
                    setCurrentSubject(null);
                  }
                  addLog('System', `Đã xóa môn học: ${subjId}`, 'warning');
                };

                const handleUpdateSubject = (updatedSubject) => {
                  storageV2.saveSubjectV2(updatedSubject);
                };

                if (editingExamId !== null && currentSubject) {
                  return (
                    <ExamEditor
                      subject={currentSubject}
                      examId={editingExamId === 'new' ? null : editingExamId}
                      onBack={() => setEditingExamId(null)}
                      onSaveExam={async (examId, config, questions) => {
                        const subjCode = currentSubject.code || (currentSubject.name || 'MON').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 6);
                        
                        let newExamId = examId;
                        let examCode = config.code;

                        if (!examId) {
                          // Dùng generateExamId() — scan số đã dùng, luôn chọn số nhỏ nhất chưa tồn tại
                          newExamId = await generateExamId(currentSubject.id, subjCode);
                          const padded = newExamId.split('_bai_')[1] || '01';
                          examCode = config.code || `${subjCode}_BAI_${padded}`;
                        } else {
                          examCode = config.code || examId.toUpperCase().replace(/_/g, '_');
                        }

                        const newExam = {
                          id: newExamId,
                          subjectId: currentSubject.id,
                          subjectCode: subjCode,
                          code: examCode,
                          title: config.title || 'Đề thi',
                          config: config,
                          created: new Date().toLocaleDateString('vi-VN')
                        };
                        // Save exam
                        await storageV2.saveExamV2(newExam);
                        // Save questions
                        if (questions && questions.length > 0) {
                          await storageV2.saveQuestionsV2(newExamId, questions);
                        }
                        
                        addLog('System', `Đã ${examId ? 'cập nhật' : 'tạo mới'} đề thi "${config.title}" [${examCode}] trong môn "${currentSubject.name}" [${subjCode}]`, 'info');
                        setEditingExamId(null);
                      }}

                    />
                  );
                }

                if (currentSubject) {
                  if (!currentSubject.id) {
                    setCurrentSubject(null);
                    return null;
                  }
                  const isCoding = currentSubject.status === 'developer';
                  if (isCoding) {
                    return (
                      <CodingProblemManager
                        subject={currentSubject}
                        onBack={() => setCurrentSubject(null)}
                      />
                    );
                  }

                  const handlePlayExam = async (examId) => {
                    // Fetch exam first to get config
                    const exams = await storageV2.loadExamsV2(currentSubject.id);
                    const exam = exams.find(e => e.id === examId);
                    if (!exam) return;
                    navigate('/client/exam', {
                      state: {
                        examId: exam.id,
                        title: exam.config?.title || exam.title,
                        timeLimit: exam.config?.time ? exam.config.time * 60 : 15 * 60,
                        mode: 'practice',
                        subjectName: currentSubject.name
                      }
                    });
                  };

                  return (
                    <ExamManager
                      subject={currentSubject}
                      onBack={() => setCurrentSubject(null)}
                      onOpenEditor={(id) => setEditingExamId(id ? id : 'new')}
                      onPlayExam={handlePlayExam}
                    />
                  );
                }

                return (
                  <SubjectManager
                    subjects={subjects}
                    onAddSubject={handleAddSubject}
                    onDeleteSubject={handleDeleteSubject}
                    onUpdateSubject={handleUpdateSubject}
                    onOpenSubject={(subjOrId) => {
                      const target = typeof subjOrId === 'string' ? subjects.find(s => s.id === subjOrId) : subjOrId;
                      setCurrentSubject(target || null);
                    }}
                  />
                );
              })()}
            </div>
          )}



          {activeTab === 'audit' && (
            <div className="space-y-6">
              <AuditLogManager logs={logs} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <SystemSettingsManager onAddLog={addLog} />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <UserManager
                users={users}
                onAddUser={async (u) => {
                  // Atomic CREATE — chỉ thêm đúng 1 document, không ghi đè toàn bộ
                  await storage.createUser(u);
                  const payload = { newUser: { ...u, password: '***' } };
                  addLog('Manager', `Tạo tài khoản mới: ${u.username} (${u.fullName})`, 'Info', payload);
                }}
                onUpdateUser={async (updated) => {
                  // Atomic UPDATE — chỉ cập nhật đúng các trường thay đổi
                  const oldUser = users.find(u => u.id === updated.id);
                  const { id, ...fields } = updated;
                  await storage.updateUser(id, fields);

                  const oldPerm = oldUser?.permissions || {};
                  const newPerm = updated.permissions || {};
                  const permDiffs = [];
                  if (oldPerm.codingAccess !== newPerm.codingAccess) {
                    permDiffs.push(`Coding & Vấn đáp: ${oldPerm.codingAccess ? 'Có' : 'Không'} -> ${newPerm.codingAccess ? 'Có' : 'Không'}`);
                  }
                  const diffText = permDiffs.length > 0 ? ` (Thay đổi quyền: ${permDiffs.join(', ')})` : '';
                  const payload = {
                    oldUser: oldUser ? { ...oldUser, password: '***' } : null,
                    newUser: { ...updated, password: '***' },
                    changes: permDiffs
                  };
                  addLog('Manager', `Cập nhật tài khoản: ${updated.username}${diffText}`, 'Info', payload);
                }}
                onDeleteUser={async (id) => {
                  // Atomic DELETE — chỉ xóa đúng 1 document
                  const targetUser = users.find(u => u.id === id);
                  await storage.deleteUser(id);
                  const payload = { deletedUser: targetUser ? { ...targetUser, password: '***' } : null };
                  addLog('Manager', `Xóa tài khoản: ${targetUser?.username || id}`, 'Critical', payload);
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* ─── DB Cleanup Modal ──────────────────────────────────────────── */}
      {dbCleanupOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Database className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-lg">Dọn dẹp & Tối ưu Database</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Kiểm tra và xử lý dữ liệu rác trong Firestore</p>
              </div>
            </div>

            {dbCleanupResult ? (
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Hoàn thành!</span>
                </div>
                {[
                  { label: 'Session rác đã xóa', value: dbCleanupResult.staleSessions },
                  { label: 'Audit log cũ đã xóa', value: dbCleanupResult.oldAuditLogs },
                  { label: 'Exam ID đã chuẩn hóa', value: dbCleanupResult.normalizedExamIds },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                    <span className="font-black text-slate-800 dark:text-white">{value}</span>
                  </div>
                ))}
                {dbCleanupResult.errors?.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-xs text-red-600 dark:text-red-400 font-mono">
                    {dbCleanupResult.errors.join('\n')}
                  </div>
                )}
                <button
                  onClick={() => { setDbCleanupOpen(false); setDbCleanupResult(null); }}
                  className="w-full mt-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1.5">
                  <p>⚠️ Hành động này sẽ:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2 font-medium">
                    <li>Xóa các phiên thi rác ({'>'} 2 phút không hoạt động)</li>
                    <li>Xóa Audit Log cũ hơn 14 ngày</li>
                    <li>Chuẩn hóa đỏ thị có ID ngẫu nhiên sang format chuẩn</li>
                  </ul>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setDbCleanupOpen(false); setDbCleanupResult(null); }}
                    className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    disabled={dbCleanupLoading}
                  >
                    Hủy
                  </button>
                  <button
                      onClick={async () => {
                        setDbCleanupLoading(true);
                        try {
                          const result = await runDatabaseCleanup();
                          setDbCleanupResult(result);
                          addLog('System', 'Dọn dẹp Database: ' +
                            `${result.staleSessions} session, ${result.oldAuditLogs} log, ${result.normalizedExamIds} exam ID`, 'Info');
                        } catch (e) {
                          setDbCleanupResult({ staleSessions: 0, oldAuditLogs: 0, normalizedExamIds: 0, errors: [e.message] });
                        } finally {
                          setDbCleanupLoading(false);
                        }
                      }}
                    disabled={dbCleanupLoading}
                    className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 font-bold text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {dbCleanupLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang chạy...</> : <><Database className="h-4 w-4" /> Xác nhận Dọn dẹp</>}
                  </button>

                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
