import { useState } from 'react';
import QuestionModal from './QuestionModal';
import { Pencil, Trash2, Check } from 'lucide-react';
import { Button } from '../ui/Button';

export default function QuestionList({ questions, onUpdateQuestion, onDeleteQuestion }) {
  const [editingIndex, setEditingIndex] = useState(null);

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center p-12 italic text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
        Đề thi chưa có câu hỏi nào. Hãy nhập từ Word/PDF hoặc Thêm thủ công ở trên.
      </div>
    );
  }

  const handleSaveEdit = (updatedQuestion) => {
    onUpdateQuestion(editingIndex, updatedQuestion);
    setEditingIndex(null); 
  };

  return (
    <div className="flex flex-col gap-6 mt-6 relative">
      <QuestionModal isOpen={editingIndex !== null} questionData={editingIndex !== null ? questions[editingIndex] : null} onSave={handleSaveEdit} onClose={() => setEditingIndex(null)} />

      {questions.map((q, i) => {
        let typeBadge = ""; let detailsHtml = null;

        if (q.type === 'single') {
          typeBadge = "Trắc nghiệm 1 Đáp án";
          detailsHtml = <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{q.options.map((opt, optIdx) => (<div key={optIdx} className={`p-4 border-2 rounded-xl flex justify-between items-start transition ${optIdx === q.correct ? 'border-green-500 bg-green-50 text-green-800 font-bold' : 'border-slate-200 text-slate-600 bg-white'}`}><span className="leading-relaxed" dangerouslySetInnerHTML={{ __html: opt }} />{optIdx === q.correct && <Check className="h-5 w-5 ml-3 flex-shrink-0 text-green-600 font-black" />}</div>))}</div>;
        } 
        else if (q.type === 'multiselect') {
          typeBadge = "Trắc nghiệm Nhiều Đ.Án";
          detailsHtml = <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{q.options.map((opt, optIdx) => { const isSelected = q.corrects.includes(optIdx); return (<div key={optIdx} className={`p-4 border-2 rounded-xl flex items-start gap-3 transition ${isSelected ? 'border-green-500 bg-green-50 text-green-800 font-bold' : 'border-slate-200 text-slate-600 bg-white'}`}><div className={`mt-0.5 w-5 h-5 flex flex-shrink-0 items-center justify-center border-2 rounded ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>{isSelected && <Check className="h-3 w-3 text-white font-bold" />}</div><span className="leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: opt }} /></div>); })}</div>;
        }
        else if (q.type === 'fill') {
          typeBadge = "Điền từ (Lệnh)";
          detailsHtml = <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-xl mt-4"><span className="text-slate-500 font-semibold">Đáp án cần điền:</span> <b className="text-indigo-600 ml-2 text-lg border-b-2 border-indigo-400 pb-1">{q.answer}</b></div>;
        }
        else if (q.type === 'truefalse') {
          typeBadge = "Đúng / Sai";
          detailsHtml = <div className="flex gap-4 mt-4 max-w-md"><div className={`flex-1 p-4 border-2 rounded-xl text-center font-bold text-lg ${q.correct ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-400 bg-white'}`}>ĐÚNG</div><div className={`flex-1 p-4 border-2 rounded-xl text-center font-bold text-lg ${!q.correct ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-400 bg-white'}`}>SAI</div></div>;
        }
        else if (q.type === 'drag') {
          typeBadge = "Ghép cặp 1-1";
          detailsHtml = <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-xl mt-4 flex flex-col gap-3">{q.pairs.map((p, pIdx) => (<div key={pIdx} className="flex gap-3 text-sm"><div className="flex-1 bg-white p-3 border border-slate-300 rounded-lg font-semibold text-slate-700">{p.left}</div><div className="flex-1 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 p-3 rounded-lg font-bold flex items-center justify-center">{p.right}</div></div>))}</div>;
        }
        else if (q.type === 'groupdrag') {
          typeBadge = "Phân loại Nhóm";
          const gridColsClass = q.groups.length === 2 ? 'grid-cols-2' : (q.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4');
          detailsHtml = <div className={`grid ${gridColsClass} gap-6 mt-6 w-full`}>{q.groups.map((g, gIdx) => (<div key={gIdx} className="bg-slate-50 border-2 border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-start h-full"><strong className="text-indigo-800 block mb-5 border-b-2 border-indigo-200 pb-3 text-center text-lg w-full">{g.name}</strong><div className="flex flex-wrap justify-center content-start gap-3 w-full">{g.items.map((item, itemIdx) => <span key={itemIdx} className="bg-indigo-100 border border-indigo-300 text-indigo-800 px-4 py-2 rounded-xl text-sm font-bold text-center">{item}</span>)}</div></div>))}</div>;
        }
        else if (q.type === 'clozedrag') {
          typeBadge = "Kéo thả Đoạn văn";
          let previewText = q.question; q.answers.forEach(ans => { previewText = previewText.replace("___", `<b style="color:#166534; background:#dcfce7; padding:2px 8px; border-radius:6px; border:2px dashed #22c55e;">${ans}</b>`); });
          detailsHtml = <div className="bg-white border-2 border-slate-200 p-6 rounded-xl mt-4 text-slate-800 leading-loose italic text-lg" dangerouslySetInnerHTML={{ __html: previewText }} />;
        }
        // XEM TRƯỚC SẮP XẾP
        else if (q.type === 'order') {
          typeBadge = "Sắp xếp";
          detailsHtml = (
            <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-xl mt-4 flex flex-col gap-2">
              <span className="text-slate-500 font-semibold mb-2 block">Thứ tự đúng:</span>
              {q.items.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-300 p-3 rounded-lg font-bold text-slate-700 flex items-center gap-3">
                  <span className="text-indigo-400 font-black">{idx + 1}.</span> {item}
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={i} className="bg-white border border-slate-200 p-8 rounded-2xl border-l-4 border-l-indigo-500 shadow-sm relative group transition hover:shadow-md">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
              <span className="bg-slate-100 text-slate-700 font-black text-xs px-3 py-1.5 rounded-md tracking-wider">CÂU {i + 1}</span>
              <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-3 py-1.5 rounded-full">{typeBadge}</span>
              <span className="text-slate-400 text-sm font-semibold ml-auto">• Trọng số: {q.points || 1}</span>
            </div>
            {q.type !== 'clozedrag' && <div className="text-lg font-bold text-slate-800 mb-5 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: q.question }} />}
            {q.image && <img src={q.image} alt="Question Image" className="max-w-full max-h-72 rounded-xl border border-slate-200 mb-5 shadow-sm mx-auto block" />}
            {detailsHtml}
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button variant="outline" onClick={() => setEditingIndex(i)} className="text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white font-bold shadow-sm gap-2"><Pencil className="h-4 w-4" /> Sửa</Button>
              <Button variant="outline" onClick={() => onDeleteQuestion(i)} className="text-red-600 border-red-200 hover:bg-red-500 hover:text-white font-bold shadow-sm gap-2"><Trash2 className="h-4 w-4" /> Xóa</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}