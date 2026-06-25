import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  User, Officer, Team, PatrolSchedule, Attendance, RationRecord, NightShiftRecord, Approval, AuditLog, SystemSettings 
} from './types';
import { 
  initialOfficers, initialTeams, initialPatrolSchedules, initialAttendance, initialRations, initialNightShifts, initialAuditLogs, initialSettings, generateRecordsFromSchedules
} from './data/initialData';

// Icons
import { 
  LayoutDashboard, Users, ShieldAlert, CalendarRange, ClipboardCheck, FileSpreadsheet, Settings, HelpCircle, LogOut, Check, Shield, User as UserIcon, Lock
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import OfficerManagement from './components/OfficerManagement';
import TeamManagement from './components/TeamManagement';
import PatrolSchedules from './components/PatrolSchedules';
import AttendanceManagement from './components/AttendanceManagement';
import ApprovalAndReports from './components/ApprovalAndReports';
import SecurityAndSettings from './components/SecurityAndSettings';
import DatabaseGuide from './components/DatabaseGuide';
import { hasSupabaseConfig, supabase } from './lib/supabaseClient';
import {
  loadAppStateFromSupabase,
  syncApprovalsToSupabase,
  syncAttendanceToSupabase,
  syncAuditLogsToSupabase,
  syncNightShiftsToSupabase,
  syncOfficersToSupabase,
  syncRationsToSupabase,
  syncSchedulesToSupabase,
  syncSettingsToSupabase,
  syncTeamsToSupabase,
  syncUsersToSupabase,
} from './lib/supabaseData';

type RemoteAppState = Awaited<ReturnType<typeof loadAppStateFromSupabase>>;

export default function App() {
  const appName = 'Chấm Công và Định lượng CSGT';
  const defaultCurrentUser: User = {
    id: '',
    username: '',
    fullName: '',
    role: 'admin',
  };
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Core Database States
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedules, setSchedules] = useState<PatrolSchedule[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [rations, setRations] = useState<RationRecord[]>([]);
  const [nightShifts, setNightShifts] = useState<NightShiftRecord[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(defaultCurrentUser);

  // Sidebar navigation active state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isCloudBootstrapping, setIsCloudBootstrapping] = useState<boolean>(hasSupabaseConfig);
  const [cloudSyncError, setCloudSyncError] = useState<string>('');
  const hasHydratedSupabaseRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const syncedStateRef = useRef({
    users: '[]',
    officers: '[]',
    teams: '[]',
    schedules: '[]',
    attendance: '[]',
    rations: '[]',
    nightShifts: '[]',
    approvals: '[]',
    auditLogs: '[]',
    settings: JSON.stringify(initialSettings),
  });
  const getSignature = (value: unknown) => JSON.stringify(value);
  const applyRemoteState = useCallback((remote: RemoteAppState) => {
    const nextSettings = remote.settings ?? initialSettings;
    syncedStateRef.current = {
      users: getSignature(remote.users),
      officers: getSignature(remote.officers),
      teams: getSignature(remote.teams),
      schedules: getSignature(remote.schedules),
      attendance: getSignature(remote.attendance),
      rations: getSignature(remote.rations),
      nightShifts: getSignature(remote.nightShifts),
      approvals: getSignature(remote.approvals),
      auditLogs: getSignature(remote.auditLogs),
      settings: getSignature(nextSettings),
    };
    setUsers(remote.users);
    setOfficers(remote.officers);
    setTeams(remote.teams);
    setSchedules(remote.schedules);
    setAttendance(remote.attendance);
    setRations(remote.rations);
    setNightShifts(remote.nightShifts);
    setApprovals(remote.approvals);
    setAuditLogs(remote.auditLogs);
    setSettings(nextSettings);
  }, []);
  const refreshFromSupabase = useCallback(async ({ showLoader = false }: { showLoader?: boolean } = {}) => {
    if (!hasSupabaseConfig) {
      setCloudSyncError('Ứng dụng chưa được cấu hình Supabase.');
      return;
    }
    if (showLoader) {
      setIsCloudBootstrapping(true);
    }
    try {
      const remote = await loadAppStateFromSupabase();
      applyRemoteState(remote);
      setCloudSyncError('');
    } catch (error) {
      console.error('Supabase bootstrap error:', error);
      setCloudSyncError('Không thể đồng bộ dữ liệu từ Supabase. Vui lòng kiểm tra schema, quyền truy cập và kết nối mạng.');
    } finally {
      if (showLoader) {
        hasHydratedSupabaseRef.current = true;
        setIsCloudBootstrapping(false);
      }
    }
  }, [applyRemoteState]);
  const syncStateToSupabase = useCallback(
    async <T,>(
      key: keyof typeof syncedStateRef.current,
      value: T,
      syncer: (payload: T) => Promise<void>,
      errorMessage: string,
    ) => {
      if (!hasSupabaseConfig || !hasHydratedSupabaseRef.current) return;
      const signature = getSignature(value);
      if (signature === syncedStateRef.current[key]) return;
      try {
        await syncer(value);
        syncedStateRef.current[key] = signature;
        setCloudSyncError('');
      } catch (error) {
        console.error(errorMessage, error);
        setCloudSyncError(errorMessage);
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsCloudBootstrapping(false);
      hasHydratedSupabaseRef.current = false;
      setCloudSyncError('Ứng dụng yêu cầu Supabase và không còn dùng dữ liệu local.');
      return;
    }

    const hydrateFromSupabase = async () => {
      await refreshFromSupabase({ showLoader: true });
    };

    void hydrateFromSupabase();
  }, [refreshFromSupabase]);

  // Persistence triggers
  useEffect(() => {
    void syncStateToSupabase('users', users, syncUsersToSupabase, 'Không đồng bộ được tài khoản người dùng lên Supabase.');
  }, [users, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('officers', officers, syncOfficersToSupabase, 'Không đồng bộ được danh sách cán bộ lên Supabase.');
  }, [officers, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('teams', teams, syncTeamsToSupabase, 'Không đồng bộ được tổ đội lên Supabase.');
  }, [teams, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('schedules', schedules, syncSchedulesToSupabase, 'Không đồng bộ được lịch tuần tra lên Supabase.');
  }, [schedules, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('attendance', attendance, syncAttendanceToSupabase, 'Không đồng bộ được dữ liệu chấm công lên Supabase.');
  }, [attendance, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('rations', rations, syncRationsToSupabase, 'Không đồng bộ được dữ liệu định lượng lên Supabase.');
  }, [rations, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('nightShifts', nightShifts, syncNightShiftsToSupabase, 'Không đồng bộ được dữ liệu làm đêm lên Supabase.');
  }, [nightShifts, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('approvals', approvals, syncApprovalsToSupabase, 'Không đồng bộ được trạng thái phê duyệt lên Supabase.');
  }, [approvals, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('auditLogs', auditLogs, syncAuditLogsToSupabase, 'Không đồng bộ được nhật ký hệ thống lên Supabase.');
  }, [auditLogs, syncStateToSupabase]);

  useEffect(() => {
    void syncStateToSupabase('settings', settings, syncSettingsToSupabase, 'Không đồng bộ được cấu hình hệ thống lên Supabase.');
  }, [settings, syncStateToSupabase]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || isCloudBootstrapping) return;

    const requestRefresh = () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        void refreshFromSupabase();
      }, 250);
    };

    const channel = supabase.channel('csgt-app-realtime');
    [
      'users',
      'officers',
      'teams',
      'patrol_schedules',
      'attendance',
      'ration_records',
      'night_shift_records',
      'approvals',
      'audit_logs',
      'system_settings',
    ].forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, requestRefresh);
    });
    channel.subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [isCloudBootstrapping, refreshFromSupabase]);

  // System audit logger logic
  const addLog = (action: string, details: string, actor: User = currentUser) => {
    const newLog: AuditLog = {
      id: `LOG_${Date.now()}`,
      userId: actor.id,
      username: actor.username,
      userFullName: actor.fullName,
      timestamp: new Date().toISOString(),
      action,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  useEffect(() => {
    if (!isAuthenticated || !currentUser.id) return;
    const latestUser = users.find((user) => user.id === currentUser.id);
    if (!latestUser) {
      setIsAuthenticated(false);
      setCurrentUser(defaultCurrentUser);
      setLoginError('Tài khoản đang đăng nhập không còn tồn tại trên Supabase.');
      return;
    }
    if (getSignature(latestUser) !== getSignature(currentUser)) {
      setCurrentUser(latestUser);
    }
  }, [currentUser, isAuthenticated, users]);

  // Sync automatic attendance, rations, and night shift records based on patrol schedules
  const syncAutoCalculations = (latestSchedules: PatrolSchedule[]) => {
    const cleanManualAttendance = attendance.filter(a => !a.sourceScheduleId);
    
    // Generate new database state from patrol rules
    const newAuto = generateRecordsFromSchedules(latestSchedules, teams, officers, settings);
    
    const finalAttendance = [...cleanManualAttendance, ...newAuto.attendance];
    setAttendance(finalAttendance);
    setRations(newAuto.rations);
    setNightShifts(newAuto.nightShifts);
  };

  useEffect(() => {
    syncAutoCalculations(schedules);
  }, [settings]);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedUser = users.find(
      u => u.username.toLowerCase() === loginUsername.trim().toLowerCase() && 
      (u.password === loginPassword || (u.username === 'admin' && loginPassword === '123456'))
    );

    if (matchedUser) {
      setIsAuthenticated(true);
      setCurrentUser(matchedUser);
      setLoginError('');
      addLog('Đăng nhập hệ thống', `Đã đăng nhập thành công vào hệ thống với tài khoản '${matchedUser.username}' (${matchedUser.fullName}).`, matchedUser);
    } else {
      setLoginError('Tài khoản hoặc mật khẩu không chính xác! (Mật khẩu mặc định là 123, tài khoản admin là 123456 hoặc mật khẩu cụ thể của bạn)');
    }
  };

  // Logout handler
  const handleLogout = () => {
    addLog('Đăng xuất hệ thống', `Cán bộ '${currentUser?.fullName || 'ẩn danh'}' đã hủy phiên làm việc và đăng xuất.`);
    setIsAuthenticated(false);
    setCurrentUser(defaultCurrentUser);
    setLoginUsername('');
    setLoginPassword('');
  };

  // Database Backup State exporter
  const exportDatabaseState = () => {
    const dbState = {
      officers,
      teams,
      schedules,
      attendance,
      rations,
      nightShifts,
      approvals,
      auditLogs,
      settings
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dbState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "backup.db"); // Named .db to simulate binary SQLite backup as requested
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addLog('Sao lưu cơ sở dữ liệu', 'Đã tải xuống file sao lưu backup.db bọc cấu trúc hệ thống.');
    alert('Sao lưu thành công! Đã tải về tệp tin backup.db.');
  };

  // Database Backup State importer
  const importDatabaseState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (files && files[0]) {
      fileReader.readAsText(files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          
          if (parsed.officers && parsed.teams && parsed.schedules) {
            setOfficers(parsed.officers);
            setTeams(parsed.teams);
            setSchedules(parsed.schedules);
            setAttendance(parsed.attendance || []);
            setRations(parsed.rations || []);
            setNightShifts(parsed.nightShifts || []);
            setApprovals(parsed.approvals || []);
            setAuditLogs(parsed.auditLogs || []);
            if (parsed.settings) setSettings(parsed.settings);

            addLog('Khôi phục cơ sở dữ liệu', 'Đã nạp khôi phục thành công dữ liệu từ file backup.');
            alert('Khôi phục cơ sở dữ liệu hoàn thành nguyên trạng!');
            setActiveTab('dashboard');
          } else {
            alert('Định dạng tệp tin không hợp lệ hoặc thiếu dữ liệu cốt lõi!');
          }
        } catch (err) {
          alert('Không thể đọc tệp tin sao lưu! Vui lòng chọn đúng tệp backup.db.');
        }
      };
    }
  };

  if (isCloudBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-red-600/90 border border-yellow-500 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <div className="text-white text-lg font-black uppercase tracking-wide">Đang kết nối Supabase</div>
          <div className="text-slate-400 text-sm font-semibold">Vui lòng chờ trong giây lát...</div>
        </div>
      </div>
    );
  }

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-lg text-center space-y-3">
          <div className="w-14 h-14 bg-red-600/90 border border-yellow-500 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <div className="text-white text-lg font-black uppercase tracking-wide">Thiếu cấu hình Supabase</div>
          <div className="text-slate-400 text-sm font-semibold">
            Ứng dụng này đang chạy ở chế độ cloud-only. Hãy khai báo `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`, sau đó build/chạy lại app.
          </div>
        </div>
      </div>
    );
  }

  // Render Login Guard Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        
        {/* Aesthetic Background Police Theme Accents */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-650/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>

        <div className="bg-slate-850 border border-slate-750 w-full max-w-md p-8 rounded-2xl shadow-xl space-y-6 relative z-10">
          
          {/* Badge logo heading */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-red-650 text-yellow-400 rounded-full flex items-center justify-center mx-auto border-2 border-yellow-400 shadow-md animate-pulse">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-bold uppercase tracking-wide text-white">{appName}</h1>
            <p className="text-xs text-yellow-400 font-bold tracking-widest uppercase">Phòng Cảnh sát giao thông</p>
          </div>

          {loginError && (
            <div className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs py-2.5 px-3 rounded-lg text-center font-semibold">
              {loginError}
            </div>
          )}
          {cloudSyncError && (
            <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs py-2.5 px-3 rounded-lg text-center font-semibold">
              {cloudSyncError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tài khoản công vụ *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập... (admin)"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white rounded-lg text-xs outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mật khẩu *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Nhập mật khẩu... (123456)"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white rounded-lg text-xs outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-red-650 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md hover:shadow-lg border border-red-500/20 cursor-pointer"
            >
              Đăng nhập hệ thống
            </button>
          </form>

          {/* Credentials guideline */}
          <div className="text-center pt-2 border-t border-slate-800 text-[10.5px] text-slate-400">
            <p>Tài khoản dùng thử mặc định:</p>
            <p className="mt-1">Tên đăng nhập: <strong className="text-yellow-400 font-bold">admin</strong> / Mật gót: <strong className="text-yellow-400 font-bold">123456</strong></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* Top Banner (Header) */}
      <header className="bg-slate-950 border-b border-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600/90 border border-yellow-500 text-yellow-400 rounded-xl flex items-center justify-center shadow-inner">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight text-white">{appName.toUpperCase()}</h1>
            <p className="text-[10px] text-yellow-400 font-extrabold uppercase tracking-wider mt-0.5">Phần mềm định lượng nghiệp vụ</p>
          </div>
        </div>

        {/* User context information */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="text-right hidden sm:block">
            <span className="block text-slate-100">{currentUser.fullName}</span>
            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${cloudSyncError ? 'text-amber-300' : 'text-emerald-400'}`}>
              {cloudSyncError ? 'Supabase • Có lỗi đồng bộ' : 'Supabase • Đã kết nối'}
            </span>
          </div>
          
          <button
            onClick={handleLogout}
            className="p-2 bg-slate-900 hover:bg-slate-850 text-rose-400 rounded-lg transition-all border border-slate-850 cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar Menu */}
        <aside className="w-68 bg-slate-950 border-r border-slate-900 text-slate-310 shrink-0 flex flex-col justify-between hidden md:flex">
          
          <nav className="p-4 space-y-2 flex-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3.5 mb-3">DANH MỤC QUẢN LÝ</p>
            
            {/* Nav List */}
            {[
              { id: 'dashboard', label: 'Trang chủ Thống kê', icon: LayoutDashboard, roles: ['admin', 'leader', 'commander', 'team_leader', 'officer_self'] },
              { id: 'officers', label: 'Cán bộ chiến sĩ', icon: Users, roles: ['admin', 'leader', 'commander', 'team_leader'] },
              { id: 'teams', label: 'Tổ tuần tra kiểm soát', icon: ShieldAlert, roles: ['admin', 'leader', 'commander', 'team_leader'] },
              { id: 'schedules', label: 'Nhập lịch tuần tra kiểm soát', icon: CalendarRange, roles: ['admin', 'leader', 'commander', 'team_leader', 'officer_self'] },
              { id: 'attendance', label: 'Khai báo Làm việc/Nghỉ phép', icon: ClipboardCheck, roles: ['admin', 'leader', 'commander', 'team_leader', 'officer_self'] },
              { id: 'reports', label: 'Duyệt & Xuất Báo cáo', icon: FileSpreadsheet, roles: ['admin', 'leader', 'commander', 'team_leader', 'officer_self'] },
            ].filter(menu => menu.roles.includes(currentUser.role)).map((menu) => {
              const IconComp = menu.icon;
              const isActive = activeTab === menu.id;

              return (
                <button
                  key={menu.id}
                  onClick={() => setActiveTab(menu.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-200 border cursor-pointer ${
                    isActive 
                      ? 'bg-linear-to-r from-red-600/15 to-red-600/5 text-red-500 border-red-500/20' 
                      : 'hover:bg-slate-900/80 text-slate-400 border-transparent'
                  }`}
                >
                  <IconComp className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-red-400' : 'text-slate-500'}`} />
                  <span>{menu.label}</span>
                </button>
              );
            })}

            <div className="pt-3 border-t border-slate-900 my-4"></div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">HỆ THỐNG & ĐÓNG GÓI</p>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-200 border cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-linear-to-r from-red-650/15 to-red-650/5 text-red-400 border-red-500/20' 
                  : 'hover:bg-slate-900/80 text-slate-400 border-transparent'
              }`}
            >
              <Settings className={`w-4.5 h-4.5 shrink-0 ${activeTab === 'settings' ? 'text-red-400' : 'text-slate-500'}`} />
              <span>Cấu hình & Bảo mật</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-200 border cursor-pointer ${
                activeTab === 'guide' 
                  ? 'bg-linear-to-r from-red-650/15 to-red-650/5 text-red-400 border-red-500/20' 
                  : 'hover:bg-slate-900/80 text-slate-400 border-transparent'
              }`}
            >
              <HelpCircle className={`w-4.5 h-4.5 shrink-0 ${activeTab === 'guide' ? 'text-red-400' : 'text-slate-500'}`} />
              <span>Đóng gói Setup.exe</span>
            </button>
          </nav>

          {/* Sidebar footer flag */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-900 text-[10px] text-slate-500 text-center font-bold">
            <p className="text-slate-400">P.M.H, SĐT: 0972876779</p>
            <p className="mt-0.5 font-medium text-slate-600">Bản quyền 2026 • Đồng bộ Supabase</p>
          </div>
        </aside>

        {/* Content Panel Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {activeTab === 'dashboard' && (
              <Dashboard 
                officers={officers} 
                schedules={schedules} 
                attendance={attendance} 
                rations={rations} 
                nightShifts={nightShifts} 
                teams={teams}
              />
            )}

            {activeTab === 'officers' && (
              <OfficerManagement 
                officers={officers} 
                setOfficers={setOfficers} 
                addLog={addLog} 
              />
            )}

            {activeTab === 'teams' && (
              <TeamManagement 
                teams={teams} 
                setTeams={setTeams} 
                officers={officers} 
                addLog={addLog} 
              />
            )}

            {activeTab === 'schedules' && (
              <PatrolSchedules 
                schedules={schedules} 
                setSchedules={setSchedules} 
                teams={teams} 
                officers={officers} 
                approvals={approvals}
                settings={settings}
                addLog={addLog} 
                syncAutoCalculations={syncAutoCalculations} 
                currentUser={currentUser}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceManagement 
                attendance={attendance} 
                setAttendance={setAttendance} 
                officers={officers} 
                approvals={approvals}
                addLog={addLog} 
                currentUser={currentUser}
              />
            )}

            {activeTab === 'reports' && (
              <ApprovalAndReports 
                officers={officers} 
                attendance={attendance} 
                rations={rations} 
                nightShifts={nightShifts} 
                approvals={approvals} 
                setApprovals={setApprovals} 
                settings={settings} 
                addLog={addLog} 
                currentUser={currentUser} 
                schedules={schedules}
                teams={teams}
              />
            )}

            {activeTab === 'settings' && (
              <SecurityAndSettings 
                settings={settings} 
                setSettings={setSettings} 
                auditLogs={auditLogs} 
                setAuditLogs={setAuditLogs} 
                currentUser={currentUser} 
                setCurrentUser={setCurrentUser} 
                addLog={addLog} 
                exportDatabaseState={exportDatabaseState} 
                importDatabaseState={importDatabaseState} 
                users={users}
                setUsers={setUsers}
                officers={officers}
              />
            )}

            {activeTab === 'guide' && (
              <DatabaseGuide />
            )}

          </div>
        </main>

      </div>
    </div>
  );
}
