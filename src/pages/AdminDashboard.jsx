// Trigger HMR Rebuild
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { LayoutDashboard, Users, FileText, Activity, LogOut, Upload, Search, ChevronLeft, ChevronRight, BookOpen, Sun, Moon, Code2, Settings } from 'lucide-react';
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

    // Lắng nghe Realtime kết quả thi → Tự nhảy số khi học sinh nộp bài (không cần F5)
    const unsubResults = storage.subscribeExamResults(null, (r) => {
      setExamResults(r || []);
    });

    return () => {
      if (typeof unsubSubj === 'function') unsubSubj();
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubLogs === 'function') unsubLogs();
      if (typeof unsubResults === 'function') unsubResults();
    };
  }, []);

  // Đã xóa auto-save bulk subjects vì V2 lưu từng subject độc lập.

  // Auto-save khi users thay đổi (Chỉ lưu sau khi đã tải xong dữ liệu từ Firebase)
  const usersLoadedRef = React.useRef(false);
  useEffect(() => {
    if (dataLoading) return;
    if (!usersLoadedRef.current) {
      usersLoadedRef.current = true;
      return;
    }
    storage.saveUsers(users);
  }, [users, dataLoading]);

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
                        const newExamId = examId || 'ex_' + Date.now();
                        const newExam = {
                          id: newExamId,
                          subjectId: currentSubject.id,
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
                        
                        addLog('System', `Đã ${examId ? 'cập nhật' : 'tạo mới'} đề thi "${config.title}" trong môn "${currentSubject.name}"`, 'info');
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
                    onOpenSubject={(subj) => setCurrentSubject(subj)}
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
                onAddUser={(u) => {
                  setUsers([...users, u]);
                  const payload = { newUser: { ...u, password: '***' } };
                  addLog('Manager', `Tạo tài khoản mới: ${u.username} (${u.fullName})`, 'Info', payload);
                }}
                onUpdateUser={(updated) => {
                  const oldUser = users.find(u => u.id === updated.id);
                  setUsers(users.map(u => u.id === updated.id ? updated : u));

                  // So sánh sự khác biệt của permissions nếu có
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
                onDeleteUser={(id) => {
                  const targetUser = users.find(u => u.id === id);
                  setUsers(users.filter(u => u.id !== id));
                  const payload = { deletedUser: targetUser ? { ...targetUser, password: '***' } : null };
                  addLog('Manager', `Xóa tài khoản: ${targetUser?.username || id}`, 'Critical', payload);
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
