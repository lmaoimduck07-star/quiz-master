import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Trash2, Plus, Pencil, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';

export default function QuestionModal({ isOpen, questionData, onSave, onClose }) {
  const [formData, setFormData] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const questionFileRef = useRef(null);
  const optionFileRefs = useRef([]);

  useEffect(() => {
    if (isOpen && questionData) {
      let cloned = JSON.parse(JSON.stringify(questionData));
      // Đảm bảo có optionImages song song với options (tương thích dữ liệu cũ)
      if (cloned.options && !cloned.optionImages) {
        cloned.optionImages = cloned.options.map(() => '');
      }
      setFormData(cloned);
    }
  }, [isOpen, questionData]);

  if (!isOpen || !formData) return null;

  // ===================== ẢNH: UPLOAD + PASTE =====================
  const readFileAsDataURL = (file, callback) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => callback(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleQuestionImageUpload = (e) => {
    readFileAsDataURL(e.target.files[0], (dataUrl) => {
      setFormData(prev => ({ ...prev, image: dataUrl }));
    });
  };

  const handleOptionImageUpload = (e, idx) => {
    readFileAsDataURL(e.target.files[0], (dataUrl) => {
      setFormData(prev => {
        let imgs = [...(prev.optionImages || prev.options.map(() => ''))];
        imgs[idx] = dataUrl;
        return { ...prev, optionImages: imgs };
      });
    });
  };

  const removeQuestionImage = () => {
    setFormData(prev => ({ ...prev, image: '' }));
    if (questionFileRef.current) questionFileRef.current.value = '';
  };

  const removeOptionImage = (idx) => {
    setFormData(prev => {
      let imgs = [...(prev.optionImages || prev.options.map(() => ''))];
      imgs[idx] = '';
      return { ...prev, optionImages: imgs };
    });
    if (optionFileRefs.current[idx]) optionFileRefs.current[idx].value = '';
  };

  // Paste ảnh trực tiếp (Ctrl+V) vào ô đề bài
  const handleQuestionPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        readFileAsDataURL(item.getAsFile(), (dataUrl) => {
          setFormData(prev => ({ ...prev, image: dataUrl }));
        });
        break;
      }
    }
  };

  // Paste ảnh trực tiếp (Ctrl+V) vào ô đáp án
  const handleOptionPaste = (e, idx) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        readFileAsDataURL(item.getAsFile(), (dataUrl) => {
          setFormData(prev => {
            let imgs = [...(prev.optionImages || prev.options.map(() => ''))];
            imgs[idx] = dataUrl;
            return { ...prev, optionImages: imgs };
          });
        });
        break;
      }
    }
  };

  // ===================== ĐỔI DẠNG CÂU HỎI =====================
  const handleTypeChange = (newType) => {
    if (confirm("⚠️ Đổi dạng câu hỏi sẽ làm mới các đáp án. Bạn chắc chứ?")) {
      let newForm = { ...formData, type: newType };
      if (newType === 'single') { newForm.options = ["Đáp án A", "Đáp án B"]; newForm.optionImages = ["", ""]; newForm.correct = 0; }
      else if (newType === 'multiselect') { newForm.options = ["Đáp án A", "Đáp án B"]; newForm.optionImages = ["", ""]; newForm.corrects = [0]; }
      else if (newType === 'fill') { newForm.answer = ""; if (!newForm.question.includes("___")) newForm.question += " ___"; }
      else if (newType === 'truefalse') { newForm.correct = true; }
      else if (newType === 'drag') { newForm.pairs = [{ left: "", right: "" }, { left: "", right: "" }]; }
      else if (newType === 'groupdrag') { newForm.groups = [{ name: "Nhóm 1", items: [] }, { name: "Nhóm 2", items: [] }]; }
      else if (newType === 'clozedrag') { newForm.answers = []; if (!newForm.question.includes("___")) newForm.question += " ___"; }
      else if (newType === 'order') { newForm.items = ["", ""]; }
      setFormData(newForm);
    }
  };

  const handleOptionTextChange = (index, value) => {
    let newOptions = [...formData.options]; newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };
  const handleSingleCorrectChange = (index) => setFormData({ ...formData, correct: index });
  const handleMultiCorrectChange = (index) => {
    let newCorrects = [...formData.corrects];
    if (newCorrects.includes(index)) newCorrects = newCorrects.filter(i => i !== index); else newCorrects.push(index);
    setFormData({ ...formData, corrects: newCorrects });
  };
  const addOption = () => setFormData({
    ...formData,
    options: [...formData.options, "Đáp án mới"],
    optionImages: [...(formData.optionImages || formData.options.map(() => '')), '']
  });
  const removeOption = (index) => {
    if (formData.options.length <= 2) return alert("Cần ít nhất 2 đáp án!");
    let newOptions = [...formData.options]; newOptions.splice(index, 1);
    let newImages = [...(formData.optionImages || formData.options.map(() => ''))]; newImages.splice(index, 1);
    if (formData.type === 'single' && formData.correct === index) {
      setFormData({ ...formData, options: newOptions, optionImages: newImages, correct: 0 });
    } else if (formData.type === 'multiselect') {
      let newCorrects = formData.corrects.filter(i => i !== index).map(i => i > index ? i - 1 : i);
      setFormData({ ...formData, options: newOptions, optionImages: newImages, corrects: newCorrects });
    } else {
      setFormData({ ...formData, options: newOptions, optionImages: newImages });
    }
  };

  // ===================== KÉO THẢ SẮP XẾP LẠI THỨ TỰ (dạng "order") =====================
  const moveOrderItem = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    let arr = [...formData.items];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setFormData({ ...formData, items: arr });
  };

  const handleOrderDragStart = (idx) => setDraggedIdx(idx);
  const handleOrderDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleOrderDragLeave = () => setDragOverIdx(null);
  const handleOrderDrop = (e, idx) => {
    e.preventDefault();
    if (draggedIdx !== null) moveOrderItem(draggedIdx, idx);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };
  const handleOrderDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); };

  // Nút mũi tên lên/xuống — phương án dự phòng cho ai khó kéo thả (mobile, trackpad...)
  const moveOrderUp = (idx) => { if (idx > 0) moveOrderItem(idx, idx - 1); };
  const moveOrderDown = (idx) => { if (idx < formData.items.length - 1) moveOrderItem(idx, idx + 1); };

  // Component 1 ô đáp án — input text + nút ảnh + preview, hỗ trợ paste ảnh
  const OptionEditRow = ({ idx, isChecked, inputEl, borderClass }) => {
    const optImg = (formData.optionImages || [])[idx];
    return (
      <div className={`border-2 rounded-xl mb-3 transition shadow-sm overflow-hidden ${borderClass}`}>
        <div className="flex items-center gap-3 p-3">
          {inputEl}
          <input
            type="text"
            className="flex-1 bg-transparent outline-none text-slate-700 font-semibold"
            value={(formData.options[idx] || '').replace(/<[^>]+>/g, '')}
            onChange={(e) => handleOptionTextChange(idx, e.target.value)}
            onPaste={(e) => handleOptionPaste(e, idx)}
            placeholder={`Đáp án ${idx + 1}... (dán ảnh được, Ctrl+V)`}
          />
          <Button
            variant="outline"
            type="button"
            title="Đính kèm ảnh cho đáp án này"
            onClick={() => optionFileRefs.current[idx]?.click()}
            className="h-10 w-10 p-0 text-sky-500 hover:text-white border-sky-200 hover:bg-sky-500 transition"
          ><ImageIcon className="h-4 w-4" /></Button>
          <input
            type="file" accept="image/*" className="hidden"
            ref={el => optionFileRefs.current[idx] = el}
            onChange={(e) => handleOptionImageUpload(e, idx)}
          />
          <Button variant="outline" onClick={() => removeOption(idx)} className="h-10 w-10 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 transition"><Trash2 className="h-4 w-4" /></Button>
        </div>
        {optImg && (
          <div className="px-3 pb-3 flex items-start gap-2">
            <img src={optImg} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-32 rounded-lg border border-slate-200 object-contain" />
            <Button variant="outline" onClick={() => removeOptionImage(idx)} className="text-red-400 hover:text-red-600 text-xs font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition mt-1 gap-1"><X className="h-3 w-3" /> Xóa ảnh</Button>
          </div>
        )}
      </div>
    );
  };

  let dynamicBody = null;

  if (formData.type === 'single') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Các Đáp Án (Chọn ô tròn để làm đáp án đúng — có thể dán ảnh)</label>
        {formData.options.map((opt, i) => (
          <OptionEditRow key={i} idx={i}
            borderClass={formData.correct === i ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}
            inputEl={<input type="radio" className="w-5 h-5 accent-green-600 flex-shrink-0" checked={formData.correct === i} onChange={() => handleSingleCorrectChange(i)} />}
          />
        ))}
        <Button variant="ghost" onClick={addOption} className="text-indigo-600 font-bold text-sm hover:underline hover:bg-indigo-50 mt-2 gap-2"><Plus className="h-4 w-4" /> Thêm đáp án nữa</Button>
      </div>
    );
  }
  else if (formData.type === 'multiselect') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Các Đáp Án (Tick chọn nhiều ô vuông — có thể dán ảnh)</label>
        {formData.options.map((opt, i) => {
          let isChecked = formData.corrects.includes(i);
          return (
            <OptionEditRow key={i} idx={i}
              borderClass={isChecked ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}
              inputEl={<input type="checkbox" className="w-5 h-5 accent-green-600 rounded flex-shrink-0" checked={isChecked} onChange={() => handleMultiCorrectChange(i)} />}
            />
          );
        })}
        <Button variant="ghost" onClick={addOption} className="text-indigo-600 font-bold text-sm hover:underline hover:bg-indigo-50 mt-2 gap-2"><Plus className="h-4 w-4" /> Thêm đáp án nữa</Button>
      </div>
    );
  }
  else if (formData.type === 'fill') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Đáp án đúng cần điền</label>
        <input type="text" className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-lg font-bold text-indigo-700"
          value={formData.answer || ''} onChange={(e) => setFormData({ ...formData, answer: e.target.value, answers: [e.target.value] })} />
      </div>
    );
  }
  // ===== SẮP XẾP — kéo thả để đổi thứ tự, kèm nút mũi tên dự phòng =====
  else if (formData.type === 'order') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
          Thứ Tự Đúng <span className="normal-case font-medium text-slate-400">— kéo thả 🟰 để sắp xếp lại, hoặc dùng nút ▲▼</span>
        </label>
        {formData.items.map((item, i) => {
          const isDragging = draggedIdx === i;
          const isDragOver = dragOverIdx === i && draggedIdx !== null && draggedIdx !== i;
          return (
            <div
              key={i}
              draggable
              onDragStart={() => handleOrderDragStart(i)}
              onDragOver={(e) => handleOrderDragOver(e, i)}
              onDragLeave={handleOrderDragLeave}
              onDrop={(e) => handleOrderDrop(e, i)}
              onDragEnd={handleOrderDragEnd}
              className={`flex gap-3 mb-3 items-center p-2 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing
                ${isDragging ? 'opacity-40 border-indigo-300 bg-indigo-50' : 'border-transparent'}
                ${isDragOver ? 'border-indigo-400 bg-indigo-50 -translate-y-0.5' : ''}`}
            >
              <span className="text-slate-300 select-none text-lg font-bold px-1" title="Kéo để sắp xếp">⠿</span>
              <span className="font-bold text-white bg-indigo-500 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0">{i + 1}</span>
              <input
                type="text"
                className="flex-1 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700"
                value={item}
                onChange={(e) => { let arr = [...formData.items]; arr[i] = e.target.value; setFormData({ ...formData, items: arr }); }}
              />
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => moveOrderUp(i)} disabled={i === 0}
                  className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed font-bold leading-none px-1.5 py-0.5 hover:bg-indigo-50 rounded transition">▲</button>
                <button type="button" onClick={() => moveOrderDown(i)} disabled={i === formData.items.length - 1}
                  className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed font-bold leading-none px-1.5 py-0.5 hover:bg-indigo-50 rounded transition">▼</button>
              </div>
              <Button variant="outline" onClick={() => {
                if (formData.items.length > 2) { let arr = [...formData.items]; arr.splice(i, 1); setFormData({ ...formData, items: arr }); }
                else alert("Cần tối thiểu 2 mục");
              }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-2 h-auto"><Trash2 className="h-5 w-5" /></Button>
            </div>
          );
        })}
        <Button variant="ghost" onClick={() => setFormData({ ...formData, items: [...formData.items, ""] })} className="text-indigo-600 font-bold text-sm hover:underline mt-2 gap-2 hover:bg-indigo-50"><Plus className="h-4 w-4"/> Thêm mục</Button>
      </div>
    );
  }
  // ===== GHÉP CẶP 1-1 — sửa trực tiếp các cặp, có thể để trống vế phải =====
  else if (formData.type === 'drag') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
          Các Cặp Ghép Tương Ứng <span className="normal-case font-medium text-slate-400">— để trống "vế trái" nếu là đáp án nhiễu, để trống "vế phải" nếu câu hỏi đó không cần đáp án</span>
        </label>
        {formData.pairs.map((p, i) => (
          <div key={i} className="flex gap-4 mb-3">
            <input type="text" className="flex-1 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold bg-white shadow-sm"
              placeholder="Vế trái cố định — để trống nếu là đáp án nhiễu..." value={p.left}
              onChange={(e) => { let arr = formData.pairs.map(x => ({ ...x })); arr[i].left = e.target.value; setFormData({ ...formData, pairs: arr }); }} />
            <input type="text" className="flex-1 p-3 border-2 border-emerald-200 bg-emerald-50 rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700 shadow-sm"
              placeholder="Vế phải (Kéo thả) — để trống nếu không cần..." value={p.right}
              onChange={(e) => { let arr = formData.pairs.map(x => ({ ...x })); arr[i].right = e.target.value; setFormData({ ...formData, pairs: arr }); }} />
            <Button variant="outline" onClick={() => {
              if (formData.pairs.length > 2) { let arr = [...formData.pairs]; arr.splice(i, 1); setFormData({ ...formData, pairs: arr }); }
              else alert('Cần tối thiểu 2 cặp!');
            }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-3 h-auto rounded-xl"><Trash2 className="h-5 w-5" /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setFormData({ ...formData, pairs: [...formData.pairs, { left: '', right: '' }] })}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"><Plus className="h-4 w-4"/> Thêm cặp nữa</Button>
      </div>
    );
  }
  else {
    dynamicBody = <div className="mt-6 border-t pt-6 text-center text-amber-600 font-bold bg-amber-50 p-4 rounded-xl border border-amber-200">🚧 Vui lòng sử dụng tính năng xóa và tạo mới cho các dạng kéo thả.</div>;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 m-0 flex items-center gap-2"><Pencil className="h-6 w-6 text-indigo-500" /> Sửa Câu Hỏi</h2>
            <select className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-2 px-3 rounded-lg outline-none cursor-pointer" value={formData.type} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="single">Trắc nghiệm 1 Đ.Án</option><option value="multiselect">Trắc nghiệm Nhiều Đ.Án</option>
              <option value="fill">Điền từ (___)</option><option value="truefalse">Đúng / Sai</option>
              <option value="drag">Ghép cặp 1-1</option><option value="groupdrag">Phân loại Nhóm</option>
              <option value="clozedrag">Kéo thả Đoạn văn</option><option value="order">Sắp xếp</option>
            </select>
          </div>
          <div className="flex items-center gap-2"><span className="text-slate-500 font-bold text-sm">Trọng số:</span><input type="number" min="1" className="w-16 p-2 text-center border-2 border-slate-200 rounded-lg font-bold outline-none focus:border-indigo-500" value={formData.points} onChange={(e) => setFormData({ ...formData, points: parseFloat(e.target.value) || 1 })} /></div>
        </div>
        <div className="p-8 overflow-y-auto flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nội Dung Đề Bài <span className="normal-case font-medium text-slate-400">— dán ảnh được, Ctrl+V</span></label>
          <textarea
            className="w-full h-32 p-4 border-2 border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none text-base resize-y font-medium text-slate-700 leading-relaxed"
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            onPaste={handleQuestionPaste}
          />
          <div className="flex items-center gap-3 mt-3">
            <Button variant="outline" onClick={() => questionFileRef.current.click()}
              className="text-sky-600 border-sky-200 hover:bg-sky-50 font-bold gap-2">
              <ImageIcon className="h-4 w-4" /> Đính kèm ảnh đề bài
            </Button>
            <input type="file" accept="image/*" className="hidden" ref={questionFileRef} onChange={handleQuestionImageUpload} />
            {formData.image && (
              <Button variant="outline" onClick={removeQuestionImage} className="text-red-500 hover:text-white font-bold border-red-200 hover:bg-red-500 gap-2"><Trash2 className="h-4 w-4" /> Xóa ảnh</Button>
            )}
          </div>
          {formData.image && (
            <div className="mt-3 p-2 border-2 border-dashed border-slate-300 rounded-xl inline-block bg-slate-50">
              <img src={formData.image} alt="Ảnh đề bài" className="max-w-full max-h-64 rounded-lg" />
            </div>
          )}

          {dynamicBody}
        </div>
        <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="px-6 font-bold text-slate-600 border-slate-300 hover:bg-slate-100">Hủy Bỏ</Button>
          <Button onClick={() => {
            if (formData.type === 'drag') {
              if (formData.pairs.some(p => !p.left.trim() && !p.right.trim())) return alert('⚠️ Mỗi dòng phải có ít nhất một trong hai vế (trái hoặc phải)!');
              if (formData.pairs.filter(p => p.right.trim()).length < 2) return alert('⚠️ Cần ít nhất 2 vế phải (đáp án) để học sinh có thể kéo thả!');
              if (formData.pairs.filter(p => p.left.trim()).length < 1) return alert('⚠️ Cần ít nhất 1 vế trái (câu hỏi) để ghép!');
            }
            onSave(formData);
          }} className="px-8 font-black shadow-md gap-2"><Save className="h-5 w-5" /> Lưu Lại Thay Đổi</Button>
        </div>
      </div>
    </div>
  );
}
