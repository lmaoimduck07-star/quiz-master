// src/components/QuestionForms.jsx
import { useState, useRef } from 'react';
import { Image as ImageIcon, Trash2, Plus, HelpCircle, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';

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

  const handleSaveQuestion = () => {
    if (!qText.trim() && !imageBox) return alert('⚠️ Bạn phải nhập nội dung đề bài hoặc đính kèm ảnh!');
    let newQuestion = { type: currentType, question: qText.trim(), image: imageBox, points };

    if (currentType === 'single') {
      if (options.some(o => !o.text.trim() && !o.image)) return alert('⚠️ Vui lòng nhập đầy đủ nội dung hoặc ảnh các đáp án!');
      newQuestion.options = options.map(o => o.text);
      newQuestion.optionImages = options.map(o => o.image);
      newQuestion.correct = singleCorrect;
    }
    else if (currentType === 'multiselect') {
      if (options.some(o => !o.text.trim() && !o.image)) return alert('⚠️ Vui lòng nhập đầy đủ nội dung hoặc ảnh các đáp án!');
      if (multiCorrects.length === 0) return alert('⚠️ Phải chọn ít nhất 1 đáp án đúng!');
      newQuestion.options = options.map(o => o.text);
      newQuestion.optionImages = options.map(o => o.image);
      newQuestion.corrects = [...multiCorrects];
    }
    else if (currentType === 'fill') {
      if (!fillAnswer.trim()) return alert('⚠️ Vui lòng nhập đáp án!');
      if (!newQuestion.question.includes('___')) newQuestion.question += ' ___';
      newQuestion.answer = fillAnswer.trim();
      newQuestion.answers = [fillAnswer.trim()];
    }
    else if (currentType === 'truefalse') { newQuestion.correct = tfCorrect; }
    else if (currentType === 'drag') {
      if (pairs.some(p => !p.left.trim() && !p.right.trim())) return alert('⚠️ Mỗi dòng phải có ít nhất một trong hai vế (trái hoặc phải)!');
      if (pairs.filter(p => p.right.trim()).length < 2) return alert('⚠️ Cần ít nhất 2 vế phải (đáp án) để học sinh có thể kéo thả!');
      if (pairs.filter(p => p.left.trim()).length < 1) return alert('⚠️ Cần ít nhất 1 vế trái (câu hỏi) để ghép!');
      newQuestion.pairs = [...pairs];
    }
    else if (currentType === 'groupdrag') {
      if (groups.some(g => !g.name.trim() || !g.itemsStr.trim())) return alert('⚠️ Vui lòng nhập đầy đủ!');
      newQuestion.groups = groups.map(g => ({ name: g.name.trim(), items: g.itemsStr.split(',').map(s => s.trim()).filter(s => s !== '') }));
    }
    else if (currentType === 'clozedrag') {
      let blanksCount = (newQuestion.question.match(/___/g) || []).length;
      let validWords = clozeWords.filter(w => w.trim() !== '');
      if (blanksCount === 0 || blanksCount !== validWords.length) return alert('⚠️ Lỗi số lượng ___');
      newQuestion.answers = validWords.map(w => w.trim());
    }
    else if (currentType === 'order') {
      let validItems = orderItems.filter(i => i.trim() !== '');
      if (validItems.length < 2) return alert('⚠️ Cần ít nhất 2 mục để sắp xếp!');
      newQuestion.items = validItems;
    }

    onAddQuestion(newQuestion);

    setQText(''); removeImage();
    setOptions([{ text: '', image: '' }, { text: '', image: '' }, { text: '', image: '' }, { text: '', image: '' }]);
    setSingleCorrect(0); setMultiCorrects([0]);
    setFillAnswer('');
    setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
    setGroups([{ name: '', itemsStr: '' }, { name: '', itemsStr: '' }]);
    setClozeWords(['', '']); setOrderItems(['', '', '']);
    alert('✅ Đã thêm câu hỏi vào đề!');
  };

  // Component ô đáp án có ảnh — dùng chung cho single & multiselect
  const OptionRow = ({ idx, isChecked, inputEl, borderClass }) => (
    <div className={`border-2 rounded-xl mb-3 transition shadow-sm overflow-hidden ${borderClass}`}>
      {/* Hàng text */}
      <div className="flex items-center gap-3 p-3">
        {inputEl}
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-slate-700 font-semibold"
          placeholder={`Nhập đáp án ${idx + 1}... (dán ảnh được)`}
          value={options[idx].text}
          onPaste={(e) => handleOptionPaste(e, idx)}
          onChange={(e) => {
            const newOpts = [...options];
            newOpts[idx] = { ...newOpts[idx], text: e.target.value };
            setOptions(newOpts);
          }}
        />
        {/* Nút upload ảnh đáp án */}
        <Button
          variant="outline"
          title="Đính kèm ảnh cho đáp án này"
          onClick={() => optionFileRefs.current[idx]?.click()}
          className="h-10 w-10 p-0 text-sky-500 hover:text-white border-sky-200 hover:bg-sky-500 transition"
        ><ImageIcon className="h-4 w-4" /></Button>
        <input
          type="file" accept="image/*" className="hidden"
          ref={el => optionFileRefs.current[idx] = el}
          onChange={(e) => handleOptionImageUpload(e, idx)}
        />
        <Button
          variant="outline"
          onClick={() => {
            if (options.length > 2) {
              const newOpts = [...options]; newOpts.splice(idx, 1); setOptions(newOpts);
              if (singleCorrect === idx) setSingleCorrect(0);
            } else alert('Cần tối thiểu 2 đáp án!');
          }}
          className="h-10 w-10 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 transition"
        ><Trash2 className="h-4 w-4" /></Button>
      </div>

      {/* Preview ảnh đáp án (nếu có) */}
      {options[idx].image && (
        <div className="px-3 pb-3 flex items-start gap-2">
          <img src={options[idx].image} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-32 rounded-lg border border-slate-200 object-contain" />
          <button
            onClick={() => removeOptionImage(idx)}
            className="text-red-400 hover:text-red-600 text-xs font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition mt-1 flex items-center gap-1"
          ><X className="h-3 w-3" /> Xóa ảnh</button>
        </div>
      )}
    </div>
  );

  let dynamicForm = null;

  if (currentType === 'single') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Các Đáp Án (Chọn ô tròn làm đáp án đúng — có thể thêm ảnh)</label>
        {options.map((opt, i) => (
          <OptionRow
            key={i} idx={i}
            isChecked={singleCorrect === i}
            borderClass={singleCorrect === i ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'}
            inputEl={
              <input type="radio" className="w-5 h-5 accent-green-600 cursor-pointer flex-shrink-0"
                checked={singleCorrect === i} onChange={() => setSingleCorrect(i)} />
            }
          />
        ))}
        <Button onClick={() => setOptions([...options, { text: '', image: '' }])}
          variant="outline"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2">
          <Plus className="h-4 w-4" /> Thêm đáp án nữa
        </Button>
      </div>
    );
  }
  else if (currentType === 'multiselect') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Các Đáp Án (Tick NHIỀU ô vuông — có thể thêm ảnh)</label>
        {options.map((opt, i) => {
          const isChecked = multiCorrects.includes(i);
          return (
            <OptionRow
              key={i} idx={i}
              isChecked={isChecked}
              borderClass={isChecked ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'}
              inputEl={
                <input type="checkbox" className="w-5 h-5 accent-green-600 cursor-pointer rounded flex-shrink-0"
                  checked={isChecked}
                  onChange={() => {
                    let newArr = [...multiCorrects];
                    if (newArr.includes(i)) newArr = newArr.filter(x => x !== i);
                    else newArr.push(i);
                    setMultiCorrects(newArr);
                  }} />
              }
            />
          );
        })}
        <Button onClick={() => setOptions([...options, { text: '', image: '' }])}
          variant="outline"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2">
          <Plus className="h-4 w-4" /> Thêm đáp án nữa
        </Button>
      </div>
    );
  }
  else if (currentType === 'fill') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">ĐÁP ÁN ĐÚNG CẦN ĐIỀN VÀO CHỖ TRỐNG ___</label>
        <input type="text" className="w-full p-4 border-2 border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-lg font-bold text-indigo-700 bg-indigo-50 focus:bg-white transition shadow-sm"
          placeholder="Ví dụ: 10, Windows, v.v..." value={fillAnswer} onChange={(e) => setFillAnswer(e.target.value)} />
      </div>
    );
  }
  else if (currentType === 'truefalse') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">NHẬN ĐỊNH TRÊN LÀ:</label>
        <select className="w-full p-4 border-2 border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-lg font-bold text-indigo-700 bg-indigo-50 cursor-pointer transition shadow-sm"
          value={tfCorrect.toString()} onChange={(e) => setTfCorrect(e.target.value === 'true')}>
          <option value="true">ĐÚNG</option>
          <option value="false">SAI</option>
        </select>
      </div>
    );
  }
  else if (currentType === 'drag') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">TẠO CÁC CẶP GHÉP TƯƠNG ỨNG</label>
        <p className="text-xs text-slate-400 mb-3 -mt-2">💡 Để trống "Vế trái" nếu đó là đáp án nhiễu (không cần khớp với câu hỏi nào — dùng khi số câu trả lời nhiều hơn số câu hỏi). Để trống "Vế phải" nếu câu hỏi đó không cần đáp án.</p>
        {pairs.map((p, i) => (
          <div key={i} className="flex gap-4 mb-3">
            <input type="text" className="flex-1 p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold bg-white shadow-sm"
              placeholder="Vế trái cố định — để trống nếu là đáp án nhiễu..." value={p.left} onChange={(e) => { let arr = [...pairs]; arr[i].left = e.target.value; setPairs(arr); }} />
            <input type="text" className="flex-1 p-3 border-2 border-emerald-200 bg-emerald-50 rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700 shadow-sm"
              placeholder="Vế phải (Kéo thả) — để trống nếu không cần..." value={p.right} onChange={(e) => { let arr = [...pairs]; arr[i].right = e.target.value; setPairs(arr); }} />
            <Button variant="outline" onClick={() => { if (pairs.length > 2) { let arr = [...pairs]; arr.splice(i, 1); setPairs(arr); } else alert('Cần tối thiểu 2 cặp!'); }}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-3 rounded-xl border-transparent hover:border-red-200 h-auto"><Trash2 className="h-5 w-5" /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setPairs([...pairs, { left: '', right: '' }])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"><Plus className="h-4 w-4" /> Thêm cặp nữa</Button>
      </div>
    );
  }
  else if (currentType === 'groupdrag') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">TẠO CÁC NHÓM VÀ TỪ KHÓA</label>
        {groups.map((g, i) => (
          <div key={i} className="bg-slate-50 p-5 border border-slate-200 rounded-xl mb-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <input type="text" className="flex-1 p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-bold text-indigo-700 bg-white"
                placeholder={`Tên Nhóm ${i + 1}...`} value={g.name} onChange={(e) => { let arr = [...groups]; arr[i].name = e.target.value; setGroups(arr); }} />
              <Button variant="outline" onClick={() => { if (groups.length > 2) { let arr = [...groups]; arr.splice(i, 1); setGroups(arr); } else alert('Cần tối thiểu 2 nhóm!'); }}
                className="text-red-500 hover:text-white bg-white hover:bg-red-500 border border-red-200 font-bold gap-2"><Trash2 className="h-4 w-4" /> Xóa nhóm</Button>
            </div>
            <textarea className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-medium resize-y bg-white text-slate-700" rows="2"
              placeholder="Các từ khóa thuộc nhóm này (Cách nhau bằng dấu phẩy)..." value={g.itemsStr} onChange={(e) => { let arr = [...groups]; arr[i].itemsStr = e.target.value; setGroups(arr); }} />
          </div>
        ))}
        <Button variant="outline" onClick={() => setGroups([...groups, { name: '', itemsStr: '' }])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"><Plus className="h-4 w-4" /> Thêm nhóm mới</Button>
      </div>
    );
  }
  else if (currentType === 'clozedrag') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">TỪ KHÓA ĐÁP ÁN (THEO THỨ TỰ DẤU ___)</label>
        {clozeWords.map((w, i) => (
          <div key={i} className="flex gap-4 mb-3 items-center">
            <span className="font-bold text-slate-400 bg-slate-100 px-3 py-2 rounded-lg">Vị trí {i + 1}:</span>
            <input type="text" className="flex-1 p-3 border-2 border-emerald-200 bg-emerald-50 rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700 shadow-sm"
              placeholder="Từ khóa đúng cần điền..." value={w} onChange={(e) => { let arr = [...clozeWords]; arr[i] = e.target.value; setClozeWords(arr); }} />
            <Button variant="outline" onClick={() => { let arr = [...clozeWords]; arr.splice(i, 1); setClozeWords(arr); }}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200 p-3 h-auto rounded-xl"><Trash2 className="h-5 w-5" /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setClozeWords([...clozeWords, ''])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"><Plus className="h-4 w-4" /> Thêm từ khóa</Button>
      </div>
    );
  }
  else if (currentType === 'order') {
    dynamicForm = (
      <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in duration-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">SẮP XẾP TỪ / CÂU (NHẬP THEO ĐÚNG THỨ TỰ)</label>
        {orderItems.map((item, i) => (
          <div key={i} className="flex gap-4 mb-3 items-center">
            <span className="font-bold text-white bg-indigo-500 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">{i + 1}</span>
            <input type="text" className="flex-1 p-3 border-2 border-slate-200 bg-white rounded-xl outline-none focus:border-indigo-500 font-semibold text-slate-700 shadow-sm"
              placeholder={`Nội dung mục số ${i + 1}...`} value={item} onChange={(e) => { let arr = [...orderItems]; arr[i] = e.target.value; setOrderItems(arr); }} />
            <Button variant="outline" onClick={() => { let arr = [...orderItems]; arr.splice(i, 1); setOrderItems(arr); }}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-3 h-auto border-transparent hover:border-red-200 rounded-xl"><Trash2 className="h-5 w-5" /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setOrderItems([...orderItems, ''])}
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold mt-2 gap-2"><Plus className="h-4 w-4" /> Thêm mục</Button>
      </div>
    );
  }

  const tabs = [
    { id: 'single', label: 'Trắc nghiệm' }, { id: 'multiselect', label: 'Nhiều đáp án' },
    { id: 'fill', label: 'Điền từ' }, { id: 'truefalse', label: 'Đúng / Sai' },
    { id: 'drag', label: 'Ghép cặp 1-1' }, { id: 'groupdrag', label: 'Phân loại Nhóm' },
    { id: 'clozedrag', label: 'Kéo vào Đoạn văn' }, { id: 'order', label: 'Sắp xếp' }
  ];

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 m-0"><HelpCircle className="h-8 w-8 text-indigo-500" /> Thêm Câu Hỏi Mới</h2>
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
          <label className="font-bold text-amber-700 text-sm uppercase tracking-wide">Trọng số:</label>
          <input type="number" min="1" step="1" className="w-16 p-1 text-center font-bold border border-amber-300 rounded outline-none"
            value={points} onChange={(e) => setPoints(parseFloat(e.target.value) || 1)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-slate-100 p-2 rounded-xl mb-6">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setCurrentType(tab.id)}
            className={`flex-1 text-center py-2.5 px-4 font-bold rounded-lg transition text-sm whitespace-nowrap ${currentType === tab.id ? 'bg-white text-indigo-600 shadow-md border border-slate-200 scale-105 transform' : 'text-slate-500 hover:bg-slate-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nội dung câu hỏi & Hình ảnh</label>
        <textarea className="w-full h-32 p-4 border-2 border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition text-base resize-y font-medium text-slate-700 leading-relaxed shadow-sm"
          placeholder="Nhập nội dung đề bài... (dán ảnh được, Ctrl+V)" value={qText} onChange={(e) => setQText(e.target.value)} onPaste={handleQuestionPaste} />
        {(currentType === 'fill' || currentType === 'clozedrag') &&
          <p className="text-amber-600 text-sm font-bold mt-2 bg-amber-50 p-2 rounded-lg border border-amber-200 inline-block">
            * Dùng 3 dấu gạch dưới <code className="bg-amber-200 px-1 rounded text-amber-800">___</code> để tạo vị trí điền/kéo thả.
          </p>
        }
        <div className="flex items-center gap-3 mt-4">
          <Button variant="outline" onClick={() => fileInputRef.current.click()}
            className="text-sky-600 border-sky-200 hover:bg-sky-50 font-bold gap-2">
            <ImageIcon className="h-4 w-4" /> Đính kèm ảnh đề bài
          </Button>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
          {imageBox && <Button variant="outline" onClick={removeImage} className="text-red-500 hover:text-white font-bold border-red-200 hover:bg-red-500 gap-2"><Trash2 className="h-4 w-4" /> Xóa ảnh</Button>}
        </div>
        {imageBox && <div className="mt-4 p-2 border-2 border-dashed border-slate-300 rounded-xl inline-block bg-slate-50"><img src={imageBox} alt="Preview" className="max-w-full max-h-64 rounded-lg shadow-sm" /></div>}
      </div>

      {dynamicForm}

      <div className="text-right mt-8 pt-6 border-t border-slate-200">
        <Button onClick={handleSaveQuestion}
          className="font-black py-6 px-10 rounded-xl shadow-lg hover:shadow-xl text-lg gap-2">
          <Check className="h-6 w-6" /> Đưa Câu Hỏi Vào Đề
        </Button>
      </div>
    </div>
  );
}
