import {
  Approval,
  Attendance,
  AuditLog,
  NightShiftRecord,
  Officer,
  PatrolSchedule,
  ReportTemplateId,
  ReportTemplateOverride,
  ReportTemplateOverrides,
  RationRecord,
  SystemSettings,
  Team,
  User,
} from '../types';
import { supabase } from './supabaseClient';

export type AppStatePayload = {
  users: User[];
  officers: Officer[];
  teams: Team[];
  schedules: PatrolSchedule[];
  attendance: Attendance[];
  rations: RationRecord[];
  nightShifts: NightShiftRecord[];
  approvals: Approval[];
  auditLogs: AuditLog[];
  settings: SystemSettings | null;
  accountSettings?: Record<string, SystemSettings>;
};

const ensureClient = () => {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình');
  }
  return supabase;
};

// 1. User mappings
const toUser = (row: any): User => {
  let officerId: string | undefined = row.officer_id ?? undefined;
  let managedTeamId: string | undefined = undefined;

  if (row.officer_id && String(row.officer_id).includes('__TEAM__')) {
    const parts = String(row.officer_id).split('__TEAM__');
    officerId = parts[0] || undefined;
    managedTeamId = parts[1] || undefined;
  }

  let role: User['role'] = 'admin';
  if (row.role === 'commander' || row.role === 'doi') {
    role = 'doi';
  } else if (row.role === 'leader' || row.role === 'to_dia_ban') {
    role = 'to_dia_ban';
  } else if (row.role === 'admin') {
    role = 'admin';
  }

  return {
    id: String(row.id),
    username: String(row.username),
    password: row.password ?? undefined,
    role,
    fullName: String(row.full_name),
    officerId,
    managedTeamId,
  };
};

const fromUser = (row: User) => {
  const now = new Date().toISOString();
  let roleVal = 'admin';
  if (row.role === 'doi') roleVal = 'commander';
  else if (row.role === 'to_dia_ban') roleVal = 'leader';

  let officerIdVal: string | null = null;
  if (row.managedTeamId) {
    officerIdVal = `${row.officerId || ''}__TEAM__${row.managedTeamId}`;
  } else if (row.officerId) {
    officerIdVal = row.officerId;
  }

  return {
    id: row.id,
    username: row.username,
    password: row.password ?? '',
    role: roleVal,
    full_name: row.fullName,
    officer_id: officerIdVal,
    created_at: now,
    updated_at: now,
  };
};

// 2. Officer mappings
const toOfficer = (row: any): Officer => {
  let yearOfBirth: number | undefined = undefined;
  if (row.full_name) {
    const match = String(row.full_name).match(/\((19\d\d|20\d\d)[A-Za-z]?\)/);
    if (match && match[1]) {
      yearOfBirth = parseInt(match[1], 10);
    }
  }

  return {
    id: String(row.id),
    fullName: String(row.full_name),
    rank: row.rank || 'Thiếu úy',
    position: row.position || 'Cán bộ',
    badgeNumber: row.badge_number ?? '',
    department: row.department ?? '',
    phoneNumber: row.phone_number ?? '',
    yearOfBirth,
    status: row.status === 'Tạm nghỉ' || row.status === 'Chuyển công tác' ? row.status : 'Đang công tác',
  };
};

const fromOfficer = (row: Officer) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    full_name: row.fullName,
    rank: row.rank,
    position: row.position,
    badge_number: row.badgeNumber || '',
    department: row.department || '',
    phone_number: row.phoneNumber || '',
    status: row.status || 'Đang công tác',
    created_at: now,
    updated_at: now,
  };
};

