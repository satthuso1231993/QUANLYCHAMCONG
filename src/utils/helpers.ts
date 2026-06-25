/**
 * Check if the patrol schedule time overlaps with the night-shift hours (22:00 to 06:00)
 * Night shift hours are 22:00 - 06:00.
 */
export function isNightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);

  const startMin = sH * 60 + sM;
  let endMin = eH * 60 + eM;

  if (endMin < startMin) {
    // Crosses midnight
    endMin += 24 * 60;
  }

  // Night shift intervals:
  // Option A: 22:00 (1320 min) to 24:00 (1440 min)
  // Option B: 00:00 (0 min) to 06:00 (360 min)
  // In our midnight-adjusted scale of [startMin, endMin]:
  // The night shift slots are:
  // Day 1 Night: [1320, 1440]
  // Day 2 Morning: [1440, 1800] (which is [0, 360] shifted by 1440)
  // Day 1 Morning (if the shift started before standard daytime and overlaps with [0, 360]): [0, 360]
  
  // We can check if the interval [startMin, endMin] overlaps with [1320, 1800]
  // (which ranges from 22:00 Day 1 to 06:00 Day 2) OR if [startMin, endMin] overlaps with [0, 360] (00:00 to 06:00 Day 1).
  
  const overlapsNightDay1ToDay2 = Math.max(startMin, 1320) < Math.min(endMin, 1800);
  const overlapsMorningDay1 = Math.max(startMin, 0) < Math.min(endMin, 360);

  return overlapsNightDay1ToDay2 || overlapsMorningDay1;
}

/**
 * Returns formatted local currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount).replace('₫', 'đồng');
}

/**
 * Convert Date from YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateDmy(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Converts numbers into Vietnamese text
 */
export function numberToVietnameseWords(number: number): string {
  if (number === 0) return 'Không đồng';

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readTriad(num: number, showZeroHundred: boolean): string {
    let hundred = Math.floor(num / 100);
    let ten = Math.floor((num % 100) / 10);
    let unit = num % 10;
    let res = '';

    if (hundred > 0 || showZeroHundred) {
      res += digits[hundred] + ' trăm ';
    }

    if (ten > 1) {
      res += digits[ten] + ' mươi ';
    } else if (ten === 1) {
      res += 'mười ';
    } else if (ten === 0 && unit > 0 && (hundred > 0 || showZeroHundred)) {
      res += 'linh ';
    }

    if (unit === 1) {
      if (ten > 1) {
        res += 'mốt';
      } else {
        res += 'một';
      }
    } else if (unit === 5) {
      if (ten > 0) {
        res += 'lăm';
      } else {
        res += 'năm';
      }
    } else if (unit > 0) {
      res += digits[unit];
    }

    return res.trim();
  }

  let text = '';
  let str = Math.abs(number).toString();
  
  // Pad the string to be a multiple of 3
  while (str.length % 3 !== 0) {
    str = '0' + str;
  }

  const triads: number[] = [];
  for (let i = 0; i < str.length; i += 3) {
    triads.push(parseInt(str.substr(i, 3), 10));
  }

  for (let i = 0; i < triads.length; i++) {
    const level = triads.length - 1 - i;
    const val = triads[i];

    if (val > 0 || level === 0) {
      const showZero = i > 0;
      const triadText = readTriad(val, showZero);
      if (triadText) {
        text += ' ' + triadText + ' ' + units[level];
      }
    }
  }

  let result = text.trim();
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);
  result = result.replace(/\s+/g, ' ');
  
  return result.trim() + ' đồng';
}

/**
 * Returns the SQLite full schema DDL
 */
