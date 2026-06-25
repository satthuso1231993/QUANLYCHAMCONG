import React, { useState } from 'react';
import { SystemSettings, AuditLog, User, Officer, UserRole, OvernightShiftAttendanceMode } from '../types';
import { getSQLiteSchema } from '../utils/helpers';
import { Settings, Shield, Lock, FileText, Database, Check, History, Save, RefreshCw, AlertTriangle, Download, ArrowUp, Users, Trash2, Edit2, Plus } from 'lucide-react';

interface SecurityAndSettingsProps {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  auditLogs: AuditLog[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLog[]>>;
  currentUser: User;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  addLog: (action: string, details: string) => void;
  exportDatabaseState: () => void;
  importDatabaseState: (e: React.ChangeEvent<HTMLInputElement>) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  officers: Officer[];
}

export default function SecurityAndSettings({
  settings,
  setSettings,
  auditLogs,
  setAuditLogs,
  currentUser,
  setCurrentUser,
  addLog,
  exportDatabaseState,
  importDatabaseState,
  users,
  setUsers,
  officers,
}: SecurityAndSettingsProps) {
  const [activeTab, setActiveTab] = useState<'rates' | 'password' | 'logs' | 'backup' | 'accounts'>('rates');
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<{ id: string; name: string; usernameStr: string } | null>(null);

  // Rate fields
  const [rationRate, setRationRate] = useState(settings.rationRate);
  const [nightShiftRate, setNightShiftRate] = useState(settings.nightShiftRate);
  const [departmentName, setDepartmentName] = useState(settings.departmentName);
  const [unitName, setUnitName] = useState(settings.unitName);
  const [overnightShiftAttendanceMode, setOvernightShiftAttendanceMode] = useState<OvernightShiftAttendanceMode>(
    settings.overnightShiftAttendanceMode || 'standard'
  );

  // Symbol fields with safe fallbacks
  const [symbolWork, setSymbolWork] = useState(settings.symbolWork || 'x');
  const [symbolMission, setSymbolMission] = useState(settings.symbolMission || 'Ct');
  const [symbolStudy, setSymbolStudy] = useState(settings.symbolStudy || 'H');
  const [symbolLeave, setSymbolLeave] = useState(settings.symbolLeave || 'P');
  const [symbolCompensation, setSymbolCompensation] = useState(settings.symbolCompensation || 'Nb');
  const [symbolMaternity, setSymbolMaternity] = useState(settings.symbolMaternity || 'Ts');
  const [symbolRest, setSymbolRest] = useState(settings.symbolRest || 'Nd');

  // Signer fields with safe fallbacks
  const [signerPreparer, setSignerPreparer] = useState(settings.signerPreparer || 'Thiếu tá Đào Hải Dương');
  const [signerCommander, setSignerCommander] = useState(settings.signerCommander || 'Trung tá Nguyễn Khánh Tiên');
  const [signerLeader, setSignerLeader] = useState(settings.signerLeader || 'Thượng tá Nguyễn Thành Phương');
  const [signerPreparerTitle, setSignerPreparerTitle] = useState(settings.signerPreparerTitle || 'NGƯỜI CHẤM CÔNG');
  const [signerCommanderTitle, setSignerCommanderTitle] = useState(settings.signerCommanderTitle || 'CHỈ HUY ĐỘI');
  const [signerCommanderSubTitle, setSignerCommanderSubTitle] = useState(settings.signerCommanderSubTitle || 'ĐỘI TRƯỞNG');
  const [signerLeaderTitle, setSignerLeaderTitle] = useState(settings.signerLeaderTitle || 'LÃNH ĐẠO ĐƠN VỊ');
  const [signerLeaderActingTitle, setSignerLeaderActingTitle] = useState(settings.signerLeaderActingTitle || 'KT. TRƯỞNG PHÒNG');
  const [signerLeaderSubTitle, setSignerLeaderSubTitle] = useState(settings.signerLeaderSubTitle || 'PHÓ TRƯỞNG PHÒNG');
  const [signerLeaderSealTitle, setSignerLeaderSealTitle] = useState(settings.signerLeaderSealTitle || 'TRƯỞNG PHÒNG CSGT');
  const [maxNightShiftCompensationTurns, setMaxNightShiftCompensationTurns] = useState(settings.maxNightShiftCompensationTurns || 10);

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Account creation & assignment state fields
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('officer_self');
  const [linkedOfficerIdState, setLinkedOfficerIdState] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');

  // Handle Create or Edit User Account
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError('');
    setAccountSuccess('');

    const formattedUsername = usernameInput.trim().toLowerCase().replace(/\s+/g, '');
    if (!formattedUsername) {
      setAccountError('Tên đăng nhập không được để trống!');
      return;
    }

    if (!fullNameInput.trim()) {
      setAccountError('Họ và tên không được để trống!');
      return;
    }

    // Check unique username if creating new
    if (!editingUserId) {
      const exists = users.some(u => u.username.toLowerCase() === formattedUsername);
      if (exists) {
        setAccountError('Tên đăng nhập này đã tồn tại trên hệ thống!');
        return;
      }
      if (!passwordInput) {
        setAccountError('Mật khẩu là bắt buộc khi tạo tài khoản mới!');
        return;
      }
    }

    let updatedUsersList: User[];

    if (editingUserId) {
      // Edit mode
      updatedUsersList = users.map(u => {
        if (u.id === editingUserId) {
          return {
            ...u,
            username: formattedUsername,
            fullName: fullNameInput.trim(),
            password: passwordInput ? passwordInput : u.password,
            role: roleInput,
            officerId: linkedOfficerIdState || undefined,
          };
        }
        return u;
      });
      addLog('Cập nhật tài khoản', `Đã cập nhật cấu hình tài khoản '${formattedUsername}' (${roleInput}).`);
      setAccountSuccess('Cập nhật thông tin phân quyền tài khoản thành công!');
    } else {
      // Create mode
      const newUser: User = {
        id: `USER_${Date.now()}`,
        username: formattedUsername,
        password: passwordInput,
        role: roleInput,
        fullName: fullNameInput.trim(),
        officerId: linkedOfficerIdState || undefined,
      };
      updatedUsersList = [...users, newUser];
      addLog('Tạo tài khoản mới', `Đã tạo tài khoản công vụ mới '${formattedUsername}' cấp quyền: ${roleInput}.`);
      setAccountSuccess('Cấp tài khoản mới và thiết lập phân quyền thành công!');
    }

    setUsers(updatedUsersList);
    
    // Clear form
    setEditingUserId(null);
    setUsernameInput('');
    setFullNameInput('');
    setPasswordInput('');
    setRoleInput('officer_self');
    setLinkedOfficerIdState('');

    setTimeout(() => {
      setAccountSuccess('');
    }, 5000);
  };

