import React, { useState, useMemo } from 'react';
import { Officer, Team, PatrolSchedule, MissionType, Approval, User, SystemSettings } from '../types';
import { isNightShift, formatDateDmy } from '../utils/helpers';
import { Plus, Calendar, Clock, MapPin, Tag, Shield, FileText, Edit2, Trash2, X, Lock, CheckCircle, HelpCircle, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { getFixedPersonnelOfficers } from '../utils/personnel';

interface PatrolSchedulesProps {
  schedules: PatrolSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<PatrolSchedule[]>>;
  teams: Team[];
  officers: Officer[];
  approvals: Approval[];
  settings: SystemSettings;
  addLog: (action: string, details: string) => void;
  syncAutoCalculations: (latestSchedules: PatrolSchedule[]) => void;
  currentUser: User;
}

export default function PatrolSchedules({
  schedules,
  setSchedules,
  teams,
  officers,
  approvals,
  settings,
  addLog,
  syncAutoCalculations,
  currentUser,
}: PatrolSchedulesProps) {
  const fixedPersonnelOfficers = useMemo(() => getFixedPersonnelOfficers(officers), [officers]);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PatrolSchedule | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [calendarMonth, setCalendarMonth] = useState('2026-06');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; dateStr: string; topicStr: string } | null>(null);

  const canManageSchedules = currentUser.role === 'admin' || currentUser.role === 'commander' || currentUser.role === 'team_leader';

  const getNextDateString = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    if (Number.isNaN(dateObj.getTime())) return dateStr;
    dateObj.setDate(dateObj.getDate() + 1);
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };

  const parseTimeToDec = (timeStr: string | undefined) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h + m / 60;
  };

  const getShiftEndDateString = (dateStr: string, startTimeStr: string, endTimeStr: string) => {
    const startDec = parseTimeToDec(startTimeStr);
    const endDec = parseTimeToDec(endTimeStr);
    if (startDec === null || endDec === null) return dateStr;
    if (endDec <= startDec) return getNextDateString(dateStr);
    return dateStr;
  };

  // Form Fields for Shift 1
  const [startDate, setStartDate] = useState('2026-06-02');
  const [endDate, setEndDate] = useState('2026-06-02');
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('23:00');
  const [route, setRoute] = useState('');
  const [area, setArea] = useState('');
  const [topic, setTopic] = useState('');
  const [missionType, setMissionType] = useState<MissionType>('Tuần tra kiểm soát');
  const [teamId, setTeamId] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Bản nháp' | 'Đã ban hành'>('Đã ban hành');

  // Custom Officer Assignments
  const [assignmentMode, setAssignmentMode] = useState<'team' | 'individual'>('team');
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [searchVal, setSearchVal] = useState('');

  // Sister Form Fields for Shift 2 (Quick Two-Shift Entry Method)
  const [isTwoShifts, setIsTwoShifts] = useState(false);
  const [startDate2, setStartDate2] = useState('2026-06-02');
  const [endDate2, setEndDate2] = useState('2026-06-02');
  const [startTime2, setStartTime2] = useState('21:00');
  const [endTime2, setEndTime2] = useState('03:00'); // Overnight shift by default
  const [route2, setRoute2] = useState('');
  const [area2, setArea2] = useState('');
  const [topic2, setTopic2] = useState('');
  const [missionType2, setMissionType2] = useState<MissionType>('Chuyên đề nồng độ cồn');

  const missionTypes: MissionType[] = [
    'Tuần tra kiểm soát',
    'Chuyên đề nồng độ cồn',
    'Chuyên đề tốc độ',
    'Kiểm tra xử lý quá tải',
    'Kiểm tra xử lý vi phạm',
    'Hộ tống dẫn đoàn',
    'Khác'
  ];

  // Check if a date string YYYY-MM is locked
  const isMonthLocked = (dateStr: string) => {
    return false; // Lock functionality removed
  };

  const handlePrevMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setCalendarMonth(`${prevY}-${prevM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
    setCalendarMonth(`${nextY}-${nextM}`);
  };

  const handleOpenAdd = (targetDate?: string) => {
    const defaultDate = targetDate || '2026-06-02';
    // Default initial template
    setStartDate(defaultDate);
    setEndDate(defaultDate);
    setStartTime('08:00');
    setEndTime('12:00');
    setRoute('');
    setArea('');
    setTopic('ATGT chung');
    setMissionType('Tuần tra kiểm soát');
    setTeamId(teams[0]?.id || '');
    setNotes('');
    setStatus('Đã ban hành');
    setEditingSchedule(null);
    setAssignmentMode('team');
    setSelectedOfficerIds([]);
    setSearchVal('');

    // Reset second shift states
    setIsTwoShifts(false);
    setStartDate2(defaultDate);
    setEndDate2(defaultDate);
    setStartTime2('21:00');
    setEndTime2('03:00'); // Spans across midnight
    setRoute2('');
    setArea2('');
    setTopic2('Nồng độ cồn');
    setMissionType2('Chuyên đề nồng độ cồn');

    setShowModal(true);
  };

  const handleOpenEdit = (sched: PatrolSchedule) => {
    if (isMonthLocked(sched.date)) {
      alert(`Dữ liệu tháng ${sched.date.substring(5, 7)}/${sched.date.substring(0, 4)} đã được khóa phê duyệt. Không thể chỉnh sửa lịch tuần tra này!`);
      return;
    }

    setEditingSchedule(sched);
    setStartDate(sched.date);
    setEndDate(sched.date);
    setStartTime(sched.startTime);
    setEndTime(sched.endTime);
    setRoute(sched.route || '');
    setArea(sched.area || '');
    setTopic(sched.topic);
    setMissionType(sched.missionType);
    setNotes(sched.notes || '');
    setStatus(sched.status);
    setIsTwoShifts(false); // Can only edit single shifts from details list

    if (sched.customOfficerIds && sched.customOfficerIds.length > 0) {
      setAssignmentMode('individual');
      setSelectedOfficerIds(sched.customOfficerIds);
      setTeamId('');
    } else {
      setAssignmentMode('team');
      setTeamId(sched.teamId || '');
      setSelectedOfficerIds([]);
    }

    setSearchVal('');
    setShowModal(true);
  };

  const handleDelete = (id: string, dateStr: string, topicStr: string) => {
    if (isMonthLocked(dateStr)) {
      alert(`Dữ liệu tháng ${dateStr.substring(5, 7)}/${dateStr.substring(0, 4)} đã được khóa phê duyệt. Không thể xóa lịch tuần tra!`);
      return;
    }

    setDeleteConfirm({ id, dateStr, topicStr });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id, dateStr, topicStr } = deleteConfirm;
    const updatedSchedules = schedules.filter(s => s.id !== id);
    setSchedules(updatedSchedules);
    syncAutoCalculations(updatedSchedules);
    addLog('Xóa lịch tuần tra', `Đã xóa lịch tuần tra ngày ${formatDateDmy(dateStr)}, ${topicStr}.`);
    setDeleteConfirm(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isTeamMode = assignmentMode === 'team';

    if (isTeamMode && !teamId) {
      alert('Vui lòng chọn Tổ tuần tra!');
      return;
    }

    if (!isTeamMode && selectedOfficerIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 cán bộ chiến sĩ để thực hiện lịch tuần tra!');
      return;
    }

    let updatedSchedules = [...schedules];

    if (editingSchedule) {
      if (isMonthLocked(startDate)) {
        alert(`Tháng ${startDate.substring(5, 7)}/${startDate.substring(0, 4)} đã được khóa phê duyệt. Không thể lưu lịch!`);
        return;
      }

      updatedSchedules = schedules.map(s => s.id === editingSchedule.id ? {
        ...s,
        date: startDate,
        startTime,
        endTime,
        route: '',
        area: '',
        topic: '',
        missionType: 'Tuần tra kiểm soát',
        teamId: isTeamMode ? teamId : undefined,
        customOfficerIds: isTeamMode ? undefined : selectedOfficerIds,
        notes,
        status
      } : s);

      addLog('Sửa lịch tuần tra', `Đã cập nhật lịch tuần tra ngày ${formatDateDmy(startDate)} (${status}).`);
    } else {
      // Create new schedules in selected date range
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

      const [sH, sM] = startTime.split(':').map(Number);
      const [eH, eM] = endTime.split(':').map(Number);
      const isOvernight = (eH + eM / 60) <= (sH + sM / 60);

      const targetDates1 = (!isTwoShifts && isOvernight) ? [startDate] : getDatesInRange(startDate, endDate);
      const targetDates2 = isTwoShifts ? getDatesInRange(startDate2, endDate2) : [];

      if (targetDates1.length === 0) {
        alert('Vui lòng chọn khoảng ngày hợp lệ!');
        return;
      }
      if (isTwoShifts && targetDates2.length === 0) {
        alert('Vui lòng chọn khoảng ngày hợp lệ cho Ca 2!');
        return;
      }

      const lockedDates1 = targetDates1.filter(d => isMonthLocked(d));
      const lockedDates2 = isTwoShifts ? targetDates2.filter(d => isMonthLocked(d)) : [];

      if (lockedDates1.length > 0 || lockedDates2.length > 0) {
        const allLocked = [...lockedDates1, ...lockedDates2];
        alert(`Không thể lập lịch tuần tra vì tồn tại ngày thuộc tháng đã được khóa phê duyệt: ${allLocked.map(d => formatDateDmy(d)).join(', ')}`);
        return;
      }
      const addShiftToSchedules = (
        targetArray: PatrolSchedule[],
        idBase: string,
        curDate: string,
        stTime: string,
        edTime: string,
        shiftNotes: string
      ) => {
        targetArray.push({
          id: idBase,
          date: curDate,
          startTime: stTime,
          endTime: edTime,
          route: '',
          area: '',
          topic: '',
          missionType: 'Tuần tra kiểm soát',
          teamId: isTeamMode ? teamId : undefined,
          customOfficerIds: isTeamMode ? undefined : selectedOfficerIds,
          notes: shiftNotes,
          status
        });
      };
      
      const newSchedules: PatrolSchedule[] = [];
      const timestamp = Date.now();

      if (isTwoShifts) {
        // Ca 1 creation
        targetDates1.forEach((curDate, index) => {
          addShiftToSchedules(newSchedules, `SCH_${timestamp}_${index}_A`, curDate, startTime, endTime, notes ? `${notes} (Ca 1)` : 'Ca 1');
        });

        // Ca 2 creation
        targetDates2.forEach((curDate, index) => {
          addShiftToSchedules(newSchedules, `SCH_${timestamp}_${index}_B`, curDate, startTime2, endTime2, notes ? `${notes} (Ca 2)` : 'Ca 2');
        });
      } else {
        // Standard single shift creation
        targetDates1.forEach((curDate, index) => {
          addShiftToSchedules(newSchedules, `SCH_${timestamp}_${index}`, curDate, startTime, endTime, notes);
        });
      }

      updatedSchedules = [...schedules, ...newSchedules];
      const dateDesc = isTwoShifts
        ? `phối ca độc lập`
        : (startDate === endDate
          ? `ngày ${formatDateDmy(startDate)}`
          : `từ ngày ${formatDateDmy(startDate)} đến ngày ${formatDateDmy(endDate)}`);
      addLog('Tạo lịch tuần tra', `Đã lập lịch tuần tra mới ${dateDesc} (${status}).`);
    }

    setSchedules(updatedSchedules);
    syncAutoCalculations(updatedSchedules);
    setShowModal(false);
  };

  // Calendar Grid Calculations
  const [calYearStr, calMonthStr] = calendarMonth.split('-');
  const calYear = parseInt(calYearStr, 10);
  const calMonth = parseInt(calMonthStr, 10);

  // First day of that selected month
  const firstDayOfMonthDate = new Date(calYear, calMonth - 1, 1);
  const rawFirstDayOfWeek = firstDayOfMonthDate.getDay();
  // Adjust Monday = index 0, Tuesday = index 1, ... Sunday = index 6
  const adjustedFirstDayOfWeek = rawFirstDayOfWeek === 0 ? 6 : rawFirstDayOfWeek - 1;

  // Number of days in selected month:
  const daysInCalMonth = new Date(calYear, calMonth, 0).getDate();

  // Derived display schedules
  const visualSchedules = useMemo(() => {
    return schedules.map(s => ({
      ...s,
      originalSched: s,
      originalId: s.id
    }));
  }, [schedules]);

  // Create an array of days
  const daySlots: (number | null)[] = [];
  // previous month slots as null:
  for (let i = 0; i < adjustedFirstDayOfWeek; i++) {
    daySlots.push(null);
  }
  // current month days:
  for (let d = 1; d <= daysInCalMonth; d++) {
    daySlots.push(d);
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Nhập lịch tuần tra kiểm soát</h2>
          <p className="text-sm text-slate-500 mt-1">
            Bảng điều phối kế hoạch tuần tra, tự động kết toán ngày công, định lượng và lượt làm đêm của Tổ công tác
          </p>
        </div>

        {canManageSchedules && (
          <button
            onClick={() => handleOpenAdd()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Lập lịch tuần tra kiểm soát</span>
          </button>
        )}
      </div>

      {/* Tab select & Control Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        {/* Toggle Mode */}
        <div className="flex p-1 bg-slate-100 rounded-lg max-w-fit">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
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
            <span>Bảng kê chi tiết ({schedules.length})</span>
          </button>
        </div>

        {/* Month selector controls */}
        {viewMode === 'calendar' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 px-2.5 bg-slate-50 border border-slate-250 rounded-lg hover:bg-slate-100 text-xs font-bold font-mono text-slate-650 transition-colors cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={calendarMonth}
              onChange={(e) => {
                if (e.target.value) setCalendarMonth(e.target.value);
              }}
              className="bg-slate-50 text-slate-800 border border-slate-250 px-3 py-1.5 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden cursor-pointer"
            />
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 px-2.5 bg-slate-50 border border-slate-250 rounded-lg hover:bg-slate-100 text-xs font-bold font-mono text-slate-650 transition-colors cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* RENDER DẠNG LƯỚI NGÀY TRONG THÁNG */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-150 shadow-xs overflow-hidden p-4">
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
              const dateStr = `${calYear}-${calMonthStr}-${formattedDay}`;
              const daySchedules = visualSchedules.filter(s => s.date === dateStr);
              
              const currentDayOfWeek = idx % 7;
              const isSaturday = currentDayOfWeek === 5;
              const isSunday = currentDayOfWeek === 6;
              const isToday = dateStr === '2026-06-03';
              const isLocked = isMonthLocked(dateStr);

              return (
                <div 
                  key={`day-${dayNum}`} 
                  className={`bg-white min-h-[140px] p-2 flex flex-col group relative transition-colors ${
                    isToday ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/10' : ''
                  } ${isSunday ? 'bg-rose-50/5' : ''} ${isSaturday ? 'bg-slate-50/20' : ''} hover:bg-slate-50/80`}
                >
                  {/* Cell Header */}
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-bold leading-none ${
                        isToday 
                          ? 'bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-xs' 
                          : (isSunday ? 'text-rose-600' : 'text-slate-600')
                      }`}>
                        {dayNum}
                      </span>
                      {isToday && (
                        <span className="text-[9px] uppercase font-bold text-blue-600 tracking-tight">Hôm nay</span>
                      )}
                    </div>
                    
                    {!isLocked && canManageSchedules && (
                      <button
                        type="button"
                        onClick={() => handleOpenAdd(dateStr)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-600 hover:bg-blue-50 bg-slate-50 rounded border border-slate-200 transition-all shadow-xs cursor-pointer"
                        title={`Lập lịch mới cho ngày ${dayNum}/${calMonth}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sched Roster inside cell */}
                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[140px]">
                    {daySchedules.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-5 text-[10px] text-slate-300 italic group-hover:text-slate-400">
                        Chưa phân công
                      </div>
                    ) : (
                      daySchedules.map((sched) => {
                        const hasCustomOfficers = sched.customOfficerIds && sched.customOfficerIds.length > 0;
                        const team = !hasCustomOfficers ? teams.find(t => t.id === sched.teamId) : null;
                        const isSchedLocked = isMonthLocked(sched.date);
                        
                        let label = "";
                        let colorClasses = "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/80";
                        
                        if (hasCustomOfficers) {
                          label = "CBCS lẻ";
                          colorClasses = "bg-purple-50 text-purple-750 border-purple-200 hover:bg-purple-100/80";
                        } else if (team) {
                          label = team.name;
                          if (team.id === 'TEAM_001') {
                            colorClasses = "bg-blue-50 text-blue-700 border-blue-250 hover:bg-blue-100/80";
                          } else if (team.id === 'TEAM_002') {
                            colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100/80";
                          } else if (team.id === 'TEAM_003') {
                            colorClasses = "bg-amber-50 text-amber-700 border-amber-250 hover:bg-amber-100/80";
                          } else {
                            colorClasses = "bg-teal-50 text-teal-700 border-teal-250 hover:bg-teal-100/80";
                          }
                        } else {
                          label = "Tổ giải tán";
                          colorClasses = "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-250";
                        }

                        if (sched.status === 'Bản nháp') {
                          colorClasses = "bg-slate-50 text-slate-400 border-slate-200 border-dashed hover:bg-slate-100";
                        }

                        const crossesNight = isNightShift(sched.startTime, sched.endTime);
                        const endDateStr = getShiftEndDateString(sched.date, sched.startTime, sched.endTime);
                        const isOvernight = endDateStr !== sched.date;
                        const timeText = isOvernight
                          ? `${sched.startTime}-${sched.endTime} (sang ${formatDateDmy(endDateStr)})`
                          : `${sched.startTime}-${sched.endTime}`;
                        const titleText = isOvernight
                          ? `${label}: ${formatDateDmy(sched.date)} ${sched.startTime} → ${formatDateDmy(endDateStr)} ${sched.endTime}. ${sched.notes || ''}`
                          : `${label}: ${sched.startTime} - ${sched.endTime}. ${sched.notes || ''}`;

                        return (
                          <div 
                            key={sched.id}
                            onClick={() => handleOpenEdit(sched.originalSched)}
                            className={`p-1.5 rounded-lg border text-[10.5px] font-semibold leading-tight cursor-pointer transition-all flex flex-col justify-between shadow-xs ${colorClasses}`}
                            title={titleText}
                          >
                            <div className="flex items-center justify-between gap-1 w-full text-[11px]">
                              <span className="truncate font-bold">{label}</span>
                              {sched.status === 'Bản nháp' && (
                                <span className="text-[8px] bg-slate-200 text-slate-600 px-0.5 rounded leading-none shrink-0 scale-90 origin-right">NHÁP</span>
                              )}
                              {isSchedLocked && (
                                <Lock className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between gap-1 mt-1 text-[9px] font-mono opacity-85">
                              <span className="truncate">{timeText}</span>
                              <div className="flex gap-0.5 shrink-0 text-[10px]">
                                {crossesNight && <span title="Ca tuần đêm / qua đêm">🌙</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RENDER CHẾ ĐỘ DANH SÁCH CHI TIẾT */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Ngày công tác</th>
                <th className="py-3 px-4">Khung giờ</th>
                <th className="py-3 px-4">Lực lượng thực hiện</th>
                <th className="py-3 px-4 text-center">Tự động tính</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Chưa có lịch tuần tra kiểm soát nào được ghi nhận. Vui lòng bấm "Lập Lịch Tuần Tra".
                  </td>
                </tr>
              ) : (
                [...schedules]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((sched) => {
                    const hasCustomOfficers = sched.customOfficerIds && sched.customOfficerIds.length > 0;
                    const team = !hasCustomOfficers ? teams.find(t => t.id === sched.teamId) : null;
                    const isLocked = isMonthLocked(sched.date);
                    const crossesNight = isNightShift(sched.startTime, sched.endTime);
                    const endDateStr = getShiftEndDateString(sched.date, sched.startTime, sched.endTime);
                    const isOvernight = endDateStr !== sched.date;
                    
                    let displayTeamName = "";
                    let countMembers = 0;
                    let memberNamesList = "";
                    let isCustom = false;

                    if (hasCustomOfficers) {
                      countMembers = sched.customOfficerIds!.length;
                      const matchedOfficers = sched.customOfficerIds!
                        .map(id => officers.find(o => o.id === id))
                        .filter(Boolean) as Officer[];
                      displayTeamName = "CBCS lẻ tự chọn";
                      memberNamesList = matchedOfficers.map(o => `${o.rank} ${o.fullName}`).join(", ");
                      isCustom = true;
                    } else {
                      displayTeamName = team ? team.name : "Tổ đã giải tán";
                      countMembers = team ? team.memberIds.length : 0;
                      const matchedOfficers = team 
                        ? team.memberIds.map(id => officers.find(o => o.id === id)).filter(Boolean) as Officer[]
                        : [];
                      memberNamesList = matchedOfficers.map(o => `${o.rank} ${o.fullName}`).join(", ");
                    }

                    return (
                      <tr key={sched.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {isOvernight ? `${formatDateDmy(sched.date)} → ${formatDateDmy(endDateStr)}` : formatDateDmy(sched.date)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{sched.startTime} - {sched.endTime}{isOvernight ? ' (xuyên ngày)' : ''}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 max-w-[250px]">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold ${isCustom ? 'text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]' : 'text-slate-700'}`}>
                              {displayTeamName}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2" title={memberNamesList}>
                            <span className="font-semibold text-slate-500">Quân số ({countMembers}):</span> {memberNamesList || 'Chưa phân công'}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-center gap-1 text-[10px]">
                            {sched.status === 'Đã ban hành' ? (
                              <>
                                <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-sm font-semibold">
                                  +1 công/CBCS
                                </span>
                                <div className="flex gap-1">
                                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-xs font-semibold" title="Đảm bảo định lượng 75.000 đ/ngày">
                                    +1 Định lượng
                                  </span>
                                  {crossesNight && (
                                    <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-xs font-semibold font-mono" title="Phí làm đêm 200.000 đ">
                                      🌙 +1 Đêm
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Nháp - chưa tính</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sched.status === 'Đã ban hành' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {sched.status}
                            </span>

                            {isLocked && (
                              <span className="flex items-center gap-0.5 text-[9px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.2 rounded-full mt-1">
                                <Lock className="w-2.5 h-2.5" />
                                Đã duyệt khóa
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {canManageSchedules ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(sched)}
                                disabled={isLocked}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isLocked 
                                    ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                                    : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                }`}
                                title={isLocked ? "Tháng đã bị khóa" : "Chỉnh sửa lịch"}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(sched.id, sched.date, sched.topic || sched.missionType)}
                                disabled={isLocked}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isLocked 
                                    ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                                    : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                                }`}
                                title={isLocked ? "Tháng đã bị khóa" : "Xóa lịch tuần tra"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[10px] bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">Chỉ xem</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Lập lịch/Cập nhật MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`bg-white rounded-xl shadow-xl border border-slate-200 w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200 transition-all ${isTwoShifts ? 'max-w-4xl' : 'max-w-lg'}`}>
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingSchedule ? 'Cập nhật lịch tuần tra kiểm soát' : 'Lập lịch tuần tra kiểm soát'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Ngày thực hiện hoặc Chọn khoảng ngày */}
                {editingSchedule ? (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày thực hiện *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setEndDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                    />
                  </div>
                ) : !isTwoShifts ? (
                  <>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Từ ngày *</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Đến ngày *</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                      />
                    </div>
                  </>
                ) : null}

                {/* PHƯƠNG THỨC PHÂN CÔNG */}
                <div className="col-span-2 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                  <span className="block text-xs font-bold text-slate-700">Lực lượng làm nhiệm vụ *</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignmentMode('team')}
                      className={`flex-1 py-1.5 px-2.5 text-[11px] font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        assignmentMode === 'team'
                          ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-100/50'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      Chọn Tổ tuần tra sẵn có
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentMode('individual')}
                      className={`flex-1 py-1.5 px-2.5 text-[11px] font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        assignmentMode === 'individual'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-100/50'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      Tự chọn Cán bộ chiến sĩ lẻ
                    </button>
                  </div>

                  {assignmentMode === 'team' ? (
                    <div className="pt-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Tổ tuần tra phụ trách *</label>
                      <select
                        required={assignmentMode === 'team'}
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 rounded-md text-xs outline-hidden"
                      >
                        <option value="" disabled>--- Chọn tổ tuần tra ---</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-slate-200/50">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-slate-500">
                          Chọn Cán bộ chiến sĩ ({selectedOfficerIds.length} đã chọn)
                        </label>
                        <button
                          type="button"
                          onClick={() => setSelectedOfficerIds([])}
                          className="text-[9px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          Bỏ chọn tất cả
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Tìm kiếm danh bạ theo tên hoặc quân hàm..."
                        value={searchVal}
                        onChange={(e) => setSearchVal(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 focus:border-indigo-400 rounded text-[11px] outline-hidden"
                      />

                      <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-md bg-white divide-y divide-slate-100 p-1">
                        {fixedPersonnelOfficers.filter(o => {
                          if (o.status !== 'Đang công tác') return false;
                          if (!searchVal) return true;
                          const query = searchVal.toLowerCase();
                          return o.fullName.toLowerCase().includes(query) || o.badgeNumber.toLowerCase().includes(query) || o.rank.toLowerCase().includes(query) || o.department.toLowerCase().includes(query);
                        }).length === 0 ? (
                          <div className="text-[10px] text-slate-400 text-center py-4">Không tìm thấy cán bộ phù hợp</div>
                        ) : (
                          fixedPersonnelOfficers.filter(o => {
                            if (o.status !== 'Đang công tác') return false;
                            if (!searchVal) return true;
                            const query = searchVal.toLowerCase();
                            return o.fullName.toLowerCase().includes(query) || o.badgeNumber.toLowerCase().includes(query) || o.rank.toLowerCase().includes(query) || o.department.toLowerCase().includes(query);
                          }).map(o => {
                            const isChecked = selectedOfficerIds.includes(o.id);
                            return (
                              <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded transition-colors text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedOfficerIds(selectedOfficerIds.filter(id => id !== o.id));
                                    } else {
                                      setSelectedOfficerIds([...selectedOfficerIds, o.id]);
                                    }
                                  }}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300 animate-none shrink-0"
                                />
                                <div className="flex-1 flex justify-between items-center pr-1.5 min-w-0">
                                  <span className="font-semibold text-slate-700 truncate">
                                    {o.rank} {o.fullName}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-medium shrink-0 ml-1">
                                    [SH: {o.badgeNumber}] • {o.position}
                                  </span>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!editingSchedule && (
                  <div className="col-span-2 bg-blue-50/45 p-3 rounded-lg border border-blue-100 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="isTwoShifts"
                      checked={isTwoShifts}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsTwoShifts(checked);
                        if (checked) {
                          // Copied fields for quick-entry
                          setRoute2(route || 'Quốc lộ 20');
                          setArea2(area || 'Đức Trọng');
                          setTopic2(topic || 'Bắn tốc độ ban đêm');
                          setMissionType2('Chuyên đề tốc độ');
                        }
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300"
                    />
                    <div className="text-xs">
                      <label htmlFor="isTwoShifts" className="font-bold text-blue-900 cursor-pointer flex items-center gap-1">
                        Nhập nhanh 2 ca tuần tra kiểm soát trong ngày
                      </label>
                      <p className="text-[10px] text-blue-700/80 mt-0.5">
                        Tự động lập đồng thời 2 ca tuần tra độc lập cho Tổ phụ trách trong cùng 1 ngày (ví dụ: Ca 1 ban ngày và Ca 2 tuần tra ban đêm hoặc qua đêm kéo dài sang hôm sau).
                      </p>
                    </div>
                  </div>
                )}

                {isTwoShifts ? (
                  <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    {/* KHUNG CA 1 */}
                    <div className="border border-blue-100 bg-blue-50/10 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center gap-1.5 font-bold text-blue-800 text-xs border-b border-blue-100/50 pb-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        CA TUẦN TRA 1
                      </div>

                      {/* Date Range for Shift 1 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Từ ngày *</label>
                          <input
                            type="date"
                            required
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Đến ngày *</label>
                          <input
                            type="date"
                            required
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Giờ b.đầu *</label>
                          <input
                            type="time"
                            required
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Giờ k.thúc *</label>
                          <input
                            type="time"
                            required
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* KHUNG CA 2 */}
                    <div className="border border-indigo-100 bg-indigo-50/10 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-800 text-xs border-b border-indigo-100/50 pb-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        CA TUẦN TRA 2 (Hỗ trợ kéo dài qua đêm)
                      </div>

                      {/* Date Range for Shift 2 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Từ ngày *</label>
                          <input
                            type="date"
                            required
                            value={startDate2}
                            onChange={(e) => setStartDate2(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Đến ngày *</label>
                          <input
                            type="date"
                            required
                            value={endDate2}
                            onChange={(e) => setEndDate2(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Giờ b.đầu *</label>
                          <input
                            type="time"
                            required
                            value={startTime2}
                            onChange={(e) => setStartTime2(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Giờ k.thúc *</label>
                          <input
                            type="time"
                            required
                            value={endTime2}
                            onChange={(e) => setEndTime2(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Giờ bắt đầu */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Giờ bắt đầu *</label>
                      <input
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                      />
                    </div>

                    {/* Giờ kết thúc */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Giờ kết thúc *</label>
                      <input
                        type="time"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-mono"
                      />
                    </div>
                  </>
                )}

                {/* Ghi chú */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú bổ sung</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="VD: Chú ý ghi hình lập biên bản nợ phạt nguội..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                {/* Trạng thái ban hành */}
                <div className="col-span-2">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-blue-700 space-y-1">
                      <p className="font-bold">Quy luật tự động hóa:</p>
                      <p>Khi đặt trạng thái <strong>"Đã ban hành"</strong> và lưu lại:</p>
                      <ul className="list-disc pl-4 space-y-0.5 mt-1 text-[10px]">
                        <li>Chấm <strong>1 ngày công</strong> cho tất cả lực lượng trong Tổ công tác.</li>
                        <li>Tính <strong>1 ngày phụ cấp định lượng (75.000 đ)</strong> cho lực lượng đi tuần.</li>
                        <li>Nếu ca đi tuần giao cắt khung giờ <strong>22h - 6h sáng mai</strong> $\rightarrow$ Tính <strong>1 lượt tiền trực đêm (200.000 đ)</strong>.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={status === 'Đã ban hành'}
                        onChange={() => setStatus('Đã ban hành')}
                        className="text-blue-600"
                      />
                      <span>Đã ban hành (Áp dụng chấm công tự động)</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={status === 'Bản nháp'}
                        onChange={() => setStatus('Bản nháp')}
                        className="text-blue-600"
                      />
                      <span>Bản nháp</span>
                    </label>
                  </div>
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
                  Lưu & Ban Hành
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
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa lịch tuần tra</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa lịch tuần tra ngày <strong className="text-slate-800">{formatDateDmy(deleteConfirm.dateStr)}</strong> - Nhiệm vụ: <strong className="text-slate-800">{deleteConfirm.topicStr}</strong>?
              </p>
              <p className="text-xs text-rose-500 font-medium mt-2">
                * Tất cả dữ liệu chấm công, định lượng tự động liên quan sẽ bị xóa theo.
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
