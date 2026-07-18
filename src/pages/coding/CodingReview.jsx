// src/pages/coding/CodingReview.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Trophy, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, MessageSquare, Terminal, ChevronRight, XCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSession, clearSession } from '../../utils/codingSession';

export default function CodingReview() {
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

  const problem = session?.problem || { title: 'Bài thi' };
  const code = session?.code || '';
  const testResults = session?.testResults || { passedCount: 0, totalCount: 1, results: [] };
  const vivaScore = session?.vivaScore || 0;
  const feedback = session?.feedback || '';
  const summary = session?.summary || '';
  const chatHistory = session?.chatHistory || [];

  const reviewFiles = session?.files || (code ? { 'Solution': code } : { 'Không có code': '' });
  const [activeReviewFile, setActiveReviewFile] = useState(Object.keys(reviewFiles)[0]);

  const codeScore = parseFloat(((testResults.passedCount / testResults.totalCount) * 10).toFixed(1));
  const finalScore = parseFloat(((codeScore * 0.6) + (vivaScore * 0.4)).toFixed(1));

  const handleFinish = () => {
    // Xóa session khi hoàn tất
    if (currentUser?.uid) {
      clearSession(currentUser.uid);
    }
    navigate('/coding/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-y-auto p-6 md:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-900 mb-8 shrink-0">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kết quả thi tự luận</span>
          <h1 className="text-2xl font-black text-white">{problem.title}</h1>
        </div>
        <Button
          onClick={handleFinish}
          className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md h-10 px-5 flex items-center gap-1 border-transparent"
        >
          Hoàn tất thi <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      {/* Main content grid */}
      <main className="max-w-4xl mx-auto w-full space-y-6">
        
        {/* Scores Overview Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Final overall score */}
          <Card className="border-slate-800 bg-gradient-to-br from-blue-950/40 to-slate-900 rounded-3xl overflow-hidden shadow-lg">
            <CardContent className="p-6 text-center space-y-2">
              <Trophy className="h-10 w-10 text-yellow-400 mx-auto animate-pulse" />
              <div className="text-3xl font-black text-white">{finalScore}/10</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Điểm tổng kết</div>
              <div className="text-[9px] text-slate-500 font-semibold">(60% Điểm Code + 40% Điểm Vấn đáp)</div>
            </CardContent>
          </Card>

          {/* Card 2: Code compile score */}
          <Card className="border-slate-800 bg-slate-900 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <div className="text-3xl font-black text-white">{codeScore}/10</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Điểm chấm Code</div>
              <div className="text-[10px] text-emerald-500 font-bold">
                {testResults.isAiEvaluated 
                  ? `Đạt ${testResults.passedCount}/${testResults.totalCount} Yêu cầu AI`
                  : `Đạt ${testResults.passedCount}/${testResults.totalCount} Testcases`}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: AI Viva score */}
          <Card className="border-slate-800 bg-slate-900 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6 text-center space-y-2">
              <ShieldCheck className="h-10 w-10 text-blue-400 mx-auto" />
              <div className="text-3xl font-black text-white">{vivaScore}/10</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Điểm Vấn đáp AI</div>
              <div className="text-[10px] text-blue-500 font-bold">
                Giám khảo AI đánh giá
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Performance Evaluation and summary */}
        <Card className="border-slate-800 bg-slate-900 rounded-3xl overflow-hidden shadow-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <h3 className="font-bold text-slate-200">Đánh giá chung của Hội đồng AI</h3>
            </div>
            <p className="text-xs text-blue-400 font-bold leading-relaxed">
              "{summary}"
            </p>
            <div className="h-px bg-slate-800" />
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Báo cáo nhận xét chi tiết</span>
              <p className="text-xs text-slate-350 leading-relaxed whitespace-pre-line">
                {feedback}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mã nguồn bài làm */}
        <Card className="border-slate-800 bg-slate-900 rounded-3xl overflow-hidden shadow-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-slate-200">Mã nguồn bài làm</h3>
            </div>
            
            {/* File selection tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
              {Object.keys(reviewFiles).map((fileName) => {
                const isActive = fileName === activeReviewFile;
                return (
                  <button
                    key={fileName}
                    onClick={() => setActiveReviewFile(fileName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition select-none ${
                      isActive
                        ? 'bg-slate-800 text-blue-400 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    {fileName}
                  </button>
                );
              })}
            </div>
            
            {/* Code view panel */}
            <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl overflow-x-auto max-h-[400px]">
              <pre className="font-mono text-xs text-slate-350 leading-relaxed whitespace-pre text-left">
                <code>{reviewFiles[activeReviewFile]}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Testcases Review Details */}
        <Card className="border-slate-800 bg-slate-900 rounded-3xl overflow-hidden shadow-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Terminal className="h-5 w-5 text-emerald-400" />
              <h3 className="font-bold text-slate-200">
                {testResults.isAiEvaluated ? 'Kết quả Thẩm định AI' : 'Chi tiết chạy Test Cases'}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testResults.results.map((r) => (
                <div key={r.id} className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 ${
                  r.passed 
                    ? 'border-emerald-500/10 bg-emerald-950/10' 
                    : 'border-red-500/10 bg-red-950/10'
                }`}>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-200">
                      {testResults.isAiEvaluated ? `Tiêu chí ${r.id}` : `Test Case ${r.id}`}
                    </span>
                    {r.passed ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Thành công</span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Thất bại</span>
                    )}
                  </div>
                  <div className="space-y-1 font-mono text-[10px] text-slate-400">
                    {testResults.isAiEvaluated ? (
                      <>
                        <div>Yêu cầu: <span className="text-slate-300 font-sans block pt-0.5">{r.input}</span></div>
                        <div className="pt-1">Chi tiết: <span className={r.passed ? "text-emerald-400 font-sans block pt-0.5" : "text-red-400 font-sans block pt-0.5"}>{r.actual}</span></div>
                      </>
                    ) : (
                      <>
                        <div>Input: <span className="text-slate-300">{r.input}</span></div>
                        <div>Đầu ra: <span className="text-slate-300">{r.actual}</span></div>
                        <div>Kỳ vọng: <span className="text-slate-300">{r.expected}</span></div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Viva Chat dialogue History */}
        <Card className="border-slate-800 bg-slate-900 rounded-3xl overflow-hidden shadow-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-slate-200">Biên bản cuộc vấn đáp 5 câu</h3>
            </div>
            
            <div className="space-y-4">
              {chatHistory.slice(0, 10).map((msg, index) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isAssistant ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {isAssistant ? 'Giám khảo AI' : 'Sinh viên'}
                      </span>
                    </div>
                    <p className={`text-xs p-3 rounded-xl ${
                      isAssistant 
                        ? 'bg-slate-950 text-slate-200' 
                        : 'bg-blue-600/10 border border-blue-500/20 text-slate-300'
                    }`}>
                      {msg.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
