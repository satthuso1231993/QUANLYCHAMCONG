// src/utils/accessScope.ts
import { Team, User, PatrolSchedule } from '../types';

export interface UserScope {
  canViewAll: boolean;
  canManageAccounts: boolean;
  canManageStructure: boolean;
  allowedTeamIds: string[];
  allowedOfficerIds: string[];
}

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

  // 3. Phân cấp Đội / Tổ địa bàn
  let allowedTeamIds: string[] = [currentUser.managedTeamId];
  
  // Nếu là cấp Đội: Tự động gom thêm các Tổ địa bàn con trực thuộc Đội
  if (currentUser.role === 'doi') {
    const childTeams = teams.filter(
      (t) => t.parentTeamId === currentUser.managedTeamId && (t.teamType || 'doi') === 'to_dia_ban'
    );
    allowedTeamIds = [...allowedTeamIds, ...childTeams.map((t) => t.id)];
  }

  // Lấy danh sách ID tất cả cán bộ thuộc các đơn vị trong phạm vi
  const allowedOfficerIds = Array.from(
    new Set(
      teams
        .filter((t) => allowedTeamIds.includes(t.id))
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
