export type UserRole = 'admin' | 'leader' | 'commander' | 'team_leader' | 'officer_self';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  fullName: string;
  officerId?: string;
}

export type OfficerRank = 
  | 'Binh nhì' 
  | 'Binh nhất' 
  | 'Hạ sĩ' 
  | 'Trung sĩ' 
  | 'Thượng sĩ' 
  | 'Thiếu úy' 
  | 'Trung úy' 
  | 'Thượng úy' 
  | 'Đại úy' 
  | 'Thiếu tá' 
  | 'Trung tá' 
  | 'Thượng tá' 
  | 'Đại tá';

export type OfficerPosition = 
  | 'Đội trưởng' 
  | 'Phó Đội trưởng' 
  | 'Cán bộ' 
  | 'Chiến sĩ' 
  | 'Trực ban';

export interface Officer {
  id: string;
  fullName: string;
  rank: OfficerRank;
  position: OfficerPosition;
  badgeNumber: string; // Số hiệu CAND
  department: string;  // Đội công nghiệp/Đội tuần tra/Đội hành chính...
  phoneNumber: string;
  status: 'Đang công tác' | 'Tạm nghỉ' | 'Chuyển công tác';
}

export interface Team {
  id: string;
  name: string;
  leaderId: string; // ID of Officer who is leader
  memberIds: string[]; // List of Officer IDs
}

export type MissionType = 
  | 'Tuần tra kiểm soát'
  | 'Chuyên đề nồng độ cồn'
  | 'Chuyên đề tốc độ'
  | 'Kiểm tra xử lý quá tải'
  | 'Kiểm tra xử lý vi phạm'
  | 'Hộ tống dẫn đoàn'
  | 'Khác';

export interface PatrolSchedule {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  route?: string; // Tuyến đường
  area?: string; // Địa bàn
  topic: string; // Chuyên đề (e.g. Nồng độ cồn, Tốc độ, Quá tải)
  missionType: MissionType;
  teamId?: string;
  customOfficerIds?: string[];
  notes?: string;
  status: 'Bản nháp' | 'Đã ban hành';
}

export type AttendanceType = 
  | 'Làm việc' 
  | 'Công tác' 
  | 'Học tập' 
  | 'Nghỉ bù' 
  | 'Nghỉ phép' 
  | 'Nghỉ sinh' 
  | 'Nghỉ dưỡng';

export interface Attendance {
  id: string;
  officerId: string;
  date: string; // YYYY-MM-DD
  type: AttendanceType;
  sourceScheduleId?: string; // If auto-calculated from schedule
  hours?: number;
  notes?: string;
}

export interface RationRecord {
  id: string;
  officerId: string;
  date: string; // YYYY-MM-DD
  scheduleId: string;
  amount: number; // Mức tiền lúc tính (VND)
}

export interface NightShiftRecord {
  id: string;
  officerId: string;
  date: string; // YYYY-MM-DD
  scheduleId: string;
  hoursCount: number; // số lượt (thường là 1)
  amount: number; // Mức tiền (VND)
}

export interface Approval {
  id: string;
  monthString: string; // YYYY-MM
  status: 'Đã khóa' | 'Chưa khóa';
  approvedBy: string;
  approvedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  userFullName: string;
  timestamp: string; // ISO 8601
  action: string;
  details: string;
}

export type OvernightShiftAttendanceMode =
  | 'standard'
  | 'overnight_only_next_day'
  | 'overnight_half_split_if_22_to_after_2';