// 3. Team mappings (transparent metadata encoding in member_ids)
const toTeam = (row: any): Team => {
  const rawMembers: string[] = Array.isArray(row.member_ids) ? row.member_ids.map(String) : [];
  let teamType: Team['teamType'] = 'doi';
  let parentTeamId: string | undefined = undefined;
  const cleanMembers: string[] = [];

  for (const m of rawMembers) {
    if (m.startsWith('__TYPE__')) {
      const typeVal = m.replace('__TYPE__', '') as Team['teamType'];
      if (typeVal === 'doi' || typeVal === 'to_dia_ban' || typeVal === 'to_ttks') {
        teamType = typeVal;
      }
    } else if (m.startsWith('__PARENT__')) {
      parentTeamId = m.replace('__PARENT__', '');
    } else {
      cleanMembers.push(m);
    }
  }

  // Fallback if no metadata tag found
  if (!rawMembers.some(m => m.startsWith('__TYPE__'))) {
    const nameLower = (row.name || '').toLowerCase();
    if (nameLower.includes('địa bàn') || nameLower.includes('tổ ') || nameLower.includes('to ')) {
      teamType = 'to_dia_ban';
    } else {
      teamType = 'doi';
    }
  }

  return {
    id: String(row.id),
    name: String(row.name),
    teamType,
    parentTeamId,
    leaderId: row.leader_id ?? '',
    memberIds: cleanMembers,
  };
};

const fromTeam = (row: Team) => {
  const now = new Date().toISOString();
  const metaType = `__TYPE__${row.teamType || 'doi'}`;
  const metaParent = row.parentTeamId ? `__PARENT__${row.parentTeamId}` : null;
  const cleanMembers = (row.memberIds || []).filter(m => !m.startsWith('__TYPE__') && !m.startsWith('__PARENT__'));
  const finalMembers = [...cleanMembers, metaType, metaParent].filter(Boolean);

  return {
    id: row.id,
    name: row.name,
    leader_id: row.leaderId || null,
    member_ids: finalMembers,
    created_at: now,
    updated_at: now,
  };
};

// 4. Schedule mappings
const toSchedule = (row: any): PatrolSchedule => {
  let status: PatrolSchedule['status'] = 'Bản nháp';
  if (row.status === 'Đã ban hành' || row.status === 'approved') {
    status = 'Đã ban hành';
  }

  return {
    id: String(row.id),
    date: String(row.date),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    route: row.route ?? undefined,
    area: row.area ?? undefined,
    topic: String(row.topic || ''),
    missionType: row.mission_type || 'Tuần tra kiểm soát',
    teamId: row.team_id ?? undefined,
    customOfficerIds: Array.isArray(row.custom_officer_ids) ? row.custom_officer_ids.map(String) : [],
    notes: row.notes ?? undefined,
    status,
  };
};

const fromSchedule = (row: PatrolSchedule) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    date: row.date,
    start_time: row.startTime,
    end_time: row.endTime,
    route: row.route ?? null,
    area: row.area ?? null,
    topic: row.topic || '',
    mission_type: row.missionType || 'Tuần tra kiểm soát',
    team_id: row.teamId ?? null,
    custom_officer_ids: row.customOfficerIds ?? [],
    notes: row.notes ?? null,
    status: row.status === 'Bản nháp' ? 'Bản nháp' : 'Đã ban hành',
    created_at: now,
    updated_at: now,
  };
};

// 5. Attendance mappings
const toAttendance = (row: any): Attendance => ({
  id: String(row.id),
  officerId: String(row.officer_id),
  date: String(row.date),
  type: row.type || 'Làm việc',
  sourceScheduleId: row.source_schedule_id ?? undefined,
  hours: row.hours === null || row.hours === undefined ? undefined : Number(row.hours),
  notes: row.notes ?? undefined,
});

const fromAttendance = (row: Attendance) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    officer_id: row.officerId,
    date: row.date,
    type: row.type || 'Làm việc',
    source_schedule_id: row.sourceScheduleId ?? null,
    hours: row.hours ?? null,
    notes: row.notes ?? null,
    created_at: now,
    updated_at: now,
  };
};

// 6. Ration mappings
const toRation = (row: any): RationRecord => ({
  id: String(row.id),
  officerId: String(row.officer_id),
  date: String(row.date),
  scheduleId: String(row.schedule_id),
  amount: Number(row.amount ?? 0),
});

