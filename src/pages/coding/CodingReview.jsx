// src/pages/coding/CodingReview.jsx
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import {
  Trophy, ArrowRight, ShieldCheck, MessageSquare,
  Terminal, Code2, Star, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSession, clearSession } from '../../utils/codingSession';
import Editor from '@monaco-editor/react';
import { useState } from 'react';

// ── Tính điểm ──────────────────────────────────────────────────────────────
function calcScores(session) {
  const vivaScore = typeof session?.vivaScore === 'number' ? session.vivaScore : null;
  const aiCodeScore = typeof session?.aiCodeScore === 'number' ? session.aiCodeScore : null;

  if (vivaScore === null) return { vivaScore: null, aiCodeScore, finalScore: null };

  const code = aiCodeScore ?? 6.5;
  const finalScore = parseFloat((code * 0.35 + vivaScore * 0.65).toFixed(1));
  return { vivaScore, aiCodeScore: code, finalScore };
}

function ScoreRing({ score, label, color, max = 10 }) {
  const pct = score !== null ? Math.round((score / max) * 100) : 0;
  const grade =
    score === null ? '—' :
    score >= 8.5 ? 'Xuất sắc' :
    score >= 7.0 ? 'Tốt' :
    score >= 5.0 ? 'Khá' :
    'Cần cải thiện';

  return (
    <div className="flex flex-col items-center gap-2 p-5">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="34" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-white">
            {score !== null ? score.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-bold text-slate-400">{label}</div>
        <div className="text-[10px] font-bold mt-0.5" style={{ color }}>{grade}</div>
      </div>
    </div>
  );
}

export default function CodingReview() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.uid;
  const session = getSession(userId);

  const problem = session?.problem || { title: 'Bài thi lập trình' };
  const language = session?.selectedLang || 'python';
  const chatHistory = session?.chatHistory || [];
  const feedback = session?.feedback || '';
  const summary = session?.summary || '';
  const lastOutput = session?.lastOutput || '';

  const code = (() => {
    if (session?.files) {
      const main = Object.keys(session.files)[0];
      return session.files[main] || '';
    }
    return session?.code || '';
  })();

  const { vivaScore, aiCodeScore, finalScore } = calcScores(session);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'code' | 'output'

  const handleFinish = () => {
    clearSession(userId);
    navigate('/coding/dashboard');
  };

  const monacoLang = language === 'cpp' ? 'cpp' : language === 'c' ? 'c' : language === 'java' ? 'java' : 'python';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 px-8 flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kết quả thi lập trình</div>
          <h1 className="text-xl font-black text-white">{problem.title}</h1>
        </div>
        <Button
          onClick={handleFinish}
          className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md h-10 px-5 flex items-center gap-1.5 border-transparent"
        >
          Hoàn tất thi <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      <main className="max-w-4xl mx-auto w-full p-6 md:p-8 space-y-6 pb-16">

        {/* Viva chưa hoàn thành */}
        {vivaScore === null && (
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300 text-sm">Vấn đáp chưa hoàn thành</div>
              <div className="text-xs text-amber-400/80 mt-0.5">Điểm tổng không thể tính vì chưa hoàn thành phần vấn đáp AI.</div>
            </div>
          </div>
        )}

        {/* Score overview */}
        <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-blue-950/20 rounded-3xl overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-2 mb-6">
              <Trophy className="h-8 w-8 text-yellow-400" />
              <h2 className="text-2xl font-black text-white">
                {finalScore !== null ? `${finalScore}/10` : 'Chưa có điểm'}
              </h2>
              <p className="text-slate-400 text-sm">Điểm tổng kết</p>
            </div>

            <div className="flex justify-center gap-4 flex-wrap">
              <ScoreRing score={aiCodeScore} label="Điểm Code (35%)" color="#3b82f6" />
              <div className="flex flex-col items-center justify-center gap-1 px-4">
                <div className="text-2xl font-black text-slate-600">×</div>
              </div>
              <ScoreRing score={vivaScore} label="Vấn đáp (65%)" color="#a78bfa" />
            </div>

            {/* Score formula */}
            {finalScore !== null && (
              <div className="mt-4 text-center text-xs text-slate-500 font-mono bg-slate-950/50 rounded-xl p-2">
                {aiCodeScore?.toFixed(1)} × 0.35 + {vivaScore?.toFixed(1)} × 0.65 ={' '}
                <span className="text-white font-black">{finalScore}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Summary */}
        {(summary || feedback) && (
          <Card className="border-slate-800 bg-slate-900/60 rounded-3xl overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-yellow-400" />
                <h3 className="font-black text-white">Nhận xét từ Giám khảo AI</h3>
              </div>
              {summary && (
                <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-4">
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Tóm tắt</div>
                  <p className="text-slate-200 text-sm leading-relaxed">{summary}</p>
                </div>
              )}
              {feedback && (
                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nhận xét chi tiết</div>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs: Chat | Code | Output */}
        <div>
          <div className="flex gap-2 mb-4">
            {[
              { key: 'chat', label: 'Lịch sử vấn đáp', icon: MessageSquare },
              { key: 'code', label: 'Code đã nộp', icon: Code2 },
              { key: 'output', label: 'Output terminal', icon: Terminal },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Tab: Chat */}
          {activeTab === 'chat' && (
            <Card className="border-slate-800 bg-slate-900/60 rounded-3xl overflow-hidden">
              <CardContent className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">Không có lịch sử vấn đáp.</p>
                ) : (
                  chatHistory.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'assistant'
                          ? 'bg-slate-800 text-slate-200 rounded-tl-sm'
                          : 'bg-blue-600/30 text-blue-100 rounded-tr-sm border border-blue-700/30'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="text-[9px] font-bold text-blue-400 mb-1 uppercase tracking-wider">Giám khảo</div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab: Code */}
          {activeTab === 'code' && (
            <div className="border border-slate-800 rounded-3xl overflow-hidden h-80">
              <Editor
                height="100%"
                language={monacoLang}
                theme="vs-dark"
                value={code}
                options={{
                  readOnly: true,
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollbar: { vertical: 'auto' },
                  padding: { top: 12 },
                  fontFamily: "'Fira Code', monospace",
                }}
              />
            </div>
          )}

          {/* Tab: Output */}
          {activeTab === 'output' && (
            <Card className="border-slate-800 bg-slate-900/60 rounded-3xl overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center gap-2 text-xs text-slate-400 font-bold">
                  <Terminal className="h-3.5 w-3.5 text-blue-400" /> Output khi nộp bài
                </div>
                <div className="p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto bg-black/40 whitespace-pre-wrap leading-5">
                  {lastOutput || '(Không có output)'}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Finish button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleFinish}
            className="font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg h-12 px-10 flex items-center gap-2 border-transparent"
          >
            <Trophy className="h-4 w-4" /> Hoàn tất & Về trang chủ
          </Button>
        </div>
      </main>
    </div>
  );
}
