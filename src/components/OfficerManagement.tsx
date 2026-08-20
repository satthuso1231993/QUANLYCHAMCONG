import React, { useMemo, useRef, useState } from 'react';
import { AuditLog, Officer, OfficerPosition, OfficerRank, SystemSettings, Team, User } from '../types';
import { Plus, Search, Edit2, Trash2, Upload, FileSpreadsheet, Check, X, AlertCircle, Building2, Users } from 'lucide-react';
import { getFixedPersonnelOfficers } from '../utils/personnel';
import { collectDescendantTeamIds, getTeamTypeLabel } from '../utils/accessScope';

interface OfficerManagementProps {
  officers: Officer[];
  setOfficers: React.Dispatch<React.SetStateAction<Officer[]>>;
  teams?: Team[];
  setTeams?: React.Dispatch<React.SetStateAction<Team[]>>;
  currentUser?: User;
  settings: SystemSettings;
  addLog: (action: string, details: string) => void;
}

export default function OfficerManagement({ 
  officers, 
  setOfficers, 
  teams = [], 
  setTeams, 
  currentUser, 
  settings, 
  addLog 
}: OfficerManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState<OfficerRank>('Thiếu úy');
  const [position, setPosition] = useState<OfficerPosition>('Cán bộ');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [status, setStatus] = useState<'Đang công tác' | 'Tạm nghỉ' | 'Chuyển công tác'>('Đang công tác');

  // Excel / CSV import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTeamId, setImportTeamId] = useState('');
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

  // Accessible teams based on currentUser scope
  const accessibleTeams = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') {
      return teams;
    }
    if (currentUser.managedTeamId) {
      const allowedIds = collectDescendantTeamIds(currentUser.managedTeamId, teams);
      return teams.filter(t => allowedIds.includes(t.id));
    }
    return [];
  }, [currentUser, teams]);

  const handleOpenAdd = () => {
    setEditingOfficer(null);
    setFullName('');
    setRank('Thiếu úy');
    setPosition('Cán bộ');
    setBadgeNumber('');
    
    // Auto-select initial team
    const defaultTeam = accessibleTeams[0];
    const defaultTeamId = currentUser?.managedTeamId || defaultTeam?.id || '';
    const foundTeam = teams.find(t => t.id === defaultTeamId);
    setSelectedTeamId(defaultTeamId);
    setDepartment(foundTeam ? foundTeam.name : '');
    
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
    
    // Find matching team by memberIds or department
    const foundTeam = teams.find(t => (t.memberIds || []).includes(officer.id) || t.leaderId === officer.id)
      || teams.find(t => t.name.toLowerCase() === (officer.department || '').toLowerCase());
    
    setSelectedTeamId(foundTeam?.id || '');
    setDepartment(officer.department || foundTeam?.name || '');
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
    
    // Also remove from teams memberIds
    if (setTeams) {
      setTeams(prev => prev.map(t => ({
        ...t,
        leaderId: t.leaderId === id ? '' : t.leaderId,
        memberIds: (t.memberIds || []).filter(mId => mId !== id)
      })));
    }

    addLog('Xóa cán bộ chiến sĩ', `Đã xóa CBCS ${name} ra khỏi danh sách quản lý.`);
    setDeleteConfirm(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Vui lòng điền Họ và tên cán bộ!');
      return;
    }

    // Check unique badge number if provided
    if (badgeNumber.trim()) {
      const badgeExists = officers.some(o => o.badgeNumber === badgeNumber.trim() && (!editingOfficer || o.id !== editingOfficer.id));
      if (badgeExists) {
        alert(`Số hiệu CAND ${badgeNumber} đã tồn tại trong hệ thống! Vui lòng kiểm tra lại.`);
        return;
      }
    }

    const assignedTeam = teams.find(t => t.id === selectedTeamId);
    const finalDepartment = assignedTeam ? assignedTeam.name : department.trim() || 'Đơn vị';

    if (editingOfficer) {
      // Update
      const officerId = editingOfficer.id;
      setOfficers(prev => prev.map(o => o.id === officerId ? {
        ...o,
        fullName: fullName.trim(),
        rank,
        position,
        badgeNumber: badgeNumber.trim(),
        department: finalDepartment,
        phoneNumber: phoneNumber.trim(),
        yearOfBirth: yearOfBirth ? Number(yearOfBirth) : undefined,
        status,
      } : o));

      // Update team memberIds
      if (setTeams && selectedTeamId) {
        setTeams(prev => prev.map(t => {
          if (t.id === selectedTeamId) {
            const currentMembers = t.memberIds || [];
            return currentMembers.includes(officerId) ? t : { ...t, memberIds: [...currentMembers, officerId] };
          } else {
            // Remove from other teams if moved
            return { ...t, memberIds: (t.memberIds || []).filter(mId => mId !== officerId) };
          }
        }));
      }

      addLog('Sửa thông tin cán bộ', `Đã cập nhật thông tin cho ${rank} ${fullName}${badgeNumber.trim() ? ` (Số hiệu: ${badgeNumber}).` : '.'}`);
    } else {
      // Create new
      const newOfficerId = `OFF_${Date.now()}`;
      const newOfficer: Officer = {
        id: newOfficerId,
        fullName: fullName.trim(),
        rank,
        position,
        badgeNumber: badgeNumber.trim(),
        department: finalDepartment,
        phoneNumber: phoneNumber.trim(),
        yearOfBirth: yearOfBirth ? Number(yearOfBirth) : undefined,
        status,
      };

      setOfficers(prev => [...prev, newOfficer]);

      // Automatically link to selected team
      if (setTeams && selectedTeamId) {
        setTeams(prev => prev.map(t => {
          if (t.id === selectedTeamId) {
            const currentMembers = t.memberIds || [];
            return currentMembers.includes(newOfficerId) ? t : { ...t, memberIds: [...currentMembers, newOfficerId] };
          }
          return t;
        }));
      }

      addLog('Thêm mới cán bộ', `Đã thêm mới cán bộ ${rank} ${fullName}${badgeNumber.trim() ? `, Số hiệu: ${badgeNumber}` : ''} vào ${finalDepartment}.`);
    }
    setShowModal(false);
  };

  // CSV / Text Parser for real officer list import
  const parseOfficerCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    
    const parsed: any[] = [];
    lines.forEach((line, idx) => {
      // Skip header row if matches common terms
      if (idx === 0 && (line.toLowerCase().includes('họ') || line.toLowerCase().includes('stt') || line.toLowerCase().includes('tên'))) {
        return;
      }
      const parts = line.split(/[,\t;|]/).map(p => p.trim());
      if (parts.length >= 1 && parts[0]) {
        // Find rank
        const rawRank = parts[1] || 'Thiếu úy';
        const matchedRank = ranks.find(r => r.toLowerCase() === rawRank.toLowerCase()) || 'Thiếu úy';
        
        // Find position
        const rawPos = parts[2] || 'Cán bộ';
        const matchedPos = positions.find(p => p.toLowerCase() === rawPos.toLowerCase()) || 'Cán bộ';

        parsed.push({
          fullName: parts[0],
          rank: matchedRank,
          position: matchedPos,
          badgeNumber: parts[3] || '',
          phoneNumber: parts[4] || '',
          yearOfBirth: parts[5] ? parseInt(parts[5], 10) || undefined : undefined,
          department: parts[6] || (teams.find(t => t.id === importTeamId)?.name || 'Đơn vị'),
          status: 'Đang công tác' as const,
        });
      }
    });
    return parsed;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseOfficerCsv(text);
        if (parsed.length > 0) {
          setImportedRows(parsed);
          setImportStatus('parsed');
        } else {
          alert('Không thể đọc dữ liệu danh sách! Vui lòng định dạng tệp gồm: Họ tên, Cấp bậc, Chức vụ, Số hiệu, SĐT, Năm sinh.');
        }
      };
      reader.readAsText(file);
    }
  };

  const saveImported = () => {
    let countAdded = 0;
    const targetTeam = teams.find(t => t.id === importTeamId);
    const addedIds: string[] = [];

    setOfficers(prev => {
      let current = [...prev];
      importedRows.forEach(row => {
        if (!row.badgeNumber || !current.some(o => o.badgeNumber === row.badgeNumber)) {
          const newId = `OFF_IMP_${Math.random().toString(36).substr(2, 9)}`;
          current.push({
            id: newId,
            ...row,
            department: targetTeam ? targetTeam.name : (row.department || 'Đơn vị')
          });
          addedIds.push(newId);
          countAdded++;
        }
      });
      return current;
    });

    if (setTeams && targetTeam) {
      setTeams(prev => prev.map(t => t.id === targetTeam.id ? {
        ...t,
        memberIds: Array.from(new Set([...(t.memberIds || []), ...addedIds]))
      } : t));
    }

    addLog('Nhập dữ liệu cán bộ từ file', `Đã import thành công ${countAdded} cán bộ chiến sĩ mới.`);
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
      (o.badgeNumber && o.badgeNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.phoneNumber && o.phoneNumber.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterTeamId !== 'all') {
      const team = teams.find(t => t.id === filterTeamId);
      if (team) {
        const isMember = (team.memberIds || []).includes(o.id) || team.leaderId === o.id;
        const isDept = (o.department || '').toLowerCase() === team.name.toLowerCase();
        return isMember || isDept;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Title & Top buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-650" />
            <span>Quản lý Cán bộ Chiến sĩ</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser?.role === 'doi' 
              ? `Cập nhật thông tin cán bộ chiến sĩ thuộc Đội quản lý`
              : currentUser?.role === 'to_dia_ban'
              ? `Cập nhật thông tin cán bộ chiến sĩ thuộc Tổ địa bàn`
              : `Đăng ký danh sách nhân sự, cấp bậc, chức vụ và số hiệu CAND toàn đơn vị`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Import Excel */}
          <button
            onClick={() => {
              setImportTeamId(accessibleTeams[0]?.id || '');
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Nhập từ Excel/CSV</span>
          </button>

          {/* Add New Officer */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Cán Bộ Mới</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo họ tên, số hiệu CAND hoặc số điện thoại..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-hidden shadow-2xs"
          />
        </div>

        {accessibleTeams.length > 0 && (
          <div className="sm:w-64">
            <select
              value={filterTeamId}
              onChange={(e) => setFilterTeamId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-hidden shadow-2xs"
            >
              <option value="all">Tất cả đơn vị ({accessibleTeams.length})</option>
              {accessibleTeams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({getTeamTypeLabel(t.teamType)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Officers Table Card */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-150 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-4">Cấp bậc</th>
                <th className="py-3.5 px-4">Chức vụ</th>
                <th className="py-3.5 px-4 text-center">Năm sinh</th>
                <th className="py-3.5 px-4 text-center">Số hiệu CAND</th>
                <th className="py-3.5 px-4">Đơn vị / Đội công tác</th>
                <th className="py-3.5 px-4">Số điện thoại</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredOfficers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold">Chưa có cán bộ chiến sĩ nào. Hãy bấm "Thêm Cán Bộ Mới" bên trên.</p>
                  </td>
                </tr>
              ) : (
                filteredOfficers.map((officer) => {
                  const officerTeam = teams.find(t => (t.memberIds || []).includes(officer.id) || t.leaderId === officer.id);
                  const displayTeamName = officerTeam ? officerTeam.name : officer.department;

                  return (
                    <tr key={officer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{officer.fullName}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600">{officer.rank}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          officer.position === 'Đội trưởng' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : officer.position === 'Phó Đội trưởng' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {officer.position}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                        {officer.yearOfBirth || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600">
                        {officer.badgeNumber || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <Building2 className="w-3 h-3 text-blue-600" />
                          <span>{displayTeamName || 'Chưa gán Đội'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{officer.phoneNumber || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          officer.status === 'Đang công tác' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : officer.status === 'Tạm nghỉ' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {officer.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(officer)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(officer.id, officer.fullName)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa cán bộ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 p-4 border-t border-slate-150 text-xs text-slate-500 flex justify-between items-center font-medium">
          <span>Tổng số: <strong>{filteredOfficers.length}</strong> cán bộ chiến sĩ</span>
          <span className="font-semibold text-slate-600">Đơn vị: {settings.departmentName || 'Phòng Cảnh sát giao thông'}</span>
        </div>
      </div>

      {/* CRUD MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{editingOfficer ? 'Sửa thông tin Cán bộ Chiến sĩ' : 'Thêm mới Cán bộ Chiến sĩ'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cấp bậc CAND *</label>
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value as OfficerRank)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-semibold outline-hidden"
                  >
                    {ranks.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chức vụ *</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as OfficerPosition)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-semibold outline-hidden"
                  >
                    {positions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đơn vị / Đội công tác *
                  </label>
                  {accessibleTeams.length > 0 ? (
                    <select
                      value={selectedTeamId}
                      onChange={(e) => {
                        const tId = e.target.value;
                        setSelectedTeamId(tId);
                        const found = teams.find(t => t.id === tId);
                        if (found) setDepartment(found.name);
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-bold outline-hidden"
                    >
                      <option value="">--- Chọn Đội hoặc Tổ địa bàn ---</option>
                      {accessibleTeams.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({getTeamTypeLabel(t.teamType)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="VD: Đội CSGT ĐB số 4"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-bold outline-hidden"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số hiệu CAND</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="VD: 123-456"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs outline-hidden font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Năm sinh</label>
                  <input
                    type="number"
                    min={1950}
                    max={2100}
                    value={yearOfBirth}
                    onChange={(e) => setYearOfBirth(e.target.value)}
                    placeholder="VD: 1990"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái công tác</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs outline-hidden"
                  >
                    <option value="Đang công tác">Đang công tác</option>
                    <option value="Tạm nghỉ">Tạm nghỉ</option>
                    <option value="Chuyển công tác">Chuyển công tác</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
                >
                  {editingOfficer ? 'Lưu thay đổi' : 'Thêm cán bộ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Nhập danh sách Cán bộ từ File</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {accessibleTeams.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gán vào Đội / Tổ địa bàn *</label>
                  <select
                    value={importTeamId}
                    onChange={(e) => setImportTeamId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-bold outline-hidden"
                  >
                    {accessibleTeams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({getTeamTypeLabel(t.teamType)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {importStatus === 'idle' && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 border-2 border-dashed border-slate-250 rounded-2xl text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-50"
                  >
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Bấm vào đây để chọn tệp CSV / Text</p>
                    <p className="text-[11px] text-slate-400 mt-1">Định dạng mỗi dòng: Họ tên, Cấp bậc, Chức vụ, Số hiệu CAND, SĐT, Năm sinh</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {importStatus === 'parsed' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đã đọc thành công {importedRows.length} cán bộ chiến sĩ từ tệp.</span>
                  </div>

                  <div className="max-h-[180px] overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5">
                    {importedRows.map((r, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                        <span className="font-bold text-slate-800">{r.fullName} ({r.rank})</span>
                        <span className="text-[11px] text-slate-500">{r.position} • {r.badgeNumber || 'Không SH'}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setImportStatus('idle')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                    >
                      Chọn lại
                    </button>
                    <button
                      onClick={saveImported}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm"
                    >
                      Lưu {importedRows.length} cán bộ vào hệ thống
                    </button>
                  </div>
                </div>
              )}

              {importStatus === 'done' && (
                <div className="p-8 text-center space-y-2 text-emerald-600 font-bold text-sm">
                  <Check className="w-8 h-8 mx-auto" />
                  <p>Nhập dữ liệu thành công!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-800 text-sm">Xác nhận xóa cán bộ</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa cán bộ chiến sĩ <strong>"{deleteConfirm.name}"</strong>? Hành động này sẽ gỡ cán bộ khỏi các tổ tuần tra và lịch phân công.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
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