export function getSQLiteSchema(): string {
  return `
-- BẢNG 1: NGƯỜI DÙNG HỆ THỐNG
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin'
);

-- BẢNG 2: CÁN BỘ CHIẾN SĨ (CBCS)
CREATE TABLE IF NOT EXISTS officers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    rank TEXT NOT NULL,
    position TEXT NOT NULL,
    badge_number TEXT NOT NULL UNIQUE, -- Số hiệu CAND
    department TEXT NOT NULL,          -- Đội công tác
    phone_number TEXT,
    status TEXT DEFAULT 'Đang công tác' -- Đang công tác, Tạm nghỉ, Chuyển công tác
);

-- BẢNG 3: TỔ TUẦN TRA KIỂM SOÁT
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    leader_id TEXT NOT NULL,
    FOREIGN KEY (leader_id) REFERENCES officers(id)
);

-- BẢNG 4: THÀNH VIÊN TỔ TUẦN TRA
CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL,
    officer_id TEXT NOT NULL,
    PRIMARY KEY (team_id, officer_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE CASCADE
);

-- BẢNG 5: LỊCH TUẦN TRA KIỂM SOÁT (BẢNG TRUNG TÂM)
CREATE TABLE IF NOT EXISTS patrol_schedules (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,          -- Định dạng YYYY-MM-DD
    start_time TEXT NOT NULL,    -- Định dạng HH:mm
    end_time TEXT NOT NULL,      -- Định dạng HH:mm
    route TEXT NOT NULL,         -- Tuyến đường tuần tra
    area TEXT NOT NULL,          -- Địa bàn kiểm soát
    topic TEXT NOT NULL,         -- Chuyên đề thực hiện
    mission_type TEXT NOT NULL,  -- Loại nhiệm vụ
    team_id TEXT NOT NULL,       -- Tổ tuần tra thực hiện
    notes TEXT,
    status TEXT DEFAULT 'Bản nháp', -- Bản nháp, Đã ban hành
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- BẢNG 6: DỮ LIỆU CHẤM CÔNG (CHI TIẾT)
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    officer_id TEXT NOT NULL,
    date TEXT NOT NULL,                -- YYYY-MM-DD
    type TEXT NOT NULL,                -- Tuần tra, Trực cơ quan, Nghỉ phép, Nghỉ ốm...
    source_schedule_id TEXT,           -- Tham chiếu đến mã lịch tuần tra (nếu tự động)
    hours REAL,
    notes TEXT,
    FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE CASCADE,
    FOREIGN KEY (source_schedule_id) REFERENCES patrol_schedules(id) ON DELETE SET NULL
);

-- BẢNG 7: DỮ LIỆU ĐỊNH LƯỢNG (PHỤ CẤP ĂN)
CREATE TABLE IF NOT EXISTS ration_records (
    id TEXT PRIMARY KEY,
    officer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    schedule_id TEXT NOT NULL,
    amount REAL NOT NULL,              -- Mức tiền áp dụng tại thời điểm tính
    FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE CASCADE,
    FOREIGN KEY (schedule_id) REFERENCES patrol_schedules(id) ON DELETE CASCADE
);

-- BẢNG 8: DỮ LIỆU LÀM ĐÊM
CREATE TABLE IF NOT EXISTS night_shift_records (
    id TEXT PRIMARY KEY,
    officer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    schedule_id TEXT NOT NULL,
    hours_count REAL DEFAULT 1,        -- Số lượt làm đêm (thường là 1)
    amount REAL NOT NULL,              -- Mức tiền làm đêm tại thời điểm tính
    FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE CASCADE,
    FOREIGN KEY (schedule_id) REFERENCES patrol_schedules(id) ON DELETE CASCADE
);

-- BẢNG 9: PHÊ DUYỆT KHÓA DỮ LIỆU THÁNG
CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    month_string TEXT UNIQUE NOT NULL, -- Định dạng YYYY-MM
    status TEXT DEFAULT 'Đã khóa',     -- Đã khóa, Chưa khóa
    approved_by TEXT NOT NULL,
    approved_at TEXT NOT NULL
);

-- BẢNG 10: NHẬT KÝ HỆ THỐNG
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    user_full_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
);

-- BẢNG 11: CẤU HÌNH HỆ THỐNG
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- CHÈN DỮ LIỆU CẤU HÌNH BAN ĐẦU
INSERT OR IGNORE INTO settings (key, value) VALUES ('ration_rate', '75000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('night_shift_rate', '200000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('department_name', 'PHÒNG CẢNH SÁT GIAO THÔNG');
INSERT OR IGNORE INTO settings (key, value) VALUES ('unit_name', 'CÔNG AN TỈNH LÂM ĐỒNG');
INSERT OR IGNORE INTO settings (key, value) VALUES ('overnight_shift_attendance_mode', 'standard');

-- CHÈN TÀI KHOẢN QUẢN TRỊ VIÊN MẶC ĐỊNH (Mật khẩu: 123456)
-- Trong thực tế chúng ta lưu mật khẩu băm, ví dụ bcrypt hay pbkdf2
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) 
VALUES ('U001', 'admin', '123456', 'Quản trị viên Hệ thống', 'admin');
`;
}
