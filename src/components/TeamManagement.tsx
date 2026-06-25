import React, { useState } from 'react';
import { Officer, Team } from '../types';
import { Plus, Users, Shield, User, Edit2, Trash2, X, Check, CheckSquare, Square } from 'lucide-react';

interface TeamManagementProps {
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  officers: Officer[];
  addLog: (action: string, details: string) => void;
}

export default function TeamManagement({ teams, setTeams, officers, addLog }: TeamManagementProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const handleOpenAdd = () => {
    setEditingTeam(null);
    setName('');
    // Select first working officer as default leader candidates
    const activeOfficers = officers.filter(o => o.status === 'Đang công tác');
    setLeaderId(activeOfficers[0]?.id || '');
    setMemberIds([]);
    setShowModal(true);
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setLeaderId(team.leaderId);
    setMemberIds(team.memberIds);
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id, name } = deleteConfirm;
    setTeams(prev => prev.filter(t => t.id !== id));
    addLog('Giải tán tổ tuần tra', `Đã giải tán ${name}.`);
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
    if (!name.trim() || !leaderId) {
      alert('Vui lòng nhập Tên tổ tuần tra và bổ nhiệm Tổ trưởng!');
      return;
    }

    // Ensure leader is part of the members
    let finalMembers = [...memberIds];
    if (!finalMembers.includes(leaderId)) {
      finalMembers.push(leaderId);
    }

    if (editingTeam) {
      // Update
      setTeams(prev => prev.map(t => t.id === editingTeam.id ? {
        ...t,
        name,
        leaderId,
        memberIds: finalMembers
      } : t));
      addLog('Cấu trúc lại tổ tuần tra', `Đã cập nhật cơ cấu tổ của ${name}.`);
    } else {
      // New Team
      const newTeam: Team = {
        id: `TEAM_${Date.now()}`,
        name,
        leaderId,
        memberIds: finalMembers
      };
      setTeams(prev => [...prev, newTeam]);
      addLog('Thành lập tổ tuần tra mới', `Đã thành lập tổ tuần tra mới: ${name}.`);
    }
    setShowModal(false);
  };

  const activeOfficers = officers.filter(o => o.status === 'Đang công tác');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý Tổ Tuần tra Kiểm soát</h2>
          <p className="text-sm text-slate-500 mt-1">Lập danh sách cơ cấu tổ, chỉ định Tổ trưởng và định biên thành viên</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Tổ Tuần Tra</span>
        </button>
      </div>

      {/* Grid of Teams */}
      {teams.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-100 text-slate-400">
          Chưa thành lập biên chế tổ tuần tra kiểm soát nào. Vui lòng bấm "Thêm Tổ Tuần Tra".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const leader = officers.find(o => o.id === team.leaderId);
            // Members excluding leader
            const otherMemberIds = team.memberIds.filter(id => id !== team.leaderId);
            const otherMembers = otherMemberIds
              .map(id => officers.find(o => o.id === id))
              .filter(Boolean) as Officer[];

            return (
              <div key={team.id} className="bg-white rounded-xl border border-slate-150 shadow-xs hover:border-slate-350 transition-all overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Card Header */}
                  <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                        <Users className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm">{team.name}</h3>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenEdit(team)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                        title="Đổi cơ cấu"
                      >
                        <Edit2 className="w-3 h-3 animate-none" />
                      </button>
                      <button
                        onClick={() => handleDelete(team.id, team.name)}
                        className="p-1 text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                        title="Giải tán"
                      >
                        <Trash2 className="w-3 h-3 animate-none" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-4">
                    {/* Leader details */}
                    <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-100/50">
                      <span className="text-[10px] text-blue-600 uppercase font-bold tracking-wider flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        Tổ trưởng (Chỉ huy)
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
                        <p className="text-xs text-rose-500 italic mt-1">Chưa chỉ định tổ trưởng hoặc cán bộ bị xóa</p>
                      )}
                    </div>

                    {/* Member List */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Danh sách thành viên ({team.memberIds.length} CBCS)
                      </span>
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                        {team.memberIds.map(memId => {
                          const officer = officers.find(o => o.id === memId);
                          if (!officer) return null;
                          const isLeader = memId === team.leaderId;

                          return (
                            <div key={memId} className="flex items-center justify-between bg-slate-50 p-2 rounded-md border border-slate-100">
                              <span className="text-xs font-medium text-slate-700">
                                {officer.rank} {officer.fullName}
                              </span>
                              <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                <span className="font-mono bg-white px-1.5 py-0.5 rounded-sm border border-slate-150">
                                  {officer.badgeNumber}
                                </span>
                                {isLeader && (
                                  <span className="bg-amber-100 text-amber-700 font-semibold px-1 py-0.5 rounded-xs">
                                    T.Trưởng
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer status */}
                <div className="px-5 py-3 bg-slate-50 text-[11px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
                  <span>Trạng thái: Hoạt động</span>
                  <span className="font-semibold text-slate-600">Phòng CSGT Lâm Đồng</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD/EDIT TEAM MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingTeam ? 'Cấu trúc lại Tổ Tuần tra' : 'Thành lập Tổ Tuần tra mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tên tổ tuần tra *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Tổ Tuần tra Số 1, Tổ Cơ động..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                />
              </div>

              {/* Chỉ định Tổ trưởng */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Chỉ định Tổ trưởng *</label>
                <select
                  required
                  value={leaderId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setLeaderId(newId);
                    // Automatically append to memberIds if not exist
                    if (newId && !memberIds.includes(newId)) {
                      setMemberIds(prev => [...prev, newId]);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                >
                  <option value="" disabled>--- Chọn cán bộ làm Tổ trưởng ---</option>
                  {activeOfficers.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.rank} {o.fullName} ({o.badgeNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lực lượng biên chế */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider text-slate-500">
                  Phân công lực lượng biên chế tổ tuần tra (Chọn nhiều làm thành viên)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto border border-slate-200 rounded-lg p-3 scrollbar-thin">
                  {activeOfficers.map(o => {
                    const isSelected = memberIds.includes(o.id) || o.id === leaderId;
                    const isSelfLeader = o.id === leaderId;

                    return (
                      <div
                        key={o.id}
                        onClick={() => !isSelfLeader && handleToggleMember(o.id)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-200 text-blue-900' 
                            : 'bg-slate-50/50 border-slate-150 text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">
                            <strong className="font-semibold">{o.fullName}</strong> ({o.rank})
                          </span>
                        </div>

                        {isSelfLeader && (
                          <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full shrink-0">
                            Tổ trưởng
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                  Lưu cơ cấu tổ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900">Xác nhận giải tán tổ tuần tra</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Bạn có chắc chắn muốn giải tán <strong className="text-slate-800">{deleteConfirm.name}</strong>? Lịch sử tuần tra cũ vẫn được lưu giữ.
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
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
