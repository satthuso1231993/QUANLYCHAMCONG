import React, { useState, useMemo } from 'react';
import { Attendance, NightShiftRecord, Officer, PatrolSchedule, RationRecord, SystemSettings, Team, User, Approval } from '../types';
import { formatCurrency, numberToVietnameseWords } from '../utils/helpers';
import { 
  Users, Calendar, Shield, Moon, DollarSign, Award, ArrowUpRight, TrendingUp, 
  Clock, ShieldAlert, Sparkles, Filter, CheckCircle2, AlertCircle, FileSpreadsheet, 
  Settings as SettingsIcon, ChevronRight, BarChart3, Activity, Compass, MapPin
} from 'lucide-react';
import { getFixedPersonnelOfficers } from '../utils/personnel';

interface DashboardProps {
  officers: Officer[];
  schedules: PatrolSchedule[];
  attendance: Attendance[];
  rations: RationRecord[];
  nightShifts: NightShiftRecord[];
  teams?: Team[];
  settings: SystemSettings;
  currentUser?: User;
  onNavigateTab?: (tab: string) => void;
  approvals?: Approval[];
}

export default function Dashboard({
  officers,
  schedules,
  attendance,
  rations,
  nightShifts,
  teams = [],
  settings,
  currentUser,
  onNavigateTab,
  approvals = [],
}: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all', '2026-01' .. '2026-12'
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedOfficer, setSelectedOfficer] = useState<string>('all');

  const fixedPersonnelOfficers = useMemo(() => getFixedPersonnelOfficers(officers), [officers]);

  // Months list for 2026
  const monthsList = useMemo(() => [
    { name: 'Tháng 1', key: '2026-01', short: 'T1' },
    { name: 'Tháng 2', key: '2026-02', short: 'T2' },
    { name: 'Tháng 3', key: '2026-03', short: 'T3' },
    { name: 'Tháng 4', key: '2026-04', short: 'T4' },
    { name: 'Tháng 5', key: '2026-05', short: 'T5' },
    { name: 'Tháng 6', key: '2026-06', short: 'T6' },
    { name: 'Tháng 7', key: '2026-07', short: 'T7' },
    { name: 'Tháng 8', key: '2026-08', short: 'T8' },
    { name: 'Tháng 9', key: '2026-09', short: 'T9' },
    { name: 'Tháng 10', key: '2026-10', short: 'T10' },
    { name: 'Tháng 11', key: '2026-11', short: 'T11' },
    { name: 'Tháng 12', key: '2026-12', short: 'T12' },
  ], []);

  // Filter officers based on selected team
  const availableOfficers = useMemo(() => {
    if (selectedTeamId === 'all') return fixedPersonnelOfficers;
    const targetTeam = teams.find(t => t.id === selectedTeamId);
    if (!targetTeam) return fixedPersonnelOfficers;
    const teamMemberIds = targetTeam.memberIds || [];
    const teamNameLower = targetTeam.name.toLowerCase().trim();
    return fixedPersonnelOfficers.filter(o => 
      teamMemberIds.includes(o.id) || 
      (o.department && o.department.toLowerCase().trim() === teamNameLower)
    );
  }, [fixedPersonnelOfficers, selectedTeamId, teams]);

  const targetOfficerIds = useMemo(() => {
    if (selectedOfficer !== 'all') return [selectedOfficer];
    if (selectedTeamId !== 'all') return availableOfficers.map(o => o.id);
    return null; // all
  }, [selectedOfficer, selectedTeamId, availableOfficers]);

  // Filter helpers
  const filterByCriteria = (recordDate: string, recordOfficerId: string) => {
    const matchesMonth = selectedMonth === 'all' || recordDate.startsWith(selectedMonth);
    const matchesOfficer = !targetOfficerIds || targetOfficerIds.includes(recordOfficerId);
    return matchesMonth && matchesOfficer;
  };

  // Filtered Core Datasets
  const filteredAttendance = useMemo(() => attendance.filter(a => filterByCriteria(a.date, a.officerId)), [attendance, selectedMonth, targetOfficerIds]);
  const filteredRations = useMemo(() => rations.filter(r => filterByCriteria(r.date, r.officerId)), [rations, selectedMonth, targetOfficerIds]);
  const filteredNightShifts = useMemo(() => nightShifts.filter(n => filterByCriteria(n.date, n.officerId)), [nightShifts, selectedMonth, targetOfficerIds]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const matchesMonth = selectedMonth === 'all' || s.date.startsWith(selectedMonth);
      let matchesTeamOrOfficer = true;
      if (selectedTeamId !== 'all') {
        matchesTeamOrOfficer = s.teamId === selectedTeamId;
      }
      if (selectedOfficer !== 'all') {
        const hasCustom = s.customOfficerIds && s.customOfficerIds.includes(selectedOfficer);
        const teamOfSched = teams.find(t => t.id === s.teamId);
        const inTeam = teamOfSched && teamOfSched.memberIds && teamOfSched.memberIds.includes(selectedOfficer);
        matchesTeamOrOfficer = !!(hasCustom || inTeam);
      }
      return matchesMonth && matchesTeamOrOfficer;
    });
  }, [schedules, selectedMonth, selectedTeamId, selectedOfficer, teams]);

  // Core KPI Calculations
  const activeOfficersCount = availableOfficers.filter(o => o.status === 'Đang công tác').length;
  const totalOfficersCount = availableOfficers.length;
  
  const totalAttendanceDays = filteredAttendance.length;
  const totalRationDays = filteredRations.length;
  const totalNightShiftLaps = filteredNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);

  const totalRationAmount = filteredRations.reduce((acc, curr) => acc + curr.amount, 0);
  const totalNightShiftAmount = filteredNightShifts.reduce((acc, curr) => acc + curr.amount, 0);
  const grandTotalAmount = totalRationAmount + totalNightShiftAmount;

  // Monthly sums for Chart
  const monthlyChartData = useMemo(() => {
    return monthsList.map(m => {
      const monthRations = rations.filter(r => 
        r.date.startsWith(m.key) && (!targetOfficerIds || targetOfficerIds.includes(r.officerId))
      );
      const monthNightShifts = nightShifts.filter(n => 
        n.date.startsWith(m.key) && (!targetOfficerIds || targetOfficerIds.includes(n.officerId))
      );

      const rSum = monthRations.reduce((acc, curr) => acc + curr.amount, 0);
      const nSum = monthNightShifts.reduce((acc, curr) => acc + curr.amount, 0);
      const total = rSum + nSum;

      return {
        name: m.name,
        short: m.short,
        key: m.key,
        rationAmount: rSum,
        nightShiftAmount: nSum,
        totalAmount: total,
        rationDays: monthRations.length,
        nightShiftsCount: monthNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0),
      };
    });
  }, [monthsList, rations, nightShifts, targetOfficerIds]);

  const maxMonthlyAmount = useMemo(() => {
    const max = Math.max(...monthlyChartData.map(d => d.totalAmount), 1000000);
    return max;
  }, [monthlyChartData]);

  // Current approval status for selected month
  const currentMonthApproval = useMemo(() => {
    if (selectedMonth === 'all') return null;
    return approvals.find(a => a.monthString === selectedMonth);
  }, [approvals, selectedMonth]);

  // Team performance breakdown
  const teamBreakdowns = useMemo(() => {
    return teams.map(t => {
      const memberIds = t.memberIds || [];
      const teamNameLower = t.name.toLowerCase().trim();
      const teamOfficers = fixedPersonnelOfficers.filter(o => 
        memberIds.includes(o.id) || (o.department && o.department.toLowerCase().trim() === teamNameLower)
      );
      const officerIds = teamOfficers.map(o => o.id);

      const tRations = rations.filter(r => 
        (selectedMonth === 'all' || r.date.startsWith(selectedMonth)) && officerIds.includes(r.officerId)
      );
      const tNightShifts = nightShifts.filter(n => 
        (selectedMonth === 'all' || n.date.startsWith(selectedMonth)) && officerIds.includes(n.officerId)
      );
      const tSchedules = schedules.filter(s => 
        (selectedMonth === 'all' || s.date.startsWith(selectedMonth)) && (s.teamId === t.id)
      );

      const rAmount = tRations.reduce((a, b) => a + b.amount, 0);
      const nAmount = tNightShifts.reduce((a, b) => a + b.amount, 0);

      return {
        team: t,
        officerCount: teamOfficers.length,
        scheduleCount: tSchedules.length,
        rationDays: tRations.length,
        nightShiftLaps: tNightShifts.reduce((a, b) => a + b.hoursCount, 0),
        totalAmount: rAmount + nAmount,
        rationAmount: rAmount,
        nightShiftAmount: nAmount,
      };
    });
  }, [teams, fixedPersonnelOfficers, rations, nightShifts, schedules, selectedMonth]);

  const maxTeamAmount = Math.max(...teamBreakdowns.map(t => t.totalAmount), 1);

  // Today string
  const todayStr = useMemo(() => {
    const d = new Date();
    const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${daysOfWeek[d.getDay()]}, ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. HERO COMMAND BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-8 shadow-xl border border-blue-850/40">
        {/* Background decorative police glow watermark */}
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-6 top-6 opacity-5 pointer-events-none">
          <Shield className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles className="w-3.5 h-3.5" />
                Hệ thống Quản lý Chấm công & TTKS
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Đồng bộ Supabase Trực tuyến
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
              {settings.departmentName || 'PHÒNG CẢNH SÁT GIAO THÔNG'}
            </h1>
            <p className="text-sm text-blue-200/90 font-medium max-w-2xl flex items-center gap-2">
              <span>{settings.unitName || 'CÔNG AN TỈNH'}</span>
              <span className="text-blue-400">•</span>
              <span className="text-slate-300">{todayStr}</span>
            </p>
          </div>

          {/* User profile & Quick stats badge */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-lg shadow-md border border-white/20">
                {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'A'}
              </div>
              <div>
                <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Tài khoản công vụ</p>
                <p className="text-sm font-black text-white truncate max-w-[180px]">{currentUser?.fullName || 'Quản trị viên'}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200 inline-block mt-0.5">
                  {currentUser?.role === 'admin' ? 'Quản trị tối cao' : currentUser?.role === 'doi' ? 'Chỉ huy cấp Đội' : 'Chỉ huy Tổ địa bàn'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Filter Controls Bar inside Hero Banner */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <Filter className="w-4 h-4 text-blue-300" />
              <span className="text-xs font-bold text-blue-200">Lọc dữ liệu:</span>
            </div>

            {/* Filter by Month */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3.5 py-1.5 bg-slate-800/90 text-white border border-white/15 rounded-xl text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-xs"
            >
              <option value="all">📅 Toàn bộ Năm 2026</option>
              {monthsList.map(m => (
                <option key={m.key} value={m.key}>Tháng {m.name.replace('Tháng ', '')}/2026</option>
              ))}
            </select>

            {/* Filter by Team */}
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setSelectedOfficer('all');
              }}
              className="px-3.5 py-1.5 bg-slate-800/90 text-white border border-white/15 rounded-xl text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-xs max-w-[220px]"
            >
              <option value="all">🏢 Tất cả Đội / Tổ địa bàn</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Filter by Officer */}
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="px-3.5 py-1.5 bg-slate-800/90 text-white border border-white/15 rounded-xl text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-xs max-w-[220px]"
            >
              <option value="all">👮 Tất cả Cán bộ ({availableOfficers.length})</option>
              {availableOfficers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.rank} {o.fullName} ({o.badgeNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Quick reset filters */}
          {(selectedMonth !== 'all' || selectedTeamId !== 'all' || selectedOfficer !== 'all') && (
            <button
              onClick={() => {
                setSelectedMonth('all');
                setSelectedTeamId('all');
                setSelectedOfficer('all');
              }}
              className="text-xs text-amber-300 hover:text-amber-200 font-bold underline transition-colors cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* 2. TOP 4 HERO KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* KPI 1: Quân số */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Quân số Cán bộ</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight">{activeOfficersCount}</span>
              <span className="text-xs font-bold text-slate-400">/ {totalOfficersCount} CBCS</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                100% Đang công tác
              </span>
              <span className="text-slate-500">{teams.length} đơn vị/tổ</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Ca Tuần tra */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Ca TTKS & Chuyên đề</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight">{filteredSchedules.length}</span>
              <span className="text-xs font-bold text-slate-400">ca ban hành</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {totalAttendanceDays} lượt công tác
              </span>
              <span className="text-slate-500">
                {selectedMonth === 'all' ? 'Cả năm 2026' : selectedMonth.replace('2026-', 'Tháng ')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Ăn Định lượng */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Kinh phí Định lượng</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700 tracking-tight">
                {formatCurrency(totalRationAmount)}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {totalRationDays} ngày ({settings.rationRate.toLocaleString('vi-VN')} đ/ngày)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Bồi dưỡng Làm đêm */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Bồi dưỡng Làm đêm</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Moon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
                {formatCurrency(totalNightShiftAmount)}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
              <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {totalNightShiftLaps.toFixed(1)} lượt ({settings.nightShiftRate.toLocaleString('vi-VN')} đ/lượt)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. TOTAL BUDGET HIGHLIGHT BAR */}
      <div className="bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-yellow-400 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Tổng Dự toán Kinh phí Nghiệp vụ Phải chi trả</p>
            <h3 className="text-2xl sm:text-3xl font-black text-yellow-350 tracking-tight mt-0.5">
              {formatCurrency(grandTotalAmount)}
            </h3>
            <p className="text-[11px] text-blue-100/80 font-medium italic mt-0.5">
              (Bằng chữ: {numberToVietnameseWords(grandTotalAmount)})
            </p>
          </div>
        </div>

        {/* Budget Proportion Bar */}
        <div className="w-full md:w-80 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-amber-300">Định lượng: {grandTotalAmount > 0 ? ((totalRationAmount / grandTotalAmount) * 100).toFixed(0) : 0}%</span>
            <span className="text-purple-300">Làm đêm: {grandTotalAmount > 0 ? ((totalNightShiftAmount / grandTotalAmount) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${grandTotalAmount > 0 ? (totalRationAmount / grandTotalAmount) * 100 : 50}%` }}
              className="bg-amber-400 h-full transition-all duration-500" 
              title="Định lượng"
            />
            <div 
              style={{ width: `${grandTotalAmount > 0 ? (totalNightShiftAmount / grandTotalAmount) * 100 : 50}%` }}
              className="bg-purple-400 h-full transition-all duration-500" 
              title="Làm đêm"
            />
          </div>
        </div>
      </div>

      {/* 4. MAIN ANALYTICS GRID: 8 Cols vs 4 Cols */}
      <div className="grid grid-cols-12 gap-5">
        
        {/* Left 8 Cols: Monthly Multi-Bar Chart & Team Performance Matrix */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          
          {/* Visual Chart Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-blue-600 w-5 h-5" />
                  <h3 className="font-black text-slate-800 text-base tracking-tight">Biểu đồ Diễn biến Kinh phí Nghiệp vụ Năm 2026</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">So sánh chi phí Định lượng & Bồi dưỡng làm đêm theo từng tháng</p>
              </div>

              {/* Legend pills */}
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-3 h-3 rounded-xs bg-amber-500" />
                  Định lượng
                </span>
                <span className="flex items-center gap-1.5 text-purple-700">
                  <span className="w-3 h-3 rounded-xs bg-purple-600" />
                  Làm đêm
                </span>
              </div>
            </div>

            {/* Custom Interactive SVG / HTML Dual Bar Chart */}
            <div className="h-72 flex items-end justify-between gap-2 pt-8 px-2 relative border-b border-slate-200">
              {/* Y-axis grid guide lines */}
              <div className="absolute left-0 right-0 top-1/4 border-t border-dashed border-slate-100 pointer-events-none" />
              <div className="absolute left-0 right-0 top-2/4 border-t border-dashed border-slate-100 pointer-events-none" />
              <div className="absolute left-0 right-0 top-3/4 border-t border-dashed border-slate-100 pointer-events-none" />

              {monthlyChartData.map((d, idx) => {
                const totalPercent = maxMonthlyAmount > 0 ? (d.totalAmount / maxMonthlyAmount) * 100 : 0;
                const rationPercent = d.totalAmount > 0 ? (d.rationAmount / d.totalAmount) * 100 : 50;
                const nightPercent = 100 - rationPercent;
                const isCurrentMonth = selectedMonth === d.key;

                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedMonth(selectedMonth === d.key ? 'all' : d.key)}
                    className="flex-1 flex flex-col items-center group relative z-10 select-none cursor-pointer h-full justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-3 bg-slate-900 text-white text-[11px] p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none font-bold z-30 border border-slate-700">
                      <p className="text-amber-300 font-black mb-1">{d.name}/2026</p>
                      <p className="text-slate-200">Tổng kinh phí: <span className="text-yellow-400 font-mono">{formatCurrency(d.totalAmount)}</span></p>
                      <div className="mt-1 pt-1 border-t border-slate-700 text-[10px] text-slate-300 space-y-0.5">
                        <p className="text-amber-400">Định lượng: {formatCurrency(d.rationAmount)} ({d.rationDays} ngày)</p>
                        <p className="text-purple-300">Làm đêm: {formatCurrency(d.nightShiftAmount)} ({d.nightShiftsCount.toFixed(1)} lượt)</p>
                      </div>
                    </div>

                    {/* Stacked Bar Container */}
                    <div 
                      style={{ height: `${Math.max(totalPercent * 0.85, 4)}%` }}
                      className={`w-full max-w-[36px] rounded-t-lg overflow-hidden flex flex-col transition-all duration-300 ${
                        isCurrentMonth 
                          ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' 
                          : 'group-hover:scale-105'
                      }`}
                    >
                      {/* Night shift segment (top) */}
                      {d.nightShiftAmount > 0 && (
                        <div 
                          style={{ height: `${nightPercent}%` }}
                          className="bg-purple-600 group-hover:bg-purple-500 w-full transition-colors"
                        />
                      )}
                      {/* Ration segment (bottom) */}
                      {d.rationAmount > 0 && (
                        <div 
                          style={{ height: `${rationPercent}%` }}
                          className="bg-amber-500 group-hover:bg-amber-400 w-full transition-colors"
                        />
                      )}
                      {d.totalAmount === 0 && (
                        <div className="w-full h-full bg-slate-200" />
                      )}
                    </div>

                    {/* Month Label */}
                    <span className={`text-[10px] font-bold mt-2 truncate w-full text-center ${
                      isCurrentMonth ? 'text-blue-700 font-black' : 'text-slate-400 group-hover:text-slate-700'
                    }`}>
                      {d.short}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Chart Footer Stats */}
            <div className="mt-4 pt-3 flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium">
              <span>Bấm vào từng cột tháng để lọc nhanh dữ liệu thống kê</span>
              <span className="font-bold text-blue-700">
                {selectedMonth === 'all' ? 'Đang hiển thị toàn bộ năm 2026' : `Đang lọc theo ${selectedMonth.replace('2026-', 'Tháng ')}/2026`}
              </span>
            </div>
          </div>

          {/* Unit Performance Breakdown Matrix */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Compass className="text-indigo-600 w-5 h-5" />
                <h3 className="font-black text-slate-800 text-base tracking-tight">Thống kê Phân bổ theo Đội & Tổ Địa Bàn</h3>
              </div>
              <span className="text-xs font-bold text-slate-400">{teams.length} đơn vị</span>
            </div>

            <div className="space-y-3">
              {teamBreakdowns.map((tb) => {
                const percentOfMax = maxTeamAmount > 0 ? (tb.totalAmount / maxTeamAmount) * 100 : 0;
                const isSelected = selectedTeamId === tb.team.id;

                return (
                  <div 
                    key={tb.team.id}
                    onClick={() => setSelectedTeamId(selectedTeamId === tb.team.id ? 'all' : tb.team.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs' 
                        : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            tb.team.teamType === 'doi' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {tb.team.teamType === 'doi' ? 'Cấp Đội' : 'Tổ địa bàn'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-800">{tb.team.name}</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Biên chế: <b className="text-slate-700">{tb.officerCount} CBCS</b> • Ca TTKS: <b className="text-slate-700">{tb.scheduleCount}</b> • Ngày ăn: <b className="text-amber-700">{tb.rationDays}</b> • Làm đêm: <b className="text-purple-700">{tb.nightShiftLaps.toFixed(1)}</b>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(tb.totalAmount)}</p>
                        <span className="text-[10px] font-bold text-slate-400">Dự toán kinh phí</span>
                      </div>
                    </div>

                    {/* Progress distribution bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                      <div 
                        style={{ width: `${Math.max(percentOfMax, 3)}%` }} 
                        className="bg-indigo-600 h-1.5 rounded-full" 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 4 Cols: Account Policy Box, Live Patrol Feed & Approval Status */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          
          {/* Account Rate & Signer Configuration Widget */}
          <div className="bg-linear-to-br from-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-md border border-blue-850/40">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Cấu hình Định mức Tài khoản</h3>
              </div>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-400/20">
                Đang áp dụng
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-blue-200">Mức ăn định lượng ban ngày:</span>
                <span className="font-black text-yellow-350 font-mono">{settings.rationRate.toLocaleString('vi-VN')} đ/ngày</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-blue-200">Bồi dưỡng ca tuần tra đêm:</span>
                <span className="font-black text-purple-300 font-mono">{settings.nightShiftRate.toLocaleString('vi-VN')} đ/lượt</span>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Người lập biểu:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[150px]">{settings.signerPreparer || '(Chưa cấu hình)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Chỉ huy đơn vị:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[150px]">{settings.signerCommander || '(Chưa cấu hình)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lãnh đạo phê duyệt:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[150px]">{settings.signerLeader || '(Chưa cấu hình)'}</span>
                </div>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('settings')}
                  className="w-full mt-3 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  Tùy chỉnh Định mức & Người ký
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Recent Patrol Dispatch Feed */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="font-black text-slate-800 text-sm tracking-tight">Ca Tuần tra Gần đây</h3>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Chuyên đề</span>
            </div>

            {filteredSchedules.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center font-medium">Chưa có lịch tuần tra nào trong khoảng thời gian này.</p>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {[...filteredSchedules]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5)
                  .map((sched) => {
                    const hasCustom = sched.customOfficerIds && sched.customOfficerIds.length > 0;
                    const matchedTeam = !hasCustom ? teams.find(t => t.id === sched.teamId) : null;
                    const displayName = hasCustom 
                      ? `Lẻ (${sched.customOfficerIds!.length} đ/đ)` 
                      : (matchedTeam ? matchedTeam.name : 'Tổ phân công');

                    return (
                      <div key={sched.id} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {sched.missionType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            {sched.date.split('-').reverse().join('/')}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-1.5 truncate">{sched.route || sched.topic || sched.missionType}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-bold">
                          <span>🕒 {sched.startTime} - {sched.endTime}</span>
                          <span className="text-indigo-600 truncate max-w-[130px]">{displayName}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('schedules')}
                className="w-full mt-4 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                Xem toàn bộ Lịch Tuần tra
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Monthly Approval & Reports Quick Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="font-black text-slate-800 text-sm tracking-tight">07 Biểu mẫu Báo cáo</h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Nghị định 30
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Hệ thống tự động kết xuất 07 biểu mẫu bảng chấm công, bảng thanh toán tiền định lượng, tiền làm đêm và giấy đề xuất chuẩn in A4.
            </p>

            {selectedMonth !== 'all' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Trạng thái tháng {selectedMonth.replace('2026-', '')}/2026:</p>
                  <p className="text-xs font-black text-slate-800">
                    {currentMonthApproval?.status === 'Đã khóa' ? '🔒 Đã khóa sổ & Phê duyệt' : '📝 Đang mở nhập liệu'}
                  </p>
                </div>
                {currentMonthApproval?.status === 'Đã khóa' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
              </div>
            )}

            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('reports')}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Xuất 07 Biểu mẫu Báo cáo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
