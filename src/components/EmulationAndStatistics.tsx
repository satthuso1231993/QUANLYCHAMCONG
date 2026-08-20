import React, { useState, useMemo } from 'react';
import { 
  Award, 
  TrendingUp, 
  DollarSign, 
  FileSpreadsheet, 
  Shield, 
  Clock, 
  Moon, 
  Utensils, 
  Users, 
  Filter, 
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Officer, PatrolSchedule, AttendanceRecord, RationRecord, NightShiftRecord, SystemSettings, UserAccount } from '../types';

interface EmulationAndStatisticsProps {
  currentUser: UserAccount;
  officers: Officer[];
  schedules: PatrolSchedule[];
  attendance: AttendanceRecord[];
  rations: RationRecord[];
  nightShifts: NightShiftRecord[];
  settings: SystemSettings;
}

export const EmulationAndStatistics: React.FC<EmulationAndStatisticsProps> = ({
  currentUser,
  officers,
  schedules,
  attendance,
  rations,
  nightShifts,
  settings,
}) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'emulation' | 'budget' | 'routes'>('emulation');

  // Filter officers based on current user role
  const visibleOfficers = useMemo(() => {
    let list = officers.filter(o => o.status === 'Đang công tác');
    if (currentUser.role === 'doi' && currentUser.department) {
      list = list.filter(o => o.department === currentUser.department);
    } else if (currentUser.role === 'to_dia_ban' && currentUser.department) {
      list = list.filter(o => o.department === currentUser.department || o.teamId === currentUser.teamId);
    }
    if (selectedDepartment !== 'all') {
      list = list.filter(o => o.department === selectedDepartment);
    }
    return list;
  }, [officers, currentUser, selectedDepartment]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    return Array.from(new Set(officers.map(o => o.department).filter(Boolean)));
  }, [officers]);

  // Month ranges for periods
  const filterMonthMatch = (dateStr: string) => {
    if (!dateStr.startsWith(selectedYear)) return false;
    const month = parseInt(dateStr.substring(5, 7), 10);
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod === 'Q1') return month >= 1 && month <= 3;
    if (selectedPeriod === 'Q2') return month >= 4 && month <= 6;
    if (selectedPeriod === 'Q3') return month >= 7 && month <= 9;
    if (selectedPeriod === 'Q4') return month >= 10 && month <= 12;
    return true;
  };

  const periodAttendance = useMemo(() => attendance.filter(a => filterMonthMatch(a.date)), [attendance, selectedYear, selectedPeriod]);
  const periodRations = useMemo(() => rations.filter(r => filterMonthMatch(r.date)), [rations, selectedYear, selectedPeriod]);
  const periodNightShifts = useMemo(() => nightShifts.filter(n => filterMonthMatch(n.date)), [nightShifts, selectedYear, selectedPeriod]);
  const periodSchedules = useMemo(() => schedules.filter(s => filterMonthMatch(s.date)), [schedules, selectedYear, selectedPeriod]);

  // Calculate Emulation Stats for each officer
  const officerEmulationData = useMemo(() => {
    const list = visibleOfficers.map(officer => {
      // Days of attendance worked
      const offAtt = periodAttendance.filter(a => a.officerId === officer.id);
      const workDays = offAtt.filter(a => a.type === 'present' || a.type === 'mission').length;
      const leaveDays = offAtt.filter(a => a.type === 'leave').length;

      // Ration days
      const rationDays = periodRations.filter(r => r.officerId === officer.id).length;
      const rationAmount = rationDays * settings.rationRate;

      // Night shifts
      const offNight = periodNightShifts.filter(n => n.officerId === officer.id);
      const nightTurns = offNight.reduce((sum, n) => sum + n.hoursCount, 0);
      const nightAmount = offNight.reduce((sum, n) => sum + n.amount, 0);

      // Schedules participated
      const offSchedules = periodSchedules.filter(s => {
        if (s.customOfficerIds && s.customOfficerIds.includes(officer.id)) return true;
        if (officer.teamId && s.teamId === officer.teamId) return true;
        return false;
      });
      const patrolCount = offSchedules.length;

      // Estimate patrol hours
      let totalPatrolHours = 0;
      offSchedules.forEach(s => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        let duration = (eh * 60 + em) - (sh * 60 + sm);
        if (duration < 0) duration += 24 * 60;
        totalPatrolHours += duration / 60;
      });

      // Intensity score formula: Work Days * 2 + Patrol Shifts * 5 + Night Shifts * 8 + Patrol Hours * 0.5
      const score = Math.round((workDays * 2) + (patrolCount * 5) + (nightTurns * 8) + (totalPatrolHours * 0.5));

      return {
        officer,
        workDays,
        leaveDays,
        rationDays,
        rationAmount,
        nightTurns,
        nightAmount,
        patrolCount,
        totalPatrolHours: Math.round(totalPatrolHours),
        score,
      };
    });

    // Sort by score descending
    list.sort((a, b) => b.score - a.score);

    // Assign Rankings: Top 25% = A (Xuất sắc), Next 60% = B (Tốt), Remaining = C (Đạt)
    const total = list.length;
    return list.map((item, index) => {
      let rank: 'A' | 'B' | 'C' = 'B';
      let rankLabel = 'Hoàn thành Tốt (Chiến sĩ Tiên tiến)';
      let rankBadge = 'bg-blue-50 text-blue-700 border-blue-200';

      if (total > 0 && index < Math.ceil(total * 0.25) && item.score > 0) {
        rank = 'A';
        rankLabel = 'Xuất sắc (Chiến sĩ Thi đua Cơ sở)';
        rankBadge = 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      } else if (item.score < 10 || item.workDays < 5) {
        rank = 'C';
        rankLabel = 'Hoàn thành nhiệm vụ (Cần cố gắng)';
        rankBadge = 'bg-slate-100 text-slate-600 border-slate-200';
      }

      return {
        ...item,
        ranking: rank,
        rankLabel,
        rankBadge,
        positionRank: index + 1,
      };
    });
  }, [visibleOfficers, periodAttendance, periodRations, periodNightShifts, periodSchedules, settings]);

  // Overall totals
  const totalWorkDays = officerEmulationData.reduce((acc, curr) => acc + curr.workDays, 0);
  const totalPatrolTurns = officerEmulationData.reduce((acc, curr) => acc + curr.patrolCount, 0);
  const totalNightTurns = officerEmulationData.reduce((acc, curr) => acc + curr.nightTurns, 0);
  const totalRationExpense = officerEmulationData.reduce((acc, curr) => acc + curr.rationAmount, 0);
  const totalNightExpense = officerEmulationData.reduce((acc, curr) => acc + curr.nightAmount, 0);
  const totalAllExpense = totalRationExpense + totalNightExpense;

  // Estimated Allocated Budget (Benchmark: 25M/officer/quarter or custom)
  const estimatedBudget = visibleOfficers.length * (selectedPeriod === 'all' ? 45000000 : 12000000);
  const budgetSavings = Math.max(0, estimatedBudget - totalAllExpense);
  const budgetUtilizationPercent = estimatedBudget > 0 ? Math.min(100, Math.round((totalAllExpense / estimatedBudget) * 100)) : 0;

  // Route & Mission Statistics
  const routeStats = useMemo(() => {
    const counts: Record<string, number> = {
      'Quốc lộ': 0,
      'Tỉnh lộ': 0,
      'Nội thị': 0,
      'Liên xã / Huyện lộ': 0,
    };
    periodSchedules.forEach(s => {
      const type = s.routeType || 'Quốc lộ';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [periodSchedules]);

  const missionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    periodSchedules.forEach(s => {
      const type = s.missionType || 'TTKS thường xuyên';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [periodSchedules]);

  // Export Emulation Excel (.xls)
  const handleExportEmulationExcel = () => {
    const periodName = selectedPeriod === 'all' ? `Năm ${selectedYear}` : `${selectedPeriod} Năm ${selectedYear}`;
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 0.5pt solid #333333; padding: 5px; text-align: center; }
          th { background-color: #f1f5f9; font-weight: bold; }
          .title { font-size: 14pt; font-weight: bold; text-align: center; border: none; }
          .subtitle { font-size: 12pt; font-style: italic; text-align: center; border: none; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="10" class="title">BẢNG ĐÁNH GIÁ & XẾP LOẠI THI ĐUA CÁN BỘ CHIẾN SỸ TTKS</td></tr>
          <tr><td colspan="10" class="subtitle">Kỳ đánh giá: ${periodName} — Đơn vị: ${currentUser.department || 'Phòng CSGT'}</td></tr>
          <tr><td colspan="10" style="border:none; height: 10px;"></td></tr>
          <tr>
            <th>Xếp hạng</th>
            <th>Họ và tên</th>
            <th>Cấp bậc / Chức vụ</th>
            <th>Số ngày công</th>
            <th>Số ca TTKS</th>
            <th>Tổng giờ TTKS</th>
            <th>Số lượt trực đêm</th>
            <th>Điểm Cường độ</th>
            <th>Phân loại Thi đua</th>
            <th>Ghi chú</th>
          </tr>
    `;

    officerEmulationData.forEach((item) => {
      html += `
        <tr>
          <td>${item.positionRank}</td>
          <td style="text-align: left; font-weight: bold;">${item.officer.fullName}</td>
          <td>${item.officer.rank} - ${item.officer.position}</td>
          <td>${item.workDays}</td>
          <td>${item.patrolCount}</td>
          <td>${item.totalPatrolHours}h</td>
          <td>${item.nightTurns.toFixed(1)}</td>
          <td style="font-weight: bold; color: #1e3a8a;">${item.score}</td>
          <td style="font-weight: bold; ${item.ranking === 'A' ? 'color: #b45309;' : 'color: #1d4ed8;'}">Loại ${item.ranking}</td>
          <td>${item.rankLabel}</td>
        </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BANG_XEP_LOAI_THI_DUA_${selectedPeriod}_${selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Thi Đua Khen Thưởng & Dự Toán Nghiệp Vụ TTKS
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Phân tích chỉ số cường độ làm nhiệm vụ, tự động xếp loại danh hiệu thi đua và theo dõi dự toán ngân sách
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportEmulationExcel}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Bảng Thi Đua (.xls)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          {/* Year */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Năm đánh giá</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
            >
              <option value="2025">Năm 2025</option>
              <option value="2026">Năm 2026</option>
              <option value="2027">Năm 2027</option>
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Kỳ thi đua</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
            >
              <option value="all">🌟 Toàn năm {selectedYear}</option>
              <option value="Q1">Quý I (Tháng 1 - 3)</option>
              <option value="Q2">Quý II (Tháng 4 - 6)</option>
              <option value="Q3">Quý III (Tháng 7 - 9)</option>
              <option value="Q4">Quý IV (Tháng 10 - 12)</option>
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Đơn vị / Đội phụ trách</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              disabled={currentUser.role !== 'admin'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-800 outline-hidden disabled:opacity-60"
            >
              <option value="all">Tất cả các Đội TTKS</option>
              {departments.map((dept, i) => (
                <option key={i} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* View Tab Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Phân hệ hiển thị</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('emulation')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'emulation' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Xếp loại
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('budget')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'budget' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dự toán
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('routes')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'routes' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tuyến & Đề
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRICS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">QUÂN SỐ ĐÁNH GIÁ</span>
            <span className="text-xl font-black text-slate-800">{visibleOfficers.length} CBCS</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">TỔNG CA TUẦN TRA</span>
            <span className="text-xl font-black text-indigo-700">{totalPatrolTurns} lượt</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">CA LÀM ĐÊM / QUA ĐÊM</span>
            <span className="text-xl font-black text-purple-700">{totalNightTurns.toFixed(1)} ca</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">TỔNG QUYẾT TOÁN</span>
            <span className="text-xl font-black text-emerald-700">{totalAllExpense.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>
      </div>

      {/* TAB 1: EMULATION & OFFICER RANKINGS */}
      {activeTab === 'emulation' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>🌟</span> Bảng Xếp Loại & Danh Hiệu Thi Đua Cán Bộ Chiến Sĩ
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Căn cứ tổng hợp tự động từ Nhật ký TTKS, Chấm công ngày, Tiền ăn định lượng và Ca trực đêm
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500">
                Top 25% Loại A: <strong className="text-amber-700">{officerEmulationData.filter(o => o.ranking === 'A').length}</strong> CBCS
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-12">Hạng</th>
                  <th className="py-3 px-4">Cán bộ chiến sĩ</th>
                  <th className="py-3 px-3">Chức vụ / Đơn vị</th>
                  <th className="py-3 px-3 text-center">Ngày công</th>
                  <th className="py-3 px-3 text-center">Ca TTKS</th>
                  <th className="py-3 px-3 text-center">Giờ tuần tra</th>
                  <th className="py-3 px-3 text-center">Lượt đêm</th>
                  <th className="py-3 px-3 text-right">Thực nhận (đ)</th>
                  <th className="py-3 px-3 text-center">Điểm Cống Hiến</th>
                  <th className="py-3 px-4 text-center">Xếp loại Danh hiệu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {officerEmulationData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Chưa có dữ liệu thống kê trong kỳ này.
                    </td>
                  </tr>
                ) : (
                  officerEmulationData.map((row) => (
                    <tr key={row.officer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-3 text-center font-black">
                        {row.positionRank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-950 text-xs shadow-xs">🥇</span>
                        ) : row.positionRank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-900 text-xs shadow-xs">🥈</span>
                        ) : row.positionRank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/30 text-amber-900 text-xs shadow-xs">🥉</span>
                        ) : (
                          <span className="text-slate-400">#{row.positionRank}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">{row.officer.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SH: {row.officer.badgeNumber}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-700">{row.officer.rank}</div>
                        <div className="text-[10px] text-slate-400">{row.officer.position} • {row.officer.department}</div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                        {row.workDays}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/40 rounded-lg">
                        {row.patrolCount}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700">
                        {row.totalPatrolHours}h
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-purple-700">
                        {row.nightTurns.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {(row.rationAmount + row.nightAmount).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full font-black text-xs bg-slate-900 text-white shadow-2xs">
                          {row.score} pts
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border inline-block ${row.rankBadge}`}>
                          Loại {row.ranking} — {row.ranking === 'A' ? 'CSTĐ Cơ sở' : row.ranking === 'B' ? 'CSTT' : 'Đạt'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BUDGET & EXPENDITURE ANALYTICS */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          {/* Budget Overview Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Báo Cáo Giải Ngân Dự Toán Chế Độ TTKS
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi hạn mức ngân sách được giao so với thực chi quyết toán định lượng và bồi dưỡng làm đêm
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded-full">
                Tỷ lệ giải ngân: {budgetUtilizationPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">Thực chi: {totalAllExpense.toLocaleString('vi-VN')} đ</span>
                <span className="text-slate-400">Hạn mức dự toán: {estimatedBudget.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${budgetUtilizationPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>0 đ</span>
                <span className="text-emerald-700 font-bold">Tiết kiệm dự toán: +{budgetSavings.toLocaleString('vi-VN')} đ</span>
                <span>{estimatedBudget.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            {/* Detailed Budget Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Utensils className="w-4 h-4 text-amber-600" />
                  <span>Kinh phí Tiền ăn Định lượng (Mức III: {settings.rationRate.toLocaleString('vi-VN')} đ/ngày)</span>
                </div>
                <div className="text-2xl font-black text-amber-800">
                  {totalRationExpense.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-[11px] text-amber-700">
                  Tổng cộng <strong>{officerEmulationData.reduce((acc, curr) => acc + curr.rationDays, 0)}</strong> ngày công hưởng định lượng tuần tra.
                </div>
              </div>

              <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200/80 space-y-2">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                  <Moon className="w-4 h-4 text-purple-600" />
                  <span>Kinh phí Bồi dưỡng TTKS Ban đêm ({settings.nightShiftRate.toLocaleString('vi-VN')} đ/ca 4h)</span>
                </div>
                <div className="text-2xl font-black text-purple-800">
                  {totalNightExpense.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-[11px] text-purple-700">
                  Tổng cộng <strong>{totalNightTurns.toFixed(1)}</strong> lượt trực đêm / qua đêm được phê duyệt.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROUTE & TOPIC ANALYTICS */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Route Type Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Cơ Cấu Tuyến Đường Tuần Tra Kiểm Soát
            </h3>
            <div className="space-y-3">
              {Object.entries(routeStats).map(([routeType, count]) => {
                const total = periodSchedules.length || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div key={routeType} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{routeType}</span>
                      <span className="font-bold text-blue-700">{count} ca ({percent}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mission & Topic Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Cơ Cấu Chuyên Đề & Nhiệm Vụ TTKS
            </h3>
            <div className="space-y-3">
              {Object.entries(missionStats).map(([missionName, count]) => {
                const total = periodSchedules.length || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div key={missionName} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{missionName}</span>
                      <span className="font-bold text-amber-700">{count} ca ({percent}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