  // Start editing user details
  const handleEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUsernameInput(u.username);
    setFullNameInput(u.fullName);
    setPasswordInput(u.password || '');
    setRoleInput(u.role);
    setLinkedOfficerIdState(u.officerId || '');
    setAccountError('');
    setAccountSuccess('');
  };

  // Delete user account
  const handleDeleteUser = (id: string, name: string, usernameStr: string) => {
    if (id === currentUser.id) {
      alert('Không thể tự xóa tài khoản của chính mình đang thao tác!');
      return;
    }
    if (usernameStr === 'admin') {
      alert('Không thể xóa tài khoản Quản trị tối cao (admin)!');
      return;
    }

    setDeleteUserConfirm({ id, name, usernameStr });
  };

  const executeDeleteUser = () => {
    if (!deleteUserConfirm) return;
    const { id, name, usernameStr } = deleteUserConfirm;
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    addLog('Xóa tài khoản', `Đã xóa tài khoản công vụ '${usernameStr}' khỏi hệ thống.`);
    alert(`Đã xóa tài khoản '${usernameStr}' khỏi hệ thống thành công.`);
    setDeleteUserConfirm(null);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setUsernameInput('');
    setFullNameInput('');
    setPasswordInput('');
    setRoleInput('officer_self');
    setLinkedOfficerIdState('');
    setAccountError('');
  };

  // Save Settings
  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings({
      rationRate,
      nightShiftRate,
      departmentName,
      unitName,
      overnightShiftAttendanceMode,
      symbolWork,
      symbolMission,
      symbolStudy,
      symbolLeave,
      symbolCompensation,
      symbolMaternity,
      symbolRest,
      signerPreparer,
      signerCommander,
      signerLeader,
      signerPreparerTitle,
      signerCommanderTitle,
      signerCommanderSubTitle,
      signerLeaderTitle,
      signerLeaderActingTitle,
      signerLeaderSubTitle,
      signerLeaderSealTitle,
      maxNightShiftCompensationTurns,
    });
    addLog(
      'Thay đổi cấu hình',
      `Cập nhật mức định lượng: ${rationRate.toLocaleString()}đ, mức làm đêm: ${nightShiftRate.toLocaleString()}đ, số lượt tối đa hưởng làm đêm: ${maxNightShiftCompensationTurns}, phương án tính ca qua đêm: ${overnightShiftAttendanceMode === 'standard' ? 'Tính chuẩn' : overnightShiftAttendanceMode === 'overnight_only_next_day' ? 'Chỉ tính cho ngày hôm sau' : 'Chia 0.5-0.5 (<=22:00 và >02:00)'}, các ký hiệu chấm công và thông tin người ký phê duyệt.`
    );
    alert('Cập nhật cấu hình hệ thống thành công!');
  };

  // Change Password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('Vui lòng điền đầy đủ thông tin mật khẩu!');
      return;
    }
    if (oldPassword !== '123456') {
      alert('Mật khẩu hiện tại không hợp lệ! Mật khẩu mặc định là 123456.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu mới và mật khẩu xác nhận không trùng khớp!');
      return;
    }
    setPasswordSuccess('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới để đăng nhập ở những lần tiếp theo.');
    addLog('Đổi mật khẩu', `Tài khoản '${currentUser.username}' đổi mật khẩu quản trị thành công.`);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setPasswordSuccess('');
    }, 5000);
  };

  // Export SQL DDL layout
  const handleCopySQL = () => {
    const sql = getSQLiteSchema();
    navigator.clipboard.writeText(sql);
    alert('Đã sao chép SQLite DDL Schema vào bộ nhớ tạm!');
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-xl font-bold text-slate-800">Cài đặt Hệ thống & Bảo mật</h2>
        <p className="text-sm text-slate-500 mt-1">
          Cấu hình định mức tài chính, quản lý tài khoản, xem nhật ký kiểm soát an ninh và sao lưu dữ liệu SQLite
        </p>
      </div>

      {/* Grid structure with local tabbed view */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Left Side: Settings category selection */}
        <div className="bg-white rounded-xl border border-slate-150 shadow-2xs overflow-hidden h-fit">
          <div className="p-3 bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
            Phân mục thiết lập
          </div>
          
          <div className="divide-y divide-slate-100">
            <button
              onClick={() => setActiveTab('rates')}
              className={`w-full text-left px-4 py-3 text-xs font-semibold flex items-center gap-3 transition-colors ${
                activeTab === 'rates' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Cấu hình Định mức</span>
            </button>

            <button
              onClick={() => setActiveTab('password')}
              className={`w-full text-left px-4 py-3 text-xs font-semibold flex items-center gap-3 transition-colors ${
                activeTab === 'password' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Đổi mật khẩu tài khoản</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full text-left px-4 py-3 text-xs font-semibold flex items-center gap-3 transition-colors ${
                activeTab === 'logs' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Nhật ký hệ thống</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`w-full text-left px-4 py-3 text-xs font-semibold flex items-center gap-3 transition-colors ${
                activeTab === 'backup' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>Sao lưu / Khôi phục</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('accounts')}
                className={`w-full text-left px-4 py-3 text-xs font-semibold flex items-center gap-3 transition-colors ${
                  activeTab === 'accounts' ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600' : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Quản lý Phân quyền</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Tab content */}
        <div className="md:col-span-3 bg-white p-6 rounded-xl border border-slate-150 shadow-xs">
          
          {/* TAB 1: RATES AND ORG NAMES */}
          {activeTab === 'rates' && (
            <form onSubmit={handleSaveRates} className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">Cấu hình thông tin cơ quan & Mức chi phí</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cong an Cap tren */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cơ quan chủ quản cấp trên</label>
                  <input
                    type="text"
                    required
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="VD: CÔNG AN TỈNH LÂM ĐỒNG"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                {/* Ten phong */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tên phòng nghiệp vụ</label>
                  <input
                    type="text"
                    required
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="VD: PHÒNG CẢNH SÁT GIAO THÔNG"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                {/* Dinh luong */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mức ăn định lượng ban ngày (đồng/ngày) *</label>
                  <input
                    type="number"
                    required
                    value={rationRate}
                    onChange={(e) => setRationRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-mono outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Áp dụng cho ngày Tuần tra kiểm soát thực địa. Mặc định: 75.000đ</span>
                </div>

                {/* Lam dem */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Đơn giá bồi dưỡng làm đêm (đồng/lượt) *</label>
                  <input
                    type="number"
                    required
                    value={nightShiftRate}
                    onChange={(e) => setNightShiftRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-mono outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Khung giờ giao cắt 22:00 đến 06:00 sáng. Mặc định: 200.000đ</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Số lượt tối đa hưởng bồi dưỡng làm đêm *</label>
                  <input
                    type="number"
                    required
                    value={maxNightShiftCompensationTurns}
                    onChange={(e) => setMaxNightShiftCompensationTurns(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-mono outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Số lượt tối đa công nhận để tính bồi dưỡng làm đêm. Mặc định: 10</span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phương án tính công ca qua đêm *</label>
                  <div className="bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="standard"
                        checked={overnightShiftAttendanceMode === 'standard'}
                        onChange={() => setOvernightShiftAttendanceMode('standard')}
                      />
                      <span className="text-xs text-slate-700">Tính chuẩn</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="overnight_only_next_day"
                        checked={overnightShiftAttendanceMode === 'overnight_only_next_day'}
                        onChange={() => setOvernightShiftAttendanceMode('overnight_only_next_day')}
                      />
                      <span className="text-xs text-slate-700">Ca đêm: chỉ tính cho ngày hôm sau</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="overnight_half_split_if_22_to_after_2"
                        checked={overnightShiftAttendanceMode === 'overnight_half_split_if_22_to_after_2'}
                        onChange={() => setOvernightShiftAttendanceMode('overnight_half_split_if_22_to_after_2')}
                      />
                      <span className="text-xs text-slate-700">Ca qua đêm: chia 0.5-0.5 (đến/sớm hơn 22:00 và kết thúc sau 02:00)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 block">
                      Áp dụng cho lịch tuần tra có giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu (qua 0:00).
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom symbols grid */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cấu hình ký hiệu viết tắt trên bảng chấm công</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Làm việc ngày (X/x)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolWork}
                      onChange={(e) => setSymbolWork(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đi Công tác (Ct)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolMission}
                      onChange={(e) => setSymbolMission(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đi Học tập (H)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolStudy}
                      onChange={(e) => setSymbolStudy(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nghỉ phép (P)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolLeave}
                      onChange={(e) => setSymbolLeave(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nghỉ bù (Nb)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolCompensation}
                      onChange={(e) => setSymbolCompensation(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nghỉ thai sản (Ts)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolMaternity}
                      onChange={(e) => setSymbolMaternity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nghỉ dưỡng (Nd)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={symbolRest}
                      onChange={(e) => setSymbolRest(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs text-center font-bold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Signers names */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cấu hình chức danh & Người ký phê duyệt biểu mẫu</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Người lập biểu/Chấm công</label>
                    <input
                      type="text"
                      required
                      value={signerPreparer}
                      onChange={(e) => setSignerPreparer(e.target.value)}
                      placeholder="VD: Thiếu tá Đào Hải Dương"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Chỉ huy Đội (Đội trưởng)</label>
                    <input
                      type="text"
                      required
                      value={signerCommander}
                      onChange={(e) => setSignerCommander(e.target.value)}
                      placeholder="VD: Trung tá Nguyễn Khánh Tiên"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Lãnh đạo đơn vị (KT. Trưởng phòng)</label>
                    <input
                      type="text"
                      required
                      value={signerLeader}
                      onChange={(e) => setSignerLeader(e.target.value)}
                      placeholder="VD: Thượng tá Nguyễn Thành Phương"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Chức danh (Người lập)</label>
                    <input
                      type="text"
                      required
                      value={signerPreparerTitle}
                      onChange={(e) => setSignerPreparerTitle(e.target.value)}
                      placeholder="VD: NGƯỜI CHẤM CÔNG"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Chức danh (Chỉ huy)</label>
                      <input
                        type="text"
                        required
                        value={signerCommanderTitle}
                        onChange={(e) => setSignerCommanderTitle(e.target.value)}
                        placeholder="VD: CHỈ HUY ĐỘI"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dòng phụ</label>
                      <input
                        type="text"
                        required
                        value={signerCommanderSubTitle}
                        onChange={(e) => setSignerCommanderSubTitle(e.target.value)}
                        placeholder="VD: ĐỘI TRƯỞNG"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Chức danh (Lãnh đạo)</label>
                      <input
                        type="text"
                        required
                        value={signerLeaderTitle}
                        onChange={(e) => setSignerLeaderTitle(e.target.value)}
                        placeholder="VD: LÃNH ĐẠO ĐƠN VỊ"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dòng phụ 1</label>
                        <input
                          type="text"
                          required
                          value={signerLeaderActingTitle}
                          onChange={(e) => setSignerLeaderActingTitle(e.target.value)}
                          placeholder="VD: KT. TRƯỞNG PHÒNG"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-[11px] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dòng phụ 2</label>
                        <input
                          type="text"
                          required
                          value={signerLeaderSubTitle}
                          onChange={(e) => setSignerLeaderSubTitle(e.target.value)}
                          placeholder="VD: PHÓ TRƯỞNG PHÒNG"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-[11px] font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh đóng dấu</label>
                      <input
                        type="text"
                        required
                        value={signerLeaderSealTitle}
                        onChange={(e) => setSignerLeaderSealTitle(e.target.value)}
                        placeholder="VD: TRƯỞNG PHÒNG CSGT"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-[11px] font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Cập nhật cấu hình</span>
              </button>
            </form>
          )}

          {/* TAB 2: PASSWORD CHANGE */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">Đổi mật khẩu người dùng</h3>
              </div>

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-semibold">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu cũ *</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại (VD: 123456)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu mới *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Xác nhận mật khẩu mới *</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại chính xác mật khẩu mới"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Cập nhật mật mật khẩu mới
              </button>
            </form>
          )}

          {/* TAB 3: SYSTEM AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Nhật ký Hệ thống (Audit Logs)</h3>
                </div>
                <button
                  onClick={() => {
                    setAuditLogs([]);
                    alert('Đã xóa trắng nhật ký hệ thống!');
                  }}
                  className="text-[10px] text-rose-600 hover:underline font-semibold"
                >
                  Xóa lịch sử log
                </button>
              </div>

              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-400 text-xs py-12 text-center">Chưa ghi nhận hoạt động nào của hệ thống.</p>
                ) : (
                  [...auditLogs]
                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                    .map((log) => {
                      const logDateStr = new Date(log.timestamp).toLocaleString('vi-VN');
                      return (
                        <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs flex justify-between gap-4">
                          <div>
                            <p className="font-bold text-slate-800">{log.action}</p>
                            <p className="text-slate-500 mt-1 font-medium">{log.details}</p>
                            <span className="text-[10px] text-slate-400 mt-2 block">Thực hiện bởi: {log.userFullName} ({log.username})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 py-1">{logDateStr}</span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SQL BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">Sao lưu & Khôi phục dữ liệu cục bộ</h3>
              </div>

              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg flex gap-3 text-xs leading-relaxed text-blue-800">
                <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold">Khóa lưu trữ dữ liệu an toàn - Offline 100%</p>
                  <p className="mt-1 font-medium">Toàn bộ dữ liệu của phòng được lưu trong ổ đĩa cứng của thiết bị thông qua hệ quản trị cơ sở dữ liệu SQLite cục bộ. Hãy chủ động tải về file sao lưu định kỳ để bảo hiểm sự cố máy tính phần cứng.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-5 border border-slate-200 hover:border-slate-350 transition-colors bg-slate-100/30 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Xuất Sao Lưu mới</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Xuất toàn bộ dữ liệu hiện hành (officers, teams, schedules...) ra file <strong className="font-bold text-slate-700">backup.db</strong> chuẩn hóa để lưu trữ hoặc nạp sang máy tính dự phòng.</p>
                  </div>

                  <button
                    onClick={exportDatabaseState}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải về file backup.db</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-5 border border-slate-200 hover:border-slate-350 transition-colors bg-slate-100/30 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Khôi phục từ File</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Chọn file <strong className="font-bold text-slate-700">backup.db</strong> (hoặc cấu trúc database cũ) được xuất ra trước đó để nạp phục hồi nguyên trạng vào hệ thống.</p>
                  </div>

                  <label className="w-full cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg">
                    <Save className="w-4 h-4 text-emerald-600" />
                    <span>Nạp file khôi phục</span>
                    <input
                      type="file"
                      accept=".db,.json"
                      onChange={importDatabaseState}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500">Xem trước SQL Schema DDL khởi tạo SQLite:</span>
                <button
                  onClick={handleCopySQL}
                  className="px-3.5 py-1.5 text-blue-600 font-bold bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200"
                >
                  Sao chép SQLite Schema DDL
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNT & ROLE MANAGEMENT (ADMIN ONLY) */}
          {activeTab === 'accounts' && currentUser.role === 'admin' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Quản lý Tài khoản & Phân quyền</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Trang dành riêng cho Quản trị viên khởi tạo và liên kết định danh người dùng ứng với Sổ bộ sỹ quan</p>
                </div>
              </div>

              {accountError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 text-xs rounded-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{accountError}</span>
                </div>
              )}

              {accountSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs rounded-lg font-semibold">
                  {accountSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form column */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 h-fit space-y-4">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    {editingUserId ? 'Cập nhật tài khoản' : 'Khởi tạo tài khoản mới'}
                  </h4>

                  <form onSubmit={handleSaveAccount} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Tên đăng nhập (viết liền, không dấu) *</label>
                      <input
                        type="text"
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="VD: nguyenvanb"
                        className="w-full px-3 py-2 bg-white border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Họ và tên người dùng *</label>
                      <input
                        type="text"
                        required
                        value={fullNameInput}
                        onChange={(e) => setFullNameInput(e.target.value)}
                        placeholder="VD: Nguyễn Văn B"
                        className="w-full px-3 py-2 bg-white border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        {editingUserId ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu đăng nhập *'}
                      </label>
                      <input
                        type="password"
                        required={!editingUserId}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Nhập mật khẩu"
                        className="w-full px-3 py-2 bg-white border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Vai trò truy cập *</label>
                      <select
                        required
                        value={roleInput}
                        onChange={(e) => setRoleInput(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-white border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                      >
                        <option value="admin">Quản trị tối cao (Admin)</option>
                        <option value="leader">Lãnh đạo Đội/Phòng (Leader)</option>
                        <option value="commander">Trực chỉ huy (Commander)</option>
                        <option value="team_leader">Tổ trưởng tuần tra (Team Leader)</option>
                        <option value="officer_self">Cán bộ chiến sĩ tự chấm (Self-attendance Officer)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Cán bộ liên kết danh tính</label>
                      <select
                        value={linkedOfficerIdState}
                        onChange={(e) => setLinkedOfficerIdState(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                      >
                        <option value="">--- Không liên kết (Không bắt buộc) ---</option>
                        {officers.filter(o => o.status === 'Đang công tác').map(o => (
                          <option key={o.id} value={o.id}>
                            {o.rank} - {o.fullName} ({o.badgeNumber})
                          </option>
                        ))}
                      </select>
                      {roleInput === 'officer_self' && !linkedOfficerIdState && (
                        <p className="text-[10px] text-amber-600 font-medium mt-1">⚠️ Cán bộ tự chấm công bắt buộc phải được liên kết danh tính để tự sửa ngày nghỉ của mình!</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        {editingUserId ? 'Cập nhật' : 'Cấp tài khoản'}
                      </button>
                      {editingUserId && (
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                        >
                          Hủy bỏ
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* List column */}
                <div className="lg:col-span-7 bg-white border border-slate-150 rounded-xl overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-150">
                    <h4 className="font-bold text-slate-800 text-xs">Danh sách tài khoản phân quyền ({users.length})</h4>
                  </div>

                  <div className="overflow-x-auto max-h-[410px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                          <th className="py-2.5 px-3">Tài khoản</th>
                          <th className="py-2.5 px-3">Họ và tên / Vai trò</th>
                          <th className="py-2.5 px-3">Liên kết danh tính</th>
                          <th className="py-2.5 px-3 text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {users.map(u => {
                          const linkedOfficer = officers.find(o => o.id === u.officerId);
                          
                          let roleBadgeColor = 'bg-slate-100 text-slate-700';
                          let roleNameText = 'Cán bộ tự chấm';
                          if (u.role === 'admin') {
                            roleBadgeColor = 'bg-rose-50 text-rose-700 border border-rose-100';
                            roleNameText = 'Quản trị viên';
                          } else if (u.role === 'leader') {
                            roleBadgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                            roleNameText = 'Lãnh đạo';
                          } else if (u.role === 'commander') {
                            roleBadgeColor = 'bg-purple-50 text-purple-700 border border-purple-100';
                            roleNameText = 'Trực chỉ huy';
                          } else if (u.role === 'team_leader') {
                            roleBadgeColor = 'bg-amber-50 text-amber-700 border border-amber-100';
                            roleNameText = 'Tổ trưởng';
                          }

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/30">
                              <td className="py-3 px-3">
                                <span className="font-bold text-blue-700 font-mono block">{u.username}</span>
                                <span className="text-[10px] text-slate-400">PW: {u.password ? '••••••' : 'Chưa đặt'}</span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="block font-semibold text-slate-800">{u.fullName}</span>
                                <span className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${roleBadgeColor}`}>
                                  {roleNameText}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-600">
                                {linkedOfficer ? (
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-700 block">{linkedOfficer.fullName}</span>
                                    <span className="text-[10px] text-slate-400">{linkedOfficer.rank} - {linkedOfficer.badgeNumber}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Không liên kết</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    className="p-1 rounded text-blue-600 hover:bg-blue-50"
                                    title="Chỉnh sửa thông tin"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.fullName, u.username)}
                                    className="p-1 rounded text-rose-600 hover:bg-rose-50 disabled:text-slate-200"
                                    disabled={u.username === 'admin' || u.id === currentUser.id}
                                    title="Xóa tài khoản"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Custom Confirmation Modal */}
      {deleteUserConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa tài khoản</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa tài khoản công vụ <strong className="text-slate-800">'{deleteUserConfirm.usernameStr}'</strong> ({deleteUserConfirm.name})?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setDeleteUserConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteUser}
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
