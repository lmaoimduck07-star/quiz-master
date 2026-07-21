// src/pages/coding/CodingViva.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Mic, MicOff, Send, Loader2, Sparkles, ShieldCheck, MessageSquare, Code2 } from 'lucide-react';
import { generateFirstQuestion, generateNextQuestion, evaluateViva, hasGeminiApiKey } from '../../utils/gemini';
import { useAuth } from '../../context/AuthContext';
import { getSession, updateSession } from '../../utils/codingSession';

// ── Hệ thống mã lỗi AI ──────────────────────────────────────────────────────
const AI_ERROR_MSG = {
  A01: 'Lỗi kết nối mạng đến máy chủ AI.',
  A02: 'Hạn mức API đã vượt giới hạn (quota exceeded).',
  A03: 'API key không hợp lệ hoặc thiếu quyền truy cập.',
  A04: 'Máy chủ AI phản hồi quá lâu (timeout).',
  A05: 'Dữ liệu phản hồi từ AI không đúng định dạng.',
};

function classifyGeminiError(err) {
  const msg = err?.message || '';
  if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 'A02';
  if (msg.includes('API key') || msg.includes('403') || msg.includes('401') || msg.includes('UNAUTHENTICATED') || msg.includes('PERMISSION_DENIED')) return 'A03';
  if (msg.includes('timeout') || msg.includes('AbortError') || msg.includes('504')) return 'A04';
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('ERR_NETWORK')) return 'A01';
  if (msg.includes('JSON') || msg.includes('parse')) return 'A05';
  return 'A01'; // default: network
}

const TOTAL_QUESTIONS = 5;

