import { Officer, OfficerPosition, OfficerRank } from '../types';

const positionPriority: Record<OfficerPosition, number> = {
  'Đội trưởng': 5,
  'Phó Đội trưởng': 4,
  'Cán bộ': 3,
  'Chiến sĩ': 2,
  'Trực ban': 1,
};

const rankPriority: Record<OfficerRank, number> = {
  'Đại tá': 13,
  'Thượng tá': 12,
  'Trung tá': 11,
  'Thiếu tá': 10,
  'Đại úy': 9,
  'Thượng úy': 8,
  'Trung úy': 7,
  'Thiếu úy': 6,
  'Thượng sĩ': 5,
  'Trung sĩ': 4,
  'Hạ sĩ': 3,
  'Binh nhất': 2,
  'Binh nhì': 1,
};

const normalizeBirthYear = (value?: number) => {
  if (!value || !Number.isFinite(value)) return Number.MAX_SAFE_INTEGER;
  return value;
};

export const isFixedPersonnelOfficer = (officer: Officer) => officer.position !== 'Trực ban';

export const compareOfficersByPriority = (left: Officer, right: Officer) => {
  const positionDiff = (positionPriority[right.position] || 0) - (positionPriority[left.position] || 0);
  if (positionDiff !== 0) return positionDiff;

  const rankDiff = (rankPriority[right.rank] || 0) - (rankPriority[left.rank] || 0);
  if (rankDiff !== 0) return rankDiff;

  const birthYearDiff = normalizeBirthYear(left.yearOfBirth) - normalizeBirthYear(right.yearOfBirth);
  if (birthYearDiff !== 0) return birthYearDiff;

  return left.fullName.localeCompare(right.fullName, 'vi');
};

export const sortOfficersByPriority = (officers: Officer[]) => [...officers].sort(compareOfficersByPriority);

export const getFixedPersonnelOfficers = (officers: Officer[]) => sortOfficersByPriority(officers.filter(isFixedPersonnelOfficer));
