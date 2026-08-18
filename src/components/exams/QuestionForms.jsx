// src/components/QuestionForms.jsx
import { useState, useRef } from 'react';
import { Image as ImageIcon, Trash2, Plus, HelpCircle, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';

// ─── Đặt OptionRow ở ngoài component QuestionForms để tránh tạo lại hàm khi render, không bị mất focus ───
const OptionRow = ({
  idx,
  isChecked,
  inputEl,
  borderClass,
  option,
  onTextChange,
  onPaste,
  onImageClick,
  onRemoveOption,
  onRemoveImage,
  fileInputRef,
  onImageUpload,
}) => (
  <div className={`border-2 rounded-xl mb-3 transition shadow-sm overflow-hidden ${borderClass}`}>
    {/* Hàng text */}
    <div className="flex items-center gap-3 p-3">
      {inputEl}
      <input
        type="text"
        className="flex-1 bg-transparent outline-none text-slate-700 dark:text-slate-200 font-semibold"
        placeholder={`Nhập đáp án ${idx + 1}... (dán ảnh được)`}
        value={option?.text || ''}
        onPaste={(e) => onPaste(e, idx)}
        onChange={(e) => onTextChange(idx, e.target.value)}
      />
      {/* Nút upload ảnh đáp án */}
      <Button
        variant="outline"
        type="button"
        title="Đính kèm ảnh cho đáp án này"
        onClick={() => onImageClick(idx)}
        className="h-10 w-10 p-0 text-sky-500 hover:text-white border-sky-200 hover:bg-sky-500 transition"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => onImageUpload(e, idx)}
      />
      <Button
        variant="outline"
        type="button"
        onClick={() => onRemoveOption(idx)}
        className="h-10 w-10 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 transition"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>

    {/* Preview ảnh đáp án (nếu có) */}
    {option?.image && (
      <div className="px-3 pb-3 flex items-start gap-2">
        <img
          src={option.image}
          alt={`Ảnh đáp án ${idx + 1}`}
          className="max-h-32 rounded-lg border border-slate-200 object-contain"
        />
        <button
          type="button"
          onClick={() => onRemoveImage(idx)}
          className="text-red-400 hover:text-red-600 text-xs font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition mt-1 flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Xóa ảnh
        </button>
      </div>
    )}
  </div>
);

