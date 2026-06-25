import { Officer, Team, PatrolSchedule, Attendance, RationRecord, NightShiftRecord, AuditLog, SystemSettings } from '../types';

export const initialSettings: SystemSettings = {
  rationRate: 75000,
  nightShiftRate: 200000,
  departmentName: 'PHÒNG CẢNH SÁT GIAO THÔNG',
  unitName: 'CÔNG AN TỈNH LÂM ĐỒNG',
  overnightShiftAttendanceMode: 'standard',
  symbolWork: 'x',
  symbolMission: 'Ct',
  symbolStudy: 'H',
  symbolLeave: 'P',
  symbolCompensation: 'Nb',
  symbolMaternity: 'Ts',
  symbolRest: 'Nd',
  signerPreparer: 'Thiếu tá Đào Hải Dương',
  signerCommander: 'Trung tá Nguyễn Khánh Tiên',
  signerLeader: 'Thượng tá Nguyễn Thành Phương',
  signerPreparerTitle: 'NGƯỜI CHẤM CÔNG',
  signerCommanderTitle: 'CHỈ HUY ĐỘI',
  signerCommanderSubTitle: 'ĐỘI TRƯỞNG',
  signerLeaderTitle: 'LÃNH ĐẠO ĐƠN VỊ',
  signerLeaderActingTitle: 'KT. TRƯỞNG PHÒNG',
  signerLeaderSubTitle: 'PHÓ TRƯỞNG PHÒNG',
  signerLeaderSealTitle: 'TRƯỞNG PHÒNG CSGT',
  maxNightShiftCompensationTurns: 10,
};

export const initialOfficers: Officer[] = [];
export const initialTeams: Team[] = [];

export const initialPatrolSchedules: PatrolSchedule[] = [];

// Helper to get next date YYYY-MM-DD in a timezone-safe manner
export function getNextDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + 1);
  const nextY = dateObj.getFullYear();
  const nextM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const nextD = String(dateObj.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

export function getPointsForDayInterval(startH: number, endH: number): number {
  if (startH >= endH) return 0;
  
  let points = 0;
  
  // Rule: "từ 22h đến 23h59" -> 0.5 (overlap with [22.0, 24.0])
  if (Math.min(endH, 24.0) > Math.max(startH, 22.0)) {
    points = Math.max(points, 0.5);
  }
  
  // Rule: Any night shift after midnight (00h to 06h) counts as a full 1.0 point.
  // 00h to 04h -> 1.0
  // 01h to 04h -> 1.0
  // 00h to 06h -> 1.0
  if (Math.min(endH, 6.0) > Math.max(startH, 0.0)) {
    points = Math.max(points, 1.0);
  }
  
  // Rule: "Từ 04h00 trở đi" -> maybe 1.0 (overlap with [4.0, 6.0]), which is covered above.
  
  return points;
}

export function calculateNightShiftPointsForSchedule(
  startTime: string,
  endTime: string,
  mode: SystemSettings['overnightShiftAttendanceMode']
): { day1Points: number; day2Points: number; crossesMidnight: boolean } {
  const parseTimeToMinutes = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const startMin = parseTimeToMinutes(startTime);
  const endMinRaw = parseTimeToMinutes(endTime);
  if (startMin === null || endMinRaw === null) {
    return { day1Points: 0, day2Points: 0, crossesMidnight: false };
  }

  const crossesMidnight = endMinRaw <= startMin;
  const endMin = crossesMidnight ? endMinRaw + 24 * 60 : endMinRaw;

  const selectedMode = mode || 'standard';

  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  };

  const pointsFromMinutes = (minutes: number) => {
    if (minutes >= 4 * 60) return 1;
    if (minutes >= 2 * 60) return 0.5;
    return 0;
  };

  const day1NightStart = 22 * 60;
  const day1NightEnd = 24 * 60;
  const day2NightStart = 24 * 60;
  const day2NightEnd = 30 * 60;

  const day1Minutes = overlap(startMin, endMin, day1NightStart, day1NightEnd);
  const day2Minutes = overlap(startMin, endMin, day2NightStart, day2NightEnd);

  const day1Points = pointsFromMinutes(day1Minutes);
  const day2Points = pointsFromMinutes(day2Minutes);

  if (selectedMode === 'overnight_only_next_day' && crossesMidnight) {
    return { day1Points: 0, day2Points, crossesMidnight };
  }

  if (selectedMode === 'overnight_half_split_if_22_to_after_2' && crossesMidnight) {
    const isEligibleHalfSplit = startMin <= day1NightStart && endMin >= 26 * 60;
    if (isEligibleHalfSplit) {
      return { day1Points: 0.5, day2Points: 0.5, crossesMidnight };
    }
  }

  return { day1Points, day2Points, crossesMidnight };
}

