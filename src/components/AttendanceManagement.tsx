import React, { useState } from 'react';
import { Officer, Attendance, AttendanceType, Approval, User } from '../types';
import { formatDateDmy } from '../utils/helpers';
import { Plus, Check, Calendar, Search, Trash2, Sliders, AlertTriangle, ChevronRight, ChevronLeft, LayoutGrid, List, Lock, X } from 'lucide-react';

interface AttendanceManagementProps {
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  officers: Officer[];
  approvals: Approval[];
  addLog: (action: string, details: string) => void;
  currentUser: User;
}

export default function AttendanceManagement({
  attendance,
  setAttendance,
  officers,
  approvals,
  addLog,
  currentUser,
}: AttendanceManagementProps) {
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; dateStr: string; typeStr: string } | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('2026-06'); // default to June 2026
  
  // Form fields
  const [officerId, setOfficerId] = useState('');
  const [startDate, setStartDate] = useState('2026-06-02');
  const [endDate, setEndDate] = useState('2026-06-02');
  const [type, setType] = useState<AttendanceType>('Nghỉ phép');
  const [notes, setNotes] = useState('');

  const attendanceTypes: AttendanceType[] = [
    'Làm việc', 'Công tác', 'Học tập', 'Nghỉ bù', 'Nghỉ phép', 'Nghỉ sinh', 'Nghỉ dưỡng'
  ];

  const isMonthLocked = (dateStr: string) => {
    return false; // Lock functionality removed
  };

  const handleOpenAdd = (dateStr?: string) => {
    if (currentUser.role === 'officer_self' && currentUser.officerId) {
      setOfficerId(currentUser.officerId);
    } else {
      setOfficerId(officers[0]?.id || '');
    }
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    setStartDate(targetDate);
    setEndDate(targetDate);
    setType('Nghỉ phép');
    setNotes('');
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string, dateStr: string, typeStr: string) => {
    if (isMonthLocked(dateStr)) {
      alert(`Tháng ${dateStr.substring(5, 7)}/${dateStr.substring(0, 4)} đã khóa phê duyệt. Không thể xóa công này!`);
      return;
    }

    setDeleteConfirm({ id, name, dateStr, typeStr });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id, name, dateStr, typeStr } = deleteConfirm;
    setAttendance(prev => prev.filter(a => a.id !== id));
    addLog('Xóa chấm công thủ công', `Đã xóa công ${typeStr} ngày ${formatDateDmy(dateStr)} của CBCS ${name}.`);
    setDeleteConfirm(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId) {
      alert('Vui lòng chọn cán bộ chiến sĩ!');
      return;
    }

    const getDatesInRange = (startStr: string, endStr: string) => {
      const dates = [];
      const start = new Date(startStr);
      const end = new Date(endStr);
      const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const final = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      while (current <= final) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    const targetDates = getDatesInRange(startDate, endDate);
    if (targetDates.length === 0) {
      alert('Vui lòng chọn khoảng ngày hợp lệ!');
      return;
    }

    const lockedDates = targetDates.filter(d => isMonthLocked(d));
    if (lockedDates.length > 0) {
      alert(`Không thể chấm công vì tồn tại ngày thuộc tháng đã được khóa phê duyệt: ${lockedDates.map(d => formatDateDmy(d)).join(', ')}`);
      return;
    }

    const selectedOfficer = officers.find(o => o.id === officerId);
    const officerName = selectedOfficer ? selectedOfficer.fullName : '';

    const replacedList: string[] = [];
    const filteredPrev = attendance.filter(a => {
      const isTarget = a.officerId === officerId && targetDates.includes(a.date);
      if (isTarget) {
        replacedList.push(`${formatDateDmy(a.date)} (từ "${a.type}" sang "${type}")`);
      }
      return !isTarget;
    });

    const newRecords: Attendance[] = targetDates.map((curDate, index) => ({
      id: `ATT_MAN_${Date.now()}_${index}`,
      officerId,
      date: curDate,
      type,
      notes: notes.trim() || `Chấm thủ công: ${type}`,
    }));

    setAttendance([...filteredPrev, ...newRecords]);

    const dateDesc = startDate === endDate
      ? `ngày ${formatDateDmy(startDate)}`
      : `từ ngày ${formatDateDmy(startDate)} đến ngày ${formatDateDmy(endDate)}`;
      
    const auditDetails = `Đã đăng ký ngày công (${type}) cho đồng chí ${officerName} ${dateDesc}.${replacedList.length > 0 ? ` Thay đổi trạng thái cũ các ngày: ${replacedList.join(', ')}` : ''}`;
    addLog('Chấm công thủ công', auditDetails);

    setShowModal(false);
  };

  // Filter attendance records
  const filteredAttendance = attendance.filter(a => {
    const officer = officers.find(o => o.id === a.officerId);
    if (!officer) return false;

    if (currentUser.role === 'officer_self' && a.officerId !== currentUser.officerId) {
      return false;
    }

    const matchesSearch = 
      officer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      officer.badgeNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMonth = !monthFilter || a.date.startsWith(monthFilter);

    return matchesSearch && matchesMonth;
  });

  const isCurrentMonthLocked = monthFilter && approvals.some(app => app.monthString === monthFilter && app.status === 'Đã khóa');

  const handlePrevMonth = () => {
    if (!monthFilter) return;
    const [y, m] = monthFilter.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    setMonthFilter(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    if (!monthFilter) return;
    const [y, m] = monthFilter.split('-').map(Number);
    const date = new Date(y, m, 1);
    setMonthFilter(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  // Calendar Grid Calculations
  let calYearStr = '2026';
  let calMonthStr = '06';
  if (monthFilter) {
    const parts = monthFilter.split('-');
    if (parts.length === 2) {
      calYearStr = parts[0];
      calMonthStr = parts[1];
    }
  }
  const calYear = parseInt(calYearStr, 10);
  const calMonth = parseInt(calMonthStr, 10);

  const firstDayOfMonthDate = new Date(calYear, calMonth - 1, 1);
  const rawFirstDayOfWeek = firstDayOfMonthDate.getDay();
  const adjustedFirstDayOfWeek = rawFirstDayOfWeek === 0 ? 6 : rawFirstDayOfWeek - 1;
  const daysInCalMonth = new Date(calYear, calMonth, 0).getDate();

  const daySlots: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDayOfWeek; i++) {
    daySlots.push(null);
  }
  for (let d = 1; d <= daysInCalMonth; d++) {
    daySlots.push(d);
  }

  return (
    <div className="space-y-6">
      {/* Upper header action banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Chấm công & Phép chế độ</h2>
          <p className="text-sm text-slate-500 mt-1">
            Đăng ký chế độ phép, ốm đau, đi học, trực ban phụ để hoàn chỉnh bảng kiểm toán công tác tháng
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Khai báo Công / Phép</span>
        </button>
      </div>

      {/* Layout / Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Toggle Mode */}
          <div className="flex p-1 bg-slate-100 rounded-lg max-w-fit">
            <button
              type="button"
              onClick={() => {
                setViewMode('calendar');
                if (!monthFilter) setMonthFilter('2026-06');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Lưới lịch tháng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Danh sách chi tiết ({filteredAttendance.length})</span>
            </button>
          </div>

          {/* Locked Status */}
          {isCurrentMonthLocked && viewMode === 'calendar' && (
            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Tháng đã khóa
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Quick Search */}
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 flex-grow min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên CBCS..."
              className="bg-transparent text-xs outline-hidden w-full text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          {/* Month Selector / Navigation */}
          {viewMode === 'calendar' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 px-2 bg-slate-50 border border-slate-250 rounded-md hover:bg-slate-100 text-xs font-bold font-mono text-slate-650 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => {
                  if (e.target.value) setMonthFilter(e.target.value);
                }}
                className="bg-slate-50 text-slate-800 border border-slate-250 px-3 py-1 rounded-md text-xs font-bold font-mono outline-hidden cursor-pointer h-7"
              />
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 px-2 bg-slate-50 border border-slate-250 rounded-md hover:bg-slate-100 text-xs font-bold font-mono text-slate-650 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-slate-50 text-slate-800 border border-slate-250 px-3 py-1 rounded-md text-xs font-bold font-mono outline-hidden cursor-pointer h-7 min-w-[140px]"
            >
              <option value="">Tất cả các tháng</option>
              <option value="2026-05">Tháng 05-2026</option>
              <option value="2026-06">Tháng 06-2026</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Ledger Grid & Matrix table */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Dòng nhật ký công tác */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-150 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs">Chi tiết dòng công trong kỳ</h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-sm">
                {filteredAttendance.length} dòng dữ liệu
              </span>
            </div>

            <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/55 border-b border-slate-150 text-[10.5px] font-bold text-slate-500 uppercase">
                    <th className="py-2.5 px-4">Cán bộ chiến sĩ</th>
                    <th className="py-2.5 px-4">Ngày</th>
                    <th className="py-2.5 px-4">Loại hình công</th>
                    <th className="py-2.5 px-4">Nguồn gốc</th>
                    <th className="py-2.5 px-4">Ghi chú</th>
                    <th className="py-2.5 px-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Không tìm thấy dữ liệu chấm công. Vui lòng bấm "Khai báo Công / Phép".
                      </td>
                    </tr>
                  ) : (
                    [...filteredAttendance]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((att) => {
                        const officer = officers.find(o => o.id === att.officerId);
                        const isAuto = !!att.sourceScheduleId;
                        const isLocked = isMonthLocked(att.date);

                        return (
                          <tr key={att.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4">
                              {officer ? (
                                <div>
                                  <span className="font-bold text-slate-800">{officer.fullName}</span>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{officer.rank} - SH: {officer.badgeNumber}</p>
                                </div>
                              ) : (
                                <span className="text-rose-500 font-bold">Cán bộ đã xóa</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-600">
                              {formatDateDmy(att.date)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                                att.type === 'Làm việc' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : att.type === 'Công tác' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : att.type === 'Học tập' 
                                  ? 'bg-indigo-100 text-indigo-800' 
                                  : att.type === 'Nghỉ phép' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : att.type === 'Nghỉ bù'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : att.type === 'Nghỉ sinh'
                                  ? 'bg-pink-100 text-pink-800'
                                  : 'bg-teal-100 text-teal-800' // 'Nghỉ dưỡng'
                              }`}>
                                {att.type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-semibold ${isAuto ? 'text-blue-600' : 'text-slate-500'}`}>
                                {isAuto ? 'Tuần tra (Tự động)' : 'Thẩm quyền chấm'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 italic max-w-[150px] truncate" title={att.notes}>
                              {att.notes || '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => officer && handleDelete(att.id, officer.fullName, att.date, att.type)}
                                disabled={isAuto || isLocked}
                                className={`p-1 rounded-sm transition-colors ${
                                  isAuto || isLocked
                                    ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                                    : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                                }`}
                                title={isAuto ? "Công tự động không thể xóa tại đây" : "Xóa dòng công"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col: Ma trận tổng công chế độ của cán bộ trong kỳ lọc */}
          <div className="bg-white rounded-xl border border-slate-150 shadow-xs p-5 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Tổng công chế độ trong kỳ</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Bao gồm ngày làm việc tuần tra và nghỉ phép chế độ khác</p>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {officers.filter(off => {
                if (currentUser.role === 'officer_self') {
                  return off.id === currentUser.officerId;
                }
                return off.status === 'Đang công tác';
              }).map(off => {
                const offAtts = filteredAttendance.filter(a => a.officerId === off.id);
                const countLàmViệc = offAtts.filter(a => a.type === 'Làm việc').length;
                const countCôngTác = offAtts.filter(a => a.type === 'Công tác').length;
                const countNghỉPhép = offAtts.filter(a => a.type === 'Nghỉ phép').length;
                const countPhépKhác = offAtts.filter(a => a.type !== 'Làm việc' && a.type !== 'Công tác' && a.type !== 'Nghỉ phép').length;

                return (
                  <div key={off.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-350 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 text-xs">{off.fullName}</span>
                      <span className="text-[10px] font-mono text-slate-400">{off.rank}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      SH: {off.badgeNumber}
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-600 mt-2.5 pt-2 border-t border-slate-200/50">
                      <div className="text-center">
                        <span className="block font-bold text-blue-600 text-xs">{countLàmViệc}</span>
                        <span>Làm việc</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-purple-600 text-xs">{countCôngTác}</span>
                        <span>Công tác</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-emerald-600 text-xs">{countNghỉPhép}</span>
                        <span>Nghỉ phép</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-slate-600 text-xs">{countPhépKhác}</span>
                        <span>Nghỉ khác</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* RENDER DẠNG LƯỚI NGÀY TRONG THÁNG */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-150 shadow-xs overflow-hidden p-4 min-h-[500px]">
          {/* Day Headers row */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-t-xl overflow-hidden">
            {['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'].map((dayName, idx) => (
              <div key={idx} className="py-2.5 text-center font-bold text-xs bg-slate-50 text-slate-700">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Grid slots */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 border-x border-b border-slate-200 rounded-b-xl overflow-hidden">
            {daySlots.map((dayNum, idx) => {
              if (dayNum === null) {
                return (
                  <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[140px]" />
                );
              }

              const formattedDay = String(dayNum).padStart(2, '0');
              const dateStr = `${calYearStr}-${calMonthStr}-${formattedDay}`;
              
              // Find attendance for this day
              const dayAttendance = filteredAttendance.filter(a => a.date === dateStr);
              
              const currentDayOfWeek = idx % 7;
              const isSaturday = currentDayOfWeek === 5;
              const isSunday = currentDayOfWeek === 6;
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              return (
                <div 
                  key={`day-${dayNum}`} 
                  className={`bg-white min-h-[140px] p-2 flex flex-col group relative transition-colors ${
                    isToday ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : isSunday
                        ? 'text-rose-600'
                        : isSaturday
                        ? 'text-indigo-600'
                        : 'text-slate-600'
                    }`}>
                      {dayNum}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {dayAttendance.length} lượt
                      </span>
                      {!isCurrentMonthLocked && (
                        <button
                          type="button"
                          onClick={() => handleOpenAdd(dateStr)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-600 hover:bg-blue-50 bg-slate-50 rounded border border-slate-200 transition-all shadow-xs cursor-pointer"
                          title={`Khai báo công cho ngày ${dayNum}/${calMonthStr}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] pr-1 styled-scrollbar">
                    {dayAttendance.map(att => {
                      const officer = officers.find(o => o.id === att.officerId);
                      const isAuto = !!att.sourceScheduleId;
                      
                      const typeColors: Record<string, string> = {
                        'Làm việc': 'bg-blue-50 text-blue-700 border-blue-200/60',
                        'Công tác': 'bg-purple-50 text-purple-700 border-purple-200/60',
                        'Học tập': 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
                        'Nghỉ phép': 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                        'Nghỉ bù': 'bg-amber-50 text-amber-700 border-amber-200/60',
                        'Nghỉ sinh': 'bg-pink-50 text-pink-700 border-pink-200/60',
                        'Nghỉ dưỡng': 'bg-teal-50 text-teal-700 border-teal-200/60'
                      };
                      
                      const itemColor = typeColors[att.type] || 'bg-slate-50 text-slate-700 border-slate-200/60';

                      return (
                        <div 
                          key={att.id}
                          className={`p-1.5 rounded flex flex-col gap-1 border text-[10px] leading-tight ${itemColor}`}
                          title={`${officer?.fullName} - ${att.type}${att.notes ? `: ${att.notes}` : ''}`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-bold truncate" style={{ maxWidth: '80%' }}>
                              {officer?.fullName || 'Đã xóa'}
                            </span>
                            <button
                              onClick={() => officer && handleDelete(att.id, officer.fullName, att.date, att.type)}
                              disabled={isAuto || isCurrentMonthLocked}
                              className={`p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                                isAuto || isCurrentMonthLocked
                                  ? 'text-slate-300 hidden'
                                  : 'text-rose-500 hover:bg-rose-100'
                              }`}
                              title="Xóa nghỉ/chấm công"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="font-medium opacity-80">{att.type}</span>
                            {isAuto && <span className="opacity-60 text-[8px] italic">(Tự động)</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CHẤM CÔNG THỦ CÔNG MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Chấm công Thủ công bổ sung</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Chọn Cán bộ */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cán bộ chiến sĩ áp dụng *</label>
                <select
                  required
                  disabled={currentUser.role === 'officer_self'}
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="" disabled>--- Chọn cán bộ ---</option>
                  {officers.filter(o => {
                    if (currentUser.role === 'officer_self') {
                      return o.id === currentUser.officerId;
                    }
                    return o.status === 'Đang công tác';
                  }).map(o => (
                    <option key={o.id} value={o.id}>
                      {o.rank} {o.fullName} ({o.badgeNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Từ ngày tới ngày */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Từ ngày *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Đến ngày *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Loại hình công */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loại hình / Chế độ công tác *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AttendanceType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                >
                  {attendanceTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lý do / Quyết định liên quan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Đi huấn luyện theo QĐ số 45/QĐ-CAT"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                />
              </div>

              <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-[10px] text-amber-800 leading-normal">
                  Chế độ chấm thủ công (như phép, công tác, trực cơ quan) dùng để tổng hợp báo cáo hành chính. Chế độ này không tự động cộng thêm phụ cấp định lượng tuần tra và tiền làm đêm trừ khi được định nghĩa trong lịch tuần tra cụ thể.
                </span>
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
                  Xác nhận chấm
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
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa dòng chấm công</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa dòng chấm công ngày <strong className="text-slate-800">{formatDateDmy(deleteConfirm.dateStr)}</strong> ({deleteConfirm.typeStr}) của đồng chí <strong className="text-slate-800">{deleteConfirm.name}</strong>?
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
