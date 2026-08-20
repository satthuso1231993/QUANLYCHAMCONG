import { NightShiftRecord, PatrolSchedule, RationRecord, Team, User } from '../types';

export interface UserScope {
  canViewAll: boolean;
  canManageAccounts: boolean;
  canManageStructure: boolean;
  allowedTeamIds: string[];
  allowedOfficerIds: string[];
}

export const getUserRoleLabel = (role: User['role']) => {
  switch (role) {
    case 'admin':
      return 'Quản trị viên';
    case 'doi':
      return 'Tài khoản Đội';
    case 'to_dia_ban':
      return 'Tài khoản Tổ địa bàn';
    default:
      return 'Người dùng';
  }
};

export const getTeamTypeLabel = (teamType: Team['teamType']) => {
  return teamType === 'to_dia_ban' ? 'Tổ địa bàn' : 'Đội';
};

export const resolveUserScope = (currentUser: User, teams: Team[]): UserScope => {
  if (currentUser.role === 'admin') {
    return {
      canViewAll: true,
      canManageAccounts: true,
      canManageStructure: true,
      allowedTeamIds: teams.map((team) => team.id),
      allowedOfficerIds: Array.from(
        new Set(teams.flatMap((team) => [team.leaderId, ...team.memberIds].filter(Boolean))),
      ),
    };
  }

  if (!currentUser.managedTeamId) {
    return {
      canViewAll: false,
      canManageAccounts: false,
      canManageStructure: false,
      allowedTeamIds: [],
      allowedOfficerIds: currentUser.officerId ? [currentUser.officerId] : [],
    };
  }

  const allowedTeamIds: string[] = [currentUser.managedTeamId];

  const allowedOfficerIds = Array.from(
    new Set(
      teams
        .filter((team) => allowedTeamIds.includes(team.id))
        .flatMap((team) => [team.leaderId, ...team.memberIds].filter(Boolean)),
    ),
  );

  if (currentUser.officerId && !allowedOfficerIds.includes(currentUser.officerId)) {
    allowedOfficerIds.push(currentUser.officerId);
  }

  return {
    canViewAll: false,
    canManageAccounts: false,
    canManageStructure: false,
    allowedTeamIds,
    allowedOfficerIds,
  };
};

export const filterSchedulesByScope = (
  schedules: PatrolSchedule[],
  allowedTeamIds: string[],
  allowedOfficerIds: string[],
) => {
  return schedules.filter((schedule) => {
    if (schedule.teamId) {
      return allowedTeamIds.includes(schedule.teamId);
    }
    if (schedule.customOfficerIds && schedule.customOfficerIds.length > 0) {
      return schedule.customOfficerIds.some((officerId) => allowedOfficerIds.includes(officerId));
    }
    return false;
  });
};

export const filterRecordsByOfficerScope = <T extends { officerId: string }>(rows: T[], allowedOfficerIds: string[]) => {
  return rows.filter((row) => allowedOfficerIds.includes(row.officerId));
};

export const filterRationsByScheduleScope = (
  rows: RationRecord[],
  allowedOfficerIds: string[],
  allowedScheduleIds: string[],
) => rows.filter((row) => allowedOfficerIds.includes(row.officerId) || allowedScheduleIds.includes(row.scheduleId));

export const filterNightShiftsByScheduleScope = (
  rows: NightShiftRecord[],
  allowedOfficerIds: string[],
  allowedScheduleIds: string[],
) => rows.filter((row) => allowedOfficerIds.includes(row.officerId) || allowedScheduleIds.includes(row.scheduleId));