export interface SystemSettings {
  rationRate: number; // VND/ngày (Mặc định 75,000)
  nightShiftRate: number; // VND/lượt (Mặc định 200,000)
  departmentName: string; // Tên phòng (e.g. PHÒNG CẢNH SÁT GIAO THÔNG)
  unitName: string;       // Công an cấp trên (e.g. CÔNG AN TỈNH LÂM ĐỒNG)
  overnightShiftAttendanceMode?: OvernightShiftAttendanceMode; // Phương án tính công ca qua đêm
  symbolWork?: string;    // Ký hiệu làm việc (Mặc định 'x')
  symbolMission?: string; // Ký hiệu đi công tác (Mặc định 'Ct')
  symbolStudy?: string;   // Ký hiệu đi học tập (Mặc định 'H')
  symbolLeave?: string;   // Ký hiệu nghỉ phép (Mặc định 'P')
  symbolCompensation?: string; // Ký hiệu nghỉ bù (Mặc định 'Nb')
  symbolMaternity?: string;    // Ký hiệu nghỉ thai sản (Mặc định 'Ts')
  symbolRest?: string;         // Ký hiệu nghỉ dưỡng (Mặc định 'Nd')
  signerPreparer?: string;     // Tên người lập biểu/chấm công (Mặc định 'Thiếu tá Đào Hải Dương')
  signerCommander?: string;    // Tên chỉ huy đội (Mặc định 'Trung tá Nguyễn Khánh Tiên')
  signerLeader?: string;       // Tên lãnh đạo đơn vị/phòng (Mặc định 'Thượng tá Nguyễn Thành Phương')
  signerPreparerTitle?: string; // Chức danh hiển thị (VD: NGƯỜI CHẤM CÔNG)
  signerCommanderTitle?: string; // Chức danh hiển thị (VD: CHỈ HUY ĐỘI)
  signerCommanderSubTitle?: string; // Dòng phụ (VD: ĐỘI TRƯỞNG)
  signerLeaderTitle?: string; // Chức danh hiển thị (VD: LÃNH ĐẠO ĐƠN VỊ)
  signerLeaderActingTitle?: string; // Dòng phụ (VD: KT. TRƯỞNG PHÒNG)
  signerLeaderSubTitle?: string; // Dòng phụ (VD: PHÓ TRƯỞNG PHÒNG)
  signerLeaderSealTitle?: string; // Chức danh đóng dấu (VD: TRƯỞNG PHÒNG CSGT)
  maxNightShiftCompensationTurns?: number; // Số lượt tối đa được hưởng bồi dưỡng làm đêm
}

export type ReportTemplateId =
  | '1_bang_cham_cong'
  | '2_bang_dinh_luong'
  | '3_danh_sach_tien_dinh_luong'
  | '4_de_xuat_dinh_luong'
  | '5_bang_lam_dem'
  | '6_danh_sach_tien_lam_dem'
  | '7_de_xuat_lam_dem';

export interface ReportTemplateOverride {
  placeName?: string;
  teamName?: string;
  issuerUnitName?: string;
  recipientUnitName?: string;
  recipientLine?: string;
  dateLineTemplate?: string;
  attendanceCommitment?: string;
  rationIntro?: string;
  rationBasis?: string;
  rationConfirmation?: string;
  rationCommitment?: string;
  rationPaymentRequest?: string;
  rationApprovalRequest?: string;
  rationAttachmentNote?: string;
  nightCommitment?: string;
  nightBasis?: string;
  nightConfirmation?: string;
  nightPaymentRequest?: string;
  nightApprovalRequest?: string;
  nightAttachmentNote?: string;

  pageMarginTopMm?: number;
  pageMarginRightMm?: number;
  pageMarginBottomMm?: number;
  pageMarginLeftMm?: number;

  bodyFontPt?: number;
  lineHeight?: number;
  paragraphSpacingPt?: number;
  bodyAlign?: 'left' | 'right' | 'center' | 'justify';
  recipientAlign?: 'left' | 'right' | 'center';

  tableFontPt?: number;
  cellPaddingPx?: number;
  dayColWidthPx?: number;
  nameColWidthPx?: number;
  legendFontPt?: number;

  cellStyleOverrides?: Partial<
    Record<
      string,
      {
        fontPt?: number;
        fontFamily?: string;
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        align?: 'left' | 'center' | 'right' | 'justify';
        widthPx?: number;
        paddingPx?: number;
        lineHeight?: number;
      }
    >
  >;

  cellTextOverrides?: Partial<Record<string, string>>;
}

export type ReportTemplateOverrides = Partial<Record<ReportTemplateId, ReportTemplateOverride>>;
