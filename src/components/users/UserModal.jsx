import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, User, KeyRound, Mail, ShieldAlert, Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function UserModal({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData;
  const [formData, setFormData] = useState({
    id: '',
    fullName: '',
    username: '',
    password: '12345678',
    roles: ['Student'],
    status: 'Active',
    permissions: { codingAccess: false },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ 
          ...initialData, 
          roles: initialData.roles || (initialData.role ? [initialData.role] : ['Student']),
          password: initialData.password || '12345678',
          permissions: initialData.permissions || { codingAccess: false },
        });
      } else {
        setFormData({
          id: '',
          fullName: '',
          username: '',
          password: '12345678',
          roles: ['Student'],
          status: 'Active',
          permissions: { codingAccess: false },
        });
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.username.trim()) {
      alert("Vui lòng nhập đầy đủ các thông tin bắt buộc! (Mã lỗi: USER-01)");
      return;
    }

    if (formData.roles.length === 0) {
      alert("Vui lòng chọn ít nhất một vai trò! (Mã lỗi: USER-02)");
      return;
    }
    
    const submitData = { 
      ...formData,
      fullName: formData.fullName.trim(),
      username: formData.username.trim(),
      password: formData.password.trim() || '12345678'
    };
    
    onSave(submitData);
  };

  const handleRoleChange = (role, checked) => {
    if (checked) {
      setFormData(prev => {
        const newRoles = [...prev.roles, role];
        const newPermissions = role === 'Admin' 
          ? { ...prev.permissions, codingAccess: true }
          : prev.permissions;
        return { ...prev, roles: newRoles, permissions: newPermissions };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        roles: prev.roles.filter(r => r !== role)
      }));
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-colors">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-950/40 px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white m-0 flex items-center gap-2">
            <User className="h-6 w-6 text-primary dark:text-blue-400" /> 
            {isEdit ? 'Sửa thông tin tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition bg-transparent">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
              Tên hiển thị
            </label>
            <Input 
              type="text"
              placeholder="VD: Nguyễn Văn A"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" /> Tên đăng nhập / Email
            </label>
            <Input 
              type="text"
              placeholder="VD: hs_nguyenvana hoặc email..."
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full font-medium"
              disabled={isEdit}
            />
            {isEdit && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Không thể thay đổi tên đăng nhập.</p>}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-400" /> Mật khẩu
            </label>
            <Input 
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">
              Vai trò (Chọn nhiều vai trò nếu cần)
            </label>
            <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
              {['Admin', 'Student'].map(role => {
                const isChecked = formData.roles.includes(role);
                return (
                  <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleRoleChange(role, e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {role === 'Admin' ? 'Quản trị viên (Admin)' : 'Học sinh (Student)'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">
              Trạng thái tài khoản
            </label>
            <div className="flex gap-4">
              {[
                { label: 'Hoạt động', value: 'Active', color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Bị khóa', value: 'Locked', color: 'text-red-600 dark:text-red-400' }
              ].map(st => (
                <label key={st.value} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="status" 
                    value={st.value} 
                    checked={formData.status === st.value} 
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })} 
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <span className={`text-sm font-bold ${st.color}`}>{st.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">
              Đặc quyền ứng dụng
            </label>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.permissions?.codingAccess || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    permissions: { ...formData.permissions, codingAccess: e.target.checked }
                  })}
                  className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary mt-0.5"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-indigo-500" /> Cho phép Thi Lập Trình &amp; Vấn Đáp AI
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Cho phép học sinh truy cập vào khu vực Luyện lập trình, Thi lập trình và Vấn đáp trực tiếp với AI.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-950/40 px-8 py-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 transition-colors">
          <Button variant="outline" onClick={onClose} className="px-6 font-bold text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 bg-transparent">
            Hủy Bỏ
          </Button>
          <Button onClick={handleSubmit} className="px-8 font-black shadow-md gap-2 border-transparent">
            <Save className="h-5 w-5" /> LƯU TÀI KHOẢN
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}
