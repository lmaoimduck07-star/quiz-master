import { useState } from 'react';
import { Search, ShieldAlert, Info, AlertTriangle, AlertOctagon, Monitor, Globe, ChevronDown, Clock, User, Tag } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';

export default function AuditLogManager({ logs }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');

  // Lọc dữ liệu
  const filteredLogs = logs.filter(log => {
    const matchSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSeverity = severityFilter === 'All' || log.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'Critical':
        return { icon: <AlertOctagon className="h-4 w-4" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/30', label: 'Nghiêm trọng' };
      case 'Warning':
        return { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/30', label: 'Cảnh báo' };
      case 'Info':
      default:
        return { icon: <Info className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Thông tin' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center mb-10 relative">
        <div className="inline-block bg-primary/10 p-6 rounded-full text-primary mb-4">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 text-center">NHẬT KÝ HỆ THỐNG</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-center">Theo dõi các hoạt động, sự kiện và cảnh báo bảo mật</p>
      </div>

      <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex flex-col sm:flex-row justify-between gap-4 transition-colors">
          <div className="flex gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Tìm kiếm tài khoản hoặc nội dung hành động..." 
                className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-200 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <select 
                className="appearance-none h-12 pl-4 pr-10 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl outline-none bg-slate-50 dark:bg-slate-950 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors min-w-[180px]"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="All">Tất cả mức độ</option>
                <option value="Info">Thông tin</option>
                <option value="Warning">Cảnh báo</option>
                <option value="Critical">Nghiêm trọng</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-550 pointer-events-none" />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-450 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-800 transition-colors">
                <tr>
                  <th className="px-6 py-4"><div className="flex items-center gap-2"><Clock className="h-4 w-4"/> Thời gian</div></th>
                  <th className="px-6 py-4"><div className="flex items-center gap-2"><User className="h-4 w-4"/> Người dùng</div></th>
                  <th className="px-6 py-4"><div className="flex items-center gap-2"><Monitor className="h-4 w-4"/> IP / Thiết bị</div></th>
                  <th className="px-6 py-4"><div className="flex items-center gap-2"><Tag className="h-4 w-4"/> Phân loại</div></th>
                  <th className="px-6 py-4">Chi tiết hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-450 font-medium">
                      Không tìm thấy bản ghi log nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const sev = getSeverityConfig(log.severity);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group">
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{log.time.split(' ')[1]}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{log.time.split(' ')[0]}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{log.user}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{log.role}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-350 flex items-center gap-1">
                            <Globe className="h-3 w-3 text-slate-400" /> {log.ip}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                            <Monitor className="h-3 w-3 text-slate-400" /> {log.device}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1 ${sev.bg} ${sev.color}`}>
                            {sev.icon} {log.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top max-w-md">
                          <div className={`text-sm font-medium ${log.severity === 'Critical' ? 'text-red-700 dark:text-red-400' : log.severity === 'Warning' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {log.action}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
