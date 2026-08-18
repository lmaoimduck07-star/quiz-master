import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Trash2, Plus, Pencil, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';

// Component OptionEditRow được định nghĩa NGOÀI component chính
// để tránh bị tạo lại mỗi lần render (gây mất focus input)
const OptionEditRow = ({ idx, isChecked, inputEl, borderClass, optImg, optionText, onTextChange, onPaste, onImageClick, onRemoveOption, onRemoveImage }) => {
  return (
    <div className={`border-2 rounded-xl mb-3 transition shadow-sm overflow-hidden ${borderClass}`}>
      <div className="flex items-center gap-3 p-3">
        {inputEl}
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-slate-700 font-semibold"
          value={(optionText || '').replace(/<[^>]+>/g, '')}
          onChange={(e) => onTextChange(idx, e.target.value)}
          onPaste={(e) => onPaste(e, idx)}
          placeholder={`Đáp án ${idx + 1}... (dán ảnh được, Ctrl+V)`}
        />
        <Button
          variant="outline"
          type="button"
          title="Đính kèm ảnh cho đáp án này"
          onClick={() => onImageClick(idx)}
          className="h-10 w-10 p-0 text-sky-500 hover:text-white border-sky-200 hover:bg-sky-500 transition"
        ><ImageIcon className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => onRemoveOption(idx)} className="h-10 w-10 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 transition"><Trash2 className="h-4 w-4" /></Button>
      </div>
      {optImg && (
        <div className="px-3 pb-3 flex items-start gap-2">
          <img src={optImg} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-32 rounded-lg border border-slate-200 object-contain" />
          <Button variant="outline" onClick={() => onRemoveImage(idx)} className="text-red-400 hover:text-red-600 text-xs font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition mt-1 gap-1"><X className="h-3 w-3" /> Xóa ảnh</Button>
        </div>
      )}
    </div>
  );
};

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
    if (formData.options.length <= 2) return alert("Cần ít nhất 2 đáp án! (Mã lỗi: QST-11)");
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

  let dynamicBody = null;

  if (formData.type === 'single') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Các Đáp Án (Chọn ô tròn để làm đáp án đúng — có thể dán ảnh)</label>
        {/* file inputs riêng, ẩn */}
        {formData.options.map((_, i) => (
          <input key={`file-${i}`} type="file" accept="image/*" className="hidden"
            ref={el => optionFileRefs.current[i] = el}
            onChange={(e) => handleOptionImageUpload(e, i)}
          />
        ))}
        {formData.options.map((opt, i) => (
          <OptionEditRow key={i} idx={i}
            borderClass={formData.correct === i ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}
            optionText={formData.options[i]}
            optImg={(formData.optionImages || [])[i]}
            onTextChange={handleOptionTextChange}
            onPaste={handleOptionPaste}
            onImageClick={(idx) => optionFileRefs.current[idx]?.click()}
            onRemoveOption={removeOption}
            onRemoveImage={removeOptionImage}
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
        {/* file inputs riêng, ẩn */}
        {formData.options.map((_, i) => (
          <input key={`file-${i}`} type="file" accept="image/*" className="hidden"
            ref={el => optionFileRefs.current[i] = el}
            onChange={(e) => handleOptionImageUpload(e, i)}
          />
        ))}
        {formData.options.map((opt, i) => {
          let isChecked = formData.corrects.includes(i);
          return (
            <OptionEditRow key={i} idx={i}
              borderClass={isChecked ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}
              optionText={formData.options[i]}
              optImg={(formData.optionImages || [])[i]}
              onTextChange={handleOptionTextChange}
              onPaste={handleOptionPaste}
              onImageClick={(idx) => optionFileRefs.current[idx]?.click()}
              onRemoveOption={removeOption}
              onRemoveImage={removeOptionImage}
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
                else alert("Cần tối thiểu 2 mục (Mã lỗi: QST-10)");
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
              else alert('Cần tối thiểu 2 cặp! (Mã lỗi: QST-12)');
            }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-3 h-auto rounded-xl"><Trash2 className="h-5 w-5" /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setFormData({ ...formData, pairs: [...formData.pairs, { left: '', right: '' }] })}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"><Plus className="h-4 w-4"/> Thêm cặp nữa</Button>
      </div>
    );
  }
  // ===== ĐÚNG / SAI — toggle chọn đáp án đúng =====
  else if (formData.type === 'truefalse') {
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">
          Đáp Án Đúng Của Câu Hỏi Này
        </label>
        <div className="grid grid-cols-2 gap-4">
          {/* Nút ĐÚNG */}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, correct: true })}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 font-black text-lg transition-all duration-150 ${
              formData.correct === true
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md scale-[1.02]'
                : 'border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-500'
            }`}
          >
            <span className="text-4xl">{formData.correct === true ? '✅' : '⬜'}</span>
            <span>ĐÚNG</span>
            {formData.correct === true && (
              <span className="text-xs font-bold bg-emerald-500 text-white px-3 py-0.5 rounded-full">Đáp án được chọn</span>
            )}
          </button>

          {/* Nút SAI */}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, correct: false })}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 font-black text-lg transition-all duration-150 ${
              formData.correct === false
                ? 'border-red-500 bg-red-50 text-red-700 shadow-md scale-[1.02]'
                : 'border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:bg-red-50/50 hover:text-red-500'
            }`}
          >
            <span className="text-4xl">{formData.correct === false ? '❌' : '⬜'}</span>
            <span>SAI</span>
            {formData.correct === false && (
              <span className="text-xs font-bold bg-red-500 text-white px-3 py-0.5 rounded-full">Đáp án được chọn</span>
            )}
          </button>
        </div>

        {/* Hiển thị đáp án hiện tại */}
        <div className={`mt-4 p-3 rounded-xl text-sm font-bold text-center ${
          formData.correct === true
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          Đáp án hiện tại: <strong>{formData.correct === true ? '✅ ĐÚNG' : '❌ SAI'}</strong>
        </div>
      </div>
    );
  }
  // ===== PHÂN LOẠI NHÓM — sửa tên nhóm và danh sách items =====
  else if (formData.type === 'groupdrag') {
    // Đảm bảo groups tồn tại với format đúng
    const groups = (formData.groups || []).map(g => ({
      groupName: g.groupName ?? g.name ?? '',
      items: Array.isArray(g.items) ? g.items : [],
    }));
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest">
          Các Nhóm Phân Loại <span className="normal-case font-medium text-slate-400">— chỉnh tên nhóm và thêm/xóa từng item</span>
        </label>
        {groups.map((g, gi) => (
          <div key={gi} className="bg-slate-50 p-4 border-2 border-slate-200 rounded-2xl mb-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-black text-white bg-indigo-500 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 text-sm">{gi + 1}</span>
              <input
                type="text"
                className="flex-1 p-3 border-2 border-indigo-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-700 bg-white shadow-sm"
                placeholder={`Tên nhóm ${gi + 1}...`}
                value={g.groupName}
                onChange={(e) => {
                  const arr = groups.map(x => ({ ...x, items: [...x.items] }));
                  arr[gi].groupName = e.target.value;
                  setFormData({ ...formData, groups: arr });
                }}
              />
              {groups.length > 2 && (
                <Button variant="outline" onClick={() => {
                  const arr = groups.filter((_, i) => i !== gi);
                  setFormData({ ...formData, groups: arr });
                }} className="text-red-500 hover:text-white bg-white hover:bg-red-500 border border-red-200 font-bold gap-1 px-3">
                  <Trash2 className="h-4 w-4" /> Xóa
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 mb-2">
              {g.items.map((item, ii) => (
                <div key={ii} className="flex gap-2 items-center">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">{ii + 1}.</span>
                  <input
                    type="text"
                    className="flex-1 p-2.5 border-2 border-emerald-200 bg-emerald-50 rounded-xl outline-none focus:border-emerald-500 font-semibold text-emerald-800 text-sm shadow-sm"
                    value={item}
                    placeholder="Nội dung item..."
                    onChange={(e) => {
                      const arr = groups.map(x => ({ ...x, items: [...x.items] }));
                      arr[gi].items[ii] = e.target.value;
                      setFormData({ ...formData, groups: arr });
                    }}
                  />
                  <Button variant="outline" onClick={() => {
                    const arr = groups.map(x => ({ ...x, items: [...x.items] }));
                    arr[gi].items.splice(ii, 1);
                    setFormData({ ...formData, groups: arr });
                  }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-2 h-auto rounded-xl">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" onClick={() => {
              const arr = groups.map(x => ({ ...x, items: [...x.items] }));
              arr[gi].items.push('');
              setFormData({ ...formData, groups: arr });
            }} className="text-emerald-600 hover:bg-emerald-50 font-bold text-sm gap-1 mt-1">
              <Plus className="h-4 w-4" /> Thêm item
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => {
          const arr = [...groups.map(x => ({ ...x, items: [...x.items] })), { groupName: '', items: [] }];
          setFormData({ ...formData, groups: arr });
        }} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-1 gap-2">
          <Plus className="h-4 w-4" /> Thêm nhóm mới
        </Button>
      </div>
    );
  }
  // ===== KÉO VÀO ĐOẠN VĂN — sửa câu hỏi + danh sách đáp án theo thứ tự =====
  else if (formData.type === 'clozedrag') {
    const answers = formData.answers || [];
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest">
          Từ Khóa Đáp Án <span className="normal-case font-medium text-slate-400">— theo thứ tự [1][2][3] trong đề bài</span>
        </label>
        {answers.map((w, i) => (
          <div key={i} className="flex gap-3 mb-3 items-center">
            <span className="font-bold text-white bg-teal-500 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0">
              {i + 1}
            </span>
            <input
              type="text"
              className="flex-1 p-3 border-2 border-teal-200 bg-teal-50 rounded-xl outline-none focus:border-teal-500 font-bold text-teal-800 shadow-sm"
              value={w}
              placeholder={`Từ điền vào chỗ ${i + 1}...`}
              onChange={(e) => {
                const arr = [...answers]; arr[i] = e.target.value;
                setFormData({ ...formData, answers: arr });
              }}
            />
            <Button variant="outline" onClick={() => {
              const arr = answers.filter((_, idx) => idx !== i);
              setFormData({ ...formData, answers: arr });
            }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-3 h-auto rounded-xl">
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setFormData({ ...formData, answers: [...answers, ''] })}
          className="text-teal-600 border-teal-200 hover:bg-teal-50 font-bold mt-2 gap-2">
          <Plus className="h-4 w-4" /> Thêm từ khóa
        </Button>
      </div>
    );
  }
  // ===== ĐÚNG/SAI NHIỀU PHÁT BIỂU — sửa từng phát biểu + toggle đúng/sai =====
  else if (formData.type === 'multitruefalse') {
    const stmts = formData.statements || [];
    dynamicBody = (
      <div className="mt-6 border-t pt-6">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest">
          Các Phát Biểu <span className="normal-case font-medium text-slate-400">— tối đa 4 phát biểu, chọn Đúng/Sai cho từng phát biểu</span>
        </label>
        {stmts.map((stmt, i) => (
          <div key={i} className="flex gap-3 mb-3 items-center">
            <span className="font-bold text-white bg-violet-500 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 text-sm">{i + 1}</span>
            <input
              type="text"
              className="flex-1 p-3 border-2 border-slate-200 bg-white rounded-xl outline-none focus:border-violet-500 font-semibold text-slate-700 shadow-sm"
              placeholder={`Nội dung phát biểu ${i + 1}...`}
              value={stmt.text}
              onChange={(e) => {
                const arr = stmts.map(s => ({ ...s })); arr[i].text = e.target.value;
                setFormData({ ...formData, statements: arr });
              }}
            />
            <div className="flex rounded-xl overflow-hidden border-2 border-slate-200 flex-shrink-0">
              <button
                type="button"
                onClick={() => { const arr = stmts.map(s => ({ ...s })); arr[i].correct = true; setFormData({ ...formData, statements: arr }); }}
                className={`px-4 py-2 font-bold text-sm transition ${stmt.correct ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 hover:bg-emerald-50'}`}
              >Đúng</button>
              <button
                type="button"
                onClick={() => { const arr = stmts.map(s => ({ ...s })); arr[i].correct = false; setFormData({ ...formData, statements: arr }); }}
                className={`px-4 py-2 font-bold text-sm transition ${!stmt.correct ? 'bg-red-500 text-white' : 'bg-white text-slate-500 hover:bg-red-50'}`}
              >Sai</button>
            </div>
            {stmts.length > 2 && (
              <Button variant="outline" onClick={() => {
                const arr = stmts.filter((_, idx) => idx !== i);
                setFormData({ ...formData, statements: arr });
              }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-3 h-auto rounded-xl flex-shrink-0">
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        ))}
        {stmts.length < 4 && (
          <Button variant="outline" onClick={() => setFormData({ ...formData, statements: [...stmts, { text: '', correct: true }] })}
            className="text-violet-600 border-violet-200 hover:bg-violet-50 font-bold mt-2 gap-2">
            <Plus className="h-4 w-4" /> Thêm phát biểu
          </Button>
        )}
      </div>
    );
  }
  else {
    dynamicBody = null;
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
              if (formData.pairs.some(p => !p.left.trim() && !p.right.trim())) return alert('⚠️ Mỗi dòng phải có ít nhất một trong hai vế (trái hoặc phải)! (Mã lỗi: QST-05)');
              if (formData.pairs.filter(p => p.right.trim()).length < 2) return alert('⚠️ Cần ít nhất 2 vế phải (đáp án) để học sinh có thể kéo thả! (Mã lỗi: QST-06)');
              if (formData.pairs.filter(p => p.left.trim()).length < 1) return alert('⚠️ Cần ít nhất 1 vế trái (câu hỏi) để ghép! (Mã lỗi: QST-07)');
            }
            if (formData.type === 'groupdrag') {
              const gs = (formData.groups || []);
              if (gs.length < 2) return alert('⚠️ Cần ít nhất 2 nhóm! (Mã lỗi: QST-08)');
              if (gs.some(g => !(g.groupName ?? g.name ?? '').trim())) return alert('⚠️ Vui lòng nhập tên cho tất cả các nhóm! (Mã lỗi: QST-08b)');
              if (gs.some(g => (g.items || []).length === 0)) return alert('⚠️ Mỗi nhóm cần có ít nhất 1 item! (Mã lỗi: QST-08c)');
              // Normalize groupName vs name field
              const normalized = gs.map(g => ({ groupName: (g.groupName ?? g.name ?? '').trim(), items: g.items }));
              setFormData(prev => ({ ...prev, groups: normalized }));
            }
            if (formData.type === 'multitruefalse') {
              const ss = (formData.statements || []).filter(s => s.text.trim());
              if (ss.length < 2) return alert('⚠️ Cần ít nhất 2 phát biểu! (Mã lỗi: QST-12)');
              if (ss.length > 4) return alert('⚠️ Tối đa 4 phát biểu! (Mã lỗi: QST-13)');
            }
            onSave(formData);
          }} className="px-8 font-black shadow-md gap-2"><Save className="h-5 w-5" /> Lưu Lại Thay Đổi</Button>
        </div>
      </div>
    </div>
  );
}
