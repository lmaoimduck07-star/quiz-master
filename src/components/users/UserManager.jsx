import { useState } from 'react';
import { Search, Plus, UserCog, UserCheck, UserX, Pencil, Lock, Unlock, Trash2, ChevronDown, Terminal, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardContent } from '../ui/Card';
import UserModal from './UserModal';

export default function UserManager({ users, onAddUser, onUpdateUser, onDeleteUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Permission confirmation modal (2FA-style)
  const [permConfirm, setPermConfirm] = useState(null); // { user, newValue, code }
  const [permEnteredCode, setPermEnteredCode] = useState('');

  const handleTogglePermission = (user, newValue) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPermConfirm({ user, newValue, code });
    setPermEnteredCode('');
  };

  const confirmPermissionChange = () => {
    if (!permConfirm || permEnteredCode !== permConfirm.code) return;
    const updated = {
      ...permConfirm.user,
      permissions: { ...(permConfirm.user.permissions || {}), codingAccess: permConfirm.newValue }
    };
    onUpdateUser(updated);
    setPermConfirm(null);
    setPermEnteredCode('');
  };

  // Lọc dữ liệu
  const filteredUsers = users.filter(user => {
    const matchSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const userRoles = user.roles || (user.role ? [user.role] : ['Student']);
    const matchRole = roleFilter === 'All' || userRoles.includes(roleFilter);
    return matchSearch && matchRole;
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSaveModal = (data) => {
    if (editingUser) {
      onUpdateUser(data);
    } else {
      onAddUser({ ...data, id: 'user_' + Date.now() });
    }
    setIsModalOpen(false);
  };

  const handleToggleLock = (user) => {
    const newStatus = user.status === 'Active' ? 'Locked' : 'Active';
    onUpdateUser({ ...user, status: newStatus });
  };

  const handleDelete = (userId) => {
    setDeletingUserId(userId);
  };

  const confirmDelete = () => {
    if (deletingUserId) {
      onDeleteUser(deletingUserId);
      setDeletingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center mb-10 relative">
        <div className="inline-block bg-primary/10 p-6 rounded-full text-primary mb-4">
          <UserCog className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 text-center">QUẢN LÝ TÀI KHOẢN</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-center">Quản trị viên và Học sinh trong hệ thống</p>
      </div>

      <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex flex-col sm:flex-row justify-between gap-4 transition-colors">
          <div className="flex gap-4 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Tìm kiếm tên hoặc email..." 
                className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-200 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <select 
                className="appearance-none h-12 pl-4 pr-10 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl outline-none bg-slate-50 dark:bg-slate-950 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors min-w-[160px]"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">Tất cả vai trò</option>
                <option value="Admin">Admin</option>
                <option value="Student">Học sinh</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <Button onClick={handleOpenAdd} className="h-12 px-8 rounded-xl font-bold gap-2">
            <Plus className="h-5 w-5" /> THÊM TÀI KHOẢN
          </Button>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-800 transition-colors">
                <tr>
                  <th className="px-6 py-4">Họ và Tên</th>
                  <th className="px-6 py-4">Tên đăng nhập / Email</th>
                  <th className="px-6 py-4">Mật khẩu</th>
                  <th className="px-6 py-4">Vai trò</th>
                  <th className="px-6 py-4">Quyền</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                      Không tìm thấy tài khoản nào khớp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/45 transition group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{user.fullName}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">ID: {user.id}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-sm text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/40">
                        {user.password || '12345678'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || [user.role || 'Student']).map(r => (
                            <span 
                              key={r}
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${r === 'Admin' ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'}`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <label className={`inline-flex items-center gap-2 select-none ${(user.roles || []).includes('Admin') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input 
                            type="checkbox"
                            checked={user.permissions?.codingAccess || (user.roles || []).includes('Admin') || false}
                            disabled={(user.roles || []).includes('Admin')}
                            onChange={(e) => handleTogglePermission(user, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <Terminal className="h-3 w-3 text-blue-500" /> Coding & Vấn đáp
                          </span>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        {user.status === 'Active' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-1">
                            <UserCheck className="h-4 w-4" /> Hoạt động
                          </span>
                        ) : (
                          <span className="text-red-500 dark:text-red-400 font-bold text-sm flex items-center gap-1">
                            <UserX className="h-4 w-4" /> Bị khóa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleToggleLock(user)}
                            className={`h-9 w-9 border-transparent bg-transparent ${user.status === 'Active' ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'}`}
                            title={user.status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {user.status === 'Active' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleOpenEdit(user)}
                            className="h-9 w-9 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 hover:bg-primary/5 dark:hover:bg-blue-900/10 border-transparent bg-transparent"
                            title="Sửa thông tin"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleDelete(user.id)}
                            className="h-9 w-9 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-transparent bg-transparent"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <UserModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        initialData={editingUser}
      />

      {/* Delete Confirmation Modal */}
      {deletingUserId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-w-sm w-full rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Xóa tài khoản?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                Bạn có chắc chắn muốn xóa tài khoản này vĩnh viễn không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setDeletingUserId(null)} className="w-full font-bold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-transparent">
                  Hủy Bỏ
                </Button>
                <Button variant="danger" onClick={confirmDelete} className="w-full font-bold bg-red-500 hover:bg-red-600 border-transparent">
                  Xóa Vĩnh Viễn
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Confirmation Modal (2FA) */}
      {permConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-w-md w-full rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 dark:bg-slate-950/40 px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800 dark:text-white m-0 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500 animate-pulse" />
                Xác nhận thay đổi quyền
              </h2>
              <button onClick={() => setPermConfirm(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition bg-transparent">
                <Trash2 className="h-5 w-5" style={{ display: 'none' }} />
                <span className="text-xl font-bold">✕</span>
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div className={`p-4 rounded-2xl text-sm font-semibold leading-relaxed border ${permConfirm.newValue ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300'}`}>
                {permConfirm.newValue 
                  ? <>🔓 Bạn đang <strong>CẤP QUYỀN</strong> Thi Lập trình &amp; Vấn đáp AI cho tài khoản <strong>{permConfirm.user.fullName}</strong> ({permConfirm.user.username}).</>
                  : <>🔒 Bạn đang <strong>THU HỒI QUYỀN</strong> Thi Lập trình &amp; Vấn đáp AI của tài khoản <strong>{permConfirm.user.fullName}</strong> ({permConfirm.user.username}).</>
                }
              </div>

              <p className="text-slate-600 dark:text-slate-300 text-sm font-semibold">
                Để xác nhận, vui lòng nhập mã xác minh bên dưới:
              </p>

              <div className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nhập mã xác nhận</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Mã 6 số..."
                    value={permEnteredCode}
                    onChange={(e) => setPermEnteredCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && permEnteredCode === permConfirm.code) {
                        e.preventDefault();
                        confirmPermissionChange();
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-lg font-black tracking-widest text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary text-center"
                    autoFocus
                  />
                </div>
                <div className="text-center bg-slate-900 dark:bg-slate-950 text-white rounded-2xl px-5 py-3 shadow-md border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mã xác minh</div>
                  <div className="text-2xl font-black tracking-widest text-emerald-400 font-mono select-none">{permConfirm.code}</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 px-8 py-5 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setPermConfirm(null)}
                className="rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 bg-transparent"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={confirmPermissionChange}
                disabled={permEnteredCode !== permConfirm.code}
                className={`rounded-xl font-bold px-6 shadow-sm disabled:opacity-50 ${permConfirm.newValue ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
              >
                {permConfirm.newValue ? 'Xác nhận cấp quyền' : 'Xác nhận thu hồi'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
