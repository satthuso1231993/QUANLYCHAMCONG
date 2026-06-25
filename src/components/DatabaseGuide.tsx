import React, { useState } from 'react';
import { getSQLiteSchema } from '../utils/helpers';
import { FileText, Cpu, BookOpen, Terminal, Code, HelpCircle, HardDrive, Download, Check, Database } from 'lucide-react';

export default function DatabaseGuide() {
  const [activeTab, setActiveTab] = useState<'sql' | 'electron' | 'manual'>('sql');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const sampleMainJs = `/**
 * FILE: electron/main.js (Cấu hình chạy Electron + Cực bộ SQLite)
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let mainWindow;
let db;

// Khởi tạo SQLite tại ổ thư mục AppData của người dùng
const dbPath = path.join(app.getPath('userData'), 'database.db');

function initDatabase() {
  db = new Database(dbPath, { verbose: console.log });
  console.log('Connect to local SQLite database successfully at: ' + dbPath);
  
  // Khởi dựng schema bảng nếu chưa tồn tại
  db.exec(\`
    CREATE TABLE IF NOT EXISTS officers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      rank TEXT NOT NULL,
      position TEXT NOT NULL,
      badge_number TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      phone_number TEXT,
      status TEXT DEFAULT 'Đang công tác'
    );
    -- Thêm các bảng khác: users, teams, patrol_schedules, attendance, ration_records, night_shift_records ...
  \`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Chấm Công và Định lượng CSGT',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Trong chế độ phát triển (Development):
  if (process.env.NODE_ENV === 'dev') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Trong môi trường đóng gói (Production):
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  initDatabase();
  createWindow();
});

// IPC Handler để nhận lệnh SQL Bridge từ React Frontend
ipcMain.handle('execute-sql', async (event, { query, params = [] }) => {
  try {
    const stmt = db.prepare(query);
    if (query.trim().toLowerCase().startsWith('select')) {
      return { success: true, data: stmt.all(...params) };
    } else {
      const info = stmt.run(...params);
      return { success: true, data: info };
    }
  } catch (error) {
    console.error('SQLite execution error: ', error);
    return { success: false, error: error.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`;

  const sampleBuilderConfig = `{
  "appId": "com.csgt.timesheet",
  "productName": "QuanLyChamCongCSGT",
  "directories": {
    "output": "dist_electron"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  "win": {
    "icon": "public/icon.png",
    "target": [
      {
        "target": "nsis",
        "arch": [
          "x64",
          "ia32"
        ]
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Quản lý Chấm công CSGT",
    "installerIcon": "public/icon.png",
    "uninstallerIcon": "public/icon.png"
  }
}`;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cẩm nang Kỹ thuật & Vận hành Đóng gói</h2>
          <p className="text-sm text-slate-500 mt-1">
            Mã nguồn SQLite Schema, hướng dẫn đóng gói Electron ra file cài đặt Setup.exe dùng ngoại tuyến (Offline)
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => handleCopy(getSQLiteSchema())}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 flex items-center gap-1"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            <span>Copy SQLite Schema</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1 ${
            activeTab === 'sql' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>1. SQLite Schema DDL</span>
        </button>

        <button
          onClick={() => setActiveTab('electron')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1 ${
            activeTab === 'electron' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>2. Đóng gói Electron (Setup.exe)</span>
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1 ${
            activeTab === 'manual' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>3. Hướng dẫn Sử dụng (Cho CBCS)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-xl border border-slate-150 shadow-xs">
        
        {/* Tab 1: SQLite schema */}
        {activeTab === 'sql' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase flex items-center gap-1">
                  <Terminal className="w-4 h-4 text-slate-500" />
                  Khai báo thực thi bảng cơ sở dữ liệu quan hệ cục bộ (SQLite)
                </h4>
                <p className="text-[10px] text-slate-400 mt-1">Trình biên dịch SQL hỗ trợ tạo đầy đủ 11 bảng chuẩn theo yêu cầu nghiệp vụ.</p>
              </div>
              <button
                onClick={() => handleCopy(getSQLiteSchema())}
                className="px-3.5 py-1.5 bg-white border text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
              >
                Copy đoạn Script
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-green-400 text-xs font-mono rounded-xl overflow-x-auto max-h-[350px]">
              {getSQLiteSchema()}
            </pre>
          </div>
        )}

        {/* Tab 2: Electron Setup.exe configuration */}
        {activeTab === 'electron' && (
          <div className="space-y-6 text-xs text-slate-700 font-medium leading-relaxed">
            
            {/* Step flow */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-1">
                <Code className="w-4 h-4 text-blue-600" />
                Các bước bọc ứng dụng Web sang Desktop Chạy Offline trên Windows
              </h3>
              
              <ol className="list-decimal pl-5 space-y-4 text-slate-600">
                <li>
                  <p className="font-bold text-slate-800">Cài đặt dependencies đóng gói:</p>
                  <p className="mt-1">Trong thư mục dự án Node.js, cài đặt Electron và các công cụ bổ sung bằng cách chạy lệnh:</p>
                  <pre className="p-2.5 bg-slate-950 text-emerald-400 rounded-md font-mono mt-1.5 select-all">
                    npm install --save-dev electron electron-builder better-sqlite3
                  </pre>
                </li>

                <li>
                  <p className="font-bold text-slate-800">Tạo mã nguồn cầu nối SQLite:</p>
                  <p className="mt-1">Tạo file cấu hình khởi tạo của Electron để truy nhập driver database cục bộ ổ đĩa cứng:</p>
                  <div className="relative mt-2">
                    <button 
                      onClick={() => handleCopy(sampleMainJs)}
                      className="absolute right-2 top-2 px-2 py-1 bg-white border border-slate-300 text-[10px] uppercase font-bold text-slate-700 rounded-md hover:bg-slate-50"
                    >
                      Copy
                    </button>
                    <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg max-h-[200px] overflow-y-auto font-mono text-[11px]">
                      {sampleMainJs}
                    </pre>
                  </div>
                </li>

                <li>
                  <p className="font-bold text-slate-800">Cấu hình Đóng gói NSIS Installer (Setup.exe):</p>
                  <p className="mt-1">Tạo file cấu hình <strong className="text-slate-800 font-bold">electron-builder.json</strong> ở thư mục gốc để nén xuất tạo trình cài đặt cho Windows:</p>
                  <div className="relative mt-2">
                    <button 
                      onClick={() => handleCopy(sampleBuilderConfig)}
                      className="absolute right-2 top-2 px-2 py-1 bg-white border border-slate-300 text-[10px] uppercase font-bold text-slate-700 rounded-md hover:bg-slate-50"
                    >
                      Copy
                    </button>
                    <pre className="p-3 bg-slate-900 text-slate-250 rounded-lg max-h-[160px] overflow-y-auto font-mono text-[11px]">
                      {sampleBuilderConfig}
                    </pre>
                  </div>
                </li>

                <li>
                  <p className="font-bold text-slate-800">Chạy một lệnh duy nhất để build Setup.exe:</p>
                  <p className="mt-1">Thêm dòng lệnh khởi chạy vào mục script trong file <strong className="font-bold text-slate-800">package.json</strong>:</p>
                  <pre className="p-2.5 bg-slate-950 text-emerald-300 rounded-md font-mono mt-1.5 select-all">
                    "electron-build": "vite build && electron-builder"
                  </pre>
                  <p className="mt-1.5">Tiến hành thực hiện lệnh cuối sau để thu lượm file cài đặt hoàn tất:</p>
                  <pre className="p-2 bg-blue-950 text-white rounded-md font-mono mt-1 w-fit">
                    npm run electron-build
                  </pre>
                  <p className="mt-1">Trình đóng gói sẽ xuất ra một file cài đặt duy nhất là <strong className="text-emerald-600 font-bold">QuanLyChamCongCSGT_Setup.exe</strong> tại thư mục <strong className="font-bold">dist_electron/</strong>. CBCS chỉ cần nhấp đúp là cài đặt chạy liền lập tức.</p>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 3: Handbook / operational manual */}
        {activeTab === 'manual' && (
          <div className="space-y-6 text-xs text-slate-700 leading-relaxed font-semibold">
            <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              SÁCH HƯỚNG DẪN VẬN HÀNH CHO CÁN BỘ ĐƠN VỊ (TẦM NHÌN PHỔ THÔNG KHÔNG CNTT)
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl">
                <h4 className="font-bold uppercase text-[11px]">Nguyên lý vàng: Nhập 1 lần - Trích xuất vạn lần</h4>
                <p className="mt-1.5 text-[10.5px] leading-normal font-medium">Chiến sĩ biên thư ký không cần có hiểu biết sâu xa, chỉ cần làm đúng 01 hành vi duy nhất: <strong>Đăng ký lịch tuần tra kiểm soát</strong>. Hệ thống sẽ tự phân tích thời gian, tự so khớp chế độ, tự tính tiền ăn định lượng, trực đêm và tự vẽ báo cáo thay cho con người.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Step 1 card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-extrabold">BƯỚC 1</span>
                  <h5 className="font-bold text-slate-800 pt-1.5">Lập danh sách Cán bộ & Tổ tuần tra</h5>
                  <p className="text-[10.5px] text-slate-500 font-medium">Bổ sung họ tên lực lượng tại mục "Quản lý Cán bộ" (hoặc nút "Import Excel" để nạp hàng loạt cực nhanh). Sau đó sang "Quản lý Tổ" để nhóm các cán bộ thành Tổ công tác (Tổ thường trực Số 1, Số 2...).</p>
                </div>

                {/* Step 2 card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-extrabold">BƯỚC 2</span>
                  <h5 className="font-bold text-slate-800 pt-1.5">Đăng ký lịch tuần tra đường phố</h5>
                  <p className="text-[10.5px] text-slate-500 font-medium">Khi các Tổ công tác xuất kích thực hiện nhiệm vụ, thủ thư nhấp vào "Lập Lịch Tuần Tra", điền ngày, giờ xuất phát/kết thúc, chọn loại nhiệm vụ (ví dụ: Chuyên đề nồng độ cồn) rồi lưu "Đã ban hành".</p>
                </div>

                {/* Step 3 card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-extrabold">BƯỚC 3</span>
                  <h5 className="font-bold text-slate-800 pt-1.5">Khóa sổ tính lương & In phụ biểu</h5>
                  <p className="text-[10.5px] text-slate-500 font-medium">Cuối tháng, nhấp vào "Duyệt & Xuất Báo Cáo" sau đó bấm "Khóa sổ". Bấm vào bất kỳ biểu mẫu nào trong 7 phụ biểu (Chấm công, Nhận tiền định lượng...) để in ra giấy hoặc chuyển đổi tệp Excel nộp cấp trên.</p>
                </div>
              </div>

              {/* Troubleshooting table details */}
              <div className="space-y-2 border-t border-slate-200/50 pt-3">
                <h4 className="font-bold text-slate-800 text-xs">Các tình huống phát sinh thường gặp:</h4>
                <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium pb-2">
                  <li>
                    <strong>"Tôi muốn chấm thêm ngày nghỉ phép, ốm đau cho chiến sĩ?"</strong> $\rightarrow$ Bạn vào mục <strong>"Khai báo Làm việc/Nghỉ phép"</strong> để đăng ký tay. Ngày công này độc lập và không cộng định lượng sai lệch.
                  </li>
                  <li>
                    <strong>"Hệ thống báo lỗi Không thể sửa / Không thể xóa?"</strong> $\rightarrow$ Có nghĩa là tháng đó đã được Phê duyệt khóa cứng tài chính. Bạn hãy quay sang "Duyệt & Xuất Báo Cáo" bấm nút <strong>"Mở khóa"</strong> để điều chỉnh lại.
                  </li>
                  <li>
                    <strong>"Làm sao đổi đơn giá bồi dưỡng từ 75.000đ lên mức mới?"</strong> $\rightarrow$ Bạn vào <strong>"Cài đặt hệ thống"</strong>, gõ mức chi mới vào mục "Mức ăn định lượng" và lưu lại. Hệ thống sẽ áp dụng mức chi phí mới từ thời điểm đó.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
