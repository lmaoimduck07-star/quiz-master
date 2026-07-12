import { useState } from 'react';
import { Search, ShieldAlert, Info, AlertTriangle, AlertOctagon, Monitor, Globe, ChevronDown, Clock, User, Tag, X, FileText } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export default function AuditLogManager({ logs }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);

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
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-wider border-b border-slate-100 dark:border-slate-800 transition-colors">
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
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                      Không tìm thấy bản ghi log nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const sev = getSeverityConfig(log.severity);
                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                        title="Click để xem chi tiết log"
                      >
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{log.time.split(' ')[1]}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{log.time.split(' ')[0]}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{log.user}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{log.role}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Globe className="h-3 w-3 text-slate-400" /> {log.ip}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-555 mt-0.5 flex items-center gap-1">
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

      {/* Slide-out Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-primary dark:text-blue-400" />
                <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">Chi tiết bản ghi Nhật ký</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Action Banner */}
              <div className={`p-5 rounded-2xl border ${
                selectedLog.severity === 'Critical' 
                  ? 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30' 
                  : selectedLog.severity === 'Warning'
                    ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30'
                    : 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30'
              }`}>
                <div className="flex gap-3">
                  <div className="mt-1">
                    {getSeverityConfig(selectedLog.severity).icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Hành động chi tiết</h4>
                    <p className="text-slate-600 dark:text-slate-300 text-sm font-medium mt-1 leading-relaxed">{selectedLog.action}</p>
                  </div>
                </div>
              </div>

              {/* Grid metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Thời gian</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedLog.time}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Mức độ</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${getSeverityConfig(selectedLog.severity).bg} ${getSeverityConfig(selectedLog.severity).color} inline-block`}>
                    {getSeverityConfig(selectedLog.severity).label}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Tài khoản</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedLog.user}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block font-medium mt-0.5">{selectedLog.role}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Phân loại</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedLog.category}</span>
                </div>
              </div>

              {/* IP / Agent Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Thông tin môi trường</h4>
                <div className="space-y-3 bg-slate-50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Địa chỉ IP:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{selectedLog.ip || '127.0.0.1'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Thiết bị:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{selectedLog.device}</span>
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">User Agent đầy đủ</span>
                    <span className="text-xs text-slate-650 dark:text-slate-400 font-mono break-all leading-relaxed block bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      {selectedLog.userAgent || 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payload Diff */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dữ liệu thay đổi (Payload)</h4>
                {selectedLog.payload ? (
                  <div className="bg-slate-50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                    {selectedLog.payload.changes && selectedLog.payload.changes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Các thay đổi chính</span>
                        <ul className="list-disc list-inside text-xs font-semibold text-blue-600 dark:text-blue-400 space-y-1">
                          {selectedLog.payload.changes.map((ch, idx) => (
                            <li key={idx}>{ch}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Chi tiết dữ liệu (JSON)</span>
                      <pre className="text-[11px] text-slate-600 dark:text-slate-400 font-mono bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60">
                        {JSON.stringify(selectedLog.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-slate-400 dark:text-slate-500 italic text-center py-4 bg-slate-50 dark:bg-slate-950/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    Không có thông tin thay đổi dữ liệu kèm theo bản ghi này.
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <Button onClick={() => setSelectedLog(null)} className="rounded-xl px-6 font-bold">
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
