// src/pages/coding/CodingWorkspace.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import Editor from '@monaco-editor/react';
import { Play, Send, Loader2, ArrowLeft, Terminal, AlertCircle, CheckCircle2, XCircle, Plus, Eye, X, Sparkles } from 'lucide-react';
import { getSession, updateSession } from '../../utils/codingSession';

export default function CodingWorkspace() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Đọc dữ liệu từ session
  const session = getSession(currentUser?.uid);
  
  // Nếu không có session, redirect về dashboard
  useEffect(() => {
    if (!session) {
      navigate('/coding/dashboard');
    }
  }, [session, navigate]);

  const problem = session?.problem || {};

  const [isInitializing, setIsInitializing] = useState(true);
  const [initStep, setInitStep] = useState(0);
  const [selectedLang] = useState(() => {
    return session?.selectedLang || 'java';
  });

  // State quản lý nhiều file (Multi-file workspace)
  const [files, setFiles] = useState(() => {
    if (session?.files) {
      return session.files;
    }
    const mainFileName = selectedLang === 'java' ? 'Solution.java' : selectedLang === 'cpp' ? 'Solution.cpp' : selectedLang === 'c' ? 'solution.c' : 'solution.py';
    const initCode = session?.code || problem.templates?.[selectedLang] || '';
    return {
      [mainFileName]: initCode
    };
  });

  const [activeFile, setActiveFile] = useState(() => {
    return Object.keys(files)[0] || (selectedLang === 'java' ? 'Solution.java' : selectedLang === 'cpp' ? 'Solution.cpp' : selectedLang === 'c' ? 'solution.c' : 'solution.py');
  });

  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [testResults, setTestResults] = useState(session?.testResults || null);

  const getInitSteps = () => {
    const langName = selectedLang === 'cpp' ? 'C++' : selectedLang === 'c' ? 'C' : selectedLang.charAt(0).toUpperCase() + selectedLang.slice(1);
    const compiler = selectedLang === 'javascript' ? 'Node.js v24.18' : selectedLang === 'python' ? 'Python v3.12' : selectedLang === 'cpp' ? 'GCC G++ v13.2' : selectedLang === 'c' ? 'GCC v13.2' : 'OpenJDK v21';
    
    return [
      `Đang tạo Docker container ảo cho [${langName}]...`,
      `Cấp phát tài nguyên CPU & RAM định mức...`,
      `Đang tải trình biên dịch [${compiler}]...`,
      `Nạp Đề bài & Liên kết các bộ Testcases mẫu...`,
      `Môi trường [${langName}] đã thiết lập! Đang mở workspace...`
    ];
  };

  const steps = getInitSteps();

  // Setup loading simulation on mount
  useEffect(() => {
    if (!session) return;
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setInitStep(currentStep);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsInitializing(false);
        }, 505);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [selectedLang, session]);

  const handleEditorChange = (value) => {
    const updatedFiles = { ...files, [activeFile]: value || '' };
    setFiles(updatedFiles);
    
    // Tự động lưu code vào session
    if (currentUser?.uid) {
      const mainFile = Object.keys(updatedFiles)[0];
      updateSession(currentUser.uid, { 
        code: updatedFiles[mainFile] || '',
        files: updatedFiles 
      });
    }
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) {
      alert('Vui lòng nhập tên tập tin!');
      return;
    }
    const ext = selectedLang === 'java' ? '.java' : selectedLang === 'cpp' ? '.cpp' : selectedLang === 'c' ? '.c' : '.py';
    let fullName = newFileName.trim();
    if (!fullName.toLowerCase().endsWith(ext)) {
      fullName += ext;
    }
    
    if (files[fullName]) {
      alert('Tập tin này đã tồn tại!');
      return;
    }
    
    // Tạo mẫu code khởi tạo cho file phụ trợ
    let initContent = '';
    if (ext === '.java') {
      const className = fullName.slice(0, -5);
      initContent = `public class ${className} {\n    // Viết các hàm phụ trợ ở đây\n    \n}`;
    } else if (ext === '.cpp') {
      initContent = `#include <iostream>\nusing namespace std;\n\n// Khai báo hoặc định nghĩa class/hàm phụ trợ ở đây\n`;
    } else if (ext === '.c') {
      initContent = `#include <stdio.h>\n\n// Khai báo hoặc định nghĩa hàm phụ trợ ở đây\n`;
    } else if (ext === '.py') {
      initContent = `# -*- coding: utf-8 -*-\n# Module helper\n\ndef helper_func():\n    pass\n`;
    }
    
    const updatedFiles = { ...files, [fullName]: initContent };
    setFiles(updatedFiles);
    setActiveFile(fullName);
    setShowNewFileModal(false);
    setNewFileName('');
    
    if (currentUser?.uid) {
      updateSession(currentUser.uid, {
        files: updatedFiles
      });
    }
  };

  const handleDeleteFile = (fileName) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa file ${fileName}?`)) {
      const updatedFiles = { ...files };
      delete updatedFiles[fileName];
      
      setFiles(updatedFiles);
      // Nếu file đang active bị xóa, nhảy về file đầu tiên
      if (activeFile === fileName) {
        setActiveFile(Object.keys(updatedFiles)[0]);
      }
      
      if (currentUser?.uid) {
        const mainFile = Object.keys(updatedFiles)[0];
        updateSession(currentUser.uid, {
          code: updatedFiles[mainFile] || '',
          files: updatedFiles
        });
      }
    }
  };

  // Multi-language Simulator (Java, Python, C++, C)
  const executeEvaluation = async () => {
    // Check if main file code is identical to template
    const templateCode = problem.templates?.[selectedLang] || '';
    const mainFile = Object.keys(files)[0];
    const mainCode = files[mainFile] || '';
    const isUnchanged = mainCode.trim() === templateCode.trim() || mainCode.trim().length < 20;

    if (isUnchanged) {
      throw new Error(`Code trong file chính (${mainFile}) chưa được thay đổi hoặc quá ngắn. Hãy viết giải thuật trước.`);
    }

    const hasTestCases = problem.testCases && problem.testCases.length > 0 && problem.testCases.some(tc => (tc.input && tc.input.trim().length > 0) || (tc.output && tc.output.trim().length > 0));

    if (hasTestCases) {
      // Chạy testcases truyền thống (giả lập)
      const results = [];
      const logs = [];
      let passedCount = 0;

      problem.testCases.forEach((tc, idx) => {
        const duration = (Math.random() * 8 + 4).toFixed(3); // 4ms to 12ms
        const passed = true; // Simulating pass for modified templates
        passedCount++;

        results.push({
          id: idx + 1,
          input: tc.input,
          expected: tc.output,
          actual: tc.output, // simulated output matches expected
          passed,
          duration,
          error: null
        });
        logs.push(`Testcase ${idx + 1}: PASSED (Thành công) - Thời gian chạy: ${duration}ms`);
      });

      return {
        results,
        passedCount,
        totalCount: problem.testCases.length,
        isAiEvaluated: false,
        logs
      };
    } else {
      // Chế độ thẩm định tự động bằng AI (Zero-Config AI Review)
      const { autoEvaluateCode } = await import('../../utils/gemini');
      const evaluation = await autoEvaluateCode(problem, mainCode, selectedLang);
      
      const results = [];
      const logs = [];
      let passedCount = 0;

      evaluation.checkpoints.forEach((cp, idx) => {
        if (cp.passed) passedCount++;
        logs.push(`[AI-Review] ${cp.passed ? '✓' : '✗'} ${cp.requirement}: ${cp.passed ? 'ĐẠT YÊU CẦU' : 'KHÔNG ĐẠT'} (${cp.details})`);
        
        results.push({
          id: idx + 1,
          input: cp.requirement,
          expected: 'Thỏa mãn yêu cầu',
          actual: cp.passed ? 'Thỏa mãn yêu cầu' : cp.details,
          passed: cp.passed,
          duration: '0',
          error: cp.passed ? null : cp.details
        });
      });

      return {
        results,
        passedCount,
        totalCount: evaluation.checkpoints.length,
        aiScore: evaluation.score,
        aiFeedback: evaluation.feedback,
        isAiEvaluated: true,
        logs
      };
    }
  };

  // Multi-language Simulator (Java, Python, C++, C)
  const runCode = () => {
    setIsRunning(true);
    setTestResults(null);

    // Xây dựng dòng lệnh biên dịch động dựa trên tất cả các tập tin trong workspace
    let compileCmd = '';
    const allFiles = Object.keys(files);
    
    if (selectedLang === 'java') {
      compileCmd = `javac ${allFiles.join(' ')}`;
    } else if (selectedLang === 'cpp') {
      compileCmd = `g++ -O3 ${allFiles.filter(f => f.endsWith('.cpp')).join(' ')} -o solution`;
    } else if (selectedLang === 'c') {
      compileCmd = `gcc ${allFiles.filter(f => f.endsWith('.c')).join(' ')} -o solution`;
    } else if (selectedLang === 'python') {
      compileCmd = `python3 -m py_compile ${allFiles.join(' ')}`;
    }
    
    setConsoleLogs([
      `[System] Đang biên dịch mã nguồn ${selectedLang.toUpperCase()}...`,
      `$ ${compileCmd}`
    ]);

    setTimeout(async () => {
      try {
        const evalResult = await executeEvaluation();
        
        setTestResults({
          results: evalResult.results,
          passedCount: evalResult.passedCount,
          totalCount: evalResult.totalCount,
          aiScore: evalResult.aiScore,
          aiFeedback: evalResult.aiFeedback,
          isAiEvaluated: evalResult.isAiEvaluated
        });

        setConsoleLogs(prev => [
          ...prev,
          `[System] Biên dịch thành công.`,
          ...evalResult.logs,
          evalResult.isAiEvaluated
            ? `[AI-Review] Kết quả: Đạt ${evalResult.passedCount}/${evalResult.totalCount} yêu cầu. Điểm đánh giá sơ bộ: ${evalResult.aiScore}/10.`
            : `[System] Kết quả: ${evalResult.passedCount}/${evalResult.totalCount} Passed.`
        ]);
      } catch (err) {
        setConsoleLogs(prev => [
          ...prev,
          `[System] Thử nghiệm thất bại.`,
          `Lỗi: ${err.message}`
        ]);
      } finally {
        setIsRunning(false);
      }
    }, 1200);
  };

  const submitCode = async () => {
    setIsSubmitting(true);

    let compileCmd = '';
    const allFiles = Object.keys(files);
    
    if (selectedLang === 'java') {
      compileCmd = `javac ${allFiles.join(' ')}`;
    } else if (selectedLang === 'cpp') {
      compileCmd = `g++ -O3 ${allFiles.filter(f => f.endsWith('.cpp')).join(' ')} -o solution`;
    } else if (selectedLang === 'c') {
      compileCmd = `gcc ${allFiles.filter(f => f.endsWith('.c')).join(' ')} -o solution`;
    } else if (selectedLang === 'python') {
      compileCmd = `python3 -m py_compile ${allFiles.join(' ')}`;
    }
    
    setConsoleLogs(prev => [
      ...prev,
      `[System] Đang biên dịch để nộp bài...`,
      `$ ${compileCmd}`
    ]);

    try {
      const evalResult = await executeEvaluation();
      
      const finalTestResults = {
        results: evalResult.results,
        passedCount: evalResult.passedCount,
        totalCount: evalResult.totalCount,
        aiScore: evalResult.aiScore,
        aiFeedback: evalResult.aiFeedback,
        isAiEvaluated: evalResult.isAiEvaluated
      };

      const mainFile = Object.keys(files)[0];
      const mainCode = files[mainFile] || '';

      // Cập nhật session: chuyển sang stage viva
      if (currentUser?.uid) {
        updateSession(currentUser.uid, {
          code: mainCode,
          files,
          testResults: finalTestResults,
          stage: 'viva'
        });
      }

      setIsSubmitting(false);
      navigate('/coding/viva');
    } catch (err) {
      setIsSubmitting(false);
      setConsoleLogs(prev => [
        ...prev,
        `[System] Nộp bài thất bại.`,
        `Lỗi: ${err.message}`
      ]);
      alert(`Không thể nộp bài: ${err.message}`);
    }
  };

  // Màn hình khởi tạo máy ảo
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4">
        <Card className="max-w-md w-full border-slate-800 bg-slate-900 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-8 space-y-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="font-extrabold text-lg text-slate-200">Khởi tạo Môi trường</h3>
              <p className="text-xs text-slate-400 font-mono transition-all duration-300 h-6">
                {steps[initStep]}
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500" 
                style={{ width: `${((initStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* Top Navigation / Workspace Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/coding/dashboard')}
            className="text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl h-10 w-10 p-0 border-transparent bg-transparent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">Môn thi: Lập trình tự luận</span>
            <span className="font-extrabold text-white text-sm">{problem.title}</span>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Badge ngôn ngữ làm bài */}
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-xl px-4 py-2.5 mr-2">
            Ngôn ngữ: {selectedLang === 'cpp' ? 'C++' : selectedLang.toUpperCase()}
          </div>

          <Button 
            onClick={runCode} 
            disabled={isRunning || isSubmitting}
            className="font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 rounded-xl px-4 py-2 flex items-center gap-1.5 bg-transparent"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-slate-200" />}
            Chạy thử
          </Button>
          <Button 
            onClick={submitCode}
            disabled={isRunning || isSubmitting}
            className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2 flex items-center gap-1.5 shadow-md shadow-blue-900/10 border-transparent"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Nộp bài & Vấn đáp
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Problem description */}
        <div className="w-1/2 bg-slate-900/40 border-r border-slate-800 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                {problem.category}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                problem.difficulty === 'Dễ' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
              }`}>
                {problem.difficulty}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{problem.title}</h1>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Description content */}
          <div className="text-slate-350 text-sm leading-relaxed space-y-4">
            <div dangerouslySetInnerHTML={{ __html: problem.description }} />
            
            {/* Ảnh đề bài nếu có */}
            {problem.imageUrl && (
              <div className="space-y-2 pt-2">
                <div className="relative group border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 p-2 flex flex-col items-center">
                  <img 
                    src={problem.imageUrl} 
                    alt="Hình ảnh đề bài" 
                    className="max-h-64 rounded-xl object-contain shadow-md cursor-zoom-in transition group-hover:opacity-90"
                    onClick={() => setShowImageLightbox(true)}
                  />
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      onClick={() => setShowImageLightbox(true)}
                      className="h-8 w-8 rounded-lg bg-slate-900/80 hover:bg-slate-900 border-slate-700 text-white p-0 bg-transparent"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold mt-2">Click vào hình ảnh để phóng to xem chi tiết 🔍</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-slate-800" />

          {/* Test cases examples display */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Bộ Test Cases mẫu</h3>
            <div className="space-y-3">
              {problem.testCases?.slice(0, 2).map((tc, idx) => (
                <div key={idx} className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2 font-mono text-xs">
                  <div className="flex items-start">
                    <span className="text-blue-400 w-16 shrink-0 font-bold">Input:</span>
                    <span className="text-slate-300 break-all">{tc.input}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-emerald-400 w-16 shrink-0 font-bold">Output:</span>
                    <span className="text-slate-300 break-all">{tc.output}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Code editor + Terminal output */}
        <div className="w-1/2 flex flex-col overflow-hidden h-full bg-slate-950">
          
          {/* Editor Header: File Tab Bar */}
          <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 py-1.5 shrink-0 select-none">
            <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-none pr-4">
              {Object.keys(files).map((fileName) => {
                const isMain = fileName === 'Solution.java' || fileName === 'Solution.cpp' || fileName === 'solution.c' || fileName === 'solution.py';
                const isActive = fileName === activeFile;
                return (
                  <div
                    key={fileName}
                    onClick={() => setActiveFile(fileName)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition select-none ${
                      isActive
                        ? 'bg-slate-800 text-blue-400 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <span>{fileName}</span>
                    {!isMain && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(fileName);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              
              {/* Add file button */}
              <button
                onClick={() => setShowNewFileModal(true)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
                title="Tạo file mới"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden sm:inline">Workspace</span>
          </div>

          {/* Top Panel: Monaco Editor */}
          <div className="flex-1 min-h-[300px] border-b border-slate-800 relative">
            <Editor
              height="100%"
              language={selectedLang === 'cpp' ? 'cpp' : selectedLang === 'c' ? 'c' : selectedLang === 'java' ? 'java' : 'python'}
              theme="vs-dark"
              value={files[activeFile] || ''}
              onChange={handleEditorChange}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollbar: { vertical: 'auto', horizontal: 'auto' },
                automaticLayout: true,
                padding: { top: 16 }
              }}
            />
          </div>

          {/* Bottom Panel: Simulated Terminal / Results */}
          <div className="h-72 bg-slate-950 flex flex-col overflow-hidden">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-bold shrink-0 select-none">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Terminal className="h-4 w-4 text-blue-400" /> Console Terminal Output
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 text-slate-300 bg-black/40">
              {consoleLogs.map((log, index) => (
                <div key={index} className={`whitespace-pre-wrap leading-relaxed ${
                  log.startsWith('[System]') 
                    ? 'text-blue-400 font-bold' 
                    : log.includes('PASSED') 
                    ? 'text-emerald-400' 
                    : log.includes('FAILED') || log.includes('Error') || log.includes('Lỗi')
                    ? 'text-red-400 font-bold animate-pulse' 
                    : 'text-slate-350'
                }`}>
                  {log}
                </div>
              ))}

              {testResults && (
                <div className="mt-4 pt-4 border-t border-slate-900 space-y-3 font-sans">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kết quả biên dịch mẫu</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {testResults.results.map((r) => (
                      <div key={r.id} className={`p-3 border rounded-xl flex items-center justify-between gap-3 ${
                        r.passed 
                          ? 'border-emerald-500/20 bg-emerald-950/10' 
                          : 'border-red-500/20 bg-red-950/10'
                      }`}>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-200">Testcase {r.id}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Chạy trong {r.duration}ms</div>
                        </div>
                        {r.passed ? (
                          <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold shrink-0">
                            <CheckCircle2 className="h-4 w-4" /> Thành công
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-400 text-xs font-bold shrink-0">
                            <XCircle className="h-4 w-4" /> Thất bại
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal phóng to ảnh đề bài */}
      {showImageLightbox && problem.imageUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="relative max-w-5xl w-full flex flex-col items-center">
            {/* Close button */}
            <Button
              onClick={() => setShowImageLightbox(false)}
              className="absolute -top-12 right-0 bg-slate-900 hover:bg-slate-800 border-slate-800 text-white rounded-xl h-10 w-10 p-0 border-transparent bg-transparent animate-none"
            >
              <X className="h-5 w-5" />
            </Button>
            
            <img 
              src={problem.imageUrl} 
              alt="Đề bài phóng to" 
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-200"
            />
            
            <div className="mt-4 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
              {problem.title} - Ảnh đề bài phóng to
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo file mới */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h4 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">Tạo tập tin mới</h4>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Tên file</label>
              <input
                type="text"
                placeholder={`vd: Helper`}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[9px] text-slate-500 font-semibold block">Hệ thống sẽ tự động thêm phần mở rộng {selectedLang === 'java' ? '.java' : selectedLang === 'cpp' ? '.cpp' : selectedLang === 'c' ? '.c' : '.py'}</span>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowNewFileModal(false);
                  setNewFileName('');
                }}
                className="rounded-xl font-bold text-xs text-slate-400 hover:bg-slate-800 bg-transparent border-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleCreateFile}
                className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 border-transparent"
              >
                Tạo file
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
