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

type AppStatePayload = {
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
};

const ensureClient = () => {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình');
  }
  return supabase;
};

const toUser = (row: any): User => ({
  id: String(row.id),
  username: String(row.username),
  password: row.password ?? undefined,
  role: row.role,
  fullName: String(row.full_name),
  officerId: row.officer_id ?? undefined,
});

const fromUser = (row: User) => ({
  id: row.id,
  username: row.username,
  password: row.password ?? '',
  role: row.role,
  full_name: row.fullName,
  officer_id: row.officerId ?? null,
});

const toOfficer = (row: any): Officer => ({
  id: String(row.id),
  fullName: String(row.full_name),
  rank: row.rank,
  position: row.position,
  badgeNumber: row.badge_number ?? '',
  department: row.department ?? '',
  phoneNumber: row.phone_number ?? '',
  status: row.status,
});

const fromOfficer = (row: Officer) => ({
  id: row.id,
  full_name: row.fullName,
  rank: row.rank,
  position: row.position,
  badge_number: row.badgeNumber,
  department: row.department,
  phone_number: row.phoneNumber,
  status: row.status,
});

const toTeam = (row: any): Team => ({
  id: String(row.id),
  name: String(row.name),
  leaderId: row.leader_id ?? '',
  memberIds: Array.isArray(row.member_ids) ? row.member_ids.map(String) : [],
});

const fromTeam = (row: Team) => ({
  id: row.id,
  name: row.name,
  leader_id: row.leaderId || null,
  member_ids: row.memberIds,
});

const toSchedule = (row: any): PatrolSchedule => ({
  id: String(row.id),
  date: String(row.date),
  startTime: String(row.start_time),
  endTime: String(row.end_time),
  route: row.route ?? undefined,
  area: row.area ?? undefined,
  topic: String(row.topic),
  missionType: row.mission_type,
  teamId: row.team_id ?? undefined,
  customOfficerIds: Array.isArray(row.custom_officer_ids) ? row.custom_officer_ids.map(String) : [],
  notes: row.notes ?? undefined,
  status: row.status,
});

const fromSchedule = (row: PatrolSchedule) => ({
  id: row.id,
  date: row.date,
  start_time: row.startTime,
  end_time: row.endTime,
  route: row.route ?? null,
  area: row.area ?? null,
  topic: row.topic,
  mission_type: row.missionType,
  team_id: row.teamId ?? null,
  custom_officer_ids: row.customOfficerIds ?? [],
  notes: row.notes ?? null,
  status: row.status,
});

const toAttendance = (row: any): Attendance => ({
  id: String(row.id),
  officerId: String(row.officer_id),
  date: String(row.date),
  type: row.type,
  sourceScheduleId: row.source_schedule_id ?? undefined,
  hours: row.hours === null || row.hours === undefined ? undefined : Number(row.hours),
  notes: row.notes ?? undefined,
});

const fromAttendance = (row: Attendance) => ({
  id: row.id,
  officer_id: row.officerId,
  date: row.date,
  type: row.type,
  source_schedule_id: row.sourceScheduleId ?? null,
  hours: row.hours ?? null,
  notes: row.notes ?? null,
});

const toRation = (row: any): RationRecord => ({
  id: String(row.id),
  officerId: String(row.officer_id),
  date: String(row.date),
  scheduleId: String(row.schedule_id),
  amount: Number(row.amount ?? 0),
});

const fromRation = (row: RationRecord) => ({
  id: row.id,
  officer_id: row.officerId,
  date: row.date,
  schedule_id: row.scheduleId,
  amount: row.amount,
});

const toNightShift = (row: any): NightShiftRecord => ({
  id: String(row.id),
  officerId: String(row.officer_id),
  date: String(row.date),
  scheduleId: String(row.schedule_id),
  hoursCount: Number(row.hours_count ?? 0),
  amount: Number(row.amount ?? 0),
});

const fromNightShift = (row: NightShiftRecord) => ({
  id: row.id,
  officer_id: row.officerId,
  date: row.date,
  schedule_id: row.scheduleId,
  hours_count: row.hoursCount,
  amount: row.amount,
});

const toApproval = (row: any): Approval => ({
  id: String(row.id),
  monthString: String(row.month_string),
  status: row.status,
  approvedBy: String(row.approved_by),
  approvedAt: String(row.approved_at),
});

const fromApproval = (row: Approval) => ({
  id: row.id,
  month_string: row.monthString,
  status: row.status,
  approved_by: row.approvedBy,
  approved_at: row.approvedAt,
});

const toAuditLog = (row: any): AuditLog => ({
  id: String(row.id),
  userId: String(row.user_id),
  username: String(row.username),
  userFullName: String(row.user_full_name),
  timestamp: String(row.timestamp),
  action: String(row.action),
  details: String(row.details),
});

const fromAuditLog = (row: AuditLog) => ({
  id: row.id,
  user_id: row.userId,
  username: row.username,
  user_full_name: row.userFullName,
  timestamp: row.timestamp,
  action: row.action,
  details: row.details,
});

const toSettings = (row: any): SystemSettings => ({
  rationRate: Number(row.ration_rate ?? 75000),
  nightShiftRate: Number(row.night_shift_rate ?? 200000),
  departmentName: String(row.department_name ?? ''),
  unitName: String(row.unit_name ?? ''),
  overnightShiftAttendanceMode: row.overnight_shift_attendance_mode,
  symbolWork: row.symbol_work ?? 'x',
  symbolMission: row.symbol_mission ?? 'Ct',
  symbolStudy: row.symbol_study ?? 'H',
  symbolLeave: row.symbol_leave ?? 'P',
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
});

const fromSettings = (row: SystemSettings) => ({
  id: 'default',
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
});

const replaceTableById = async (table: string, rows: any[]) => {
  const client = ensureClient();
  if (rows.length > 0) {
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    const ids = rows.map((row) => row.id);
    const { error: deleteError } = await client.from(table).delete().not('id', 'in', `(${ids.map((id) => `"${String(id).replace(/"/g, '""')}"`).join(',')})`);
    if (deleteError && !String(deleteError.message || '').includes('0 rows')) throw deleteError;
    return;
  }
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
    client.from('system_settings').select('*').eq('id', 'default').maybeSingle(),
  ]);

  const results = [usersRes, officersRes, teamsRes, schedulesRes, attendanceRes, rationsRes, nightShiftsRes, approvalsRes, auditLogsRes];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  if (settingsRes.error) throw settingsRes.error;

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
    settings: settingsRes.data ? toSettings(settingsRes.data) : null,
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
