import { useState, useEffect } from 'react';
import { X, Save, User, KeyRound, Mail, ShieldAlert, Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function UserModal({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData;
  const [formData, setFormData] = useState({
    id: '',
    fullName: '',
    username: '',
    password: '12345678', // Default password
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

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.username.trim()) {
      alert("Vui lòng nhập đầy đủ Tên hiển thị và Tên đăng nhập (Email)!");
      return;
    }

    if (formData.roles.length === 0) {
      alert("Vui lòng chọn ít nhất một vai trò!");
      return;
    }
    
    // Pass back data
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
        // Nếu thêm Admin → tự động bật codingAccess
        const newPermissions = role === 'Admin' 
          ? { ...prev.permissions, codingAccess: true }
          : prev.permissions;
        return { ...prev, roles: newRoles, permissions: newPermissions };
      });
    } else {
      // Đảm bảo không bỏ chọn tất cả
      setFormData(prev => ({
        ...prev,
        roles: prev.roles.filter(r => r !== role)
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
        <div className="p-8 space-y-6 overflow-y-auto">
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
              disabled={isEdit} // Thường không cho đổi username
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mặc định là 12345678.</p>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-slate-400" /> Phân quyền
            </label>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition bg-transparent">
                <input 
                  type="checkbox"
                  checked={formData.roles.includes('Student')}
                  disabled={!isEdit} // Khi tạo mới chỉ được là Student, không sửa được
                  onChange={(e) => handleRoleChange('Student', e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-700 text-primary dark:text-blue-500 focus:ring-primary focus:ring-offset-0"
                />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Học sinh</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Tham gia thi các môn học & đề luyện tập</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition bg-transparent ${!isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="checkbox"
                  checked={formData.roles.includes('Admin')}
                  disabled={!isEdit} // Khi tạo mới không được phép chọn Admin
                  onChange={(e) => handleRoleChange('Admin', e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-700 text-purple-600 dark:text-purple-400 focus:ring-purple-500 focus:ring-offset-0"
                />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Quản trị viên (Admin)</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Xem báo cáo, quản lý môn học, đề thi & tài khoản</p>
                </div>
              </label>
            </div>
            
            {!isEdit && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
                * Tài khoản mới mặc định chỉ có quyền Học sinh. Quyền Admin phải được cấp sau bởi quản trị viên khác.
              </p>
            )}
          </div>

          {/* Quyền tính năng */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
              <Terminal className="h-4 w-4 text-slate-400" /> Quyền tính năng
            </label>
            
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition bg-transparent ${formData.roles.includes('Admin') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input 
                  type="checkbox"
                  checked={formData.permissions?.codingAccess || formData.roles.includes('Admin') || false}
                  disabled={formData.roles.includes('Admin')}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    permissions: { ...prev.permissions, codingAccess: e.target.checked }
                  }))}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-blue-500" /> Thi Lập trình & Vấn đáp AI
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Cho phép truy cập Cổng thi lập trình tự luận và vấn đáp với Giám khảo AI</p>
                </div>
              </label>
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
              * Mặc định tài khoản mới không có quyền. Tài khoản Admin được tự động cấp quyền này.
            </p>
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
    </div>
  );
}