const fromRation = (row: RationRecord) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    officer_id: row.officerId,
    date: row.date,
    schedule_id: row.scheduleId,
    amount: row.amount,
    created_at: now,
    updated_at: now,
  };
};

// 7. Night shift mappings
const toNightShift = (row: any): NightShiftRecord => ({
  id: String(row.id),
  officerId: String(row.officer_id),
  date: String(row.date),
  scheduleId: String(row.schedule_id),
  hoursCount: Number(row.hours_count ?? 0),
  amount: Number(row.amount ?? 0),
});

const fromNightShift = (row: NightShiftRecord) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    officer_id: row.officerId,
    date: row.date,
    schedule_id: row.scheduleId,
    hours_count: row.hoursCount ?? 0,
    amount: row.amount ?? 0,
    created_at: now,
    updated_at: now,
  };
};

// 8. Approval mappings
const toApproval = (row: any): Approval => ({
  id: String(row.id),
  monthString: String(row.month_string),
  status: row.status === 'Đã khóa' ? 'Đã khóa' : 'Chưa khóa',
  approvedBy: String(row.approved_by || ''),
  approvedAt: String(row.approved_at || new Date().toISOString()),
});

const fromApproval = (row: Approval) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    month_string: row.monthString,
    status: row.status === 'Đã khóa' ? 'Đã khóa' : 'Chưa khóa',
    approved_by: row.approvedBy || '',
    approved_at: row.approvedAt || now,
    created_at: now,
    updated_at: now,
  };
};

// 9. Audit log mappings
const toAuditLog = (row: any): AuditLog => ({
  id: String(row.id),
  userId: String(row.user_id || ''),
  username: String(row.username || ''),
  userFullName: String(row.user_full_name || ''),
  timestamp: String(row.timestamp || new Date().toISOString()),
  action: String(row.action || ''),
  details: String(row.details || ''),
});

const fromAuditLog = (row: AuditLog) => {
  const now = new Date().toISOString();
  return {
    id: row.id,
    user_id: row.userId || 'system',
    username: row.username || 'system',
    user_full_name: row.userFullName || 'Hệ thống',
    timestamp: row.timestamp || now,
    action: row.action || 'Thao tác',
    details: row.details || '',
    created_at: now,
  };
};

// 10. Settings mappings
const toSettings = (row: any): SystemSettings => ({
  rationRate: Number(row.ration_rate ?? 75000),
  nightShiftRate: Number(row.night_shift_rate ?? 200000),
  departmentName: String(row.department_name ?? 'PHÒNG CẢNH SÁT GIAO THÔNG'),
  unitName: String(row.unit_name ?? 'CÔNG AN TỈNH PHÚ YÊN'),
  overnightShiftAttendanceMode: row.overnight_shift_attendance_mode || 'standard',
  symbolWork: row.symbol_work ?? 'x',
  symbolMission: row.symbol_mission ?? 'Ct',
  symbolStudy: row.symbol_study ?? 'H',
  symbolLeave: row.symbol_leave ?? 'P',
  symbolPaternityLeave: row.symbol_paternity_leave ?? 'NVS',
  symbolCompensation: row.symbol_compensation ?? 'Nb',
  symbolMaternity: row.symbol_maternity ?? 'Ts',
  symbolRest: row.symbol_rest ?? 'Nd',
  signerPreparer: row.signer_preparer ?? undefined,
  signerCommander: row.signer_commander ?? undefined,
  signerLeader: row.signer_leader ?? undefined,
  signerPreparerTitle: row.signer_preparer_title ?? undefined,
  signerCommanderTitle: row.signer_commander_title ?? undefined,
  signerCommanderSubTitle: row.signer_commander_sub_title ?? undefined,
  signerLeaderTitle: row.signer_leader_title ?? undefined,
  signerLeaderActingTitle: row.signer_leader_acting_title ?? undefined,
  signerLeaderSubTitle: row.signer_leader_sub_title ?? undefined,
  signerLeaderSealTitle: row.signer_leader_seal_title ?? undefined,
  maxNightShiftCompensationTurns: Number(row.max_night_shift_compensation_turns ?? 10),
  paternityLeaveMaxDays: 14,
});

