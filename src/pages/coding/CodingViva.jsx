// src/pages/coding/CodingViva.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Mic, MicOff, Send, Loader2, Sparkles, AlertCircle, ShieldCheck, MessageSquare, Code2, AlertTriangle, Key } from 'lucide-react';
import { generateFirstQuestion, generateNextQuestion, evaluateViva, hasGeminiApiKey, saveGeminiApiKey } from '../../utils/gemini';
import { useAuth } from '../../context/AuthContext';
import { getSession, updateSession } from '../../utils/codingSession';

export default function CodingViva() {
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
  const code = session?.code || '';
  const testResults = session?.testResults || { passedCount: 0, totalCount: 0, results: [] };
  const language = session?.selectedLang || 'java';

  const [chatHistory, setChatHistory] = useState(session?.chatHistory || []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(session?.vivaQuestionIndex || 1);
  const [responseText, setResponseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [inputKey, setInputKey] = useState('');
  
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Load first question on mount (chỉ khi chưa có chat history từ session)
  useEffect(() => {
    if (chatHistory.length > 0) return; // Đã có lịch sử từ session
    
    if (!hasGeminiApiKey()) {
      setApiKeyError('Giám khảo AI cần Gemini API Key để khởi động cuộc thi vấn đáp.');
      return;
    }

    const startViva = async () => {
      setIsLoading(true);
      try {
        const q1 = await generateFirstQuestion(problem, code, testResults, language);
        const newHistory = [{ role: 'assistant', text: q1 }];
        setChatHistory(newHistory);
        // Lưu vào session
        if (currentUser?.uid) {
          updateSession(currentUser.uid, { chatHistory: newHistory });
        }
      } catch (err) {
        setChatHistory([
          { role: 'assistant', text: `Chào bạn, đã xảy ra lỗi khi kết nối với Giám khảo AI: ${err.message}. Vui lòng kiểm tra lại API Key.` }
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    startViva();
  }, []);

  const handleSaveKey = () => {
    if (inputKey.trim()) {
      saveGeminiApiKey(inputKey.trim());
      setApiKeyError('');
      setInputKey('');
      
      // Khởi động lại vấn đáp sau khi nhập key
      setIsLoading(true);
      generateFirstQuestion(problem, code, testResults, language)
        .then(q1 => {
          setChatHistory([{ role: 'assistant', text: q1 }]);
        })
        .catch(err => {
          setChatHistory([{ role: 'assistant', text: `Chào bạn, lỗi API: ${err.message}` }]);
        })
        .finally(() => setIsLoading(false));
    }
  };

  // Web Speech API Microphone controls
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Trình duyệt của bạn không hỗ trợ Nhận diện giọng nói. Hãy dùng Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError('');
      };

      recognition.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        setResponseText(prev => prev ? prev + ' ' + resultText : resultText);
      };

      recognition.onerror = (e) => {
        console.error(e);
        setSpeechError('Không nhận dạng được âm thanh, hãy thử lại.');
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error(e);
      setSpeechError('Không mở được micro.');
    }
  };

  const handleSendAnswer = async (e) => {
    e.preventDefault();
    if (!responseText.trim() || isLoading) return;

    const studentAnswer = responseText.trim();
    const nextHistory = [
      ...chatHistory,
      { role: 'user', text: studentAnswer }
    ];
    setChatHistory(nextHistory);
    setResponseText('');
    setIsLoading(true);

    try {
      if (currentQuestionIndex < 5) {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        const nextQ = await generateNextQuestion(problem, code, nextHistory, nextIndex, language);
        const updatedHistory = [...nextHistory, { role: 'assistant', text: nextQ }];
        setChatHistory(updatedHistory);
        // Lưu tiến trình vào session
        if (currentUser?.uid) {
          updateSession(currentUser.uid, {
            chatHistory: updatedHistory,
            vivaQuestionIndex: nextIndex
          });
        }
      } else {
        // Đã trả lời xong 5 câu hỏi -> Gọi đánh giá
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', text: 'Cảm ơn câu trả lời cuối của bạn. Giám khảo AI đang tiến hành đánh giá tổng hợp bài thi...' }
        ]);
        
        const evaluation = await evaluateViva(problem, code, testResults, nextHistory, language);
        
        // Cập nhật session: chuyển sang stage review
        if (currentUser?.uid) {
          updateSession(currentUser.uid, {
            chatHistory: nextHistory,
            vivaScore: evaluation.score,
            feedback: evaluation.feedback,
            summary: evaluation.summary,
            stage: 'review'
          });
        }
        
        // Chuyển tiếp tới Review page
        setTimeout(() => {
          navigate('/coding/review');
        }, 2000);
      }
    } catch (err) {
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: `Có lỗi khi trao đổi với AI: ${err.message}. Nhấn nộp bài để xem kết quả sơ bộ.` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden h-screen">
      {/* Mini header */}
      <header className="bg-slate-900 border-b border-slate-800 py-3.5 px-6 flex items-center justify-between z-20 shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
          <div>
            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest block">Trạng thái: Đang vấn đáp vấn đáp</span>
            <span className="font-extrabold text-white text-sm">Phòng thi Vấn đáp AI 1:1</span>
          </div>
        </div>

        {/* Question Counter index */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((num) => (
            <div 
              key={num} 
              className={`h-7 w-7 rounded-lg font-black text-xs flex items-center justify-center border transition-all ${
                num === currentQuestionIndex 
                  ? 'bg-blue-600 border-blue-500 text-white scale-110 shadow-md' 
                  : num < currentQuestionIndex 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {num}
            </div>
          ))}
        </div>
      </header>

      {/* Main split screen */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane: Read-only student code for reference */}
        <div className="w-1/2 bg-slate-900/30 border-r border-slate-800 flex flex-col overflow-hidden h-full">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center gap-2 shrink-0">
            <Code2 className="h-4.5 w-4.5 text-blue-400" />
            <span className="text-xs font-bold text-slate-300">Bài làm code của bạn (Dành cho việc đối chiếu giải trình)</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm bg-slate-950/80">
            <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl mb-4">
              <div className="text-xs font-bold text-slate-400 font-sans uppercase mb-1.5">Đề bài: {problem.title}</div>
              <div className="text-xs text-slate-300 font-sans leading-relaxed" dangerouslySetInnerHTML={{ __html: problem.description }} />
            </div>
            
            <pre className="text-xs text-blue-300 bg-slate-900/60 p-4 rounded-xl border border-slate-850 overflow-x-auto">
              {code}
            </pre>
          </div>
        </div>

        {/* Right pane: Chatbot examiner */}
        <div className="w-1/2 flex flex-col overflow-hidden h-full bg-slate-950 relative">
          
          {/* Key Input error warning */}
          {apiKeyError && (
            <div className="absolute inset-0 bg-slate-950/90 z-30 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
              <Card className="max-w-md w-full border-slate-850 bg-slate-900 shadow-2xl rounded-3xl">
                <CardContent className="p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-yellow-500/10 text-yellow-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Key className="h-8 w-8 text-yellow-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">Yêu cầu Gemini API Key</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Để thực hiện thi vấn đáp tự động bằng tiếng Việt với AI, vui lòng nhập mã khóa Gemini API Key.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <input 
                      type="password" 
                      placeholder="AIzaSy..."
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 text-center"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => navigate('/coding/dashboard')} variant="ghost" className="w-1/2 font-bold text-xs rounded-xl bg-transparent border-slate-850 text-slate-400 hover:bg-slate-800">
                        Quay lại
                      </Button>
                      <Button onClick={handleSaveKey} className="w-1/2 font-bold text-xs rounded-xl bg-blue-600 hover:bg-blue-700">
                        Bắt đầu vấn đáp
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {chatHistory.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div key={index} className={`flex items-start gap-3 ${isAssistant ? '' : 'justify-end'}`}>
                  {isAssistant && (
                    <div className="h-9 w-9 bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                      AI
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                    isAssistant 
                      ? 'bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-none font-semibold' 
                      : 'bg-blue-600 text-white rounded-tr-none font-medium shadow-md shadow-blue-900/10'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0 animate-pulse font-bold text-xs">
                  AI
                </div>
                <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl rounded-tl-none text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Giám khảo AI đang phân tích và soạn câu hỏi...
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Chat input panel with Speech-to-Text */}
          <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
            <form onSubmit={handleSendAnswer} className="flex gap-2.5 items-center">
              {/* Microphone icon button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-xl border transition-all ${
                  isListening 
                    ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse scale-105' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
                title={isListening ? "Bấm để tắt ghi âm" : "Bấm để nói bằng Microphone"}
              >
                {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              <input
                type="text"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder={isListening ? "Đang lắng nghe... Nói để điền câu trả lời" : `Nhập câu trả lời vấn đáp ${currentQuestionIndex}/5...`}
                disabled={isLoading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />

              <Button
                type="submit"
                disabled={!responseText.trim() || isLoading}
                className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 h-11 shrink-0"
              >
                Gửi
              </Button>
            </form>
            
            {speechError && (
              <div className="mt-2 text-[10px] text-red-400 font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {speechError}
              </div>
            )}
            {isListening && (
              <div className="mt-2 text-[10px] text-emerald-400 font-bold flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Micro đang bật, hãy nói để trả lời.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
