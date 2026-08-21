import React, { useState, useMemo } from 'react';
import { Officer, SystemSettings, Team, User } from '../types';
import { Plus, Users, Shield, Edit2, Trash2, X, Check, CheckSquare, Square, Building2, MapPin, Radio, Layers, AlertCircle, Search } from 'lucide-react';
import { getTeamTypeLabel } from '../utils/accessScope';
import { getFixedPersonnelOfficers } from '../utils/personnel';

interface TeamManagementProps {
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  officers: Officer[];
  settings: SystemSettings;
  addLog: (action: string, details: string) => void;
  currentUser?: User;
}

type ViewFilter = 'all' | 'doi' | 'to_dia_ban' | 'to_ttks';

export default function TeamManagement({ teams, setTeams, officers, settings, addLog, currentUser }: TeamManagementProps) {
  const [activeTab, setActiveTab] = useState<ViewFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [teamType, setTeamType] = useState<'doi' | 'to_dia_ban' | 'to_ttks'>('doi');
  const [parentTeamId, setParentTeamId] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [officerSearch, setOfficerSearch] = useState('');

  const fixedPersonnelOfficers = getFixedPersonnelOfficers(officers);

  const isSuperManager = !currentUser || currentUser.role === 'admin' || currentUser.role === 'doi';

  const canEditTeam = (team: Team) => {
    if (isSuperManager) return true;
    if (currentUser?.role === 'to_dia_ban') {
      return team.id === currentUser.managedTeamId || team.parentTeamId === currentUser.managedTeamId;
    }
    return false;
  };

  const canDeleteTeam = (team: Team) => {
    return isSuperManager;
  };

  const doiTeams = teams.filter((t) => (t.teamType || 'doi') === 'doi');
  const diaBanTeams = teams.filter((t) => (t.teamType || 'doi') === 'to_dia_ban');
  const ttksTeams = teams.filter((t) => (t.teamType || 'doi') === 'to_ttks');

  const handleOpenAdd = (type: 'doi' | 'to_dia_ban' | 'to_ttks' = 'doi') => {
    setEditingTeam(null);
    setName('');
    setTeamType(type);
    setParentTeamId(type === 'to_dia_ban' && doiTeams.length > 0 ? doiTeams[0].id : '');
    setLeaderId('');
    setMemberIds([]);
    setShowModal(true);
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setTeamType(team.teamType || 'doi');
    setParentTeamId(team.parentTeamId || '');
    setLeaderId(team.leaderId || '');
    setMemberIds(team.memberIds || []);
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id, name } = deleteConfirm;
    setTeams(prev => prev.filter(t => t.id !== id));
    addLog('Xóa cơ cấu đơn vị', `Đã xóa đơn vị ${name} khỏi hệ thống.`);
    setDeleteConfirm(null);
  };

  const handleToggleMember = (officerId: string) => {
    setMemberIds(prev => {
      if (prev.includes(officerId)) {
        return prev.filter(id => id !== officerId);
      } else {
        return [...prev, officerId];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập Tên đơn vị / Tổ tuần tra!');
      return;
    }

    if (teamType === 'to_dia_ban' && !parentTeamId && doiTeams.length > 0) {
      alert('Tổ địa bàn phải được chọn gán trực thuộc một Đội!');
      return;
    }

    if (teamType === 'to_ttks' && !parentTeamId && (doiTeams.length > 0 || diaBanTeams.length > 0)) {
      alert('Tổ TTKS phải được chọn gán trực thuộc một Đội hoặc một Tổ địa bàn!');
      return;
    }

    let finalParentTeamId: string | undefined;
    if (teamType === 'doi') {
      finalParentTeamId = undefined;
    } else {
      finalParentTeamId = parentTeamId || undefined;
    }

    let finalMembers = [...memberIds];
    if (leaderId && !finalMembers.includes(leaderId)) {
      finalMembers.push(leaderId);
    }

    if (editingTeam) {
      // Update
      setTeams(prev => prev.map(t => t.id === editingTeam.id ? {
        ...t,
        name: name.trim(),
        teamType,
        parentTeamId: finalParentTeamId,
        leaderId: leaderId || '',
        memberIds: finalMembers
      } : t));
      addLog('Cập nhật cơ cấu tổ', `Đã cập nhật cơ cấu của ${name}.`);
    } else {
      // New Team
      const newTeam: Team = {
        id: `TEAM_${Date.now()}`,
        name: name.trim(),
        teamType,
        parentTeamId: finalParentTeamId,
        leaderId: leaderId || '',
        memberIds: finalMembers
      };
      setTeams(prev => [...prev, newTeam]);
      addLog('Thành lập đơn vị / tổ mới', `Đã khởi tạo: ${name} (${getTeamTypeLabel(teamType)}).`);
    }
    setShowModal(false);
  };

  const activeOfficers = fixedPersonnelOfficers.filter(o => o.status === 'Đang công tác');

  const selectableOfficers = useMemo(() => {
    let pool = activeOfficers;
    if (currentUser?.role === 'to_dia_ban') {
      const parentDoi = doiTeams.find(d => d.id === parentTeamId || d.id === editingTeam?.parentTeamId);
      if (parentDoi && parentDoi.memberIds && parentDoi.memberIds.length > 0) {
        const allowedSet = new Set([...parentDoi.memberIds, ...memberIds]);
        pool = activeOfficers.filter(o => allowedSet.has(o.id));
      }
    }
    return pool;
  }, [activeOfficers, currentUser, doiTeams, parentTeamId, editingTeam, memberIds]);

  const searchedOfficers = useMemo(() => {
    if (!officerSearch.trim()) return selectableOfficers;
    const q = officerSearch.toLowerCase();
    return selectableOfficers.filter(o => 
      o.fullName.toLowerCase().includes(q) || 
      o.badgeNumber.toLowerCase().includes(q) || 
      o.rank.toLowerCase().includes(q) ||
      o.position.toLowerCase().includes(q)
    );
  }, [selectableOfficers, officerSearch]);

  const filteredTeams = teams.filter(t => {
    if (activeTab === 'all') return true;
    return (t.teamType || 'doi') === activeTab;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-red-650" />
            <span>Quản lý Đơn vị & Cơ cấu Tổ đội</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Khởi tạo các <strong>Đội nghiệp vụ</strong>, <strong>Tổ địa bàn trực thuộc</strong> và <strong>Tổ TTKS tuần tra</strong>
          </p>
        </div>

        {/* Quick Add Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isSuperManager && (
            <>
              <button
                onClick={() => handleOpenAdd('doi')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Đội mới</span>
              </button>

              <button
                onClick={() => handleOpenAdd('to_dia_ban')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Tổ địa bàn</span>
              </button>
            </>
          )}

          <button
            onClick={() => handleOpenAdd('to_ttks')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Tổ TTKS</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div 
          onClick={() => setActiveTab('doi')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'doi' ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20' : 'bg-white border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cấp Đội</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">{doiTeams.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Đơn vị quản lý cấp trên</div>
        </div>

        <div 
          onClick={() => setActiveTab('to_dia_ban')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'to_dia_ban' ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-white border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổ địa bàn</span>
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">{diaBanTeams.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Trực thuộc các Đội</div>
        </div>

        <div 
          onClick={() => setActiveTab('to_ttks')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'to_ttks' ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20' : 'bg-white border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổ TTKS</span>
            <Radio className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700">{ttksTeams.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tuần tra kiểm soát trực tiếp</div>
        </div>

        <div 
          onClick={() => setActiveTab('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'all' ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20' : 'bg-white border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng Đơn Vị</span>
            <Layers className="w-4 h-4 text-slate-700" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-800">{teams.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Toàn bộ cơ cấu tổ chức</div>
        </div>
      </div>

      {/* Filter Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Tất cả cơ cấu ({teams.length})
        </button>

        <button
          onClick={() => setActiveTab('doi')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'doi'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-blue-700 hover:bg-blue-50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Danh mục Đội ({doiTeams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('to_dia_ban')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'to_dia_ban'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Danh mục Tổ địa bàn ({diaBanTeams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('to_ttks')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'to_ttks'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-purple-700 hover:bg-purple-50'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Tổ TTKS tuần tra ({ttksTeams.length})</span>
        </button>
      </div>

      {/* Grid of Teams */}
      {filteredTeams.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-150 text-slate-400 space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold">
            {activeTab === 'doi'
              ? 'Chưa có Đội nào được tạo. Hãy bấm "+ Thêm Đội mới" bên trên.'
              : activeTab === 'to_dia_ban'
              ? 'Chưa có Tổ địa bàn nào. Hãy bấm "+ Thêm Tổ địa bàn" bên trên.'
              : activeTab === 'to_ttks'
              ? 'Chưa có Tổ TTKS nào. Hãy bấm "+ Thêm Tổ TTKS" bên trên.'
              : 'Chưa có cơ cấu đơn vị nào được tạo trong hệ thống.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeams.map((team) => {
            const leader = officers.find(o => o.id === team.leaderId);
            const otherMemberIds = (team.memberIds || []).filter(id => id !== team.leaderId);
            const otherMembers = otherMemberIds
              .map(id => officers.find(o => o.id === id))
              .filter(Boolean) as Officer[];

            // Subordinate units if this is a Đội
            const childDiaBan = diaBanTeams.filter(d => d.parentTeamId === team.id);
            const childTtks = ttksTeams.filter(t => t.parentTeamId === team.id);
            const parentTeam = teams.find(p => p.id === team.parentTeamId);

            return (
              <div 
                key={team.id} 
                className="bg-white rounded-2xl border border-slate-150 shadow-xs hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-xl mt-0.5 ${
                        team.teamType === 'doi'
                          ? 'bg-blue-100 text-blue-700'
                          : team.teamType === 'to_dia_ban'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {team.teamType === 'doi' ? (
                          <Building2 className="w-4 h-4" />
                        ) : team.teamType === 'to_dia_ban' ? (
                          <MapPin className="w-4 h-4" />
                        ) : (
                          <Radio className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-sm leading-tight">{team.name}</h3>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              team.teamType === 'doi'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : team.teamType === 'to_dia_ban'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {getTeamTypeLabel(team.teamType)}
                          </span>

                          {parentTeam && (
                            <span className="text-[10px] text-slate-500 font-semibold">
                              • Thuộc: <strong>{parentTeam.name}</strong>
                            </span>
                          )}
                        </div>

                        {team.teamType !== 'doi' && !team.parentTeamId && (
                          <p className="text-[10px] text-rose-700 font-bold mt-1 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 inline-block">
                            ⚠️ Chưa gán Đội/Đơn vị cấp trên
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {canEditTeam(team) && (
                        <button
                          onClick={() => handleOpenEdit(team)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Chỉnh sửa cơ cấu & quân số"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteTeam(team) && (
                        <button
                          onClick={() => handleDelete(team.id, team.name)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa đơn vị"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-4">
                    {/* Subordinate hierarchy overview if Đội */}
                    {team.teamType === 'doi' && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Đơn vị trực thuộc Đội ({childDiaBan.length + childTtks.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {childDiaBan.map(d => (
                            <span key={d.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              📍 {d.name}
                            </span>
                          ))}
                          {childTtks.map(t => (
                            <span key={t.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              🚔 {t.name}
                            </span>
                          ))}
                          {childDiaBan.length === 0 && childTtks.length === 0 && (
                            <span className="text-[10px] text-slate-400 italic">Chưa có Tổ địa bàn hoặc Tổ TTKS trực thuộc</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Leader details */}
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-700 uppercase font-bold tracking-wider flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        {team.teamType === 'doi' ? 'Chỉ huy Đội (Đội trưởng)' : 'Tổ trưởng (Chỉ huy tổ)'}
                      </span>
                      {leader ? (
                        <div className="mt-1.5 flex items-baseline justify-between">
                          <p className="text-xs font-bold text-slate-800">
                            {leader.rank} {leader.fullName}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-500 font-mono">
                            SH: {leader.badgeNumber}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-1">(Chưa chỉ định Chỉ huy / Tổ trưởng)</p>
                      )}
                    </div>

                    {/* Member List */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Danh sách quân số ({team.memberIds ? team.memberIds.length : 0} CBCS)
                      </span>
                      <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                        {otherMembers.map(m => (
                          <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700">
                            <span className="font-semibold">{m.rank} {m.fullName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{m.position}</span>
                          </div>
                        ))}
                        {otherMembers.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic py-1">Chưa phân công thêm thành viên</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT TEAM */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingTeam ? `Cập nhật: ${editingTeam.name}` : `Khởi tạo ${getTeamTypeLabel(teamType)} mới`}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Cấp độ đơn vị *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTeamType('doi');
                      setParentTeamId('');
                    }}
                    className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      teamType === 'doi'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Cấp Đội
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTeamType('to_dia_ban');
                      if (!parentTeamId && doiTeams.length > 0) setParentTeamId(doiTeams[0].id);
                    }}
                    className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      teamType === 'to_dia_ban'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tổ địa bàn
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTeamType('to_ttks');
                      if (!parentTeamId && doiTeams.length > 0) setParentTeamId(doiTeams[0].id);
                    }}
                    className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      teamType === 'to_ttks'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tổ TTKS
                  </button>
                </div>
              </div>

              {/* Name field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên {teamType === 'doi' ? 'Đội' : teamType === 'to_dia_ban' ? 'Tổ địa bàn' : 'Tổ TTKS'} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    teamType === 'doi'
                      ? 'VD: Đội CSGT ĐB số 4'
                      : teamType === 'to_dia_ban'
                      ? 'VD: Tổ địa bàn Sơn Hoà'
                      : 'VD: Tổ TTKS Số 1'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-bold outline-hidden"
                />
              </div>

              {/* Parent Team Selection (for to_dia_ban & to_ttks) */}
              {teamType !== 'doi' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {teamType === 'to_dia_ban' ? 'Trực thuộc Đội nào? *' : 'Trực thuộc Đội hoặc Tổ địa bàn nào? *'}
                  </label>
                  <select
                    required
                    value={parentTeamId}
                    onChange={(e) => setParentTeamId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs font-semibold outline-hidden"
                  >
                    {teamType === 'to_dia_ban' ? (
                      <>
                        <option value="">--- Chọn Đội trực thuộc ---</option>
                        {doiTeams
                          .filter((t) => t.id !== editingTeam?.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} (Cấp Đội)
                            </option>
                          ))}
                      </>
                    ) : (
                      <>
                        <option value="">--- Chọn cấp trên ---</option>
                        <optgroup label="Cấp Đội">
                          {doiTeams.filter((t) => t.id !== editingTeam?.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                        <optgroup label="Cấp Tổ địa bàn">
                          {diaBanTeams.filter((t) => t.id !== editingTeam?.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Leader Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {teamType === 'doi' ? 'Chỉ định Chỉ huy Đội (Đội trưởng)' : 'Chỉ định Tổ trưởng / Chỉ huy'}
                </label>
                <select
                  value={leaderId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setLeaderId(newId);
                    if (newId && !memberIds.includes(newId)) {
                      setMemberIds(prev => [...prev, newId]);
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl text-xs outline-hidden"
                >
                  <option value="">(Chưa chỉ định — Sẽ bổ nhiệm sau)</option>
                  {selectableOfficers.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.rank} {o.fullName} ({o.badgeNumber}) - {o.position}
                    </option>
                  ))}
                </select>
                {selectableOfficers.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 Hiện chưa có cán bộ trong danh mục. Bạn cứ tạo Đội/Tổ trước rồi vào bổ nhiệm sau.
                  </p>
                )}
              </div>

              {/* Members Checklist */}
              {selectableOfficers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-slate-500">
                      Phân công CBCS vào đơn vị ({memberIds.length} đã chọn)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMemberIds(selectableOfficers.map(o => o.id))}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setMemberIds(leaderId ? [leaderId] : [])}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        Bỏ chọn hết
                      </button>
                    </div>
                  </div>

                  {/* Search input for CBCS checklist */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={officerSearch}
                      onChange={(e) => setOfficerSearch(e.target.value)}
                      placeholder="Tìm kiếm cán bộ theo tên, số hiệu hoặc cấp bậc..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-slate-200 rounded-xl p-3 scrollbar-thin">
                    {searchedOfficers.length === 0 ? (
                      <div className="col-span-2 text-center text-slate-400 text-xs py-3">
                        Không tìm thấy cán bộ chiến sĩ phù hợp
                      </div>
                    ) : (
                      searchedOfficers.map(o => {
                        const isSelected = memberIds.includes(o.id) || o.id === leaderId;
                        const isSelfLeader = o.id === leaderId;

                        return (
                          <div
                            key={o.id}
                            onClick={() => !isSelfLeader && handleToggleMember(o.id)}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold' 
                                : 'hover:bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className="truncate mr-2">
                              <span>{o.rank} {o.fullName}</span>
                              {isSelfLeader && <span className="ml-1 text-[10px] text-blue-600 font-bold">(Chỉ huy)</span>}
                            </div>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {editingTeam ? 'Lưu thay đổi' : 'Tạo đơn vị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 border border-slate-150 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-800 text-sm">Xác nhận xóa đơn vị</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa <strong>"{deleteConfirm.name}"</strong> khỏi hệ thống? Các phân công trực thuộc sẽ cần được cấu trúc lại.
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
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
