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

export const getTeamTypeLabel = (teamType?: Team['teamType']) => {
  if (teamType === 'to_dia_ban') return 'Tổ địa bàn';
  if (teamType === 'to_ttks') return 'Tổ TTKS';
  return 'Đội';
};

/**
 * Thu thập tất cả các ID tổ/đội cấp con cháu trực thuộc theo cây phân cấp:
 * - Cấp Đội -> Gom các Tổ TTKS trực tiếp + các Tổ địa bàn con + các Tổ TTKS thuộc Tổ địa bàn
 * - Cấp Tổ địa bàn -> Gom Tổ địa bàn đó + các Tổ TTKS thuộc Tổ địa bàn
 */
export const collectDescendantTeamIds = (rootTeamId: string, teams: Team[]): string[] => {
  const result = new Set<string>();
  if (!rootTeamId) return [];

  const queue = [rootTeamId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (!result.has(currentId)) {
      result.add(currentId);
      // Tìm các tổ con có parentTeamId là currentId
      const children = teams.filter((t) => t.parentTeamId === currentId);
      for (const child of children) {
        if (!result.has(child.id)) {
          queue.push(child.id);
        }
      }
    }
  }

  return Array.from(result);
};

export const resolveUserScope = (currentUser: User, teams: Team[]): UserScope => {
  // 1. Quản trị viên: Toàn quyền truy cập
  if (currentUser.role === 'admin') {
    return {
      canViewAll: true,
      canManageAccounts: true,
      canManageStructure: true,
      allowedTeamIds: teams.map((t) => t.id),
      allowedOfficerIds: Array.from(
        new Set(teams.flatMap((t) => [t.leaderId, ...t.memberIds].filter(Boolean)))
      ),
    };
  }

  // 2. Tài khoản chưa được gán đơn vị
  if (!currentUser.managedTeamId) {
    return {
      canViewAll: false,
      canManageAccounts: false,
      canManageStructure: false,
      allowedTeamIds: [],
      allowedOfficerIds: currentUser.officerId ? [currentUser.officerId] : [],
    };
  }

  // 3. Phân cấp Đội / Tổ địa bàn (thu thập đệ quy toàn bộ tổ con/cháu)
  const allowedTeamIds = collectDescendantTeamIds(currentUser.managedTeamId, teams);

  // Nếu là tài khoản Tổ địa bàn / Tổ TTKS, lấy thêm phạm vi Đội trực thuộc để Tổ trưởng có thể điều động, thêm/bớt CBCS trong Đội vào ca
  const managedTeam = teams.find((t) => t.id === currentUser.managedTeamId);
  const parentDoiId = managedTeam?.parentTeamId;
  const parentDoiTeamIds = parentDoiId ? collectDescendantTeamIds(parentDoiId, teams) : [];
  const officerPoolTeamIds = Array.from(
    new Set([...allowedTeamIds, ...parentDoiTeamIds, ...(parentDoiId ? [parentDoiId] : [])])
  );

  // Lấy danh sách ID tất cả cán bộ thuộc các đơn vị trong phạm vi (kèm phạm vi Đội để đổi ca/tăng cường)
  const allowedOfficerIds = Array.from(
    new Set(
      teams
        .filter((t) => officerPoolTeamIds.includes(t.id))
        .flatMap((t) => [t.leaderId, ...t.memberIds].filter(Boolean))
    )
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

