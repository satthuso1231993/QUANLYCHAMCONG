import React, { useMemo, useRef, useState } from 'react';
import { Officer, OfficerRank, OfficerPosition, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, Upload, FileSpreadsheet, Check, X, AlertCircle } from 'lucide-react';
import { getFixedPersonnelOfficers } from '../utils/personnel';

interface OfficerManagementProps {
  officers: Officer[];
  setOfficers: React.Dispatch<React.SetStateAction<Officer[]>>;
  addLog: (action: string, details: string) => void;
}

export default function OfficerManagement({ officers, setOfficers, addLog }: OfficerManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState<OfficerRank>('Thiếu úy');
  const [position, setPosition] = useState<OfficerPosition>('Cán bộ');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [status, setStatus] = useState<'Đang công tác' | 'Tạm nghỉ' | 'Chuyển công tác'>('Đang công tác');

  // Excel import simulations
  const [showImportModal, setShowImportModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsed' | 'done'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available options
  const ranks: OfficerRank[] = [
    'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá',
    'Đại úy', 'Thượng úy', 'Trung úy', 'Thiếu úy',
    'Thượng sĩ', 'Trung sĩ', 'Hạ sĩ', 'Binh nhất', 'Binh nhì'
  ];

  const positions: OfficerPosition[] = ['Đội trưởng', 'Phó Đội trưởng', 'Cán bộ', 'Chiến sĩ'];

  const uniqueDepartments = Array.from(new Set(officers.map(o => o.department))).filter(Boolean);

  const handleOpenAdd = () => {
    setEditingOfficer(null);
    setFullName('');
    setRank('Trung úy');
    setPosition('Cán bộ');
    setBadgeNumber('');
    setDepartment(uniqueDepartments[0] || 'Đội Tuần tra Kiểm soát số 1');
    setPhoneNumber('');
    setYearOfBirth('');
    setStatus('Đang công tác');
    setShowModal(true);
  };

  const handleOpenEdit = (officer: Officer) => {
    setEditingOfficer(officer);
    setFullName(officer.fullName);
    setRank(officer.rank);
    setPosition(officer.position);
    setBadgeNumber(officer.badgeNumber || '');
    setDepartment(officer.department);
    setPhoneNumber(officer.phoneNumber || '');
    setYearOfBirth(officer.yearOfBirth ? String(officer.yearOfBirth) : '');
    setStatus(officer.status);
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id, name } = deleteConfirm;
    setOfficers(prev => prev.filter(o => o.id !== id));
    addLog('Xóa cán bộ chiến sĩ', `Đã xóa CBCS ${name} ra khỏi danh sách quản lý.`);
    setDeleteConfirm(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Vui lòng điền Họ tên!');
      return;
    }

    // Check unique badge
    if (badgeNumber.trim()) {
      const badgeExists = officers.some(o => o.badgeNumber === badgeNumber && (!editingOfficer || o.id !== editingOfficer.id));
      if (badgeExists) {
        alert(`Số hiệu CAND ${badgeNumber} đã tồn tại trong hệ thống! Vui lòng kiểm tra lại.`);
        return;
      }
    }

    if (editingOfficer) {
      // Update
      setOfficers(prev => prev.map(o => o.id === editingOfficer.id ? {
        ...o,
        fullName,
        rank,
        position,
        badgeNumber,
        department,
        phoneNumber,
        yearOfBirth: yearOfBirth ? Number(yearOfBirth) : undefined,
        status,
      } : o));
      addLog('Sửa thông tin cán bộ', `Đã cập nhật thông tin cho ${rank} ${fullName}${badgeNumber.trim() ? ` (Số hiệu: ${badgeNumber}).` : '.'}`);
    } else {
      // Create new
      const newOfficer: Officer = {
        id: `OFF_${Date.now()}`,
        fullName,
        rank,
        position,
        badgeNumber,
        department,
        phoneNumber,
        yearOfBirth: yearOfBirth ? Number(yearOfBirth) : undefined,
        status,
      };
      setOfficers(prev => [...prev, newOfficer]);
      addLog('Thêm mới cán bộ', `Đã thêm mới cán bộ ${rank} ${fullName}${badgeNumber.trim() ? `, Số hiệu: ${badgeNumber}.` : '.'}`);
    }
    setShowModal(false);
  };

  // Drag & drop excel simulator
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      simulateExcelParse(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      simulateExcelParse(e.target.files[0]);
    }
  };

  const simulateExcelParse = (file: File) => {
    setImportStatus('parsed');
    // Generate simulated parsed rows reflecting actual traffic officers excel format
    const mockParsed = [
      { fullName: 'Trần Văn Kiên', rank: 'Thiếu úy' as OfficerRank, position: 'Cán bộ' as OfficerPosition, badgeNumber: '114-102', department: 'Đội Tuần tra Kiểm soát số 1', phoneNumber: '0981122334', status: 'Đang công tác' as const },
      { fullName: 'Lê Hoàng Hải', rank: 'Thượng tá' as OfficerRank, position: 'Phó Đội trưởng' as OfficerPosition, badgeNumber: '293-847', department: 'Đội CSGT Dẫn đoàn', phoneNumber: '0912888888', yearOfBirth: 1983, status: 'Đang công tác' as const },
      { fullName: 'Nguyễn Huy Hoàng', rank: 'Trung úy' as OfficerRank, position: 'Cán bộ' as OfficerPosition, badgeNumber: '333-511', department: 'Đội Tuần tra Kiểm soát số 1', phoneNumber: '0966554433', yearOfBirth: 1992, status: 'Đang công tác' as const },
      { fullName: 'Ngô Việt Anh', rank: 'Binh nhất' as OfficerRank, position: 'Chiến sĩ' as OfficerPosition, badgeNumber: '904-201', department: 'Đội Tuyên truyền & Xử lý vi phạm', phoneNumber: '0904112211', yearOfBirth: 2001, status: 'Đang công tác' as const },
    ];
    setImportedRows(mockParsed);
  };

  const saveImported = () => {
    // Add non-duplicate officers
    let countAdded = 0;
    setOfficers(prev => {
      let current = [...prev];
      importedRows.forEach(row => {
        if (!row.badgeNumber || !current.some(o => o.badgeNumber === row.badgeNumber)) {
          current.push({
            id: `OFF_IMP_${Math.random().toString(36).substr(2, 9)}`,
            ...row
          });
          countAdded++;
        }
      });
      return current;
    });

    addLog('Nhập dữ liệu cán bộ từ Excel', `Đã import thành công ${countAdded} cán bộ chiến sĩ mới từ file Excel.`);
    setImportStatus('done');
    setTimeout(() => {
      setShowImportModal(false);
      setImportStatus('idle');
      setImportedRows([]);
    }, 1500);
  };

  // Filter and Search logic
  const fixedPersonnelOfficers = useMemo(() => getFixedPersonnelOfficers(officers), [officers]);
  const filteredOfficers = fixedPersonnelOfficers.filter(o => {
    const matchesSearch = 
      o.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.badgeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.phoneNumber && o.phoneNumber.includes(searchTerm));

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Top buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý Cán bộ Chiến sĩ</h2>
          <p className="text-sm text-slate-500 mt-1">Đăng ký thông tin, sửa đổi cấp bậc, chức vụ và số hiệu CAND</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Import Excel */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          {/* Thêm mới */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Cán bộ</span>
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-3.5">
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo Tên, Số hiệu CAND, Số điện thoại..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs outline-hidden shadow-2xs"
          />
        </div>
      </div>

      {/* Officers Table Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Họ tên</th>
                <th className="py-3 px-4">Cấp bậc</th>
                <th className="py-3 px-4">Chức vụ</th>
                <th className="py-3 px-4 text-center">Năm sinh</th>
                <th className="py-3 px-4 text-center">Số hiệu CAND</th>
                <th className="py-3 px-4">Đội công tác</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredOfficers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Không tìm thấy cán bộ chiến sĩ nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredOfficers.map((officer) => (
                  <tr key={officer.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800">{officer.fullName}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{officer.rank}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold ${
                        officer.position === 'Đội trưởng' 
                          ? 'bg-rose-50 text-rose-700' 
                          : officer.position === 'Phó Đội trưởng' 
                          ? 'bg-amber-50 text-amber-700' 
                          : 'bg-slate-50 text-slate-600'
                      }`}>
                        {officer.position}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                      {officer.yearOfBirth || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-500 bg-slate-50/30">
                      {officer.badgeNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 truncate max-w-[200px]">{officer.department}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{officer.phoneNumber || '-'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        officer.status === 'Đang công tác' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : officer.status === 'Tạm nghỉ' 
                          ? 'bg-amber-50 text-amber-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {officer.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(officer)}
                          className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(officer.id, officer.fullName)}
                          className="p-1 px-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-md transition-colors"
                          title="Xóa cán bộ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 p-3.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
          <span>Hiển thị {filteredOfficers.length} trên tổng số {fixedPersonnelOfficers.length} nhân sự cố định</span>
          <span className="font-semibold text-slate-600">Đơn vị: Phòng Cảnh sát giao thông</span>
        </div>
      </div>

      {/* CRUD MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingOfficer ? 'Sửa thông tin Cán bộ Chiến sĩ' : 'Thêm mới Cán bộ Chiến sĩ'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Họ tên */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Anh"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                {/* Cấp bậc */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cấp bậc CAND *</label>
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value as OfficerRank)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  >
                    {ranks.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Chức vụ */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Chức vụ *</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as OfficerPosition)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  >
                    {positions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Số hiệu CAND */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Số hiệu CAND</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="VD: 123-456"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono font-medium"
                  />
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Năm sinh</label>
                  <input
                    type="number"
                    min={1950}
                    max={2100}
                    value={yearOfBirth}
                    onChange={(e) => setYearOfBirth(e.target.value)}
                    placeholder="VD: 1988"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                  />
                </div>

                {/* Đội công tác */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Đội công tác</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="VD: Đội Tuần tra Kiểm soát số 1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                {/* Trạng thái */}
                {editingOfficer && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng thái công tác</label>
                    <div className="flex gap-4 mt-1">
                      {['Đang công tác', 'Tạm nghỉ', 'Chuyển công tác'].map(st => (
                        <label key={st} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            checked={status === st}
                            onChange={() => setStatus(st as any)}
                            className="text-blue-600"
                          />
                          <span>{st}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT SIMULATOR MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm">Import Cán bộ Chiến sĩ từ file Excel (.xlsx)</h3>
              </div>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportStatus('idle');
                  setImportedRows([]);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {importStatus === 'idle' && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-350 bg-slate-50 hover:bg-slate-100/70'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-3" />
                  <p className="text-xs font-bold text-slate-700">Kéo thả danh sách Excel vào đây hoặc click để chọn file</p>
                  <p className="text-[10px] text-slate-400 mt-1.5">Hỗ trợ định dạng .xlsx, .xls theo mẫu chuẩn của phòng CSGT</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button className="mt-4 px-3.5 py-1.5 bg-white border border-slate-250 text-slate-700 text-[10px] font-bold rounded-lg hover:border-slate-350">
                    Chọn tệp tin mẫu
                  </button>
                </div>
              )}

              {importStatus === 'parsed' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2.5 text-xs text-blue-700">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Đọc thành công tệp tin Excel. Hệ thống phát hiện <strong className="font-bold">{importedRows.length}</strong> cán bộ chiến sĩ có thể nhập dữ liệu.</span>
                  </div>

                  <div className="max-h-[250px] overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                          <th className="py-2.5 px-3">Họ và tên</th>
                          <th className="py-2.5 px-3">Cấp bậc</th>
                          <th className="py-2.5 px-3">Chức vụ</th>
                          <th className="py-2.5 px-3">Số hiệu</th>
                          <th className="py-2.5 px-3">Đội công tác</th>
                          <th className="py-2.5 px-3">Số điện thoại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {importedRows.map((row, index) => {
                          const isDuplicate = officers.some(o => o.badgeNumber === row.badgeNumber);
                          return (
                            <tr key={index} className={`hover:bg-slate-50 ${isDuplicate ? 'bg-amber-50/50' : ''}`}>
                              <td className="py-2 px-3 font-semibold text-slate-800">{row.fullName}</td>
                              <td className="py-2 px-3">{row.rank}</td>
                              <td className="py-2 px-3">{row.position}</td>
                              <td className="py-2 px-3 font-mono font-medium">{row.badgeNumber}</td>
                              <td className="py-2 px-3 truncate max-w-[150px]">{row.department}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">{row.phoneNumber}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Các dòng được tô nhạt đã tồn tại số hiệu trong hệ thống và sẽ tự động được lọc bỏ.</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setImportStatus('idle');
                          setImportedRows([]);
                        }}
                        className="px-3.5 py-1.5 bg-white border border-slate-250 text-slate-700 rounded-lg text-xs font-semibold"
                      >
                        Chọn lại file
                      </button>
                      <button
                        onClick={saveImported}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        Xác nhận Import
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {importStatus === 'done' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800">Nhập dữ liệu thành công!</h4>
                  <p className="text-xs text-slate-500">Đang cập nhật bảng danh sách cán bộ chiến sĩ...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa cán bộ</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa cán bộ chiến sĩ <strong className="text-slate-800">{deleteConfirm.name}</strong>? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
