import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

export default function PracticeReview() {
  const navigate = useNavigate();
  const location = useLocation();

  // Fallback data if page is loaded directly without state
  const reviewData = location.state || null;

  if (!reviewData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Không tìm thấy dữ liệu xem lại bài làm</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md">Vui lòng hoàn thành bài làm thực tế từ trang chính để xem lại kết quả.</p>
        <Button onClick={() => navigate('/client/dashboard')} className="font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 shadow-md">
          Quay về Trang chính
        </Button>
      </div>
    );
  }

  const { title, score, correctCount, totalCount, questions } = reviewData;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/client/dashboard')}
              className="rounded-xl h-10 w-10 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 bg-transparent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Xem lại kết quả</span>
              <h1 className="text-base font-extrabold text-slate-800 dark:text-white line-clamp-1">{title}</h1>
            </div>
          </div>
          <div className="text-right flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="text-center">
              <div className="text-xl font-black text-primary dark:text-blue-400">{score}/10</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Điểm số</div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{correctCount}/{totalCount}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Số câu đúng</div>
            </div>
          </div>
        </div>
      </header>
 
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {(questions || []).map((q, idx) => {
          const isCorrect = q.isCorrect !== undefined ? q.isCorrect : (q.userAnswer === q.correctAnswer);
          const qType = q.type || 'single';
 
          return (
            <Card key={q.id || idx} className={`border-0 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border-l-4 ${isCorrect ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="mt-1 shrink-0">
                    {isCorrect ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-1">
                      <span>Câu {idx + 1}:</span>
                      <span dangerouslySetInnerHTML={{ __html: q.text || '' }} />
                    </h3>
                    
                    <div className="mt-4 space-y-3">
                      {(() => {
                        if (qType === 'single' || qType === 'multiselect') {
                          return (q.options || []).map((opt, oIdx) => {
                            let bgColor = 'bg-slate-50 dark:bg-slate-900/50';
                            let borderColor = 'border-slate-100 dark:border-slate-800';
                            let textClass = 'text-slate-600 dark:text-slate-400';
                            
                            const isUserSelected = qType === 'multiselect'
                              ? (q.userAnswer || []).includes(oIdx)
                              : q.userAnswer === oIdx;
                              
                            const isCorrectAns = qType === 'multiselect'
                              ? (q.correctAnswer || []).includes(oIdx)
                              : q.correctAnswer === oIdx;
 
                            if (isCorrectAns) {
                              bgColor = 'bg-emerald-50 dark:bg-emerald-950/20';
                              borderColor = 'border-emerald-200 dark:border-emerald-900/40';
                              textClass = 'text-emerald-800 dark:text-emerald-300 font-semibold';
                            } else if (isUserSelected && !isCorrectAns) {
                              bgColor = 'bg-red-50 dark:bg-red-950/20';
                              borderColor = 'border-red-200 dark:border-red-900/40';
                              textClass = 'text-red-800 dark:text-red-300 font-semibold';
                            }
 
                            return (
                              <div key={oIdx} className={`p-4 rounded-2xl border-2 ${bgColor} ${borderColor} flex items-center gap-3 ${textClass}`}>
                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${isUserSelected || isCorrectAns ? 'border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {(isUserSelected || isCorrectAns) && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                                <span className="text-sm" dangerouslySetInnerHTML={{ __html: opt || '' }} />
                                {isCorrectAns && (
                                  <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold uppercase">
                                    Đáp án đúng
                                  </span>
                                )}
                                {isUserSelected && !isCorrectAns && (
                                  <span className="ml-auto text-[10px] bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-md font-bold uppercase">
                                    Lựa chọn của bạn
                                  </span>
                                )}
                              </div>
                            );
                          });
                        }

                        if (qType === 'fill') {
                          return (
                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-2">
                              <div>
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Lựa chọn của bạn</span>
                                <span className={`text-base font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                  {q.userAnswer || '(Không trả lời)'}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Đáp án đúng</span>
                                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{q.correctAnswer}</span>
                              </div>
                            </div>
                          );
                        }

                        if (qType === 'truefalse') {
                          return (
                            <div className="flex gap-4">
                              {[true, false].map((val) => {
                                const isUserSelected = q.userAnswer === val;
                                const isCorrectAns = q.correctAnswer === val;
                                
                                let borderClass = 'border-slate-100 dark:border-slate-800';
                                let bgClass = 'bg-white dark:bg-slate-900/40';
                                let textClass = 'text-slate-600 dark:text-slate-400';
                                
                                if (isCorrectAns) {
                                  borderClass = 'border-emerald-500 dark:border-emerald-800';
                                  bgClass = 'bg-emerald-50 dark:bg-emerald-950/20';
                                  textClass = 'text-emerald-700 dark:text-emerald-350 font-bold';
                                } else if (isUserSelected && !isCorrectAns) {
                                  borderClass = 'border-red-500 dark:border-red-800';
                                  bgClass = 'bg-red-50 dark:bg-red-950/20';
                                  textClass = 'text-red-700 dark:text-red-350 font-bold';
                                }

                                return (
                                  <div key={val ? 'true' : 'false'} className={`flex-1 p-4 border-2 rounded-2xl text-center ${borderClass} ${bgClass} ${textClass}`}>
                                    <div className="text-lg font-extrabold">{val ? 'ĐÚNG' : 'SAI'}</div>
                                    {isCorrectAns && <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mt-1">Đáp án đúng</div>}
                                    {isUserSelected && !isCorrectAns && <div className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase mt-1">Lựa chọn của bạn</div>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        if (qType === 'drag') {
                          return (
                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
                              {(q.pairs || []).map((p, pIdx) => {
                                const userRight = (q.userAnswer || {})[p.left] || '';
                                const isPairCorrect = userRight === p.right;
                                return (
                                  <div key={pIdx} className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    <div className="flex-1 text-slate-700 dark:text-slate-350 font-medium">{p.left}</div>
                                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                      <div className={`p-2 rounded-lg border text-sm font-bold ${isPairCorrect ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300'}`}>
                                        Lựa chọn: {userRight || '(Trống)'}
                                      </div>
                                      {!isPairCorrect && (
                                        <div className="p-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-sm font-bold">
                                          Đúng: {p.right}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        if (qType === 'groupdrag') {
                          const allItems = (q.groups || []).reduce((acc, g) => [...acc, ...(g.items || [])], []).sort();
                          return (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                              {allItems.map((item, itemIdx) => {
                                const userGroup = (q.userAnswer || {})[item] || '';
                                const correctGroup = (q.groups || []).find(g => (g.items || []).includes(item))?.name || '';
                                const isItemCorrect = userGroup === correctGroup;
                                return (
                                  <div key={itemIdx} className="flex flex-col sm:flex-row gap-4 items-center bg-white p-3 border border-slate-200 rounded-xl">
                                    <div className="flex-1 text-slate-700 font-medium">{item}</div>
                                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                      <div className={`p-2 rounded-lg border text-sm font-bold ${isItemCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                                        Nhóm đã chọn: {userGroup || '(Chưa chọn)'}
                                      </div>
                                      {!isItemCorrect && (
                                        <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold">
                                          Nhóm đúng: {correctGroup}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        if (qType === 'clozedrag') {
                          const parts = (q.text || '').split('___');
                          const userAnswers = q.userAnswer || [];
                          const correctAnswers = q.answers || [];
                          return (
                            <div className="bg-white border-2 border-slate-200 p-6 rounded-2xl text-slate-800 leading-loose text-base">
                              {parts.map((part, pIdx) => {
                                if (pIdx === parts.length - 1) {
                                  return <span key={pIdx} dangerouslySetInnerHTML={{ __html: part }} />;
                                }
                                const userAns = userAnswers[pIdx] || '';
                                const correctAns = correctAnswers[pIdx] || '';
                                const isPartCorrect = userAns === correctAns;
                                return (
                                  <span key={pIdx} className="inline-block mx-1">
                                    <span dangerouslySetInnerHTML={{ __html: part }} />
                                    <span className={`px-2 py-0.5 rounded-lg border-2 font-bold text-sm ${isPartCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                                      {userAns || '...'} {!isPartCorrect && <span className="text-emerald-700 font-bold ml-1">({correctAns})</span>}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }

                        if (qType === 'order') {
                          const userWords = (q.userAnswer || []).map(idx => q.items[idx]);
                          const correctWords = q.items || [];
                          return (
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-4">
                              <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Lựa chọn của bạn:</span>
                                <div className="flex flex-wrap gap-2">
                                  {userWords.length > 0 ? (
                                    userWords.map((word, wIdx) => (
                                      <span 
                                        key={wIdx} 
                                        className={`px-4 py-2 border-2 rounded-2xl text-sm font-bold shadow-sm ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
                                      >
                                        {word}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-sm font-bold text-red-800 italic">(Không sắp xếp)</span>
                                  )}
                                </div>
                              </div>
                              {!isCorrect && (
                                <div className="pt-3 border-t border-slate-200">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Thứ tự đúng:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {correctWords.map((word, wIdx) => (
                                      <span 
                                        key={wIdx} 
                                        className="px-4 py-2 border-2 border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-2xl shadow-sm"
                                      >
                                        {word}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