export default function QuestionForms({ onAddQuestion }) {
  const [currentType, setCurrentType] = useState('single');
  const [points, setPoints] = useState(1);
  const [qText, setQText] = useState('');
  const [imageBox, setImageBox] = useState('');
  const fileInputRef = useRef(null);

  // Mỗi đáp án giờ là { text, image } thay vì chỉ string
  const [options, setOptions] = useState([
    { text: '', image: '' }, { text: '', image: '' },
    { text: '', image: '' }, { text: '', image: '' }
  ]);
  const [singleCorrect, setSingleCorrect] = useState(0);
  const [multiCorrects, setMultiCorrects] = useState([0]);

  const [fillAnswer, setFillAnswer] = useState('');
  const [tfCorrect, setTfCorrect] = useState(true);
  const [pairs, setPairs] = useState([{ left: '', right: '' }, { left: '', right: '' }]);
  const [groups, setGroups] = useState([{ name: '', itemsStr: '' }, { name: '', itemsStr: '' }]);
  const [clozeWords, setClozeWords] = useState(['', '']);
  const [orderItems, setOrderItems] = useState(['', '', '']);
  const [mtfStatements, setMtfStatements] = useState([
    { text: '', correct: true },
    { text: '', correct: false },
  ]);

  // Refs cho upload ảnh từng đáp án
  const optionFileRefs = useRef([]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImageBox(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleQuestionPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = (ev) => setImageBox(ev.target.result);
        reader.readAsDataURL(item.getAsFile());
        break;
      }
    }
  };

  const handleOptionImageUpload = (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newOpts = [...options];
      newOpts[idx] = { ...newOpts[idx], image: ev.target.result };
      setOptions(newOpts);
    };
    reader.readAsDataURL(file);
  };

  const handleOptionPaste = (e, idx) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = (ev) => {
          const newOpts = [...options];
          newOpts[idx] = { ...newOpts[idx], image: ev.target.result };
          setOptions(newOpts);
        };
        reader.readAsDataURL(item.getAsFile());
        break;
      }
    }
  };

  const removeOptionImage = (idx) => {
    const newOpts = [...options];
    newOpts[idx] = { ...newOpts[idx], image: '' };
    setOptions(newOpts);
    if (optionFileRefs.current[idx]) optionFileRefs.current[idx].value = '';
  };

  const removeImage = () => {
    setImageBox('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOptionTextChange = (idx, text) => {
    const newOpts = [...options];
    newOpts[idx] = { ...newOpts[idx], text };
    setOptions(newOpts);
  };

  const handleRemoveOption = (idx) => {
    if (options.length > 2) {
      const newOpts = [...options];
      newOpts.splice(idx, 1);
      setOptions(newOpts);
      if (singleCorrect === idx) setSingleCorrect(0);
      else if (singleCorrect > idx) setSingleCorrect(p => p - 1);
      setMultiCorrects(prev => prev.filter(x => x !== idx).map(x => (x > idx ? x - 1 : x)));
    } else {
      alert('Cần tối thiểu 2 đáp án! (Mã lỗi: QST-11)');
    }
  };

  const handleSaveQuestion = () => {
    if (!qText.trim() && !imageBox) return alert('⚠️ Vui lòng nhập nội dung đề bài hoặc đính kèm ảnh!');

    let newQuestion = {
      id: Date.now().toString(),
      type: currentType,
      points: points,
      question: qText.trim(),
      image: imageBox,
    };

    if (currentType === 'single') {
      const validOptions = options.map(o => o.text.trim()).filter((t, i) => t !== '' || options[i].image);
      if (validOptions.length < 2) return alert('⚠️ Cần ít nhất 2 đáp án! (Mã lỗi: QST-01)');
      newQuestion.options = options.map(o => o.text.trim());
      newQuestion.optionImages = options.map(o => o.image || '');
      newQuestion.answer = singleCorrect;
    }
    else if (currentType === 'multiselect') {
      const validOptions = options.map(o => o.text.trim()).filter((t, i) => t !== '' || options[i].image);
      if (validOptions.length < 2) return alert('⚠️ Cần ít nhất 2 đáp án! (Mã lỗi: QST-02)');
      if (multiCorrects.length === 0) return alert('⚠️ Phải chọn ít nhất 1 đáp án đúng! (Mã lỗi: QST-03)');
      newQuestion.options = options.map(o => o.text.trim());
      newQuestion.optionImages = options.map(o => o.image || '');
      newQuestion.corrects = multiCorrects;
    }
    else if (currentType === 'fill') {
      if (!fillAnswer.trim()) return alert('⚠️ Chưa nhập đáp án đúng! (Mã lỗi: QST-04)');
      newQuestion.answer = fillAnswer.trim();
    }
    else if (currentType === 'truefalse') {
      newQuestion.correct = tfCorrect;
    }
    else if (currentType === 'drag') {
      const validPairs = pairs.filter(p => p.left.trim() !== '' || p.right.trim() !== '');
      if (validPairs.length < 2) return alert('⚠️ Cần ít nhất 2 cặp ghép! (Mã lỗi: QST-05)');
      newQuestion.pairs = validPairs.map(p => ({ left: p.left.trim(), right: p.right.trim() }));
    }
    else if (currentType === 'groupdrag') {
      const validGroups = groups.filter(g => g.name.trim() !== '');
      if (validGroups.length < 2) return alert('⚠️ Cần ít nhất 2 nhóm! (Mã lỗi: QST-06)');
      newQuestion.groups = validGroups.map(g => ({
        name: g.name.trim(),
        items: g.itemsStr.split(',').map(s => s.trim()).filter(Boolean)
      }));
    }
    else if (currentType === 'clozedrag') {
      const validWords = clozeWords.map(w => w.trim()).filter(Boolean);
      if (validWords.length === 0) return alert('⚠️ Chưa nhập từ khóa đáp án! (Mã lỗi: QST-07)');
      newQuestion.answers = validWords;
    }
    else if (currentType === 'order') {
      const validItems = orderItems.map(i => i.trim()).filter(Boolean);
      if (validItems.length < 2) return alert('⚠️ Cần ít nhất 2 mục! (Mã lỗi: QST-08)');
      newQuestion.items = validItems;
    }
    else if (currentType === 'multitruefalse') {
      const validStmts = mtfStatements.filter(s => s.text.trim() !== '');
      if (validStmts.length < 2) return alert('⚠️ Cần ít nhất 2 phát biểu! (Mã lỗi: QST-12)');
      if (validStmts.length > 4) return alert('⚠️ Tối đa 4 phát biểu! (Mã lỗi: QST-13)');
      newQuestion.statements = validStmts.map(s => ({ text: s.text.trim(), correct: s.correct }));
    }

    onAddQuestion(newQuestion);

    setQText(''); removeImage();
    setOptions([{ text: '', image: '' }, { text: '', image: '' }, { text: '', image: '' }, { text: '', image: '' }]);
    setSingleCorrect(0); setMultiCorrects([0]);
    setFillAnswer('');
    setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
    setGroups([{ name: '', itemsStr: '' }, { name: '', itemsStr: '' }]);
    setClozeWords(['', '']); setOrderItems(['', '', '']);
    setMtfStatements([{ text: '', correct: true }, { text: '', correct: false }]);
    alert('✅ Đã thêm câu hỏi vào đề!');
  };

  let dynamicForm = null;

  if (currentType === 'single') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          Các Đáp Án (Chọn ô tròn làm đáp án đúng — có thể thêm ảnh)
        </label>
        {options.map((opt, i) => (
          <OptionRow
            key={i}
            idx={i}
            option={opt}
            isChecked={singleCorrect === i}
            borderClass={singleCorrect === i ? 'border-green-500 bg-green-50/70 dark:bg-green-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300'}
            inputEl={
              <input
                type="radio"
                name="single-correct-choice"
                className="w-5 h-5 accent-green-600 cursor-pointer flex-shrink-0"
                checked={singleCorrect === i}
                onChange={() => setSingleCorrect(i)}
              />
            }
            onTextChange={handleOptionTextChange}
            onPaste={handleOptionPaste}
            onImageClick={(idx) => optionFileRefs.current[idx]?.click()}
            onRemoveOption={handleRemoveOption}
            onRemoveImage={removeOptionImage}
            fileInputRef={(el) => (optionFileRefs.current[i] = el)}
            onImageUpload={handleOptionImageUpload}
          />
        ))}
        <Button
          type="button"
          onClick={() => setOptions([...options, { text: '', image: '' }])}
          variant="outline"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"
        >
          <Plus className="h-4 w-4" /> Thêm đáp án nữa
        </Button>
      </div>
    );
  }
  else if (currentType === 'multiselect') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          Các Đáp Án (Tick NHIỀU ô vuông — có thể thêm ảnh)
        </label>
        {options.map((opt, i) => {
          const isChecked = multiCorrects.includes(i);
          return (
            <OptionRow
              key={i}
              idx={i}
              option={opt}
              isChecked={isChecked}
              borderClass={isChecked ? 'border-green-500 bg-green-50/70 dark:bg-green-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300'}
              inputEl={
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-green-600 cursor-pointer rounded flex-shrink-0"
                  checked={isChecked}
                  onChange={() => {
                    let newArr = [...multiCorrects];
                    if (newArr.includes(i)) newArr = newArr.filter(x => x !== i);
                    else newArr.push(i);
                    setMultiCorrects(newArr);
                  }}
                />
              }
              onTextChange={handleOptionTextChange}
              onPaste={handleOptionPaste}
              onImageClick={(idx) => optionFileRefs.current[idx]?.click()}
              onRemoveOption={handleRemoveOption}
              onRemoveImage={removeOptionImage}
              fileInputRef={(el) => (optionFileRefs.current[i] = el)}
              onImageUpload={handleOptionImageUpload}
            />
          );
        })}
        <Button
          type="button"
          onClick={() => setOptions([...options, { text: '', image: '' }])}
          variant="outline"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"
        >
          <Plus className="h-4 w-4" /> Thêm đáp án nữa
        </Button>
      </div>
    );
  }
  else if (currentType === 'fill') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          ĐÁP ÁN ĐÚNG CẦN ĐIỀN VÀO CHỖ TRỐNG ___
        </label>
        <input
          type="text"
          className="w-full p-4 border-2 border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-lg font-bold text-indigo-700 bg-indigo-50 focus:bg-white transition shadow-sm"
          placeholder="Ví dụ: 10, Windows, v.v..."
          value={fillAnswer}
          onChange={(e) => setFillAnswer(e.target.value)}
        />
      </div>
    );
  }
  else if (currentType === 'truefalse') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          NHẬN ĐỊNH TRÊN LÀ:
        </label>
        <select
          className="w-full p-4 border-2 border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-lg font-bold text-indigo-700 bg-indigo-50 cursor-pointer transition shadow-sm"
          value={tfCorrect.toString()}
          onChange={(e) => setTfCorrect(e.target.value === 'true')}
        >
          <option value="true">ĐÚNG</option>
          <option value="false">SAI</option>
        </select>
      </div>
    );
  }
  else if (currentType === 'drag') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          TẠO CÁC CẶP GHÉP TƯƠNG ỨNG
        </label>
        <p className="text-xs text-slate-400 mb-3 -mt-2">
          💡 Để trống "Vế trái" nếu đó là đáp án nhiễu (không cần khớp với câu hỏi nào). Để trống "Vế phải" nếu câu hỏi đó không cần đáp án.
        </p>
        {pairs.map((p, i) => (
          <div key={i} className="flex gap-4 mb-3">
            <input
              type="text"
              className="flex-1 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold bg-white shadow-sm"
              placeholder="Vế trái cố định — để trống nếu là đáp án nhiễu..."
              value={p.left}
              onChange={(e) => {
                let arr = [...pairs];
                arr[i].left = e.target.value;
                setPairs(arr);
              }}
            />
            <input
              type="text"
              className="flex-1 p-3 border-2 border-emerald-200 bg-emerald-50 rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700 shadow-sm"
              placeholder="Vế phải (Kéo thả) — để trống nếu không cần..."
              value={p.right}
              onChange={(e) => {
                let arr = [...pairs];
                arr[i].right = e.target.value;
                setPairs(arr);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (pairs.length > 2) {
                  let arr = [...pairs];
                  arr.splice(i, 1);
                  setPairs(arr);
                } else alert('Cần tối thiểu 2 cặp! (Mã lỗi: QST-12)');
              }}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-3 rounded-xl border-transparent hover:border-red-200 h-auto"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setPairs([...pairs, { left: '', right: '' }])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"
        >
          <Plus className="h-4 w-4" /> Thêm cặp nữa
        </Button>
      </div>
    );
  }
  else if (currentType === 'groupdrag') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          TẠO CÁC NHÓM VÀ TỪ KHÓA
        </label>
        {groups.map((g, i) => (
          <div key={i} className="bg-slate-50 dark:bg-slate-800/40 p-5 border border-slate-200 dark:border-slate-700 rounded-xl mb-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="text"
                className="flex-1 p-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 font-bold text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900"
                placeholder={`Tên Nhóm ${i + 1}...`}
                value={g.name}
                onChange={(e) => {
                  let arr = [...groups];
                  arr[i].name = e.target.value;
                  setGroups(arr);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (groups.length > 2) {
                    let arr = [...groups];
                    arr.splice(i, 1);
                    setGroups(arr);
                  } else alert('Cần tối thiểu 2 nhóm! (Mã lỗi: QST-13)');
                }}
                className="text-red-500 hover:text-white bg-white hover:bg-red-500 border border-red-200 font-bold gap-2"
              >
                <Trash2 className="h-4 w-4" /> Xóa nhóm
              </Button>
            </div>
            <textarea
              className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 font-medium resize-y bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              rows="2"
              placeholder="Các từ khóa thuộc nhóm này (Cách nhau bằng dấu phẩy)..."
              value={g.itemsStr}
              onChange={(e) => {
                let arr = [...groups];
                arr[i].itemsStr = e.target.value;
                setGroups(arr);
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setGroups([...groups, { name: '', itemsStr: '' }])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"
        >
          <Plus className="h-4 w-4" /> Thêm nhóm mới
        </Button>
      </div>
    );
  }
  else if (currentType === 'clozedrag') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          TỪ KHÓA ĐÁP ÁN (THEO THỨ TỰ DẤU ___)
        </label>
        {clozeWords.map((w, i) => (
          <div key={i} className="flex gap-4 mb-3 items-center">
            <span className="font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
              Vị trí {i + 1}:
            </span>
            <input
              type="text"
              className="flex-1 p-3 border-2 border-emerald-200 bg-emerald-50 rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700 shadow-sm"
              placeholder="Từ khóa đúng cần điền..."
              value={w}
              onChange={(e) => {
                let arr = [...clozeWords];
                arr[i] = e.target.value;
                setClozeWords(arr);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                let arr = [...clozeWords];
                arr.splice(i, 1);
                setClozeWords(arr);
              }}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-3 h-auto rounded-xl"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setClozeWords([...clozeWords, ''])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"
        >
          <Plus className="h-4 w-4" /> Thêm từ khóa
        </Button>
      </div>
    );
  }
  else if (currentType === 'order') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          SẮP XẾP TỪ / CÂU (NHẬP THEO ĐÚNG THỨ TỰ)
        </label>
        {orderItems.map((item, i) => (
          <div key={i} className="flex gap-4 mb-3 items-center">
            <span className="font-bold text-white bg-indigo-500 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
              {i + 1}
            </span>
            <input
              type="text"
              className="flex-1 p-3 border-2 border-slate-200 bg-white rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700 shadow-sm"
              placeholder={`Nội dung mục số ${i + 1}...`}
              value={item}
              onChange={(e) => {
                let arr = [...orderItems];
                arr[i] = e.target.value;
                setOrderItems(arr);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                let arr = [...orderItems];
                arr.splice(i, 1);
                setOrderItems(arr);
              }}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-3 h-auto border-transparent hover:border-red-200 rounded-xl"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOrderItems([...orderItems, ''])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"
        >
          <Plus className="h-4 w-4" /> Thêm mục
        </Button>
      </div>
    );
  }
  else if (currentType === 'multitruefalse') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          CÁC PHÁT BIỂU (TỐI ĐA 4) — CHỌN ĐÚNG/SAI CHO MỖI PHÁT BIỂU
        </label>
        {mtfStatements.map((stmt, i) => (
          <div key={i} className="flex gap-3 mb-3 items-center">
            <span className="font-bold text-white bg-teal-500 w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 shadow-sm">
              {i + 1}
            </span>
            <input
              type="text"
              className="flex-1 p-3 border-2 border-slate-200 bg-white rounded-xl outline-none focus:border-teal-500 font-semibold text-slate-700 shadow-sm"
              placeholder={`Nội dung phát biểu ${i + 1}...`}
              value={stmt.text}
              onChange={(e) => {
                const arr = [...mtfStatements];
                arr[i] = { ...arr[i], text: e.target.value };
                setMtfStatements(arr);
              }}
            />
            <div className="flex rounded-xl overflow-hidden border-2 border-slate-200 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  const arr = [...mtfStatements];
                  arr[i] = { ...arr[i], correct: true };
                  setMtfStatements(arr);
                }}
                className={`px-4 py-2 font-bold text-sm transition ${
                  stmt.correct ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 hover:bg-emerald-50'
                }`}
              >
                Đúng
              </button>
              <button
                type="button"
                onClick={() => {
                  const arr = [...mtfStatements];
                  arr[i] = { ...arr[i], correct: false };
                  setMtfStatements(arr);
                }}
                className={`px-4 py-2 font-bold text-sm transition ${
                  !stmt.correct ? 'bg-red-500 text-white' : 'bg-white text-slate-500 hover:bg-red-50'
                }`}
              >
                Sai
              </button>
            </div>
            {mtfStatements.length > 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const arr = [...mtfStatements];
                  arr.splice(i, 1);
                  setMtfStatements(arr);
                }}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-3 h-auto border-transparent hover:border-red-200 rounded-xl flex-shrink-0"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        ))}
        {mtfStatements.length < 4 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setMtfStatements([...mtfStatements, { text: '', correct: true }])}
            className="text-teal-600 border-teal-200 hover:bg-teal-50 font-bold mt-2 gap-2"
          >
            <Plus className="h-4 w-4" /> Thêm phát biểu
          </Button>
        )}
      </div>
    );
  }

  const tabs = [
    { id: 'single', label: 'Trắc nghiệm' }, { id: 'multiselect', label: 'Nhiều đáp án' },
    { id: 'fill', label: 'Điền từ' }, { id: 'truefalse', label: 'Đúng / Sai' },
    { id: 'multitruefalse', label: 'Đúng/Sai Nhiều Phát Biểu' },
    { id: 'drag', label: 'Ghép cặp 1-1' }, { id: 'groupdrag', label: 'Phân loại Nhóm' },
    { id: 'clozedrag', label: 'Kéo vào Đoạn văn' }, { id: 'order', label: 'Sắp xếp' }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0">
          <HelpCircle className="h-8 w-8 text-indigo-500" /> Thêm Câu Hỏi Mới
        </h2>
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-4 py-2 rounded-xl">
          <label className="font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">
            Trọng số:
          </label>
          <input
            type="number"
            min="1"
            step="1"
            className="w-16 p-1 text-center font-bold border border-amber-300 dark:border-amber-700 rounded outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            value={points}
            onChange={(e) => setPoints(parseFloat(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-xl mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCurrentType(tab.id)}
            className={`flex-1 text-center py-2.5 px-4 font-bold rounded-lg transition text-sm whitespace-nowrap ${
              currentType === tab.id
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-slate-600 scale-105 transform'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
          Nội dung câu hỏi & Hình ảnh
        </label>
        <textarea
          className="w-full h-32 p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-400 dark:focus:border-indigo-500 outline-none transition text-base resize-y font-medium text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm"
          placeholder="Nhập nội dung đề bài... (dán ảnh được, Ctrl+V)"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          onPaste={handleQuestionPaste}
        />
        {(currentType === 'fill' || currentType === 'clozedrag') && (
          <p className="text-amber-600 text-sm font-bold mt-2 bg-amber-50 p-2 rounded-lg border border-amber-200 inline-block">
            * Dùng 3 dấu gạch dưới <code className="bg-amber-200 px-1 rounded text-amber-800">___</code> để tạo vị trí điền/kéo thả.
          </p>
        )}
        <div className="flex items-center gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current.click()}
            className="text-sky-600 border-sky-200 hover:bg-sky-50 font-bold gap-2"
          >
            <ImageIcon className="h-4 w-4" /> Đính kèm ảnh đề bài
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          {imageBox && (
            <Button
              type="button"
              variant="outline"
              onClick={removeImage}
              className="text-red-500 hover:text-white font-bold border-red-200 hover:bg-red-500 gap-2"
            >
              <Trash2 className="h-4 w-4" /> Xóa ảnh
            </Button>
          )}
        </div>
        {imageBox && (
          <div className="mt-4 p-2 border-2 border-dashed border-slate-300 rounded-xl inline-block bg-slate-50">
            <img src={imageBox} alt="Preview" className="max-w-full max-h-64 rounded-lg shadow-sm" />
          </div>
        )}
      </div>

      {dynamicForm}

      <div className="text-right mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <Button
          type="button"
          onClick={handleSaveQuestion}
          className="font-black py-6 px-10 rounded-xl shadow-lg hover:shadow-xl text-lg gap-2"
        >
          <Check className="h-6 w-6" /> Đưa Câu Hỏi Vào Đề
        </Button>
      </div>
    </div>
  );
}