export default function CodingViva() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.uid;
  const session = getSession(userId);

  const problem = session?.problem || {};
  const language = session?.selectedLang || 'python';
  const code = (() => {
    if (session?.files) {
      const main = Object.keys(session.files)[0];
      return session.files[main] || '';
    }
    return session?.code || '';
  })();
  const lastOutput = session?.lastOutput || '';

  const [chatHistory, setChatHistory] = useState(session?.chatHistory || []);
  const [questionIndex, setQuestionIndex] = useState(session?.vivaQuestionIndex || 1);
  const [responseText, setResponseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Redirect nếu không có session
  useEffect(() => {
    if (!session) {
      alert('Hệ thống không thể truy xuất phiên làm việc. Vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: S01)');
      navigate('/coding/dashboard');
    }
  }, []); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Auto-load câu hỏi đầu tiên khi mount (nếu chưa có chat history)
  useEffect(() => {
    if (!session) return;
    if (chatHistory.length > 0) return; // Đã có từ session

    if (!hasGeminiApiKey()) {
      setErrorMsg('Hiện tại server đang có lỗi tương tác với máy chủ, vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: A03)');
      return;
    }

    const startViva = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const q1 = await generateFirstQuestion(problem, code, lastOutput, language);
        const newHistory = [{ role: 'assistant', text: q1 }];
        setChatHistory(newHistory);
        updateSession(userId, { chatHistory: newHistory });
      } catch (err) {
        const code_ = classifyGeminiError(err);
        setErrorMsg(`Hiện tại server đang có lỗi tương tác với máy chủ, vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: ${code_})`);
      } finally {
        setIsLoading(false);
      }
    };

    startViva();
  }, []); // eslint-disable-line

  // ── Gửi câu trả lời ──
  const handleSend = async () => {
    if (!responseText.trim() || isLoading || isEvaluating) return;

    const userMsg = { role: 'user', text: responseText.trim() };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setResponseText('');
    setErrorMsg('');

    const nextIndex = questionIndex + 1;

    if (nextIndex > TOTAL_QUESTIONS) {
      // Đã trả lời đủ 5 câu → Chấm điểm
      updateSession(userId, { chatHistory: newHistory });
      evaluateAndFinish(newHistory);
      return;
    }

    // Tải câu hỏi tiếp theo
    setIsLoading(true);
    try {
      const nextQ = await generateNextQuestion(problem, code, newHistory, nextIndex, language);
      const updatedHistory = [...newHistory, { role: 'assistant', text: nextQ }];
      setChatHistory(updatedHistory);
      setQuestionIndex(nextIndex);
      updateSession(userId, { chatHistory: updatedHistory, vivaQuestionIndex: nextIndex });
    } catch (err) {
      const errCode = classifyGeminiError(err);
      setErrorMsg(`Hiện tại server đang có lỗi tương tác với máy chủ, vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: ${errCode})`);
      updateSession(userId, { chatHistory: newHistory });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Chấm điểm và chuyển Review ──
  const evaluateAndFinish = async (finalHistory) => {
    setIsEvaluating(true);
    try {
      const result = await evaluateViva(problem, code, lastOutput, finalHistory, language);
      updateSession(userId, {
        vivaScore: result.vivaScore ?? result.score ?? 7,
        aiCodeScore: result.aiCodeScore ?? 6.5,
        feedback: result.feedback || '',
        summary: result.summary || '',
        chatHistory: finalHistory,
        stage: 'review',
      });
      navigate('/coding/review');
    } catch (err) {
      const errCode = classifyGeminiError(err);
      setErrorMsg(`Hiện tại server đang có lỗi tương tác với máy chủ, vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: ${errCode})`);
      setIsEvaluating(false);
    }
  };

  // ── Speech Recognition ──
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechError('Trình duyệt không hỗ trợ nhận giọng nói.'); return; }
    const rec = new SR();
    rec.lang = 'vi-VN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      setResponseText(prev => prev + (prev ? ' ' : '') + e.results[0][0].transcript);
      setIsListening(false);
    };
    rec.onerror = () => { setSpeechError('Không thể nhận diện giọng nói.'); setIsListening(false); };
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
    setSpeechError('');
  };

  if (!session) return null;

  const vivaProgress = Math.min(questionIndex - 1, TOTAL_QUESTIONS);
  const isVivaComplete = isEvaluating;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Phòng vấn đáp AI</div>
            <div className="font-extrabold text-white text-sm">{problem.title}</div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tiến độ vấn đáp</div>
            <div className="text-sm font-black text-white">
              {vivaProgress}/{TOTAL_QUESTIONS} câu
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
              <div key={i} className={`h-2 w-6 rounded-full transition-all duration-500 ${
                i < vivaProgress ? 'bg-blue-500' : 'bg-slate-800'
              }`} />
            ))}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl w-full mx-auto">

        {/* Intro card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-sm text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-200">Giám khảo AI</span> sẽ hỏi bạn{' '}
            <span className="text-blue-400 font-bold">{TOTAL_QUESTIONS} câu hỏi</span>{' '}
            về code bạn vừa viết. Hãy trả lời trung thực và giải thích rõ ràng.
            Phần vấn đáp chiếm <span className="text-yellow-400 font-bold">65% điểm tổng</span>.
          </div>
        </div>

        {/* Chat messages */}
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
          >
            {msg.role === 'assistant' && (
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-1">
                <ShieldCheck className="h-4 w-4" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                : 'bg-blue-600 text-white rounded-tr-sm'
            }`}>
              {msg.role === 'assistant' && (
                <div className="text-[10px] font-bold text-blue-400 mb-1 uppercase tracking-wider">
                  Giám khảo AI
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.role === 'user' && (
              <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 mt-1">
                {(currentUser?.fullName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {/* Loading AI */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-300">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Evaluating */}
        {isEvaluating && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3 animate-in fade-in duration-300">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <p className="text-slate-400 font-bold text-sm">Đang chấm điểm vấn đáp...</p>
            <p className="text-slate-600 text-xs">Giám khảo AI đang phân tích toàn bộ cuộc trò chuyện</p>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-4 text-sm text-red-300">
            ⚠️ {errorMsg}
            <button
              onClick={() => setErrorMsg('')}
              className="ml-2 text-red-400 hover:text-red-200 underline text-xs"
            >
              Đóng
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      {!isEvaluating && (
        <div className="border-t border-slate-800 bg-slate-900/80 backdrop-blur-md p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {speechError && (
              <p className="text-xs text-amber-400 font-semibold">{speechError}</p>
            )}
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder={
                    chatHistory.length === 0 ? 'Đang chờ câu hỏi từ Giám khảo AI...' :
                    questionIndex > TOTAL_QUESTIONS ? 'Đang chấm điểm...' :
                    `Câu ${questionIndex}/${TOTAL_QUESTIONS} — Nhập câu trả lời... (Enter để gửi)`
                  }
                  disabled={isLoading || chatHistory.length === 0 || questionIndex > TOTAL_QUESTIONS || isEvaluating}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 transition"
                />
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  onClick={toggleListening}
                  disabled={isLoading || chatHistory.length === 0 || questionIndex > TOTAL_QUESTIONS}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center p-0 border-transparent ${
                    isListening ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title="Nhập bằng giọng nói"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !responseText.trim() || questionIndex > TOTAL_QUESTIONS || isEvaluating}
                  className="h-10 w-10 rounded-xl flex items-center justify-center p-0 bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                  title="Gửi câu trả lời"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 text-center">
              Enter để gửi • Shift+Enter xuống dòng • Nhấn mic để nhập bằng giọng nói
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
