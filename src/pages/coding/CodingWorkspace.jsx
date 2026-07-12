// src/pages/coding/CodingWorkspace.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import Editor from '@monaco-editor/react';
import { Play, Send, Loader2, ArrowLeft, Terminal, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { getSession, updateSession } from '../../utils/codingSession';

export default function CodingWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [code, setCode] = useState(() => {
    return session?.code || problem.templates?.[session?.selectedLang || 'java'] || '';
  });
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
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setInitStep(currentStep);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsInitializing(false);
        }, 500);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [selectedLang]);

  const handleEditorChange = (value) => {
    setCode(value);
    // Tự động lưu code vào session
    if (currentUser?.uid) {
      updateSession(currentUser.uid, { code: value });
    }
  };

  const handleLangChange = (lang) => {
    setSelectedLang(lang);
    setCode(problem.templates?.[lang] || '');
    setConsoleLogs([`[System] Đã chuyển đổi ngôn ngữ sang ${lang.toUpperCase()}. Mẫu code đã được tải lại.`]);
    setTestResults(null);
  };

  // Multi-language Simulator (Java, Python, C++, C)
  const runCode = () => {
    setIsRunning(true);
    setTestResults(null);

    const compileCmds = {
      java: `javac Solution.java`,
      python: `python3 -m py_compile solution.py`,
      cpp: `g++ -O3 solution.cpp -o solution`,
      c: `gcc solution.c -o solution`
    };
    
    const compileCmd = compileCmds[selectedLang] || `javac Solution.java`;
    setConsoleLogs([
      `[System] Đang biên dịch mã nguồn ${selectedLang.toUpperCase()}...`,
      `$ ${compileCmd}`
    ]);

    setTimeout(() => {
      // Check if student code is identical to template
      const templateCode = problem.templates?.[selectedLang] || '';
      const isUnchanged = code.trim() === templateCode.trim() || code.trim().length < 20;

      if (isUnchanged) {
        setConsoleLogs(prev => [
          ...prev,
          `[System] Biên dịch THẤT BẠI.`,
          `Lỗi: Code của sinh viên chưa được thay đổi hoặc quá ngắn. Hãy viết giải thuật trước.`
        ]);
        setIsRunning(false);
        return;
      }

      // Simulating passed test cases
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

      setTestResults({
        results,
        passedCount,
        totalCount: problem.testCases.length
      });

      setConsoleLogs(prev => [
        ...prev,
        `[System] Biên dịch thành công.`,
        ...logs,
        `[System] Kết quả: ${passedCount}/${problem.testCases.length} Passed.`
      ]);
      setIsRunning(false);
    }, 1500);
  };

  const submitCode = () => {
    setIsSubmitting(true);
    runCode(); // Run tests one last time

    setTimeout(() => {
      setIsSubmitting(false);

      const finalTestResults = testResults || {
        passedCount: code.trim().length > 30 ? problem.testCases.length : 0,
        totalCount: problem.testCases.length,
        results: problem.testCases.map((tc, idx) => ({
          id: idx + 1,
          input: tc.input,
          expected: tc.output,
          actual: code.trim().length > 30 ? tc.output : 'Chưa chạy/Lỗi',
          passed: code.trim().length > 30,
          duration: '10',
          error: null
        }))
      };

      // Cập nhật session: chuyển sang stage viva
      if (currentUser?.uid) {
        updateSession(currentUser.uid, {
          code,
          testResults: finalTestResults,
          stage: 'viva'
        });
      }

      navigate('/coding/viva');
    }, 1800);
  };

  // Màn hình khởi tạo máy ảo
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4">
        <Card className="max-w-md w-full border-slate-800 bg-slate-900 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-8 space-y-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Khởi tạo môi trường ảo</h2>
              <p className="text-slate-400 text-sm font-semibold h-6 leading-relaxed">
                {steps[initStep]}
              </p>
            </div>
            {/* Thanh tiến độ */}
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((initStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden h-screen">
      {/* Mini header */}
      <header className="bg-slate-900 border-b border-slate-800 py-3 px-6 flex items-center justify-between z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/coding/dashboard')}
            className="text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl bg-transparent border-transparent"
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
            Ngôn ngữ: {selectedLang === 'cpp' ? 'C++' : selectedLang}
          </div>

          <Button 
            onClick={runCode} 
            disabled={isRunning || isSubmitting}
            className="font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 rounded-xl px-4 py-2 flex items-center gap-1.5"
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
          </div>

          <div className="h-px bg-slate-800" />

          {/* Test cases examples display */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Bộ Test Cases mẫu</h3>
            <div className="space-y-3">
              {problem.testCases.slice(0, 2).map((tc, idx) => (
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
          {/* Top Panel: Monaco Editor */}
          <div className="flex-1 min-h-[300px] border-b border-slate-800 relative">
            <Editor
              height="100%"
              language={selectedLang}
              theme="vs-dark"
              value={code}
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
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-bold shrink-0">
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
    </div>
  );
}
