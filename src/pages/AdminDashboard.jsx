import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { LayoutDashboard, Users, FileText, Activity, LogOut, Upload, Search, ChevronLeft, ChevronRight, BookOpen, Sun, Moon } from 'lucide-react';
import SubjectManager from '../components/exams/SubjectManager';
import ExamManager from '../components/exams/ExamManager';
import ExamEditor from '../components/exams/ExamEditor';
import UserManager from '../components/users/UserManager';
import AuditLogManager from '../components/audit/AuditLogManager';
import { storage } from '../utils/storage';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, currentUser, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState('subjects'); // 'exams' | 'users' | 'audit' | 'subjects'

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

  // Load data từ Firestore khi mount
  const [subjects, setSubjects] = useState([]);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [editingExamId, setEditingExamId] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setDataLoading(true);
      const [s, u, l] = await Promise.all([
        storage.loadSubjects(),
        storage.loadUsers(),
        storage.loadAuditLogs(),
      ]);
      setSubjects(s);
      setUsers(u);
      setLogs(l);
      setDataLoading(false);
    }
    loadAll();
  }, []);

  // Auto-save khi subjects thay đổi (bỏ qua khi mới load xong)
  const subjectsRef = React.useRef(false);
  useEffect(() => {
    if (!subjectsRef.current) { subjectsRef.current = true; return; }
    storage.saveSubjects(subjects);
  }, [subjects]);

  const usersRef = React.useRef(false);
  useEffect(() => {
    if (!usersRef.current) { usersRef.current = true; return; }
    storage.saveUsers(users);
  }, [users]);

  const addLog = async (category, action, severity) => {
    const newLog = {
      user: currentUser?.username || 'admin',
      role: activeRole || 'Admin',
      category,
      action,
      severity
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
        <div className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex fixed top-0 bottom-0 left-0 z-30">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" /> Admin Panel
            </h2>
          </div>
          <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
            <button
              onClick={() => setActiveTab('subjects')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${activeTab === 'subjects' ? 'bg-primary text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <BookOpen className="h-5 w-5" /> Quản lý môn học
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${activeTab === 'users' ? 'bg-primary text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <Users className="h-5 w-5" /> Quản lý tài khoản
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${activeTab === 'audit' ? 'bg-primary text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <Activity className="h-5 w-5" /> Audit Log
            </button>

            <div className="h-px bg-slate-800 my-4" />

            <button
              onClick={handleExportData}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors hover:bg-slate-800 hover:text-white text-slate-400 text-sm"
              title="Tải về bản sao lưu dữ liệu hệ thống"
            >
              <Upload className="h-5 w-5 rotate-180 text-slate-500" /> Sao lưu dữ liệu
            </button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800 bg-transparent" onClick={handleLogout}>
              <LogOut className="mr-3 h-5 w-5" /> Đăng xuất
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 ${editingExamId === null ? 'md:pl-64' : ''}`}>
        {editingExamId === null && (
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between md:justify-end items-center transition-colors">
            <div className="md:hidden">
              <h2 className="text-lg font-black text-primary dark:text-blue-500 flex items-center gap-1.5 m-0">
                <LayoutDashboard className="h-5 w-5" /> Admin Panel
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl border-transparent bg-transparent"
                title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-yellow-400" />}
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{currentUser?.fullName || 'Admin'}</span>
                <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-white font-bold">
                  {(currentUser?.fullName || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-y-auto ${editingExamId === null ? 'p-6' : 'p-0'}`}>
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              {(() => {
                const handleUpdateSubject = (updatedSubject) => {
                  setSubjects(subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s));
                  if (currentSubject && currentSubject.id === updatedSubject.id) {
                    setCurrentSubject(updatedSubject);
                  }
                };

                if (editingExamId !== null && currentSubject) {
                  return (
                    <ExamEditor
                      subject={currentSubject}
                      examId={editingExamId === 'new' ? null : editingExamId}
                      onBack={() => setEditingExamId(null)}
                      onSaveExam={(examId, config, questions) => {
                        const newExam = {
                          id: examId || 'ex_' + Date.now(),
                          config,
                          questions,
                          created: new Date().toLocaleDateString('vi-VN')
                        };
                        const newExams = examId
                          ? currentSubject.exams.map(e => e.id === examId ? newExam : e)
                          : [...(currentSubject.exams || []), newExam];

                        handleUpdateSubject({ ...currentSubject, exams: newExams });
                        setEditingExamId(null);
                        addLog('Manager', `${examId ? 'Cập nhật' : 'Tạo mới'} đề thi: ${config.title || 'Chưa đặt tên'} (Môn: ${currentSubject.name})`, 'Info');
                        alert('✅ Lưu đề thi thành công!');
                      }}
                    />
                  );
                }

                if (currentSubject) {
                  const handlePlayExam = (examId) => {
                    const exam = currentSubject.exams.find(e => e.id === examId);
                    navigate('/client/exam', {
                      state: {
                        examId: exam.id,
                        title: exam.config?.title || exam.title,
                        questions: exam.questions,
                        timeLimit: ((exam.questions?.length || 10) * 1.5) * 60,
                        mode: 'practice',
                        subjectName: currentSubject.name
                      }
                    });
                  };

                  return (
                    <ExamManager
                      subject={currentSubject}
                      onBack={() => setCurrentSubject(null)}
                      onUpdateSubject={handleUpdateSubject}
                      onOpenEditor={(id) => setEditingExamId(id ? id : 'new')}
                      onPlayExam={handlePlayExam}
                    />
                  );
                }

                return (
                  <SubjectManager
                    subjects={subjects}
                    onAddSubject={(s) => {
                      setSubjects([...subjects, s]);
                      addLog('Manager', `Thêm môn học mới: ${s.name}`, 'Info');
                    }}
                    onDeleteSubject={(id) => {
                      const subj = subjects.find(s => s.id === id);
                      if (confirm("Bạn có chắc chắn muốn xóa môn học này cùng toàn bộ đề thi bên trong?")) {
                        setSubjects(subjects.filter(s => s.id !== id));
                        addLog('Manager', `Xóa môn học: ${subj?.name || id}`, 'Critical');
                      }
                    }}
                    onOpenSubject={(id) => setCurrentSubject(subjects.find(s => s.id === id))}
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

          {activeTab === 'users' && (
            <div className="space-y-6">
              <UserManager
                users={users}
                onAddUser={(u) => {
                  setUsers([...users, u]);
                  addLog('Manager', `Tạo tài khoản mới: ${u.username} (${u.fullName})`, 'Info');
                }}
                onUpdateUser={(updated) => {
                  setUsers(users.map(u => u.id === updated.id ? updated : u));
                  addLog('Manager', `Cập nhật tài khoản: ${updated.username}`, 'Info');
                }}
                onDeleteUser={(id) => {
                  const targetUser = users.find(u => u.id === id);
                  setUsers(users.filter(u => u.id !== id));
                  addLog('Manager', `Xóa tài khoản: ${targetUser?.username || id}`, 'Critical');
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
