import { useState, useRef, useCallback } from 'react';
import { analyzeWordFile, analyzeWordFileWithAI, analyzeImageFilesWithAI } from '../../utils/wordParser';
import { autoDetectMissingAnswersWithAI, hasGeminiApiKey } from '../../utils/gemini';
import { Button } from '../ui/Button';
import {
  Upload, ChevronRight, ChevronLeft, Check, Trash2,
  FileText, AlertTriangle, CheckSquare, Square, Loader2,
  BookOpen, X, FileWarning, Zap, Sparkles, Bot, Camera, Image as ImageIcon,
  ScanLine
} from 'lucide-react';

const TYPE_LABELS = {
  single:           'Trắc nghiệm',
  multiselect:      'Nhiều đáp án',
  fill:             'Điền từ',
  truefalse:        'Đúng / Sai',
  multitruefalse:   'Đúng/Sai (nhiều phát biểu)',
  order:            'Sắp xếp',
  drag:             'Ghép cặp',
  groupdrag:        'Phân loại nhóm',
  clozedrag:        'Kéo vào đoạn văn',
};


const PART_COLORS = {
  1: 'bg-violet-100 text-violet-700 border-violet-300',
  2: 'bg-sky-100 text-sky-700 border-sky-300',
  3: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  4: 'bg-amber-100 text-amber-700 border-amber-300',
  5: 'bg-rose-100 text-rose-700 border-rose-300',
  6: 'bg-indigo-100 text-indigo-700 border-indigo-300',
};

// ─── SOURCE TABS: Word / Ảnh chụp ─────────────────────────────
const SOURCE_TABS = [
  { id: 'word',  label: 'File Word (.docx)', icon: FileText, color: 'indigo' },
  { id: 'image', label: 'Ảnh Chụp / Scan',   icon: Camera,   color: 'fuchsia' },
];