const fromSettingsWithId = (id: string, row: SystemSettings) => {
  const now = new Date().toISOString();
  return {
    id: id || 'default',
    ration_rate: row.rationRate,
    night_shift_rate: row.nightShiftRate,
    department_name: row.departmentName,
    unit_name: row.unitName,
    overnight_shift_attendance_mode: row.overnightShiftAttendanceMode ?? 'standard',
    symbol_work: row.symbolWork ?? 'x',
    symbol_mission: row.symbolMission ?? 'Ct',
    symbol_study: row.symbolStudy ?? 'H',
    symbol_leave: row.symbolLeave ?? 'P',
    symbol_compensation: row.symbolCompensation ?? 'Nb',
    symbol_maternity: row.symbolMaternity ?? 'Ts',
    symbol_rest: row.symbolRest ?? 'Nd',
    signer_preparer: row.signerPreparer ?? null,
    signer_commander: row.signerCommander ?? null,
    signer_leader: row.signerLeader ?? null,
    signer_preparer_title: row.signerPreparerTitle ?? null,
    signer_commander_title: row.signerCommanderTitle ?? null,
    signer_commander_sub_title: row.signerCommanderSubTitle ?? null,
    signer_leader_title: row.signerLeaderTitle ?? null,
    signer_leader_acting_title: row.signerLeaderActingTitle ?? null,
    signer_leader_sub_title: row.signerLeaderSubTitle ?? null,
    signer_leader_seal_title: row.signerLeaderSealTitle ?? null,
    max_night_shift_compensation_turns: row.maxNightShiftCompensationTurns ?? 10,
    created_at: now,
    updated_at: now,
  };
};

const fromSettings = (row: SystemSettings) => fromSettingsWithId('default', row);

/**
 * Replace table contents with safe chunked upsert and delete operations
 */
const replaceTableById = async (table: string, rows: any[]) => {
  const client = ensureClient();
  if (rows.length > 0) {
    // 1. Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: upsertError } = await client.from(table).upsert(batch, { onConflict: 'id' });
      if (upsertError) {
        console.error(`Lỗi ghi dữ liệu bảng ${table}:`, upsertError);
        throw upsertError;
      }
    }

    // 2. Delete stale rows not present in current payload
    const currentIds = new Set(rows.map((r) => String(r.id)));
    const { data: existingRows, error: fetchError } = await client.from(table).select('id');
    if (!fetchError && existingRows && existingRows.length > 0) {
      const staleIds = existingRows
        .map((r: any) => String(r.id))
        .filter((id: string) => !currentIds.has(id));

      if (staleIds.length > 0) {
        for (let i = 0; i < staleIds.length; i += 50) {
          const chunk = staleIds.slice(i, i + 50);
          await client.from(table).delete().in('id', chunk);
        }
      }
    }
    return;
  }

  // If payload is empty, clean the table
  const { error } = await client.from(table).delete().neq('id', '__never__');
  if (error) throw error;
};

