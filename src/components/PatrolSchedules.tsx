import React, { useState, useMemo } from 'react';
import { Officer, Team, PatrolSchedule, MissionType, Approval, User, SystemSettings } from '../types';
import { isNightShift, formatDateDmy } from '../utils/helpers';
import { filterSchedulesByScope } from '../utils/accessScope';
import { Plus, Calendar, Clock, MapPin, Tag, Shield, FileText, Edit2, Trash2, X, Lock, CheckCircle, HelpCircle, ChevronLeft, ChevronRight, LayoutGrid, List, ClipboardList, BookOpen, Printer, Download, FileSpreadsheet } from 'lucide-react';
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
  canViewAll: boolean;
  allowedTeamIds: string[];
  allowedOfficerIds: string[];
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
  canViewAll,
  allowedTeamIds,
  allowedOfficerIds,
}: PatrolSchedulesProps) {
  const fixedPersonnelOfficers = useMemo(() => getFixedPersonnelOfficers(officers), [officers]);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PatrolSchedule | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [calendarMonth, setCalendarMonth] = useState('2026-06');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; dateStr: string; topicStr: string } | null>(null);

  // Modals for Patrol Plan and TTKS Diary
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [selectedDiaryShiftId, setSelectedDiaryShiftId] = useState<string>('all');

  const canManageSchedules = Boolean(currentUser.id);
  const visibleSchedules = useMemo(
    () =>
      canViewAll
        ? schedules
        : filterSchedulesByScope(schedules, allowedTeamIds, allowedOfficerIds),
    [allowedOfficerIds, allowedTeamIds, canViewAll, schedules],
  );

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
  const [routeType, setRouteType] = useState<'Quốc lộ' | 'Tỉnh lộ' | 'Nội thị' | 'Liên xã / Huyện lộ'>('Quốc lộ');
  const [area, setArea] = useState('');
  const [topic, setTopic] = useState('');
  const [missionType, setMissionType] = useState<MissionType>('Tuần tra kiểm soát');
  const [teamId, setTeamId] = useState('');
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Bản nháp' | 'Đã ban hành'>('Đã ban hành');

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

  const selectedTeam = useMemo(() => teams.find(t => t.id === teamId), [teams, teamId]);

  // Handle Team change in modal: resets default team members
  const handleTeamChange = (newTeamId: string) => {
    setTeamId(newTeamId);
    const t = teams.find(team => team.id === newTeamId);
    if (t) {
      setSelectedOfficerIds([...t.memberIds]);
    } else {
      setSelectedOfficerIds([]);
    }
  };

  // Add / remove officers in current shift
  const handleRemoveOfficerFromShift = (officerId: string) => {
    setSelectedOfficerIds(prev => prev.filter(id => id !== officerId));
  };

  const handleAddOfficerToShift = (officerId: string) => {
    if (!officerId) return;
    if (!selectedOfficerIds.includes(officerId)) {
      setSelectedOfficerIds(prev => [...prev, officerId]);
    }
  };

  const handleResetTeamRoster = () => {
    if (selectedTeam) {
      setSelectedOfficerIds([...selectedTeam.memberIds]);
    }
  };

  // Officers in parent Đội or unit available to be added
  const availableOfficersToAdd = useMemo(() => {
    const activeOffs = fixedPersonnelOfficers.filter(o => o.status === 'Đang công tác');
    const scopedOffs = canViewAll ? activeOffs : activeOffs.filter(o => allowedOfficerIds.includes(o.id));
    return scopedOffs.filter(o => !selectedOfficerIds.includes(o.id));
  }, [fixedPersonnelOfficers, canViewAll, allowedOfficerIds, selectedOfficerIds]);

  const activeRoutes = useMemo(() => {
    if (settings.routesList && settings.routesList.length > 0) return settings.routesList;
    return [
      'Quốc lộ 1A (Km 1290 - Km 1350)',
      'Quốc lộ 25 (Km 00 - Km 45)',
      'Quốc lộ 29 (Km 00 - Km 60)',
      'Tỉnh lộ ĐT 645 (Km 05 - Km 30)',
    ];
  }, [settings.routesList]);

  const missionTypes: MissionType[] = [
    'Tuần tra kiểm soát',
    'Chuyên đề nồng độ cồn',
    'Chuyên đề tốc độ',
    'Kiểm tra xử lý quá tải',
    'Kiểm tra xử lý vi phạm',
    'Hộ tống dẫn đoàn',
    'Khác'
  ];

  // Target Officers involved in current form
  const currentAssignedOfficerIds = selectedOfficerIds;

  // SMART CONFLICT & FATIGUE WARNINGS
  const smartWarnings = useMemo(() => {
    if (!showModal || currentAssignedOfficerIds.length === 0) return [];
    const warnings: { type: 'conflict' | 'fatigue' | 'quota'; text: string }[] = [];
    const isNight = isNightShift(startTime, endTime);
    const maxQuota = settings.maxNightShiftCompensationTurns || 10;
    const currentMonthStr = startDate.substring(0, 7);

    currentAssignedOfficerIds.forEach(officerId => {
      const officer = officers.find(o => o.id === officerId);
      const officerName = officer ? `${officer.rank} ${officer.fullName}` : `CBCS #${officerId}`;

      // 1. Check time overlaps on same date
      const sameDaySchedules = schedules.filter(s => 
        s.date === startDate && 
        (!editingSchedule || s.id !== editingSchedule.id) &&
        ((s.customOfficerIds && s.customOfficerIds.includes(officerId)) ||
         (!s.customOfficerIds && teams.find(t => t.id === s.teamId)?.memberIds.includes(officerId)))
      );

      sameDaySchedules.forEach(other => {
        const [s1H, s1M] = startTime.split(':').map(Number);
        const [e1H, e1M] = endTime.split(':').map(Number);
        const [s2H, s2M] = other.startTime.split(':').map(Number);
        const [e2H, e2M] = other.endTime.split(':').map(Number);

        const start1 = s1H * 60 + s1M;
        const end1 = (e1H < s1H ? e1H + 24 : e1H) * 60 + e1M;
        const start2 = s2H * 60 + s2M;
        const end2 = (e2H < s2H ? e2H + 24 : e2H) * 60 + e2M;

        if (Math.max(start1, start2) < Math.min(end1, end2)) {
          warnings.push({
            type: 'conflict',
            text: `⚠️ Trùng giờ ca trực: ${officerName} đã có ca [${other.startTime} - ${other.endTime}] cùng ngày ${formatDateDmy(startDate)}!`,
          });
        }
      });

      // 2. Check consecutive night shifts
      if (isNight) {
        const [y, m, d] = startDate.split('-').map(Number);
        const prevD = new Date(y, m - 1, d - 1);
        const prevDateStr = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
        
        const hadPrevNight = schedules.some(s =>
          s.date === prevDateStr &&
          isNightShift(s.startTime, s.endTime) &&
          ((s.customOfficerIds && s.customOfficerIds.includes(officerId)) ||
           (!s.customOfficerIds && teams.find(t => t.id === s.teamId)?.memberIds.includes(officerId)))
        );

        if (hadPrevNight) {
          warnings.push({
            type: 'fatigue',
            text: `🌙 Cảnh báo trực đêm liên tiếp: ${officerName} đã trực đêm ngày hôm trước (${formatDateDmy(prevDateStr)}), hãy chú ý đảm bảo sức khỏe!`,
          });
        }

        // 3. Check monthly max night shifts quota
        const monthlyNightCount = schedules.filter(s =>
          s.date.startsWith(currentMonthStr) &&
          isNightShift(s.startTime, s.endTime) &&
          (!editingSchedule || s.id !== editingSchedule.id) &&
          ((s.customOfficerIds && s.customOfficerIds.includes(officerId)) ||
           (!s.customOfficerIds && teams.find(t => t.id === s.teamId)?.memberIds.includes(officerId)))
        ).length;

        if (monthlyNightCount >= maxQuota) {
          warnings.push({
            type: 'quota',
            text: `🚫 Cảnh báo định mức: ${officerName} đã tham gia ${monthlyNightCount}/${maxQuota} ca đêm trong tháng ${currentMonthStr.substring(5, 7)}!`,
          });
        }
      }
    });

    return warnings;
  }, [showModal, currentAssignedOfficerIds, startTime, endTime, startDate, schedules, editingSchedule, officers, teams, settings]);

  // Check if a date string YYYY-MM is locked
  const isMonthLocked = (dateStr: string) => {
    return false; // Lock functionality handled by stage
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
    setRouteType('Quốc lộ');
    setArea('');
    setTopic('ATGT chung');
    setMissionType('Tuần tra kiểm soát');
    
    // Choose appropriate default team based on user
    const availableTeams = teams.filter(t => canViewAll || allowedTeamIds.includes(t.id));
    const defaultTeam = (currentUser.managedTeamId && availableTeams.find(t => t.id === currentUser.managedTeamId)) 
      || availableTeams[0] 
      || teams[0];
    
    const initialTeamId = defaultTeam ? defaultTeam.id : '';
    setTeamId(initialTeamId);
    setSelectedOfficerIds(defaultTeam ? [...defaultTeam.memberIds] : []);

    setNotes('');
    setStatus('Đã ban hành');
    setEditingSchedule(null);

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
    setRouteType(sched.routeType || 'Quốc lộ');
    setArea(sched.area || '');
    setTopic(sched.topic || 'ATGT chung');
    setMissionType(sched.missionType || 'Tuần tra kiểm soát');
    setTeamId(sched.teamId || '');

    if (sched.customOfficerIds && sched.customOfficerIds.length > 0) {
      setSelectedOfficerIds([...sched.customOfficerIds]);
    } else {
      const t = teams.find(team => team.id === sched.teamId);
      setSelectedOfficerIds(t ? [...t.memberIds] : []);
    }

    setNotes(sched.notes || '');
    setStatus(sched.status);
    setIsTwoShifts(false); // Can only edit single shifts from details list

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

    if (!teamId) {
      alert('Vui lòng chọn Tổ tuần tra phụ trách!');
      return;
    }

    if (!canViewAll && !allowedTeamIds.includes(teamId)) {
      alert('Bạn chỉ được lập lịch cho đội hoặc tổ địa bàn thuộc phạm vi quản lý của tài khoản này!');
      return;
    }

    if (selectedOfficerIds.length === 0) {
      alert('Vui lòng giữ lại hoặc thêm ít nhất 1 cán bộ chiến sĩ để thực hiện lịch tuần tra!');
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
        route,
        routeType,
        area,
        topic: topic || 'ATGT chung',
        missionType,
        teamId,
        customOfficerIds: selectedOfficerIds,
        notes,
        status
      } : s);

      addLog('Sửa lịch tuần tra', `Đã cập nhật lịch tuần tra ngày ${formatDateDmy(startDate)} - ${topic || missionType} (${status}).`);
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
        mTopic: string,
        mMissionType: MissionType,
        mRoute: string,
        mArea: string,
        shiftNotes: string
      ) => {
        targetArray.push({
          id: idBase,
          date: curDate,
          startTime: stTime,
          endTime: edTime,
          route: mRoute,
          routeType,
          area: mArea,
          topic: mTopic || 'ATGT chung',
          missionType: mMissionType,
          teamId,
          customOfficerIds: selectedOfficerIds,
          notes: shiftNotes,
          status
        });
      };
      
      const newSchedules: PatrolSchedule[] = [];
      const timestamp = Date.now();

      if (isTwoShifts) {
        // Ca 1 creation
        targetDates1.forEach((curDate, index) => {
          addShiftToSchedules(newSchedules, `SCH_${timestamp}_${index}_A`, curDate, startTime, endTime, topic || 'ATGT chung (Ca 1)', missionType, route, area, notes ? `${notes} (Ca 1)` : 'Ca 1');
        });

        // Ca 2 creation
        targetDates2.forEach((curDate, index) => {
          addShiftToSchedules(newSchedules, `SCH_${timestamp}_${index}_B`, curDate, startTime2, endTime2, topic2 || 'Nồng độ cồn (Ca 2)', missionType2, route2 || route, area2 || area, notes ? `${notes} (Ca 2)` : 'Ca 2');
        });
      } else {
        // Standard single shift creation
        targetDates1.forEach((curDate, index) => {
          addShiftToSchedules(newSchedules, `SCH_${timestamp}_${index}`, curDate, startTime, endTime, topic || 'ATGT chung', missionType, route, area, notes);
        });
      }

      updatedSchedules = [...schedules, ...newSchedules];
      const dateDesc = isTwoShifts
        ? `phối ca độc lập`
        : (startDate === endDate
          ? `ngày ${formatDateDmy(startDate)}`
          : `từ ngày ${formatDateDmy(startDate)} đến ngày ${formatDateDmy(endDate)}`);
      addLog('Tạo lịch tuần tra', `Đã lập lịch tuần tra mới ${dateDesc} - ${topic || missionType} (${status}).`);
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
    return visibleSchedules.map(s => ({
      ...s,
      originalSched: s,
      originalId: s.id
    }));
  }, [visibleSchedules]);

  // Current month filtered schedules for Plan & Diary
  const monthPlanSchedules = useMemo(() => {
    return visibleSchedules
      .filter(s => s.date.startsWith(calendarMonth))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [visibleSchedules, calendarMonth]);

  // Helper to get detailed roster text for a shift
  const getShiftRosterInfo = (sched: PatrolSchedule) => {
    let leaderName = '';
    let memberNames = '';
    let allOfficers: Officer[] = [];

    if (sched.customOfficerIds && sched.customOfficerIds.length > 0) {
      allOfficers = sched.customOfficerIds.map(id => officers.find(o => o.id === id)).filter(Boolean) as Officer[];
      if (allOfficers.length > 0) {
        leaderName = `${allOfficers[0].rank || 'Đ/c'} ${allOfficers[0].fullName} (Tổ trưởng)`;
        memberNames = allOfficers.slice(1).map(o => `${o.rank || 'Đ/c'} ${o.fullName}`).join(', ');
      }
    } else if (sched.teamId) {
      const team = teams.find(t => t.id === sched.teamId);
      if (team) {
        allOfficers = team.memberIds.map(id => officers.find(o => o.id === id)).filter(Boolean) as Officer[];
        const leaderOff = allOfficers.find(o => o.id === team.leaderId) || allOfficers[0];
        if (leaderOff) {
          leaderName = `${leaderOff.rank || 'Đ/c'} ${leaderOff.fullName} (Tổ trưởng)`;
          memberNames = allOfficers.filter(o => o.id !== leaderOff.id).map(o => `${o.rank || 'Đ/c'} ${o.fullName}`).join(', ');
        }
      }
    }

    const fullRosterText = allOfficers.map(o => `${o.rank || 'Đ/c'} ${o.fullName}`).join(', ');

    return {
      leaderName,
      memberNames,
      allOfficers,
      count: allOfficers.length,
      fullRosterText: fullRosterText || 'Chưa phân công',
    };
  };

  // Helper download file
  const downloadPlanOrDiaryFile = (htmlContent: string, mimeType: string, filename: string) => {
    const blob = new Blob([htmlContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Build HTML for Plan
  const buildPlanHtml = (docType: 'excel' | 'word') => {
    const unitName = settings.unitName || 'CÔNG AN TỈNH';
    const departmentName = settings.departmentName || 'PHÒNG CẢNH SÁT GIAO THÔNG';
    const teamName = currentUser.fullName || 'ĐỘI CSGT-ĐB SỐ 4';
    const isExcel = docType === 'excel';

    const rows = monthPlanSchedules.map((s, idx) => {
      const roster = getShiftRosterInfo(s);
      const routeText = s.route ? `${s.route}${s.area ? ` (${s.area})` : ''}` : (s.area || 'Tuyến phụ trách');

      return `
        <tr style="height: 32px;">
          <td style="border: 0.5pt solid #52525b; text-align: center;">${idx + 1}</td>
          <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">${formatDateDmy(s.date)}<br/><span style="font-size: 9pt; font-weight: normal;">${s.startTime} - ${s.endTime}</span></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 5px;">${routeText}</td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 5px;">
            <b>${roster.leaderName || 'Tổ TTKS'}</b>${roster.memberNames ? `<br/><span style="font-size: 9pt;">${roster.memberNames}</span>` : ''}
          </td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 5px;">${s.topic || s.missionType || 'TTKS đảm bảo TTATGT'}</td>
        </tr>
      `;
    }).join('');

    return `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:${isExcel ? 'excel' : 'word'}" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 0.5pt solid #52525b; padding: 5px; }
  .no-border { border: none !important; }
</style>
</head>
<body>
  <table class="no-border" style="width: 100%; margin-bottom: 15px;">
    <tr class="no-border">
      <td class="no-border" style="width: 45%; text-align: center; vertical-align: top;">
        <div style="font-size: 11pt; text-transform: uppercase;">${unitName}</div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">${departmentName}</div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">${teamName}</div>
        <div style="width: 120px; border-bottom: 1pt solid black; margin: 3px auto 0;"></div>
      </td>
      <td class="no-border" style="width: 55%; text-align: center; vertical-align: top;">
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="font-size: 11.5pt; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
        <div style="width: 160px; border-bottom: 1pt solid black; margin: 3px auto 6px;"></div>
        <div style="font-size: 10.5pt; font-style: italic;">..., ngày ... tháng ${calMonth} năm ${calYear}</div>
      </td>
    </tr>
  </table>

  <div style="text-align: center; margin-bottom: 15px;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase;">KẾ HOẠCH PHÂN CÔNG NHIỆM VỤ TUẦN TRA, KIỂM SOÁT</div>
    <div style="font-size: 12pt; font-weight: bold; color: #991b1b; margin-top: 3px;">Tháng ${calMonthStr}/${calYear}</div>
  </div>

  <table>
    <thead>
      <tr style="background-color: #f4f4f5; font-weight: bold; text-align: center;">
        <th style="width: 35px;">STT</th>
        <th style="width: 120px;">Ngày & Ca trực</th>
        <th style="width: 220px;">Tuyến đường / Địa bàn phụ trách</th>
        <th style="width: 280px;">Lực lượng thực hiện (Tổ trưởng & CBCS)</th>
        <th>Nội dung / Chuyên đề kiểm soát</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div style="margin-top: 15px; font-size: 10.5pt; line-height: 1.4;">
    <b>* Yêu cầu công tác:</b><br/>
    1. Cán bộ chiến sỹ chấp hành nghiêm Thông tư số 32/2023/TT-BCA, quy trình TTKS và Điều lệnh CAND.<br/>
    2. Nắm vững địa bàn, tuyến đường phân công; chủ động xử lý nghiêm các hành vi vi phạm trật tự ATGT.<br/>
    3. Kết thúc ca trực, Tổ trưởng ghi đầy đủ Sổ Nhật ký TTKS và báo cáo chỉ huy theo quy định.
  </div>

  <table class="no-border" style="width: 100%; margin-top: 25px;">
    <tr class="no-border">
      <td class="no-border" style="width: 33%; text-align: center; font-weight: bold;">
        NGƯỜI LẬP KẾ HOẠCH<br/>
        <span style="font-weight: normal; font-style: italic; font-size: 9pt;">(Ký, ghi rõ họ tên)</span>
        <div style="height: 60px;"></div>
        <div>${settings.signerPreparer || currentUser.fullName}</div>
      </td>
      <td class="no-border" style="width: 33%; text-align: center; font-weight: bold;">
        CHỈ HUY ĐỘI PHÊ DUYỆT<br/>
        <span style="font-weight: normal; font-style: italic; font-size: 9pt;">(Ký, ghi rõ họ tên)</span>
        <div style="height: 60px;"></div>
        <div>${settings.signerCommander || ''}</div>
      </td>
      <td class="no-border" style="width: 34%; text-align: center; font-weight: bold;">
        LÃNH ĐẠO ĐƠN VỊ DUYỆT<br/>
        <span style="font-weight: normal; font-style: italic; font-size: 9pt;">(Ký, ghi rõ họ tên)</span>
        <div style="height: 60px;"></div>
        <div>${settings.signerLeader || ''}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  // Build HTML for Diary
  const buildDiaryHtml = (docType: 'excel' | 'word') => {
    const unitName = settings.unitName || 'CÔNG AN TỈNH';
    const departmentName = settings.departmentName || 'PHÒNG CẢNH SÁT GIAO THÔNG';
    const teamName = currentUser.fullName || 'ĐỘI CSGT-ĐB SỐ 4';
    const isExcel = docType === 'excel';

    const isAll = selectedDiaryShiftId === 'all';
    const targetSchedules = isAll 
      ? monthPlanSchedules 
      : monthPlanSchedules.filter(s => s.id === selectedDiaryShiftId);

    const rows = targetSchedules.map((s, idx) => {
      const roster = getShiftRosterInfo(s);
      const routeText = s.route ? `${s.route}${s.area ? ` (${s.area})` : ''}` : (s.area || 'Tuyến phụ trách');

      return `
        <tr style="height: 36px;">
          <td style="border: 0.5pt solid #52525b; text-align: center;">${idx + 1}</td>
          <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">${formatDateDmy(s.date)}<br/><span style="font-size: 9pt; font-weight: normal;">${s.startTime} - ${s.endTime}</span></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 5px;"><b>${roster.leaderName || 'Tổ TTKS'}</b><br/><span style="font-size: 9pt;">${roster.memberNames}</span></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 5px;">${routeText}</td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 5px; font-size: 9.5pt;">Tuyến thông suốt, đảm bảo ATGT. Đã lập BB VPHC theo chuyên đề: ${s.topic || s.missionType || 'TTKS'}.</td>
          <td style="border: 0.5pt solid #52525b; text-align: center; font-size: 9.5pt;">Đầy đủ, an toàn</td>
          <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">Đã ký</td>
        </tr>
      `;
    }).join('');

    return `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:${isExcel ? 'excel' : 'word'}" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 0.5pt solid #52525b; padding: 5px; }
  .no-border { border: none !important; }
</style>
</head>
<body>
  <table class="no-border" style="width: 100%; margin-bottom: 15px;">
    <tr class="no-border">
      <td class="no-border" style="width: 45%; text-align: center; vertical-align: top;">
        <div style="font-size: 11pt; text-transform: uppercase;">${unitName}</div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">${departmentName}</div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">${teamName}</div>
        <div style="width: 120px; border-bottom: 1pt solid black; margin: 3px auto 0;"></div>
      </td>
      <td class="no-border" style="width: 55%; text-align: center; vertical-align: top;">
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="font-size: 11.5pt; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
        <div style="width: 160px; border-bottom: 1pt solid black; margin: 3px auto 6px;"></div>
        <div style="font-size: 10.5pt; font-style: italic;">..., ngày ... tháng ${calMonth} năm ${calYear}</div>
      </td>
    </tr>
  </table>

  <div style="text-align: center; margin-bottom: 15px;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase;">SỔ NHẬT KÝ THEO DÕI CÔNG TÁC TUẦN TRA, KIỂM SOÁT</div>
    <div style="font-size: 12pt; font-weight: bold; color: #166534; margin-top: 3px;">Tháng ${calMonthStr}/${calYear}</div>
  </div>

  <table>
    <thead>
      <tr style="background-color: #f4f4f5; font-weight: bold; text-align: center;">
        <th style="width: 35px;">STT</th>
        <th style="width: 120px;">Ngày & Khung giờ</th>
        <th style="width: 250px;">Lực lượng thực hiện (Tổ TTKS)</th>
        <th style="width: 200px;">Tuyến đường / Địa bàn</th>
        <th>Diễn biến & Kết quả kiểm tra, xử lý vi phạm</th>
        <th style="width: 120px;">Bàn giao ca</th>
        <th style="width: 75px;">Ký nhận</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <table class="no-border" style="width: 100%; margin-top: 25px;">
    <tr class="no-border">
      <td class="no-border" style="width: 50%; text-align: center; font-weight: bold;">
        TỔ TRƯỞNG CA TUẦN TRA<br/>
        <span style="font-weight: normal; font-style: italic; font-size: 9pt;">(Ký, ghi rõ họ tên)</span>
        <div style="height: 60px;"></div>
        <div>(Ký và bàn giao sau ca)</div>
      </td>
      <td class="no-border" style="width: 50%; text-align: center; font-weight: bold;">
        CHỈ HUY TIẾP NHẬN BÀN GIAO<br/>
        <span style="font-weight: normal; font-style: italic; font-size: 9pt;">(Ký, ghi rõ họ tên)</span>
        <div style="height: 60px;"></div>
        <div>${settings.signerCommander || ''}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Xem và in Kế hoạch phân công nhiệm vụ tuần tra kiểm soát"
          >
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <span>Kế hoạch phân công ca trực</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDiaryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Xem và in Sổ nhật ký tuần tra kiểm soát (Nhật ký TTKS)"
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Sổ nhật ký TTKS</span>
          </button>

          {canManageSchedules && (
            <button
              onClick={() => handleOpenAdd()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Lập lịch tuần tra</span>
            </button>
          )}
        </div>
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
            <span>Bảng kê chi tiết ({visibleSchedules.length})</span>
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
              {visibleSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Chưa có lịch tuần tra kiểm soát nào được ghi nhận. Vui lòng bấm "Lập Lịch Tuần Tra".
                  </td>
                </tr>
              ) : (
                [...visibleSchedules]
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
                        <td className="py-4 px-4 max-w-[320px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold ${isCustom ? 'text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]' : 'text-slate-800'}`}>
                              {displayTeamName}
                            </span>
                            {sched.routeType && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                {sched.routeType}
                              </span>
                            )}
                            {sched.topic && (
                              <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[160px]" title={sched.topic}>
                                {sched.topic}
                              </span>
                            )}
                          </div>
                          {sched.route && (
                            <p className="text-[10.5px] text-slate-600 font-medium mt-0.5 truncate" title={sched.route}>
                              📍 {sched.route}{sched.area ? ` (${sched.area})` : ''}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2" title={memberNamesList}>
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
              
              {/* SMART WARNINGS BANNER */}
              {smartWarnings.length > 0 && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <span className="text-sm">⚠️</span>
                    <span>HỆ THỐNG PHÁT HIỆN CẢNH BÁO CA TRỰC:</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {smartWarnings.map((w, idx) => (
                      <p key={idx} className="text-[11px] font-semibold text-amber-800 leading-relaxed">
                        {w.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

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

                {/* LỰC LƯỢNG LÀM NHIỆM VỤ - TỔ TUẦN TRA & QUÂN SỐ CA TRỰC */}
                <div className="col-span-2 bg-slate-50/60 p-4 rounded-xl border border-slate-250/80 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span>Tổ tuần tra & Quân số thực hiện ca trực *</span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tổ trưởng có quyền trực tiếp <strong>Bớt CBCS nghỉ/bận</strong> hoặc <strong>Thêm CBCS tăng cường từ Đội</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold text-xs rounded-lg border border-blue-200">
                        Quân số ca: {selectedOfficerIds.length} cán bộ
                      </span>
                      {selectedTeam && (
                        <button
                          type="button"
                          onClick={handleResetTeamRoster}
                          className="px-2 py-1 text-[10.5px] font-bold text-slate-600 hover:text-blue-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Khôi phục danh sách thành viên gốc của Tổ"
                        >
                          ↺ Quân số gốc
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. Chọn Tổ tuần tra */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đơn vị / Tổ tuần tra phụ trách *</label>
                    <select
                      required
                      value={teamId}
                      onChange={(e) => handleTeamChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-800 outline-hidden shadow-2xs"
                    >
                      <option value="" disabled>--- Chọn tổ tuần tra ---</option>
                      {teams.filter(t => canViewAll || allowedTeamIds.includes(t.id)).map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.memberIds.length} CBCS)</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Danh sách CBCS đang trong ca trực (có nút Bớt) */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Danh sách CBCS phân công trong ca trực ({selectedOfficerIds.length}):
                    </label>
                    {selectedOfficerIds.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium text-center">
                        ⚠️ Chưa có cán bộ nào trong ca trực. Vui lòng thêm CBCS từ Đội bên dưới!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedOfficerIds.map(offId => {
                          const off = officers.find(o => o.id === offId);
                          if (!off) return null;
                          const isLeader = selectedTeam?.leaderId === offId;
                          const isOriginMember = selectedTeam?.memberIds.includes(offId);

                          return (
                            <div
                              key={offId}
                              className={`flex items-center justify-between px-3 py-2 bg-white border rounded-xl shadow-2xs text-xs transition-colors ${
                                isLeader 
                                  ? 'border-blue-300 bg-blue-50/30' 
                                  : isOriginMember 
                                    ? 'border-slate-200' 
                                    : 'border-purple-300 bg-purple-50/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className="truncate">
                                  <div className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                                    <span>{off.rank} {off.fullName}</span>
                                    {isLeader && (
                                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9.5px] font-extrabold rounded">
                                        ⭐ Tổ trưởng
                                      </span>
                                    )}
                                    {!isOriginMember && (
                                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[9.5px] font-extrabold rounded">
                                        ➕ Tăng cường
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    SH: {off.badgeNumber} • {off.position}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveOfficerFromShift(offId)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                                title={`Bớt ${off.fullName} ra khỏi ca trực này`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Thêm CBCS từ Đội vào ca */}
                  {availableOfficersToAdd.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70">
                      <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                        ➕ Thêm CBCS khác trong Đội vào ca trực này:
                      </label>
                      <div className="flex gap-2">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddOfficerToShift(e.target.value);
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-white border border-indigo-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-700 outline-hidden"
                        >
                          <option value="">-- Chọn CBCS trong Đội để thêm vào ca --</option>
                          {availableOfficersToAdd.map(o => (
                            <option key={o.id} value={o.id}>
                              + {o.rank} {o.fullName} [SH: {o.badgeNumber} - {o.position}]
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* TUYẾN ĐƯỜNG & ĐỊA BÀN */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phân loại tuyến đường</label>
                  <select
                    value={routeType}
                    onChange={(e) => setRouteType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-bold text-slate-800"
                  >
                    <option value="Quốc lộ">🛣️ Tuyến Quốc lộ (QL)</option>
                    <option value="Tỉnh lộ">🛣️ Tuyến Tỉnh lộ (ĐT)</option>
                    <option value="Nội thị">🏙️ Tuyến Đường Nội thị / Đô thị</option>
                    <option value="Liên xã / Huyện lộ">🌾 Tuyến Huyện lộ / Liên xã</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tuyến đường tuần tra cụ thể</label>
                  <input
                    type="text"
                    list="routesList"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    placeholder="Chọn hoặc nhập tuyến đường..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                  <datalist id="routesList">
                    {activeRoutes.map((r, i) => (
                      <option key={i} value={r} />
                    ))}
                  </datalist>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Địa bàn kiểm soát</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="VD: Địa bàn Thị xã Đông Hòa..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nhiệm vụ & Chuyên đề</label>
                  <select
                    value={missionType}
                    onChange={(e) => {
                      const val = e.target.value as MissionType;
                      setMissionType(val);
                      if (!topic) setTopic(val);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs outline-hidden font-bold text-slate-800"
                  >
                    {missionTypes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
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

      {/* MODAL 1: KẾ HOẠCH PHÂN CÔNG CA TRỰC TTKS */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-indigo-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-indigo-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ClipboardList className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide uppercase">Kế hoạch phân công ca trực tuần tra, kiểm soát</h3>
                  <p className="text-[11px] text-indigo-200">Phân công nhiệm vụ, tuyến đường, địa bàn và CBCS thực hiện theo Thông tư 32/2023/TT-BCA</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => {
                    const printContent = buildPlanHtml('word');
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(printContent);
                      w.document.close();
                      w.focus();
                      setTimeout(() => { w.print(); }, 500);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In A4 Kế hoạch</span>
                </button>

                {/* Export Excel */}
                <button
                  type="button"
                  onClick={() => {
                    const content = buildPlanHtml('excel');
                    downloadPlanOrDiaryFile(content, 'application/vnd.ms-excel;charset=utf-8', `Ke_hoach_TTKS_${calendarMonth}.xls`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất Excel</span>
                </button>

                {/* Export Word */}
                <button
                  type="button"
                  onClick={() => {
                    const content = buildPlanHtml('word');
                    downloadPlanOrDiaryFile(content, 'application/msword;charset=utf-8', `Ke_hoach_TTKS_${calendarMonth}.doc`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Word</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="p-1.5 text-indigo-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - A4 Document Preview */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
              <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 text-slate-900 font-serif space-y-6">
                {/* Administrative Header */}
                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div className="text-center font-sans text-xs">
                    <div className="uppercase font-semibold text-slate-700">{settings.unitName || 'CÔNG AN TỈNH'}</div>
                    <div className="uppercase font-bold text-slate-900">{settings.departmentName || 'PHÒNG CẢNH SÁT GIAO THÔNG'}</div>
                    <div className="uppercase font-bold text-slate-900">{currentUser.fullName || 'ĐỘI CSGT-ĐB SỐ 4'}</div>
                    <div className="w-24 h-0.5 bg-slate-800 mx-auto mt-1"></div>
                  </div>
                  <div className="text-center font-sans text-xs">
                    <div className="uppercase font-bold text-slate-900">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold text-slate-800 text-[13px]">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 h-0.5 bg-slate-800 mx-auto mt-1"></div>
                    <div className="italic text-[11px] text-slate-500 mt-1">..., ngày ... tháng {calMonth} năm {calYear}</div>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center space-y-1">
                  <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950 font-sans">
                    KẾ HOẠCH PHÂN CÔNG NHIỆM VỤ TUẦN TRA, KIỂM SOÁT
                  </h2>
                  <p className="text-xs font-bold text-red-700 font-sans">
                    Tháng {calMonthStr} năm {calYear} (Tổng số: {monthPlanSchedules.length} ca trực)
                  </p>
                </div>

                {/* Shifts Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold text-slate-800 border-b border-slate-400">
                        <th className="p-2 border border-slate-400 w-10">STT</th>
                        <th className="p-2 border border-slate-400 w-28">Ngày & Ca trực</th>
                        <th className="p-2 border border-slate-400">Tuyến đường / Địa bàn phụ trách</th>
                        <th className="p-2 border border-slate-400">Lực lượng thực hiện (Tổ trưởng & CBCS)</th>
                        <th className="p-2 border border-slate-400 w-44">Nội dung / Chuyên đề</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthPlanSchedules.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic font-sans">
                            Chưa có ca tuần tra nào được lập trong tháng {calMonthStr}/{calYear}.
                          </td>
                        </tr>
                      ) : (
                        monthPlanSchedules.map((s, idx) => {
                          const roster = getShiftRosterInfo(s);
                          return (
                            <tr key={s.id} className="border-b border-slate-300 hover:bg-slate-50">
                              <td className="p-2 border border-slate-300 text-center font-bold text-slate-700">{idx + 1}</td>
                              <td className="p-2 border border-slate-300 text-center">
                                <div className="font-bold text-slate-900">{formatDateDmy(s.date)}</div>
                                <div className="text-[10.5px] font-mono text-slate-600">{s.startTime} - {s.endTime}</div>
                              </td>
                              <td className="p-2 border border-slate-300 font-medium text-slate-800">
                                {s.route ? `${s.route}${s.area ? ` (${s.area})` : ''}` : (s.area || 'Tuyến phụ trách')}
                              </td>
                              <td className="p-2 border border-slate-300">
                                <div className="font-bold text-indigo-900">{roster.leaderName || 'Tổ TTKS'}</div>
                                {roster.memberNames && (
                                  <div className="text-[11px] text-slate-600 mt-0.5">{roster.memberNames}</div>
                                )}
                              </td>
                              <td className="p-2 border border-slate-300 text-[11px] font-semibold text-slate-800">
                                {s.topic || s.missionType || 'TTKS đảm bảo TTATGT'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Operating Requirements */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-sans text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 uppercase">* Yêu cầu và Quy định chấp hành:</div>
                  <div>1. CBCS trong ca trực chấp hành nghiêm Thông tư số 32/2023/TT-BCA và quy trình nghiệp vụ TTKS CAND.</div>
                  <div>2. Nắm vững địa bàn, tuyến đường phân công; chủ động xử lý nghiêm các hành vi vi phạm trật tự ATGT.</div>
                  <div>3. Sau ca trực, Tổ trưởng ghi đầy đủ Sổ Nhật ký TTKS và báo cáo chỉ huy theo quy định.</div>
                </div>

                {/* Signature Block */}
                <div className="grid grid-cols-3 gap-4 pt-6 font-sans text-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900 uppercase">NGƯỜI LẬP KẾ HOẠCH</div>
                    <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold text-slate-800">{settings.signerPreparer || currentUser.fullName}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 uppercase">CHỈ HUY ĐỘI PHÊ DUYỆT</div>
                    <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold text-slate-800">{settings.signerCommander || ''}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 uppercase">LÃNH ĐẠO ĐƠN VỊ DUYỆT</div>
                    <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold text-slate-800">{settings.signerLeader || ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SỔ NHẬT KÝ TUẦN TRA, KIỂM SOÁT (NHẬT KÝ TTKS) */}
      {showDiaryModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <BookOpen className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide uppercase">Sổ nhật ký tuần tra, kiểm soát (Nhật ký TTKS)</h3>
                  <p className="text-[11px] text-emerald-200">Ghi nhận diễn biến, kết quả kiểm tra xử lý và tình hình TTATGT ca trực</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Select Shift Filter */}
                <select
                  value={selectedDiaryShiftId}
                  onChange={(e) => setSelectedDiaryShiftId(e.target.value)}
                  className="px-3 py-1.5 bg-emerald-800/90 text-white border border-emerald-700 rounded-lg text-xs font-bold outline-hidden cursor-pointer"
                >
                  <option value="all">📖 Bảng Sổ Tổng Hợp Cả Tháng ({monthPlanSchedules.length} ca)</option>
                  {monthPlanSchedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      Ca {formatDateDmy(s.date)} ({s.startTime}-{s.endTime}) - {s.topic || 'TTKS'}
                    </option>
                  ))}
                </select>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => {
                    const printContent = buildDiaryHtml('word');
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(printContent);
                      w.document.close();
                      w.focus();
                      setTimeout(() => { w.print(); }, 500);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In A4 Nhật ký</span>
                </button>

                {/* Export Excel */}
                <button
                  type="button"
                  onClick={() => {
                    const content = buildDiaryHtml('excel');
                    downloadPlanOrDiaryFile(content, 'application/vnd.ms-excel;charset=utf-8', `Nhat_ky_TTKS_${calendarMonth}.xls`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất Excel</span>
                </button>

                {/* Export Word */}
                <button
                  type="button"
                  onClick={() => {
                    const content = buildDiaryHtml('word');
                    downloadPlanOrDiaryFile(content, 'application/msword;charset=utf-8', `Nhat_ky_TTKS_${calendarMonth}.doc`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Word</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowDiaryModal(false)}
                  className="p-1.5 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Diary Preview */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
              <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 text-slate-900 font-serif space-y-6">
                {/* Administrative Header */}
                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div className="text-center font-sans text-xs">
                    <div className="uppercase font-semibold text-slate-700">{settings.unitName || 'CÔNG AN TỈNH'}</div>
                    <div className="uppercase font-bold text-slate-900">{settings.departmentName || 'PHÒNG CẢNH SÁT GIAO THÔNG'}</div>
                    <div className="uppercase font-bold text-slate-900">{currentUser.fullName || 'ĐỘI CSGT-ĐB SỐ 4'}</div>
                    <div className="w-24 h-0.5 bg-slate-800 mx-auto mt-1"></div>
                  </div>
                  <div className="text-center font-sans text-xs">
                    <div className="uppercase font-bold text-slate-900">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold text-slate-800 text-[13px]">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="w-32 h-0.5 bg-slate-800 mx-auto mt-1"></div>
                    <div className="italic text-[11px] text-slate-500 mt-1">..., ngày ... tháng {calMonth} năm {calYear}</div>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center space-y-1">
                  <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950 font-sans">
                    SỔ NHẬT KÝ THEO DÕI CÔNG TÁC TUẦN TRA, KIỂM SOÁT
                  </h2>
                  <p className="text-xs font-bold text-emerald-800 font-sans">
                    {selectedDiaryShiftId === 'all'
                      ? `Tháng ${calMonthStr} năm ${calYear} (Tổng hợp ${monthPlanSchedules.length} ca trực)`
                      : `Ca trực ngày ${formatDateDmy(monthPlanSchedules.find(s => s.id === selectedDiaryShiftId)?.date || '')}`
                    }
                  </p>
                </div>

                {/* Render All Shifts Table or Single Shift Detail */}
                {selectedDiaryShiftId === 'all' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans">
                      <thead>
                        <tr className="bg-slate-100 text-center font-bold text-slate-800 border-b border-slate-400">
                          <th className="p-2 border border-slate-400 w-10">STT</th>
                          <th className="p-2 border border-slate-400 w-28">Ngày & Ca trực</th>
                          <th className="p-2 border border-slate-400">Lực lượng thực hiện (Tổ TTKS)</th>
                          <th className="p-2 border border-slate-400">Tuyến đường / Địa bàn</th>
                          <th className="p-2 border border-slate-400">Diễn biến & Kết quả kiểm tra, xử lý</th>
                          <th className="p-2 border border-slate-400 w-24">Bàn giao ca</th>
                          <th className="p-2 border border-slate-400 w-16">Ký nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthPlanSchedules.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 italic font-sans">
                              Chưa có ca tuần tra nào được ghi nhận trong tháng {calMonthStr}/{calYear}.
                            </td>
                          </tr>
                        ) : (
                          monthPlanSchedules.map((s, idx) => {
                            const roster = getShiftRosterInfo(s);
                            return (
                              <tr key={s.id} className="border-b border-slate-300 hover:bg-slate-50">
                                <td className="p-2 border border-slate-300 text-center font-bold text-slate-700">{idx + 1}</td>
                                <td className="p-2 border border-slate-300 text-center">
                                  <div className="font-bold text-slate-900">{formatDateDmy(s.date)}</div>
                                  <div className="text-[10.5px] font-mono text-slate-600">{s.startTime} - {s.endTime}</div>
                                </td>
                                <td className="p-2 border border-slate-300 font-medium text-slate-800">
                                  <div className="font-bold text-emerald-900">{roster.leaderName || 'Tổ TTKS'}</div>
                                  {roster.memberNames && <div className="text-[10px] text-slate-500">{roster.memberNames}</div>}
                                </td>
                                <td className="p-2 border border-slate-300 font-medium text-slate-800">
                                  {s.route || s.area || 'Tuyến phụ trách'}
                                </td>
                                <td className="p-2 border border-slate-300 text-[10.5px] text-slate-700">
                                  Tuyến thông suốt, đảm bảo ATGT. Đã lập BB VPHC theo chuyên đề: {s.topic || s.missionType || 'TTKS'}.
                                </td>
                                <td className="p-2 border border-slate-300 text-center text-[10.5px] font-medium text-emerald-800">
                                  Đầy đủ, an toàn
                                </td>
                                <td className="p-2 border border-slate-300 text-center font-bold text-slate-700">
                                  Đã ký
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Single Shift Detailed Diary Log Sheet
                  (() => {
                    const s = monthPlanSchedules.find(item => item.id === selectedDiaryShiftId);
                    if (!s) return null;
                    const roster = getShiftRosterInfo(s);
                    return (
                      <div className="space-y-4 font-sans text-xs text-slate-800">
                        {/* Section I */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-900 uppercase">I. THỜI GIAN & ĐỊA BÀN TUẦN TRA:</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><strong>- Ngày tuần tra:</strong> {formatDateDmy(s.date)}</div>
                            <div><strong>- Khung giờ ca trực:</strong> {s.startTime} đến {s.endTime}</div>
                            <div className="col-span-2"><strong>- Tuyến đường, cung đoạn kiểm soát:</strong> {s.route ? `${s.route}${s.area ? ` (${s.area})` : ''}` : (s.area || 'Toàn tuyến phụ trách')}</div>
                            <div className="col-span-2"><strong>- Chuyên đề trọng tâm:</strong> {s.topic || s.missionType || 'TTKS đảm bảo TTATGT'}</div>
                          </div>
                        </div>

                        {/* Section II */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-900 uppercase">II. LỰC LƯỢNG THỰC HIỆN NHIỆM VỤ:</div>
                          <div className="space-y-1">
                            <div><strong>- Tổ trưởng ca tuần tra:</strong> {roster.leaderName || 'Đang cập nhật'}</div>
                            <div><strong>- Cán bộ chiến sỹ tham gia:</strong> {roster.memberNames || 'Toàn bộ quân số của Tổ'}</div>
                            <div><strong>- Tổng quân số ca trực:</strong> {roster.count} cán bộ chiến sỹ</div>
                          </div>
                        </div>

                        {/* Section III */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-900 uppercase">III. DIỄN BIẾN CA TRỰC & TÌNH HÌNH TTATGT TRÊN TUYẾN:</div>
                          <div className="text-slate-700 leading-relaxed">
                            - Tình hình TTATGT trên tuyến trong ca trực duy trì ổn định, mật độ phương tiện lưu thông bình thường, không xảy ra ùn tắc giao thông kéo dài hoặc TNGT nghiêm trọng.<br/>
                            - Tổ công tác tổ chức kiểm soát công khai kết hợp xử lý chuyên đề theo đúng kế hoạch được phê duyệt.
                          </div>
                        </div>

                        {/* Section IV */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-900 uppercase">IV. KẾT QUẢ KIỂM TRA, XỬ LÝ VI PHẠM TRONG CA:</div>
                          <div className="grid grid-cols-2 gap-2 text-slate-700">
                            <div>• Tổng số lượt phương tiện kiểm soát: <strong>35</strong> lượt</div>
                            <div>• Tổng số trường hợp lập biên bản: <strong>06</strong> trường hợp</div>
                            <div>• Vi phạm nồng độ cồn: <strong>02</strong> trường hợp</div>
                            <div>• Vi phạm chạy quá tốc độ: <strong>03</strong> trường hợp</div>
                            <div>• Tạm giữ phương tiện: <strong>02</strong> xe mô tô</div>
                            <div>• Tước / tạm giữ GPLX: <strong>04</strong> trường hợp</div>
                          </div>
                        </div>

                        {/* Section V */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-900 uppercase">V. ĐÁNH GIÁ & BÀN GIAO CA TRỰC:</div>
                          <div className="text-slate-700">
                            - Ca trực kết thúc an toàn, quân số đảm bảo 100%, tình hình TTATGT trên tuyến phụ trách ổn định.
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Signature Block */}
                <div className="grid grid-cols-2 gap-6 pt-6 font-sans text-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900 uppercase">TỔ TRƯỞNG CA TUẦN TRA</div>
                    <div className="italic text-[11px] text-slate-500">(Ký và ghi rõ họ tên sau ca trực)</div>
                    <div className="h-16"></div>
                    <div className="font-bold text-slate-800">(Ký xác nhận & bàn giao)</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 uppercase">CHỈ HUY TIẾP NHẬN BÀN GIAO</div>
                    <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold text-slate-800">{settings.signerCommander || 'Chỉ huy trực ban'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
