// src/components/exams/CodingProblemManager.jsx
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Code2, Plus, Edit2, Trash2, Save, ArrowLeft, PlusCircle, MinusCircle, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { storage } from '../../utils/storage';

export default function CodingProblemManager({ subject, onBack }) {
  const [problems, setProblems] = useState([]);
  const [editingProblem, setEditingProblem] = useState(null); // null hoặc đối tượng problem đang sửa/thêm mới
  const [isNew, setIsNew] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('general'); // 'general' | 'templates' | 'testcases'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Tải danh sách bài toán hiện tại từ LocalStorage (theo môn học nếu có)
    if (subject) {
      setProblems(storage.loadSubjectCodingProblems(subject.id));
    } else {
      setProblems(storage.loadCodingProblems());
    }
  }, [subject]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đề thi lập trình này?')) {
      const updated = problems.filter(p => p.id !== id);
      setProblems(updated);
      if (subject) {
        storage.saveSubjectCodingProblems(subject.id, updated);
      } else {
        storage.saveCodingProblems(updated);
      }
      showSuccess('Xóa đề thi thành công!');
    }
  };

  const handleEdit = (problem) => {
    // Deep clone to avoid mutating state directly
    setEditingProblem(JSON.parse(JSON.stringify(problem)));
    setIsNew(false);
    setActiveFormTab('general');
    setErrorMsg('');
  };

  const handleAddNew = () => {
    setEditingProblem({
      id: '',
      title: '',
      difficulty: 'Dễ',
      category: 'Cơ bản',
      description: 'Cho số nguyên <code>n</code>, viết hàm... <br/>',
      templates: {
        java: `class Solution {\n    public int solve(int n) {\n        // Viết code Java ở đây\n        return 0;\n    }\n}`,
        python: `def solve(n: int) -> int:\n    # Viết code Python ở đây\n    return 0`,
        cpp: `int solve(int n) {\n    // Viết code C++ ở đây\n    return 0;\n}`,
        c: `int solve(int n) {\n    // Viết code C ở đây\n    return 0;\n}`
      },
      testCases: [
        { input: '[5]', output: '5', args: [5] }
      ]
    });
    setIsNew(true);
    setActiveFormTab('general');
    setErrorMsg('');
  };

  const handleAddTestCase = () => {
    setEditingProblem(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', output: '', args: [] }]
    }));
  };

  const handleRemoveTestCase = (index) => {
    if (editingProblem.testCases.length <= 1) {
      setErrorMsg('Đề thi phải có ít nhất 1 test case.');
      return;
    }
    setEditingProblem(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, idx) => idx !== index)
    }));
  };

  const handleTestCaseChange = (index, field, value) => {
    const updatedTestCases = [...editingProblem.testCases];
    updatedTestCases[index][field] = value;
    
    // Tự động phân tích trường `args` từ `input` nếu là JSON hợp lệ
    if (field === 'input') {
      try {
        const parsed = JSON.parse(value);
        updatedTestCases[index].args = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        // Nếu không parse được JSON trực tiếp (ví dụ đang gõ dở), ta để tạm args trống
        // Hoặc coi input là một chuỗi thô
        updatedTestCases[index].args = [value];
      }
    }
    
    setEditingProblem(prev => ({
      ...prev,
      testCases: updatedTestCases
    }));
  };

  const handleSave = () => {
    setErrorMsg('');

    // Validate
    if (!editingProblem.id.trim()) {
      setErrorMsg('Mã đề thi (ID) không được để trống.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(editingProblem.id)) {
      setErrorMsg('Mã đề thi (ID) chỉ được chứa chữ cái, số, dấu gạch dưới (_) hoặc gạch ngang (-).');
      return;
    }
    if (!editingProblem.title.trim()) {
      setErrorMsg('Tiêu đề đề thi không được để trống.');
      return;
    }
    if (!editingProblem.description.trim()) {
      setErrorMsg('Mô tả đề thi không được để trống.');
      return;
    }

    // Validate Test Cases
    for (let i = 0; i < editingProblem.testCases.length; i++) {
      const tc = editingProblem.testCases[i];
      if (!tc.input.trim() || !tc.output.trim()) {
        setErrorMsg(`Test case số ${i + 1} không được để trống dữ liệu đầu vào hoặc kết quả kỳ vọng.`);
        return;
      }
    }

    // Kiểm tra trùng ID đối với đề thi mới
    if (isNew && problems.some(p => p.id === editingProblem.id)) {
      setErrorMsg('Mã đề thi (ID) đã tồn tại. Vui lòng chọn mã khác.');
      return;
    }

    let updatedProblems;
    if (isNew) {
      updatedProblems = [...problems, editingProblem];
    } else {
      updatedProblems = problems.map(p => p.id === editingProblem.id ? editingProblem : p);
    }

    setProblems(updatedProblems);
    if (subject) {
      storage.saveSubjectCodingProblems(subject.id, updatedProblems);
    } else {
      storage.saveCodingProblems(updatedProblems);
    }
    setEditingProblem(null);
    showSuccess(isNew ? 'Thêm mới đề thi thành công!' : 'Cập nhật đề thi thành công!');
  };

  if (editingProblem) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Form Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingProblem(null)}
              className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl bg-transparent border-transparent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {isNew ? 'Thêm đề thi lập trình mới' : `Chỉnh sửa: ${editingProblem.title}`}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cấu hình đề bài, testcases và các mẫu code khởi tạo
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md h-10 px-5 flex items-center gap-1.5 border-transparent"
          >
            <Save className="h-4 w-4" /> Lưu đề thi
          </Button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1">
          <button
            onClick={() => setActiveFormTab('general')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 ${
              activeFormTab === 'general'
                ? 'border-primary text-primary dark:border-blue-500 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Thông tin chung
          </button>
          <button
            onClick={() => setActiveFormTab('templates')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 ${
              activeFormTab === 'templates'
                ? 'border-primary text-primary dark:border-blue-500 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Code Templates
          </button>
          <button
            onClick={() => setActiveFormTab('testcases')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 ${
              activeFormTab === 'testcases'
                ? 'border-primary text-primary dark:border-blue-500 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Bộ Testcases ({editingProblem.testCases.length})
          </button>
        </div>

        {/* Tab content area */}
        <div className="pt-2">
          {activeFormTab === 'general' && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Mã đề thi (ID duy nhất)</label>
                    <input
                      type="text"
                      disabled={!isNew}
                      placeholder="vd: find_max, binary_search"
                      value={editingProblem.id}
                      onChange={(e) => setEditingProblem(prev => ({ ...prev, id: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Tiêu đề bài toán</label>
                    <input
                      type="text"
                      placeholder="vd: Tìm số lớn nhất trong mảng"
                      value={editingProblem.title}
                      onChange={(e) => setEditingProblem(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Chủ đề / Phân loại</label>
                    <input
                      type="text"
                      placeholder="vd: Mảng (Array), Đệ quy, Chuỗi"
                      value={editingProblem.category}
                      onChange={(e) => setEditingProblem(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Độ khó</label>
                    <select
                      value={editingProblem.difficulty}
                      onChange={(e) => setEditingProblem(prev => ({ ...prev, difficulty: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Dễ">Dễ</option>
                      <option value="Trung bình">Trung bình</option>
                      <option value="Khó">Khó</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Mô tả chi tiết bài toán (Hỗ trợ HTML)</label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Mẹo: Sử dụng &lt;code&gt;, &lt;b&gt;, &lt;br/&gt; để định dạng đẹp</span>
                  </div>
                  <textarea
                    rows={8}
                    placeholder="Nhập mô tả đề bài thi..."
                    value={editingProblem.description}
                    onChange={(e) => setEditingProblem(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                {/* Tải ảnh đề bài */}
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Ảnh đề bài (Tùy chọn - Hỗ trợ sơ đồ, đề tự luận bằng hình ảnh)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nhập link ảnh (URL)..."
                          value={editingProblem.imageUrl || ''}
                          onChange={(e) => setEditingProblem(prev => ({ ...prev, imageUrl: e.target.value }))}
                          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-bold self-center">HOẶC</span>
                      </div>
                      
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <PlusCircle className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Tải lên file ảnh tự chọn</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">PNG, JPG, WEBP (Tự động chuyển Base64)</p>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setEditingProblem(prev => ({ ...prev, imageUrl: reader.result }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      
                      {editingProblem.imageUrl && (
                        <Button
                          variant="outline"
                          onClick={() => setEditingProblem(prev => ({ ...prev, imageUrl: '' }))}
                          className="w-full text-red-500 hover:text-white hover:bg-red-600 font-bold text-xs h-10 rounded-xl border-red-200 dark:border-red-900/40 bg-transparent animate-none"
                        >
                          Xóa ảnh hiện tại
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Xem trước ảnh (Preview)</label>
                      {editingProblem.imageUrl ? (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 p-2 max-h-56 flex items-center justify-center">
                          <img 
                            src={editingProblem.imageUrl} 
                            alt="Đề bài Preview" 
                            className="max-h-48 max-w-full rounded-lg object-contain shadow-sm"
                          />
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl h-44 flex items-center justify-center text-xs text-slate-400 font-semibold bg-slate-50 dark:bg-slate-950/20">
                          Chưa cấu hình ảnh đề bài
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeFormTab === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(editingProblem.templates).map((lang) => {
                const langLabel = lang === 'cpp' ? 'C++' : lang === 'c' ? 'C' : lang.charAt(0).toUpperCase() + lang.slice(1);
                return (
                  <Card key={lang} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-905 flex justify-between items-center">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-350">{langLabel} Template</span>
                    </div>
                    <CardContent className="p-4">
                      <textarea
                        rows={10}
                        value={editingProblem.templates[lang]}
                        onChange={(e) => {
                          const updatedTemplates = { ...editingProblem.templates, [lang]: e.target.value };
                          setEditingProblem(prev => ({ ...prev, templates: updatedTemplates }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500 leading-relaxed"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {activeFormTab === 'testcases' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Danh sách Test cases đối sánh khi biên dịch và chạy thử
                </span>
                <Button
                  onClick={handleAddTestCase}
                  className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-4 flex items-center gap-1 border-transparent shadow-sm"
                >
                  <PlusCircle className="h-4 w-4" /> Thêm Test Case
                </Button>
              </div>

              <div className="space-y-4">
                {editingProblem.testCases.map((tc, idx) => (
                  <Card key={idx} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-905 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Test Case #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTestCase(idx)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition flex items-center gap-0.5 text-xs font-bold"
                      >
                        <MinusCircle className="h-4 w-4" /> Xóa
                      </button>
                    </div>
                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Input (Đầu vào dạng JSON)</label>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">Ví dụ: `[[2,7,11], 9]` hoặc `[17]`</span>
                        </div>
                        <input
                          type="text"
                          placeholder="vd: [[2, 7, 11, 15], 9]"
                          value={tc.input}
                          onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Output (Đầu ra mong muốn dạng chuỗi)</label>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">Ví dụ: `[0,1]` hoặc `true`</span>
                        </div>
                        <input
                          type="text"
                          placeholder="vd: [0,1]"
                          value={tc.output}
                          onChange={(e) => handleTestCaseChange(idx, 'output', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {subject && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 h-9 w-9 rounded-xl bg-transparent border-transparent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {!subject && <Code2 className="h-6 w-6 text-primary dark:text-blue-500" />}
              {subject ? `Môn Code: ${subject.name}` : 'Quản lý đề thi Lập trình'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subject ? `Quản lý đề thi code của môn ${subject.name}` : 'Xem, chỉnh sửa, thêm mới hoặc xóa bỏ các bài thi lập trình trên hệ thống (Lưu trữ cục bộ LocalStorage)'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleAddNew}
          className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md h-10 px-5 flex items-center gap-1.5 border-transparent"
        >
          <Plus className="h-4.5 w-4.5" /> Tạo đề thi mới
        </Button>
      </div>

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Problems list cards */}
      {problems.length === 0 ? (
        <Card className="border-0 shadow-sm rounded-3xl p-12 text-center text-slate-500 dark:bg-slate-900">
          <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <div className="font-bold text-lg mb-1">Không có đề thi lập trình nào</div>
          <p className="text-sm">Bấm "Tạo đề thi mới" để bắt đầu soạn đề.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {problems.map((problem) => (
            <Card key={problem.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-sm hover:shadow-md transition duration-200 overflow-hidden">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0 hidden sm:block">
                    <Code2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        {problem.title}
                      </h3>
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                        {problem.category}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        problem.difficulty === 'Dễ' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {problem.difficulty}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold font-mono">
                      ID đề bài: {problem.id} • Hỗ trợ: Java, Python, C++, C, JS
                    </div>
                    <p 
                      className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pt-1" 
                      dangerouslySetInnerHTML={{ __html: problem.description }}
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 shrink-0 w-full md:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => handleEdit(problem)}
                    className="flex-1 md:flex-none font-bold h-10 px-4 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 bg-transparent flex items-center justify-center gap-1"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Sửa
                  </Button>
                  <Button
                    onClick={() => handleDelete(problem.id)}
                    className="flex-1 md:flex-none font-bold h-10 px-4 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white border-transparent text-red-500 flex items-center justify-center gap-1 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
