// src/pages/coding/CodingWorkspace.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import Editor from '@monaco-editor/react';
import {
  Play, Send, Loader2, ArrowLeft, Terminal,
  CheckCircle2, XCircle, Plus, Eye, X, Wifi, WifiOff
} from 'lucide-react';
import { getSession, updateSession } from '../../utils/codingSession';
import { executeCode, pingPiston, ERROR_CODES } from '../../utils/pistonApi';

// ─── Màn hình loading ────────────────────────────────────────────────────────
function LoadingScreen({ step, steps, ping }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in duration-300 p-8 space-y-6 text-center">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
          <div
            className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
            style={{ animationDuration: '0.8s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Terminal className="h-6 w-6 text-blue-400" />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-extrabold text-lg text-slate-200">Khởi tạo môi trường</h3>
          <p className="text-xs text-blue-300 font-mono min-h-[20px] transition-all duration-300">
            {steps[step]}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-blue-500 w-6' : 'bg-slate-700 w-1.5'
              }`}
            />
          ))}
        </div>

        {/* Ping status */}
        <div className={`flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
          ping === null ? 'text-slate-500' : ping ? 'text-emerald-400' : 'text-amber-400'
        }`}>
          {ping === null ? <Loader2 className="h-3 w-3 animate-spin" /> :
           ping ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {ping === null ? 'Đang kết nối...' : ping ? 'Máy chủ sẵn sàng' : 'Máy chủ phản hồi chậm'}
        </div>
      </div>
    </div>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────────────────
export default function CodingWorkspace() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.uid;
  const session = getSession(userId);

  // Redirect nếu không có session
  useEffect(() => {
    if (!session) {
      alert('Hệ thống không thể truy xuất phiên làm việc. Vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: S01)');
      navigate('/coding/dashboard');
    }
  }, []); // eslint-disable-line

  const problem = session?.problem || {};
  const selectedLang = session?.selectedLang || 'python';

  // ── State ──
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStep, setInitStep] = useState(0);
  const [pingStatus, setPingStatus] = useState(null); // null | true | false

  const [files, setFiles] = useState(() => {
    if (session?.files) return session.files;
    const name = getMainFileName(selectedLang);
    return { [name]: session?.code || problem.templates?.[selectedLang] || getDefaultTemplate(selectedLang) };
  });
  const [activeFile, setActiveFile] = useState(() => Object.keys(
    session?.files || { [getMainFileName(selectedLang)]: '' }
  )[0]);

  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([
    '[System] Workspace sẵn sàng. Bắt đầu viết code và nhấn "Chạy thử" để xem output.',
  ]);

  const INIT_STEPS = [
    'Đang kết nối đến máy chủ thực thi...',
    'Đang nạp đề bài...',
    'Sẵn sàng! Đang mở workspace...',
  ];

  // ── Loading init ──
  useEffect(() => {
    if (!session) return;
    let step = 0;
    setInitStep(0);

    // Step 0: Ping Piston
    pingPiston().then(ok => {
      setPingStatus(ok);
      step = 1;
      setInitStep(1);

      setTimeout(() => {
        step = 2;
        setInitStep(2);
        setTimeout(() => setIsInitializing(false), 600);
      }, 600);
    });
  }, []); // eslint-disable-line

  // ── Helpers ──
  function getMainFileName(lang) {
    return lang === 'java' ? 'Solution.java' :
           lang === 'cpp'  ? 'Solution.cpp'  :
           lang === 'c'    ? 'solution.c'    : 'solution.py';
  }

  function getDefaultTemplate(lang) {
    if (lang === 'python') return '# Viết code Python ở đây\n\n';
    if (lang === 'java') return 'public class Solution {\n    public static void main(String[] args) {\n        // Viết code Java ở đây\n    }\n}\n';
    if (lang === 'cpp') return '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code C++ ở đây\n    return 0;\n}\n';
    if (lang === 'c') return '#include <stdio.h>\n\nint main() {\n    // Viết code C ở đây\n    return 0;\n}\n';
    return '';
  }

  function getFileExt(lang) {
    return lang === 'java' ? '.java' : lang === 'cpp' ? '.cpp' : lang === 'c' ? '.c' : '.py';
  }

  const isMainFile = (name) =>
    name === 'Solution.java' || name === 'Solution.cpp' ||
    name === 'solution.c' || name === 'solution.py';

  // ── Editor ──
  const handleEditorChange = (value) => {
    const updated = { ...files, [activeFile]: value || '' };
    setFiles(updated);
    const mainKey = Object.keys(updated)[0];
    updateSession(userId, { code: updated[mainKey], files: updated });
  };

  // ── File management ──
  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const ext = getFileExt(selectedLang);
    let fullName = newFileName.trim();
    if (!fullName.endsWith(ext)) fullName += ext;
    if (files[fullName]) { alert('File này đã tồn tại!'); return; }

    const updated = { ...files, [fullName]: `# File phụ trợ\n` };
    setFiles(updated);
    setActiveFile(fullName);
    setShowNewFileModal(false);
    setNewFileName('');
    updateSession(userId, { files: updated });
  };

  const handleDeleteFile = (name) => {
    if (!window.confirm(`Xóa file ${name}?`)) return;
    const updated = { ...files };
    delete updated[name];
    setFiles(updated);
    if (activeFile === name) setActiveFile(Object.keys(updated)[0]);
    const mainKey = Object.keys(updated)[0];
    updateSession(userId, { code: updated[mainKey] || '', files: updated });
  };

  // ── Run code ──
  const runCode = async () => {
    const mainFile = Object.keys(files)[0];
    const mainCode = files[mainFile] || '';

    if (mainCode.trim().length < 5) {
      setConsoleLogs(prev => [...prev,
        `─────────────────────────────────`,
        `[Lỗi] Code quá ngắn hoặc rỗng. Hãy viết code trước khi chạy. (Mã lỗi: ${ERROR_CODES.C01})`,
      ]);
      return;
    }

    setIsRunning(true);
    const langLabel = selectedLang === 'cpp' ? 'C++' : selectedLang.toUpperCase();
    setConsoleLogs(prev => [...prev,
      `─────────────────────────────────`,
      `[System] Đang gửi code ${langLabel} đến máy chủ thực thi...`,
    ]);

    try {
      const result = await executeCode(selectedLang, files);
      setConsoleLogs(prev => [...prev, ...result.logs]);
    } catch (err) {
      const code = err.code || 'C05';
      setConsoleLogs(prev => [...prev,
        `─────────────────────────────────`,
        `[Lỗi ${code}] ${err.message}`,
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Submit code ──
  const submitCode = async () => {
    const mainFile = Object.keys(files)[0];
    const mainCode = files[mainFile] || '';

    if (mainCode.trim().length < 5) {
      alert(`Code quá ngắn hoặc rỗng. Hãy viết code trước khi nộp bài. (Mã lỗi: ${ERROR_CODES.C01})`);
      return;
    }

    setIsSubmitting(true);
    setConsoleLogs(prev => [...prev,
      `─────────────────────────────────`,
      `[System] Đang chạy code lần cuối trước khi nộp bài...`,
    ]);

    // Lưu code hiện tại
    updateSession(userId, { code: mainCode, files });

    try {
      const result = await executeCode(selectedLang, files);
      const lastOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');

      setConsoleLogs(prev => [...prev, ...result.logs, '[System] Đã lưu output. Đang chuyển sang phần vấn đáp...']);

      // Lưu lastOutput và chuyển stage
      updateSession(userId, {
        code: mainCode,
        files,
        lastOutput,
        stage: 'viva',
      });

      navigate('/coding/viva');
    } catch (err) {
      const code = err.code || 'C05';
      setConsoleLogs(prev => [...prev,
        `─────────────────────────────────`,
        `[Lỗi ${code}] ${err.message}`,
      ]);
      // Vẫn cho phép nộp bài dù có lỗi chạy (lưu output rỗng)
      if (window.confirm('Code gặp lỗi khi chạy. Bạn vẫn muốn nộp bài và chuyển sang vấn đáp không?')) {
        updateSession(userId, { code: mainCode, files, lastOutput: `[Lỗi khi chạy] ${err.message}`, stage: 'viva' });
        navigate('/coding/viva');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render loading ──
  if (!session) return null;
  if (isInitializing) {
    return <LoadingScreen step={initStep} steps={INIT_STEPS} ping={pingStatus} />;
  }

  const monacoLang = selectedLang === 'cpp' ? 'cpp' : selectedLang === 'c' ? 'c' : selectedLang === 'java' ? 'java' : 'python';

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">

      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => navigate('/coding/dashboard')}
            className="text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl h-9 w-9 p-0 border-transparent bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">Thi lập trình tự luận</span>
            <span className="font-extrabold text-white text-sm">{problem.title}</span>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-lg px-3 py-1.5">
            {selectedLang === 'cpp' ? 'C++' : selectedLang === 'c' ? 'C' : selectedLang === 'java' ? 'Java' : 'Python 3'}
          </div>
          <Button
            onClick={runCode}
            disabled={isRunning || isSubmitting}
            className="font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 rounded-xl px-4 py-2 flex items-center gap-1.5 border"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-slate-200" />}
            Chạy thử
          </Button>
          <Button
            onClick={submitCode}
            disabled={isRunning || isSubmitting}
            className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2 flex items-center gap-1.5 shadow-md border-transparent"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Nộp bài & Vấn đáp
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Đề bài */}
        <div className="w-5/12 bg-slate-900/40 border-r border-slate-800 overflow-y-auto p-6 space-y-5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">{problem.category}</span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
              problem.difficulty === 'Dễ' ? 'bg-emerald-500/15 text-emerald-400' :
              problem.difficulty === 'Trung bình' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
            }`}>{problem.difficulty}</span>
          </div>
          <h1 className="text-xl font-black text-white">{problem.title}</h1>
          <div className="h-px bg-slate-800" />
          <div
            className="text-slate-300 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: problem.description }}
          />
          {problem.imageUrl && (
            <div className="relative group border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 p-2">
              <img
                src={problem.imageUrl}
                alt="Hình ảnh đề bài"
                className="max-h-56 rounded-xl object-contain cursor-zoom-in mx-auto"
                onClick={() => setShowImageLightbox(true)}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => setShowImageLightbox(true)} className="p-1.5 bg-slate-900/80 rounded-lg text-white">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-500 mt-1.5">Click vào hình để phóng to 🔍</p>
            </div>
          )}
        </div>

        {/* Right: Editor + Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

          {/* File tabs */}
          <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 py-1.5 shrink-0 select-none">
            <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-none pr-2">
              {Object.keys(files).map(name => {
                const isActive = name === activeFile;
                return (
                  <div
                    key={name}
                    onClick={() => setActiveFile(name)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition select-none ${
                      isActive
                        ? 'bg-slate-800 text-blue-400 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <span>{name}</span>
                    {!isMainFile(name) && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteFile(name); }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setShowNewFileModal(true)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition"
                title="Tạo file mới"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider hidden sm:inline shrink-0">Workspace</span>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0 border-b border-slate-800">
            <Editor
              height="100%"
              language={monacoLang}
              theme="vs-dark"
              value={files[activeFile] || ''}
              onChange={handleEditorChange}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollbar: { vertical: 'auto', horizontal: 'auto' },
                automaticLayout: true,
                padding: { top: 12 },
                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              }}
            />
          </div>

          {/* Terminal */}
          <div className="h-64 bg-slate-950 flex flex-col overflow-hidden shrink-0">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-bold shrink-0 select-none">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Terminal className="h-4 w-4 text-blue-400" /> Terminal Output
              </span>
              <button
                onClick={() => setConsoleLogs(['[System] Console đã được xóa.'])}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition"
              >
                Xóa console
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5 bg-black/40">
              {consoleLogs.map((log, i) => (
                <div key={i} className={`whitespace-pre-wrap leading-5 ${
                  log.startsWith('[System]') ? 'text-blue-400 font-bold' :
                  log.startsWith('[Lỗi') ? 'text-red-400 font-bold' :
                  log.startsWith('[Runtime Error]') ? 'text-red-400' :
                  log.startsWith('[stderr]') ? 'text-amber-400' :
                  log.startsWith('─') ? 'text-slate-700' :
                  'text-slate-300'
                }`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {showImageLightbox && problem.imageUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-5xl w-full flex flex-col items-center">
            <button
              onClick={() => setShowImageLightbox(false)}
              className="absolute -top-10 right-0 bg-slate-800 hover:bg-slate-700 text-white rounded-xl p-2"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={problem.imageUrl}
              alt="Đề bài phóng to"
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-200"
            />
          </div>
        </div>
      )}

      {/* Modal tạo file mới */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h4 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">Tạo tập tin mới</h4>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Tên file</label>
              <input
                type="text"
                placeholder="vd: Helper"
                value={newFileName}
                onChange={e => setNewFileName(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleCreateFile()}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[9px] text-slate-500 block">Sẽ tự thêm đuôi {getFileExt(selectedLang)}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => { setShowNewFileModal(false); setNewFileName(''); }}
                className="rounded-xl font-bold text-xs text-slate-400 hover:bg-slate-800 bg-transparent border-transparent"
              >Hủy</Button>
              <Button
                onClick={handleCreateFile}
                className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 border-transparent"
              >Tạo file</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
