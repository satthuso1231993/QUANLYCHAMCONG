import React, { useState } from 'react';
import { Officer, PatrolSchedule, Attendance, RationRecord, NightShiftRecord, Team } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Users, Calendar, Shield, Moon, DollarSign, Award, ArrowUpRight, TrendingUp } from 'lucide-react';
import { getFixedPersonnelOfficers } from '../utils/personnel';

interface DashboardProps {
  officers: Officer[];
  schedules: PatrolSchedule[];
  attendance: Attendance[];
  rations: RationRecord[];
  nightShifts: NightShiftRecord[];
  teams?: Team[];
}

export default function Dashboard({
  officers,
  schedules,
  attendance,
  rations,
  nightShifts,
  teams = [],
}: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all', '2026-05', '2026-06'
  const [selectedOfficer, setSelectedOfficer] = useState<string>('all');
  const fixedPersonnelOfficers = getFixedPersonnelOfficers(officers);

  // Filter helper
  const filterByMonthAndOfficer = (recordDate: string, recordOfficerId: string) => {
    const matchesMonth = selectedMonth === 'all' || recordDate.startsWith(selectedMonth);
    const matchesOfficer = selectedOfficer === 'all' || recordOfficerId === selectedOfficer;
    return matchesMonth && matchesOfficer;
  };

  // Calculations
  const activeOfficers = fixedPersonnelOfficers.filter(o => o.status === 'Đang công tác').length;
  
  const filteredAttendance = attendance.filter(a => filterByMonthAndOfficer(a.date, a.officerId));
  const filteredRations = rations.filter(r => filterByMonthAndOfficer(r.date, r.officerId));
  const filteredNightShifts = nightShifts.filter(n => filterByMonthAndOfficer(n.date, n.officerId));

  const totalAttendanceDays = filteredAttendance.length;
  const totalRationDays = filteredRations.length;
  const totalNightShiftLaps = filteredNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);

  const totalRationAmount = filteredRations.reduce((acc, curr) => acc + curr.amount, 0);
  const totalNightShiftAmount = filteredNightShifts.reduce((acc, curr) => acc + curr.amount, 0);
  const grandTotalAmount = totalRationAmount + totalNightShiftAmount;

  // Data for charts - grouped by month
  // We'll calculate for Jan 2026 - Dec 2026 to draw an elegant SVG Chart
  const monthsList = [
    { name: 'Tháng 1', key: '2026-01' },
    { name: 'Tháng 2', key: '2026-02' },
    { name: 'Tháng 3', key: '2026-03' },
    { name: 'Tháng 4', key: '2026-04' },
    { name: 'Tháng 5', key: '2026-05' },
    { name: 'Tháng 6', key: '2026-06' },
    { name: 'Tháng 7', key: '2026-07' },
    { name: 'Tháng 8', key: '2026-08' },
    { name: 'Tháng 9', key: '2026-09' },
    { name: 'Tháng 10', key: '2026-10' },
    { name: 'Tháng 11', key: '2026-11' },
    { name: 'Tháng 12', key: '2026-12' },
  ];

  const monthlySums = monthsList.map(m => {
    const monthRations = rations.filter(r => 
      r.date.startsWith(m.key) && (selectedOfficer === 'all' || r.officerId === selectedOfficer)
    );
    const monthNightShifts = nightShifts.filter(n => 
      n.date.startsWith(m.key) && (selectedOfficer === 'all' || n.officerId === selectedOfficer)
    );

    const rationSum = monthRations.reduce((acc, curr) => acc + curr.amount, 0);
    const nightShiftSum = monthNightShifts.reduce((acc, curr) => acc + curr.amount, 0);
    
    return {
      name: m.name,
      value: (rationSum + nightShiftSum) / 1000, // Đơn vị: nghìn đồng
      raw: rationSum + nightShiftSum
    };
  });

  const maxVal = Math.max(...monthlySums.map(m => m.value), 100);

  return (
    <div className="space-y-6">
      {/* Top Welcome Title & Filter Bar - Aesthetic Bento Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Trang chủ Thống kê Bento</h2>
          <p className="text-xs text-slate-500 mt-1">Đồng bộ tự động dữ liệu Chấm công - Định lượng - Làm đêm Phòng CSGT</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Lọc theo Tháng */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Tháng:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Tất cả các tháng</option>
              <option value="2026-05">Tháng 05/2026</option>
              <option value="2026-06">Tháng 06/2026</option>
            </select>
          </div>

          {/* Lọc theo Cán bộ */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Cán bộ:</span>
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 max-w-[200px] outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Tất cả cán bộ</option>
              {fixedPersonnelOfficers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.rank} {o.fullName} ({o.badgeNumber})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-5">
        
        {/* Bento Cell 1: Quân số (col-span-12 md:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-250 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng số cán bộ</p>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{activeOfficers}</h3>
            <span className="text-xs text-emerald-600 font-bold flex items-center mt-2.5 bg-emerald-50 w-fit px-2.5 py-1 rounded-full">
              Đang hoạt động <ArrowUpRight className="w-3 h-3 ml-0.5 animate-pulse" />
            </span>
          </div>
        </div>

        {/* Bento Cell 2: Chấm Công (col-span-12 md:col-span-6 lg:col-span-3) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-250 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quản lý ngày công</p>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{totalAttendanceDays}</h3>
            <span className="text-xs text-indigo-600 font-bold flex items-center mt-2.5 bg-indigo-50 w-fit px-2.5 py-1 rounded-full">
              Tuần tra & Trực ban
            </span>
          </div>
        </div>

        {/* Bento Cell 3: Action & Export banner styled after the blue report action in Design HTML but customed with totals (col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 bg-linear-to-r from-blue-700 via-indigo-800 to-slate-900 rounded-2xl p-6 shadow-md text-white flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
          <div className="z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-extrabold bg-blue-500/30 text-white px-2.5 py-1 rounded-full tracking-wider">DỰ TOÁN THỜI THỰC KHỐI NGHIỆP VỤ</span>
            </div>
            <h4 className="text-xl font-black tracking-tight mb-1">Kinh phí định lượng & Làm đêm</h4>
            <p className="text-blue-100 text-xs opacity-90 max-w-sm font-medium leading-relaxed">Hệ thống phân tích tự động dữ liệu tuần tra thực tế để trích xuất phụ biểu cấp phát kinh phí tức thời.</p>
          </div>

          <div className="z-10 mt-6 sm:mt-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-white/10 pt-4">
            <div>
              <span className="text-[9px] text-blue-200 font-extrabold uppercase tracking-widest block mb-0.5">Tổng Kinh Phí Dự Kiến</span>
              <p className="text-2xl font-black tracking-tight text-yellow-350">{formatCurrency(grandTotalAmount)}</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3.5 py-1.5 bg-white text-blue-800 rounded-xl text-xs font-black shadow-sm">
                Offline 100% Cục Bộ
              </span>
            </div>
          </div>
          
          {/* Decorative design illustration SVG watermark */}
          <div className="absolute right-[-20px] bottom-[-20px] text-white opacity-5 pointer-events-none transition-transform group-hover:scale-105 duration-500">
            <DollarSign className="w-40 h-40" />
          </div>
        </div>

        {/* Bento Row 2: Charts and recent events */}

        {/* Bento Cell 4: Biêu đồ (col-span-12 lg:col-span-8) */}
        <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-205 transition-all duration-300">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-blue-600 w-5 h-5" />
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Biểu đồ Tổng Kinh Phí 2026 (Nghìn đồng)</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase font-mono bg-slate-50 px-2 py-1 rounded-md">Cập nhật trực quan</span>
          </div>

          <div className="h-64 flex items-end justify-between gap-2 pt-6 px-1.5 relative border-b border-l border-slate-200">
            {/* Y axis lines helper */}
            <div className="absolute left-0 right-0 top-1/4 border-t border-slate-100 pointer-events-none"></div>
            <div className="absolute left-0 right-0 top-2/4 border-t border-slate-100 pointer-events-none"></div>
            <div className="absolute left-0 right-0 top-3/4 border-t border-slate-100 pointer-events-none"></div>

            {monthlySums.map((bar, idx) => {
              const heightPercent = maxVal > 0 ? (bar.value / maxVal) * 85 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group relative z-10 select-none">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none font-bold font-mono">
                    {formatCurrency(bar.raw)}
                  </div>
                  
                  {/* Bar */}
                  <div 
                    style={{ height: `${Math.max(heightPercent, 3)}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      bar.raw > 0 
                        ? 'bg-blue-600 hover:bg-blue-500 shadow-2xs' 
                        : 'bg-slate-150 group-hover:bg-slate-200'
                    }`}
                  ></div>

                  {/* X label */}
                  <span className="text-[9px] font-bold text-slate-400 mt-2 truncate w-full text-center group-hover:text-slate-600">
                    {bar.name.replace('Tháng ', 'T')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bento Cell 5: Lịch Tuần Tra (col-span-12 lg:col-span-4) */}
        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-205 transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Tuần tra gần đây</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Chuyên đề</span>
            </div>
            
            {schedules.length === 0 ? (
              <p className="text-slate-400 text-xs py-10 text-center font-medium">Chưa có lịch tuần tra kiểm soát nào được ban hành.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {[...schedules]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 4)
                  .map((sched) => {
                    const hasCustom = sched.customOfficerIds && sched.customOfficerIds.length > 0;
                    const matchedTeam = !hasCustom ? teams.find(t => t.id === sched.teamId) : null;
                    const displayName = hasCustom 
                      ? `Lẻ (${sched.customOfficerIds!.length} đ/đ)` 
                      : (matchedTeam ? matchedTeam.name : 'Tổ đã giải tán');

                    return (
                      <div key={sched.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-sm">
                            {sched.missionType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            {sched.date.split('-').reverse().join('/')}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 mt-1.5 truncate">{sched.route || sched.topic || sched.missionType}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-400 font-bold">
                          <span>Giờ: {sched.startTime} - {sched.endTime}</span>
                          <span className={`${hasCustom ? 'text-indigo-600' : 'text-slate-500'} font-semibold truncate max-w-[130px]`}>
                            {displayName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Bento Row 3: Metrics details & Config specs */}
        
        {/* Bento Cell 6: Chi tiết Định lượng (col-span-12 md:col-span-6 lg:col-span-4) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-205 transition-all duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Định lượng ban ngày</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Award className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-black text-slate-800 tracking-tight">{totalRationDays}</span>
              <span className="text-xs font-bold text-slate-400"> ngày ăn định lượng</span>
            </div>
            <p className="text-xs font-bold mt-3 text-amber-700 bg-amber-50 px-3 py-2 rounded-xl w-full text-center font-mono">
              Tổng phát: {formatCurrency(totalRationAmount)}
            </p>
          </div>
        </div>

        {/* Bento Cell 7: Chi tiết Làm Đêm (col-span-12 md:col-span-6 lg:col-span-4) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-205 transition-all duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Làm đêm chuyên đề</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Moon className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-black text-slate-800 tracking-tight">{totalNightShiftLaps}</span>
              <span className="text-xs font-bold text-slate-400"> lượt bồi dưỡng trực</span>
            </div>
            <p className="text-xs font-bold mt-3 text-purple-700 bg-purple-50 px-3 py-2 rounded-xl w-full text-center font-mono">
              Tổng phát: {formatCurrency(totalNightShiftAmount)}
            </p>
          </div>
        </div>

        {/* Bento Cell 8: Sổ Tay Định Mức (col-span-12 lg:col-span-4) */}
        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-205 transition-all duration-300">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-slate-400">Cơ cấu đơn vị định mức</span>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold font-mono">SQLite Hoạt động</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">Mức ăn ban ngày:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono">75.000 đ</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-slate-500 font-bold">Bồi dưỡng làm đêm:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono">200.000 đ</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