export const loadAppStateFromSupabase = async (): Promise<AppStatePayload> => {
  const client = ensureClient();
  const [
    usersRes,
    officersRes,
    teamsRes,
    schedulesRes,
    attendanceRes,
    rationsRes,
    nightShiftsRes,
    approvalsRes,
    auditLogsRes,
    settingsRes,
  ] = await Promise.all([
    client.from('users').select('*').order('id'),
    client.from('officers').select('*').order('id'),
    client.from('teams').select('*').order('id'),
    client.from('patrol_schedules').select('*').order('date'),
    client.from('attendance').select('*').order('date'),
    client.from('ration_records').select('*').order('date'),
    client.from('night_shift_records').select('*').order('date'),
    client.from('approvals').select('*').order('month_string'),
    client.from('audit_logs').select('*').order('timestamp', { ascending: false }),
    client.from('system_settings').select('*').order('id'),
  ]);

  const results = [usersRes, officersRes, teamsRes, schedulesRes, attendanceRes, rationsRes, nightShiftsRes, approvalsRes, auditLogsRes];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  if (settingsRes.error) throw settingsRes.error;

  const accountSettingsMap: Record<string, SystemSettings> = {};
  let defaultSettings: SystemSettings | null = null;
  for (const sRow of (settingsRes.data || [])) {
    const sObj = toSettings(sRow);
    accountSettingsMap[sRow.id] = sObj;
    if (sRow.id === 'default' || !defaultSettings) {
      defaultSettings = sObj;
    }
  }

  return {
    users: (usersRes.data || []).map(toUser),
    officers: (officersRes.data || []).map(toOfficer),
    teams: (teamsRes.data || []).map(toTeam),
    schedules: (schedulesRes.data || []).map(toSchedule),
    attendance: (attendanceRes.data || []).map(toAttendance),
    rations: (rationsRes.data || []).map(toRation),
    nightShifts: (nightShiftsRes.data || []).map(toNightShift),
    approvals: (approvalsRes.data || []).map(toApproval),
    auditLogs: (auditLogsRes.data || []).map(toAuditLog),
    settings: defaultSettings,
    accountSettings: accountSettingsMap,
  };
};

export const syncUsersToSupabase = async (rows: User[]) => replaceTableById('users', rows.map(fromUser));
export const syncOfficersToSupabase = async (rows: Officer[]) => replaceTableById('officers', rows.map(fromOfficer));
export const syncTeamsToSupabase = async (rows: Team[]) => replaceTableById('teams', rows.map(fromTeam));
export const syncSchedulesToSupabase = async (rows: PatrolSchedule[]) => replaceTableById('patrol_schedules', rows.map(fromSchedule));
export const syncAttendanceToSupabase = async (rows: Attendance[]) => replaceTableById('attendance', rows.map(fromAttendance));
export const syncRationsToSupabase = async (rows: RationRecord[]) => replaceTableById('ration_records', rows.map(fromRation));
export const syncNightShiftsToSupabase = async (rows: NightShiftRecord[]) => replaceTableById('night_shift_records', rows.map(fromNightShift));
export const syncApprovalsToSupabase = async (rows: Approval[]) => replaceTableById('approvals', rows.map(fromApproval));
export const syncAuditLogsToSupabase = async (rows: AuditLog[]) => replaceTableById('audit_logs', rows.map(fromAuditLog));

export const syncSettingsToSupabase = async (row: SystemSettings) => {
  const client = ensureClient();
  const payload = fromSettings(row);
  const { error } = await client.from('system_settings').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

export const syncAccountSettingsToSupabase = async (id: string, row: SystemSettings) => {
  const client = ensureClient();
  const payload = fromSettingsWithId(id, row);
  const { error } = await client.from('system_settings').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

const toTemplateOverride = (payload: unknown): ReportTemplateOverride => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return payload as ReportTemplateOverride;
};

export const loadTemplateOverridesFromSupabase = async (userId: string): Promise<ReportTemplateOverrides> => {
  const client = ensureClient();
  const { data, error } = await client
    .from('report_template_overrides')
    .select('report_id, payload')
    .eq('user_id', userId)
    .order('report_id');

  if (error) throw error;

  const overrides: ReportTemplateOverrides = {};
  for (const row of data || []) {
    const reportId = String(row.report_id || '') as ReportTemplateId;
    if (!reportId) continue;
    overrides[reportId] = toTemplateOverride(row.payload);
  }
  return overrides;
};

export const saveTemplateOverrideToSupabase = async (
  userId: string,
  reportId: ReportTemplateId,
  payload: ReportTemplateOverride,
) => {
  const client = ensureClient();
  const { error } = await client.from('report_template_overrides').upsert(
    {
      user_id: userId,
      report_id: reportId,
      payload,
    },
    { onConflict: 'user_id,report_id' },
  );
  if (error) throw error;
};

export const deleteTemplateOverrideFromSupabase = async (userId: string, reportId: ReportTemplateId) => {
  const client = ensureClient();
  const { error } = await client
    .from('report_template_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('report_id', reportId);
  if (error) throw error;
};