export default function WordImportModal({ isOpen, onClose, onImport }) {
  const [step,          setStep]          = useState(1);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [fileName,      setFileName]      = useState('');
  const [analysisData,  setAnalysisData]  = useState(null);
  const [selected,      setSelected]      = useState({});
  const [preview,       setPreview]       = useState([]);
  const [dragOver,      setDragOver]      = useState(false);

  // Word import state
  const [importMode,    setImportMode]    = useState('fast');
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiProgress,    setAiProgress]    = useState({ done: 0, total: 0 });

  // Image import state
  const [sourceTab,     setSourceTab]     = useState('word'); // 'word' | 'image'
  const [imageFiles,    setImageFiles]    = useState([]);     // File[]
  const [imageDragOver, setImageDragOver] = useState(false);
  const [imageLoading,  setImageLoading]  = useState(false);
  const [imageProgress, setImageProgress] = useState({ done: 0, total: 0 });

  // Shared fix state
  const [aiFixLoading,  setAiFixLoading]  = useState(false);
  const [aiFixProgress, setAiFixProgress] = useState({ done: 0, total: 0 });
  const [loadingMsg,    setLoadingMsg]    = useState('');

  const fileRef  = useRef(null);
  const imageRef = useRef(null);

  function reset() {
    setStep(1); setLoading(false); setError('');
    setFileName(''); setAnalysisData(null);
    setSelected({}); setPreview([]); setDragOver(false);
    setAiLoading(false); setAiProgress({ done: 0, total: 0 });
    setImageFiles([]); setImageLoading(false); setImageProgress({ done: 0, total: 0 });
    setAiFixLoading(false); setAiFixProgress({ done: 0, total: 0 });
    setLoadingMsg('');
  }

  function handleClose() { reset(); onClose(); }

  // ─── WORD FILE PROCESSING ────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.docx')) {
      setError('Vui lòng chọn file .docx hợp lệ.'); return;
    }
    setFileName(file.name); setError('');

    if (importMode === 'ai') {
      if (!hasGeminiApiKey()) {
        setError('Chưa cấu hình API Key Gemini. Vui lòng vào Cấu hình Hệ thống để nhập. (Mã lỗi: SYS-02)');
        return;
      }
      setAiLoading(true);
      setAiProgress({ done: 0, total: 1 });
      setLoadingMsg('🤖 AI đang phân tích file Word...');
      try {
        const data = await analyzeWordFileWithAI(file, (done, total) => {
          setAiProgress({ done, total: total || 1 });
          setLoadingMsg(`AI đang xử lý... (${done}/${total} phần)`);
        });
        setAnalysisData(data);
        setSelected({});
        setStep(2);
      } catch (e) {
        console.error(e);
        if (e.message?.includes('SYS-02') || e.message?.includes('SYS-03')) {
          setError(e.message);
        } else {
          setError('Không thể phân tích file bằng AI. Hãy thử lại hoặc dùng Import Nhanh. (Mã lỗi: WI-02)');
        }
      } finally {
        setAiLoading(false);
        setLoadingMsg('');
      }
    } else {
      setLoading(true);
      setLoadingMsg('Đang phân tích file...');
      try {
        const data = await analyzeWordFile(file);
        setAnalysisData(data);
        const initSel = {};
        (data.sections || []).forEach(s => { initSel[s.key] = true; });
        setSelected(initSel);
        setStep(2);
      } catch (e) {
        console.error(e);
        setError('Không thể đọc file. Hãy kiểm tra lại định dạng .docx. (Mã lỗi: WI-01)');
      } finally {
        setLoading(false);
        setLoadingMsg('');
      }
    }
  }, [importMode]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  // ─── IMAGE FILE PROCESSING ───────────────────────────────────
  function handleImageSelect(files) {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(f =>
      /\.(png|jpe?g|webp)$/i.test(f.name) || /^image\//i.test(f.type)
    );
    if (validFiles.length === 0) {
      setError('Chỉ hỗ trợ file ảnh PNG, JPG, JPEG, WebP.'); return;
    }
    setError('');
    setImageFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const newFiles = validFiles.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...newFiles];
    });
  }

  function removeImageFile(idx) {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function processImageFiles() {
    if (imageFiles.length === 0) {
      setError('Chưa chọn ảnh nào.'); return;
    }
    if (!hasGeminiApiKey()) {
      setError('Chưa cấu hình API Key Gemini. Vui lòng vào Cấu hình Hệ thống để nhập. (Mã lỗi: SYS-02)');
      return;
    }
    setImageLoading(true);
    setImageProgress({ done: 0, total: imageFiles.length });
    setLoadingMsg(`🔍 AI Vision đang đọc ${imageFiles.length} trang đề thi...`);
    setError('');
    try {
      const data = await analyzeImageFilesWithAI(imageFiles, (done, total) => {
        setImageProgress({ done, total: total || 1 });
        setLoadingMsg(`AI Vision đang đọc trang ${done + 1}/${total}...`);
      });
      setAnalysisData(data);
      setFileName(`${imageFiles.length} ảnh chụp đề thi`);
      setSelected({});
      setStep(2);
    } catch (e) {
      console.error(e);
      if (e.message?.includes('SYS-02') || e.message?.includes('SYS-03')) {
        setError(e.message);
      } else {
        setError('AI Vision không thể nhận diện đề thi. Hãy thử ảnh rõ nét hơn hoặc thay đổi góc chụp. (Mã lỗi: WI-03)');
      }
    } finally {
      setImageLoading(false);
      setLoadingMsg('');
    }
  }

  // ─── STEP 2 / 3 LOGIC ───────────────────────────────────────
  function toggleSection(key) {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  }
  function selectAll()   { const s = {}; (analysisData?.sections || []).forEach(sec => { s[sec.key] = true; }); setSelected(s); }
  function deselectAll() { setSelected({}); }

  function goToPreview() {
    const qs = [];
    if (analysisData?.format === 'ai' || analysisData?.format === 'image_ai') {
      qs.push(...(analysisData?.questions || []));
    } else {
      (analysisData?.sections || []).forEach(sec => {
        if (selected[sec.key]) qs.push(...sec.questions);
      });
      if (analysisData?.format === 'classic') qs.push(...(analysisData?.questions || []));
    }
    if (qs.length === 0) { setError('Không tìm thấy câu hỏi nào để import.'); return; }
    setError('');
    setPreview(qs.map((q, i) => ({ ...q, _previewId: i })));
    setStep(3);
  }

  function removeQuestion(id) {
    setPreview(prev => prev.filter(q => q._previewId !== id));
  }

  function handleConfirmImport() {
    if (preview.length === 0) return;
    const clean = preview.map(({ _bai, _part, _previewId, _needsReview, ...rest }) => rest);
    onImport(clean);
    handleClose();
  }

  async function handleAIFixReview() {
    const reviewItems = preview.filter(q => q._needsReview);
    if (reviewItems.length === 0) return;
    if (!hasGeminiApiKey()) {
      setError('Chưa cấu hình API Key Gemini. Vui lòng vào Cấu hình Hệ thống để nhập. (Mã lỗi: SYS-02)');
      return;
    }
    setAiFixLoading(true);
    setAiFixProgress({ done: 0, total: reviewItems.length });
    setError('');
    try {
      const fixed = await autoDetectMissingAnswersWithAI(reviewItems, (done, total) => {
        setAiFixProgress({ done, total: total || 1 });
      });
      const fixedMap = {};
      reviewItems.forEach((q, i) => { fixedMap[q._previewId] = fixed[i]; });
      setPreview(prev => prev.map(q =>
        fixedMap[q._previewId] ? { ...fixedMap[q._previewId], _previewId: q._previewId } : q
      ));
    } catch (e) {
      console.error(e);
      if (e.message?.includes('SYS-02') || e.message?.includes('SYS-03')) {
        setError(e.message);
      } else {
        setError('AI gặp lỗi khi sửa đáp án. Vui lòng thử lại. (Mã lỗi: A01)');
      }
    } finally {
      setAiFixLoading(false);
    }
  }

  const reviewCount   = preview.filter(q => q._needsReview).length;
  const selectedCount = analysisData?.format === 'ai' || analysisData?.format === 'image_ai'
    ? (analysisData?.questions?.length || 0)
    : analysisData?.format === 'classic'
      ? (analysisData?.questions?.length || 0)
      : (analysisData?.sections || []).filter(s => selected[s.key]).reduce((sum, s) => sum + s.questions.length, 0);

  const isWordLoading  = loading || aiLoading;
  const isAnyLoading   = isWordLoading || imageLoading;

  if (!isOpen) return null;

  const aiProgressPct      = aiProgress.total > 0 ? Math.round((aiProgress.done / aiProgress.total) * 100) : 0;
  const imageProgressPct   = imageProgress.total > 0 ? Math.round((imageProgress.done / imageProgress.total) * 100) : 0;
  const aiFixProgressPct   = aiFixProgress.total > 0 ? Math.round((aiFixProgress.done / aiFixProgress.total) * 100) : 0;

  // Header label theo source + step
  const getSubtitle = () => {
    if (step === 2) return 'Chọn nội dung muốn import';
    if (step === 3) return 'Xem trước & xác nhận';
    return sourceTab === 'image' ? 'Tải lên ảnh chụp / scan đề thi' : 'Tải lên file .docx';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ─── HEADER ─── */}
        <div className="flex items-center gap-4 px-7 py-5 rounded-t-2xl"
             style={{ background: sourceTab === 'image' && step === 1 ? 'linear-gradient(135deg,#7c3aed,#c026d3)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <div className="bg-white/20 rounded-xl p-2.5 flex-shrink-0">
            {sourceTab === 'image' && step === 1 ? <ScanLine className="h-6 w-6 text-white" /> : <Sparkles className="h-6 w-6 text-white" />}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black m-0 leading-tight text-white">✨ Nhận Diện Đề Thi AI</h2>
            <p className="text-white/75 text-sm m-0 mt-0.5">{getSubtitle()}</p>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {[1,2,3].map(s => (
              <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition
                ${step === s ? 'bg-white text-indigo-700 shadow-lg' : step > s ? 'bg-white/40 text-white' : 'bg-white/20 text-white/50'}`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
            ))}
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition ml-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* ─── BODY ─── */}
        <div className="flex-1 overflow-y-auto px-7 py-6">

          {/* ══════════ STEP 1 ══════════ */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-5">

              {/* SOURCE TABS */}
              <div className="w-full flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                {SOURCE_TABS.map((tab, i) => {
                  const isActive = sourceTab === tab.id;
                  const Icon = tab.icon;
                  const colorActive = tab.id === 'image' ? 'bg-fuchsia-600 text-white' : 'bg-indigo-600 text-white';
                  return (
                    <button
                      key={tab.id}
                      id={`source-tab-${tab.id}`}
                      onClick={() => { setSourceTab(tab.id); setError(''); setImageFiles([]); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all
                        ${isActive ? colorActive : 'bg-white text-slate-600 hover:bg-slate-50'}
                        ${i > 0 ? 'border-l border-slate-200' : ''}`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ─── WORD TAB ─── */}
              {sourceTab === 'word' && (
                <>
                  {/* Word mode toggle */}
                  <div className="w-full flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <button
                      id="import-mode-fast"
                      onClick={() => setImportMode('fast')}
                      className={`flex-1 flex items-center justify-center gap-2.5 py-3 text-sm font-bold transition-all ${importMode === 'fast' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Zap className="h-4 w-4" />
                      ⚡ Import Nhanh
                      <span className={`text-xs font-normal ${importMode === 'fast' ? 'text-indigo-200' : 'text-slate-400'}`}>(Parser)</span>
                    </button>
                    <div className="w-px bg-slate-200" />
                    <button
                      id="import-mode-ai"
                      onClick={() => setImportMode('ai')}
                      className={`flex-1 flex items-center justify-center gap-2.5 py-3 text-sm font-bold transition-all ${importMode === 'ai' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Sparkles className="h-4 w-4" />
                      🤖 Import Thông Minh
                      <span className={`text-xs font-normal ${importMode === 'ai' ? 'text-violet-200' : 'text-slate-400'}`}>(AI)</span>
                    </button>
                  </div>

                  {importMode === 'ai' && (
                    <div className="w-full bg-violet-50 border border-violet-200 rounded-xl p-3.5 flex gap-3">
                      <Bot className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-violet-700">
                        <p className="font-bold mb-0.5">Bóc tách thông minh bằng Gemini AI</p>
                        <p className="text-xs text-violet-600">
                          Nhận diện câu hỏi ngay cả khi file Word không tuân chuẩn. Yêu cầu API Key Gemini đã được cấu hình.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Word Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => !isWordLoading && fileRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all
                      ${dragOver ? (importMode === 'ai' ? 'border-violet-500 bg-violet-50 scale-[1.01]' : 'border-indigo-500 bg-indigo-50 scale-[1.01]') : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                  >
                    {isWordLoading ? (
                      <>
                        <Loader2 className={`h-14 w-14 animate-spin ${aiLoading ? 'text-violet-500' : 'text-indigo-500'}`} />
                        <p className={`font-black text-lg ${aiLoading ? 'text-violet-600' : 'text-indigo-600'}`}>
                          {loadingMsg || 'Đang phân tích file...'}
                        </p>
                        {aiLoading && aiProgress.total > 1 && (
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between text-xs text-violet-500 mb-1 font-semibold">
                              <span>Xử lý phần {aiProgress.done}/{aiProgress.total}</span>
                              <span>{aiProgressPct}%</span>
                            </div>
                            <div className="w-full bg-violet-100 rounded-full h-2">
                              <div className="bg-violet-500 h-2 rounded-full transition-all duration-300" style={{ width: `${aiProgressPct}%` }} />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className={`rounded-2xl p-5 shadow-inner ${importMode === 'ai' ? 'bg-gradient-to-br from-violet-100 to-purple-100' : 'bg-gradient-to-br from-indigo-100 to-violet-100'}`}>
                          {importMode === 'ai' ? <Sparkles className="h-12 w-12 text-violet-500" /> : <Upload className="h-12 w-12 text-indigo-500" />}
                        </div>
                        <div className="text-center">
                          <p className="font-black text-slate-700 text-xl mb-1">Kéo thả file .docx vào đây</p>
                          <p className="text-slate-400 text-sm">hoặc nhấn để chọn file từ máy tính</p>
                        </div>
                        <span className={`text-white px-7 py-2.5 rounded-xl font-bold text-sm shadow-md transition ${importMode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                          Chọn File Word (.docx)
                        </span>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(e) => processFile(e.target.files[0])} />

                  <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                    <BookOpen className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-bold mb-1">Định dạng hỗ trợ:</p>
                      <ul className="space-y-0.5 text-blue-600 text-xs">
                        <li>• <strong>Ngoại Ngữ 4</strong>: Tự động nhận diện BAI / Part 1–6, 6 dạng bài</li>
                        <li>• <strong>Định dạng chuẩn</strong>: Câu 1:, Câu 2:, đáp án in đậm / Đáp án:</li>
                        <li>• <strong>AI (Thông minh)</strong>: Mọi định dạng — AI tự nhận diện cấu trúc</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {/* ─── IMAGE TAB ─── */}
              {sourceTab === 'image' && (
                <>
                  <div className="w-full bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-3.5 flex gap-3">
                    <ScanLine className="h-5 w-5 text-fuchsia-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-fuchsia-800">
                      <p className="font-bold mb-0.5">AI Vision — Bóc tách từ ảnh chụp đề thi</p>
                      <p className="text-xs text-fuchsia-700">
                        Chụp ảnh đề thi giấy / file scan hoặc screenshot → AI tự động OCR và nhận diện 9 dạng câu hỏi. Yêu cầu API Key Gemini.
                      </p>
                    </div>
                  </div>

                  {/* Image Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                    onDragLeave={() => setImageDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setImageDragOver(false); handleImageSelect(e.dataTransfer.files); }}
                    onClick={() => !imageLoading && imageRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all
                      ${imageDragOver ? 'border-fuchsia-500 bg-fuchsia-50 scale-[1.01]' : imageFiles.length > 0 ? 'border-fuchsia-300 bg-fuchsia-50/50 hover:bg-fuchsia-50' : 'border-slate-300 hover:border-fuchsia-400 hover:bg-slate-50'}`}
                  >
                    {imageLoading ? (
                      <>
                        <div className="relative">
                          <ScanLine className="h-12 w-12 text-fuchsia-400 animate-pulse" />
                          <Loader2 className="h-6 w-6 text-fuchsia-600 animate-spin absolute -right-2 -bottom-2" />
                        </div>
                        <p className="font-black text-lg text-fuchsia-700">{loadingMsg || 'AI Vision đang đọc...'}</p>
                        {imageProgress.total > 0 && (
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between text-xs text-fuchsia-600 mb-1 font-semibold">
                              <span>Trang {imageProgress.done + 1}/{imageProgress.total}</span>
                              <span>{imageProgressPct}%</span>
                            </div>
                            <div className="w-full bg-fuchsia-100 rounded-full h-2">
                              <div className="bg-fuchsia-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.max(imageProgressPct, 5)}%` }} />
                            </div>
                          </div>
                        )}
                      </>
                    ) : imageFiles.length > 0 ? (
                      <>
                        <div className="grid grid-cols-4 gap-2 w-full">
                          {imageFiles.slice(0, 7).map((f, i) => (
                            <div key={i} className="relative group">
                              <img
                                src={URL.createObjectURL(f)}
                                alt={f.name}
                                className="w-full h-20 object-cover rounded-lg border-2 border-fuchsia-200 shadow-sm"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); removeImageFile(i); }}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <p className="text-xs text-slate-500 truncate mt-1">{f.name}</p>
                            </div>
                          ))}
                          {imageFiles.length > 7 && (
                            <div className="w-full h-20 rounded-lg border-2 border-dashed border-fuchsia-300 flex items-center justify-center">
                              <span className="text-fuchsia-600 font-black text-sm">+{imageFiles.length - 7}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-sm text-fuchsia-700 font-semibold">{imageFiles.length} ảnh đã chọn</p>
                          <span className="text-fuchsia-400 text-xs">• Nhấn thêm ảnh hoặc kéo thả</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-2xl p-5 shadow-inner bg-gradient-to-br from-fuchsia-100 to-purple-100">
                          <Camera className="h-12 w-12 text-fuchsia-600" />
                        </div>
                        <div className="text-center">
                          <p className="font-black text-slate-700 text-xl mb-1">Kéo thả ảnh đề thi vào đây</p>
                          <p className="text-slate-400 text-sm">Hỗ trợ PNG, JPG, JPEG, WebP — nhiều ảnh cùng lúc</p>
                        </div>
                        <span className="text-white bg-fuchsia-600 hover:bg-fuchsia-700 px-7 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" /> Chọn ảnh đề thi
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={imageRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files)}
                  />

                  {imageFiles.length > 0 && !imageLoading && (
                    <button
                      id="image-ai-scan-btn"
                      onClick={processImageFiles}
                      className="w-full py-3.5 rounded-xl font-black text-white shadow-lg transition flex items-center justify-center gap-2 text-base"
                      style={{ background: 'linear-gradient(135deg,#a21caf,#7c3aed)' }}
                    >
                      <ScanLine className="h-5 w-5" />
                      🔍 Nhận Diện Đề Thi ({imageFiles.length} trang)
                    </button>
                  )}

                  <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-bold mb-1">Mẹo để AI nhận diện chính xác:</p>
                      <ul className="space-y-0.5 text-amber-700 text-xs">
                        <li>• Chụp ảnh đề thi thẳng góc, đủ sáng, không bị mờ hoặc nghiêng nhiều</li>
                        <li>• Mỗi file ảnh là 1 trang đề thi (tránh chụp nhiều trang trên 1 ảnh)</li>
                        <li>• Sắp xếp ảnh theo thứ tự trang trước khi nhận diện</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
                  <FileWarning className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
              )}
            </div>
          )}

          {/* ══════════ STEP 2 ══════════ */}
          {step === 2 && analysisData && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                {analysisData.format === 'image_ai' ? <Camera className="h-5 w-5 text-fuchsia-500 flex-shrink-0" /> : <FileText className="h-5 w-5 text-slate-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate text-sm">{fileName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tổng: <strong>{analysisData.questions?.length ?? 0}</strong> câu hỏi • Phương thức:{' '}
                    <span className={`font-bold ${
                      analysisData.format === 'image_ai'   ? 'text-fuchsia-600' :
                      analysisData.format === 'ngoaingu4'  ? 'text-indigo-600' :
                      analysisData.format === 'ai'         ? 'text-violet-600' :
                      'text-emerald-600'
                    }`}>
                      {analysisData.format === 'image_ai'  ? '📷 AI Vision (Ảnh chụp)'
                       : analysisData.format === 'ngoaingu4' ? '✅ Ngoại Ngữ 4'
                       : analysisData.format === 'ai'        ? '🤖 AI (Gemini Word)'
                       : '✅ Định dạng chuẩn'}
                    </span>
                  </p>
                </div>
              </div>

              {(analysisData.format === 'ai' || analysisData.format === 'image_ai') && (
                <div className="text-center py-10 text-slate-500">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${analysisData.format === 'image_ai' ? 'bg-fuchsia-100' : 'bg-violet-100'}`}>
                    {analysisData.format === 'image_ai'
                      ? <Camera className="h-8 w-8 text-fuchsia-600" />
                      : <Sparkles className="h-8 w-8 text-violet-500" />}
                  </div>
                  <p className="font-black text-slate-700 text-lg">
                    {analysisData.format === 'image_ai' ? '📷' : '🤖'} AI đã bóc tách {analysisData.questions.length} câu hỏi
                  </p>
                  <p className="text-sm mt-1">Nhấn <strong>Tiếp theo</strong> để xem trước và xác nhận trước khi import.</p>
                </div>
              )}

              {analysisData.format === 'classic' && (
                <div className="text-center py-10 text-slate-500">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="font-black text-slate-700 text-lg">Phát hiện {analysisData.questions.length} câu hỏi</p>
                  <p className="text-sm mt-1">Định dạng chuẩn không cần chọn phần riêng. Nhấn <strong>Tiếp theo</strong> để xem trước.</p>
                </div>
              )}

              {analysisData.format === 'ngoaingu4' && analysisData.sections.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-700">Chọn Bài / Part muốn import</h3>
                    <div className="flex gap-3">
                      <button onClick={selectAll} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                        <CheckSquare className="h-3.5 w-3.5" /> Chọn tất cả
                      </button>
                      <button onClick={deselectAll} className="text-xs font-bold text-slate-500 hover:underline flex items-center gap-1">
                        <Square className="h-3.5 w-3.5" /> Bỏ hết
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const baiMap = new Map();
                    analysisData.sections.forEach(s => {
                      if (!baiMap.has(s.bai)) baiMap.set(s.bai, []);
                      baiMap.get(s.bai).push(s);
                    });
                    return Array.from(baiMap.entries()).map(([bai, sections]) => (
                      <div key={bai} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-slate-500" />
                          <span className="font-black text-slate-700 text-sm">{bai}</span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {sections.reduce((s, sec) => s + sec.questions.length, 0)} câu
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-100">
                          {sections.map(sec => {
                            const isChecked = !!selected[sec.key];
                            const partColor = PART_COLORS[sec.part] || 'bg-slate-100 text-slate-600 border-slate-300';
                            return (
                              <button key={sec.key} onClick={() => toggleSection(sec.key)}
                                className="bg-white p-3 flex items-center gap-3 hover:bg-indigo-50 transition text-left">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition
                                  ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                  {isChecked && <Check className="h-3 w-3" />}
                                </div>
                                <div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${partColor}`}>
                                    Part {sec.part}
                                  </span>
                                  <p className="text-xs text-slate-400 mt-1">{sec.questions.length} câu</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-semibold flex gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
            </div>
          )}

          {/* ══════════ STEP 3 ══════════ */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${reviewCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {reviewCount > 0
                      ? <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      : <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />}
                    <p className={`font-bold text-sm ${reviewCount > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                      {preview.length} câu hỏi sẵn sàng import
                      {reviewCount > 0 && ` • ⚠️ ${reviewCount} câu cần kiểm tra lại đáp án`}
                    </p>
                  </div>
                  {reviewCount > 0 && !aiFixLoading && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Các câu đánh dấu ⚠️ chưa xác định được đáp án đúng. Dùng AI sửa tự động hoặc sửa thủ công sau khi import.
                    </p>
                  )}
                </div>
                {reviewCount > 0 && (
                  <button
                    id="ai-fix-review-btn"
                    onClick={handleAIFixReview}
                    disabled={aiFixLoading}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${aiFixLoading ? 'bg-violet-100 text-violet-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm'}`}
                    title="Dùng AI để tự động suy luận đáp án cho các câu bị thiếu"
                  >
                    {aiFixLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Bot className="h-3.5 w-3.5" />}
                    {aiFixLoading ? 'AI đang xử lý...' : `Sử dụng AI sửa tự động ${reviewCount} câu`}
                  </button>
                )}
              </div>

              {aiFixLoading && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <div className="flex justify-between text-xs text-violet-600 font-semibold mb-2">
                    <span>AI đang suy luận đáp án... ({aiFixProgress.done}/{aiFixProgress.total} batch)</span>
                    <span>{aiFixProgressPct}%</span>
                  </div>
                  <div className="w-full bg-violet-100 rounded-full h-2">
                    <div className="bg-violet-500 h-2 rounded-full transition-all duration-500"
                         style={{ width: `${aiFixProgressPct > 0 ? aiFixProgressPct : 10}%` }} />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-semibold flex gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {preview.map((q, idx) => {
                  const typeLabel = TYPE_LABELS[q.type] || q.type;
                  const partColor = PART_COLORS[q._part] || 'bg-slate-100 text-slate-600 border-slate-300';
                  return (
                    <div key={q._previewId}
                         className={`flex items-start gap-3 p-4 rounded-xl border transition group ${q._needsReview ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <span className="text-slate-400 font-black text-xs w-5 flex-shrink-0 mt-1">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          {q._bai && <span className="text-xs text-slate-400 font-semibold">{q._bai}</span>}
                          {q._part && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${partColor}`}>Part {q._part}</span>
                          )}
                          <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">{typeLabel}</span>
                          {q._needsReview && (
                            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />Cần review
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 text-sm font-medium leading-snug line-clamp-2">{q.question}</p>
                        <div className="text-xs text-slate-400 mt-1">
                          {q.type === 'single'         && q.options && <>Đúng: <strong className="text-emerald-600">{q.options[q.correct]}</strong></>}
                          {q.type === 'multiselect'    && <>{(q.corrects||[]).length} đáp án đúng</>}
                          {q.type === 'fill'           && <>Đáp án: <strong className="text-emerald-600">{q.answer}</strong></>}
                          {q.type === 'truefalse'      && <>Đáp án: <strong className="text-emerald-600">{q.correct ? 'Đúng' : 'Sai'}</strong></>}
                          {q.type === 'multitruefalse' && <>{(q.statements||[]).length} phát biểu — {(q.statements||[]).filter(s=>s.correct).length} Đúng / {(q.statements||[]).filter(s=>!s.correct).length} Sai</>}
                          {q.type === 'drag'           && <>{(q.pairs||[]).length} cặp ghép</>}
                          {q.type === 'groupdrag'      && <>{(q.groups||[]).length} nhóm</>}
                          {q.type === 'order'          && <>{(q.items||[]).length} mục sắp xếp</>}
                          {q.type === 'clozedrag'      && <>{(q.answers||[]).length} chỗ trống</>}
                        </div>
                      </div>
                      <button onClick={() => removeQuestion(q._previewId)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition flex-shrink-0 mt-0.5 p-1"
                        title="Xóa câu này khỏi danh sách">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {preview.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">Không còn câu hỏi nào.</p>
                  <p className="text-sm">Quay lại để chọn lại.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── FOOTER ─── */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <div>
            {step === 1 && <Button variant="outline" onClick={handleClose}>Hủy</Button>}
            {step > 1 && (
              <Button variant="outline" onClick={() => { setError(''); setStep(s => s - 1); }}
                className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />Quay lại
              </Button>
            )}
          </div>
          <div>
            {step === 2 && (
              <Button onClick={goToPreview}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 rounded-xl">
                Xem trước ({selectedCount} câu) <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleConfirmImport} disabled={preview.length === 0 || aiFixLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 rounded-xl disabled:opacity-50">
                <Check className="h-4 w-4" />Nhập vào đề ({preview.length} câu)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}