// Helper to expand schedules into attendance, ration, night shift records
export function generateRecordsFromSchedules(
  schedules: PatrolSchedule[],
  teams: Team[],
  officers: Officer[],
  settings: SystemSettings
): {
  attendance: Attendance[];
  rations: RationRecord[];
  nightShifts: NightShiftRecord[];
} {
  const attendance: Attendance[] = [];
  const rations: RationRecord[] = [];
  const nightShifts: NightShiftRecord[] = [];

  schedules.forEach(sched => {
    if (sched.status !== 'Đã ban hành') return;

    let activeOfficerIds: string[] = [];
    if (sched.customOfficerIds && sched.customOfficerIds.length > 0) {
      activeOfficerIds = sched.customOfficerIds;
    } else if (sched.teamId) {
      const team = teams.find(t => t.id === sched.teamId);
      if (team) {
        activeOfficerIds = team.memberIds;
      }
    }

    if (activeOfficerIds.length === 0) return;

    const { day1Points, day2Points, crossesMidnight } = calculateNightShiftPointsForSchedule(
      sched.startTime,
      sched.endTime,
      settings.overnightShiftAttendanceMode
    );
    const day1 = sched.date;
    const day2 = crossesMidnight ? getNextDateString(sched.date) : null;

    activeOfficerIds.forEach(offId => {
      const officer = officers.find(o => o.id === offId);
      if (!officer || officer.status !== 'Đang công tác') return;

      // 1. Attendance: TTKS automatically gets calculated as 01 working day (Làm việc)
      // Ensure no duplicated attendance record for this officer on this day
      if (!attendance.some(a => a.officerId === offId && a.date === day1)) {
        const attId = `ATT_AUTO_${sched.id}_${offId}`;
        attendance.push({
          id: attId,
          officerId: offId,
          date: day1,
          type: 'Làm việc',
          sourceScheduleId: sched.id,
          notes: `Tự động từ lịch tuần tra ${sched.route || sched.topic || sched.missionType}`,
        });
      }
      if (day2 && !attendance.some(a => a.officerId === offId && a.date === day2)) {
        const attId = `ATT_AUTO_${sched.id}_${offId}_D2`;
        attendance.push({
          id: attId,
          officerId: offId,
          date: day2,
          type: 'Làm việc',
          sourceScheduleId: sched.id,
          notes: `Tự động từ lịch tuần tra ${sched.route || sched.topic || sched.missionType} (xuyên ngày)`,
        });
      }

      // 2. Ration: TTKS in a day automatically gets 1 ration
      if (!rations.some(r => r.officerId === offId && r.date === day1)) {
        const rationId = `RATION_AUTO_${sched.id}_${offId}`;
        rations.push({
          id: rationId,
          officerId: offId,
          date: day1,
          scheduleId: sched.id,
          amount: settings.rationRate,
        });
      }
      if (day2 && !rations.some(r => r.officerId === offId && r.date === day2)) {
        const rationId = `RATION_AUTO_${sched.id}_${offId}_D2`;
        rations.push({
          id: rationId,
          officerId: offId,
          date: day2,
          scheduleId: sched.id,
          amount: settings.rationRate,
        });
      }

      // 3. Night Shift Allowance calculated automatically from patrol times
      if (day1Points > 0) {
        const nightId = `NIGHT_AUTO_${sched.id}_${offId}_D1`;
        nightShifts.push({
          id: nightId,
          officerId: offId,
          date: day1,
          scheduleId: sched.id,
          hoursCount: day1Points,
          amount: day1Points * settings.nightShiftRate,
        });
      }
      
      if (day2 && day2Points > 0) {
        const nightId = `NIGHT_AUTO_${sched.id}_${offId}_D2`;
        nightShifts.push({
          id: nightId,
          officerId: offId,
          date: day2,
          scheduleId: sched.id,
          hoursCount: day2Points,
          amount: day2Points * settings.nightShiftRate,
        });
      }
    });
  });

  return { attendance, rations, nightShifts };
}

// Generate the pre-assembled lists of records
const preGenerated = generateRecordsFromSchedules(
  initialPatrolSchedules,
  initialTeams,
  initialOfficers,
  initialSettings
);

export const initialAttendance: Attendance[] = [];

export const initialRations: RationRecord[] = [];
export const initialNightShifts: NightShiftRecord[] = [];

export const initialAuditLogs: AuditLog[] = [];
