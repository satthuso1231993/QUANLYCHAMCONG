import React, { useState } from 'react';
import { Officer, Attendance, RationRecord, NightShiftRecord, Approval, SystemSettings, PatrolSchedule, Team, ReportTemplateId, ReportTemplateOverride, ReportTemplateOverrides } from '../types';
import { formatCurrency, formatDateDmy, numberToVietnameseWords } from '../utils/helpers';
import { FileText, Lock, Unlock, Printer, Shield, Check, Calendar, HelpCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { hasOnlyOfficeConfig } from '../lib/onlyOffice';
import { getFixedPersonnelOfficers } from '../utils/personnel';
import {
  deleteTemplateOverrideFromSupabase,
  loadTemplateOverridesFromSupabase,
  saveTemplateOverrideToSupabase,
} from '../lib/supabaseData';

interface ApprovalAndReportsProps {
  officers: Officer[];
  attendance: Attendance[];
  rations: RationRecord[];
  nightShifts: NightShiftRecord[];
  approvals: Approval[];
  setApprovals: React.Dispatch<React.SetStateAction<Approval[]>>;
  settings: SystemSettings;
  addLog: (action: string, details: string) => void;
  currentUser: { id: string; fullName: string; username: string };
  schedules?: PatrolSchedule[];
  teams?: Team[];
}

type ReportType = ReportTemplateId;
const OnlyOfficeEditorModal = React.lazy(() => import('./OnlyOfficeEditorModal'));

export default function ApprovalAndReports({
  officers,
  attendance,
  rations,
  nightShifts,
  approvals,
  setApprovals,
  settings,
  addLog,
  currentUser,
  schedules = [],
  teams = [],
}: ApprovalAndReportsProps) {
  const reportDefinitions: { type: ReportType; label: string }[] = [
    { type: '1_bang_cham_cong', label: '1. Bảng chấm công tháng' },
    { type: '2_bang_dinh_luong', label: '2. Bảng định lượng tuần tra (Mẫu 02)' },
    { type: '3_danh_sach_tien_dinh_luong', label: '3. DS nhận tiền định lượng' },
    { type: '4_de_xuat_dinh_luong', label: '4. Đề xuất thanh toán ĐL' },
    { type: '5_bang_lam_dem', label: '5. Bảng chấm công làm đêm (Mẫu 05)' },
    { type: '6_danh_sach_tien_lam_dem', label: '6. DS nhận tiền làm đêm' },
    { type: '7_de_xuat_lam_dem', label: '7. Đề xuất thanh toán trực đêm' },
  ];
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-06'); // default June 2026

  const unitName = settings.unitName || 'CÔNG AN TỈNH';
  const departmentName = settings.departmentName || 'PHÒNG CẢNH SÁT GIAO THÔNG';

  const sPreparer = settings.signerPreparer || 'Thiếu tá Đào Hải Dương';
  const sCommander = settings.signerCommander || 'Trung tá Nguyễn Khánh Tiên';
  const sLeader = settings.signerLeader || 'Thượng tá Nguyễn Thành Phương';
  const signerPreparerTitle = settings.signerPreparerTitle || 'NGƯỜI CHẤM CÔNG';
  const signerCommanderTitle = settings.signerCommanderTitle || 'CHỈ HUY ĐỘI';
  const signerCommanderSubTitle = settings.signerCommanderSubTitle || 'ĐỘI TRƯỞNG';
  const signerLeaderTitle = settings.signerLeaderTitle || 'LÃNH ĐẠO ĐƠN VỊ';
  const signerLeaderActingTitle = settings.signerLeaderActingTitle || 'KT. TRƯỞNG PHÒNG';
  const signerLeaderSubTitle = settings.signerLeaderSubTitle || 'PHÓ TRƯỞNG PHÒNG';
  const signerLeaderSealTitle = settings.signerLeaderSealTitle || `TRƯỞNG ${departmentName}`;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const renderTemplate = (template: string, vars: Record<string, string | number>) => {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
  };
  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  const renderTemplateHtml = (template: string, vars: Record<string, string | number>) => {
    return escapeHtml(renderTemplate(template, vars)).replace(/\n/g, '<br/>');
  };
  const renderMultiline = (value: string) => {
    const lines = value.split('\n');
    return (
      <>
        {lines.map((line, idx) => (
          <React.Fragment key={idx}>
            {line}
            {idx < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </>
    );
  };

  const defaultTemplate: ReportTemplateOverride = {
    placeName: 'Đắk Lắk',
    teamName: 'Đội CSGT-ĐB Số 4',
    issuerUnitName: 'Phòng PC08',
    recipientUnitName: 'Phòng PH10',
    recipientLine: 'Kính gửi: Lãnh đạo Phòng PH10.',
    dateLineTemplate: '{place}, ngày ... tháng {month} năm {year}',
    attendanceCommitment: '(Đơn vị cam kết Bảng chấm công đúng với số nhật ký công tác của từng CBCS)',
    rationIntro: '{issuer} lập danh sách đề nghị hưởng tiền ăn định lượng tháng {mm}/{year} cho CBCS {team}. Đơn vị cam kết đúng với sổ nhật ký công tác của CBCS.',
    rationBasis: 'Căn cứ Công văn số 57/BCA-H01 ngày 01/07/2025 của Bộ Công an về việc điều chỉnh một số mức tiền ăn của CBCS trong CAND; {issuer} lập danh sách CBCS được hưởng tiền ăn định lượng trong tháng {mm}/{year} như sau:',
    rationConfirmation: 'Việc chấm công tiền ăn định lượng được {team} xác nhận là đảm bảo phù hợp với Kế hoạch công tác, Sổ kế hoạch và nhật ký tuần tra kiểm soát. Đội Tham mưu đã kiểm tra đối chiếu phù hợp với Bảng chấm công của đơn vị.',
    rationCommitment: 'Đơn vị cam kết Bảng chấm công CBCS hưởng tiền ăn định lượng đúng với sổ nhật ký công tác và thời gian thực hiện nhiệm vụ được hưởng tiền ăn định lượng của từng CBCS.',
    rationPaymentRequest: '{issuer} đề nghị {recipient} chi thanh toán theo quy định. Đơn vị chịu trách nhiệm chi trả đầy đủ cho cán bộ chiến sỹ ( danh sách cấp phát lưu tại đơn vị )./.',
    rationApprovalRequest: '{issuer} đề xuất lãnh đạo {recipient} duyệt và cho thanh toán số tiền trên theo quy định. Đơn vị chịu trách nhiệm chi trả đầy đủ cho CBCS./.',
    rationAttachmentNote: '(Có bảng chấm công định lượng kèm theo).',
    nightCommitment: 'Đơn vị cam kết Bảng chấm công CBCS được hưởng tiền bồi dưỡng khi thực hiện TTKS vào ban đêm đúng với Số nhật ký công tác và thời gian thực',
    nightBasis:
      'Căn cứ Nghị định số 176/2024/NĐ-CP ngày 30/12/2024 của Chính phủ quy định quản lý, sử dụng kinh phí thu từ xử phạt VPHC về Trật tự, an toàn giao thông đường bộ và đấu giá biển số xe sau khi nộp ngân sách Nhà nước.\nCăn cứ vào Kế hoạch công tác, Sổ kế hoạch và nhật ký tuần tra kiểm soát của {team} (lưu tại {team}).\nĐể đảm bảo chế độ chính sách cho CBCS làm nhiệm vụ giữ gìn trật tự ATGT trên địa bàn tỉnh {place}; {issuer} lập danh sách đề nghị thanh toán tiền bồi dưỡng tuần tra ban đêm tháng {month}/{year} cho CBCS {team}. Đơn vị cam kết đúng với nội dung Sổ nhật ký công tác của CBCS.',
    nightConfirmation:
      'Việc chấm công tuần tra ban đêm được {team} xác nhận là đảm bảo phù hợp với Kế hoạch công tác, Sổ kế hoạch và nhật ký tuần tra kiểm soát, Đội Tham mưu đã kiểm tra đối chiếu phù hợp với Bảng chấm công của đơn vị.',
    nightPaymentRequest:
      '{issuer} đề nghị {recipient} chi bồi dưỡng cho cán bộ chiến sỹ {team} theo đúng quy định. Đơn vị chịu trách nhiệm chi trả đầy đủ cho cán bộ chiến sỹ (Danh sách cấp phát thực tế lưu tại đơn vị)./.',
    nightApprovalRequest:
      '{issuer} đề xuất lãnh đạo {recipient} duyệt và cho thanh toán số tiền trên theo quy định. Đơn vị chịu trách nhiệm chi trả đầy đủ cho CBCS./.',
    nightAttachmentNote: '(Kèm theo bảng chấm công giờ làm đêm)',

    pageMarginTopMm: 20,
    pageMarginRightMm: 20,
    pageMarginBottomMm: 20,
    pageMarginLeftMm: 30,

    bodyFontPt: 14,
    lineHeight: 1.15,
    paragraphSpacingPt: 6,
    bodyAlign: 'justify',
    recipientAlign: 'center',

    tableFontPt: 14,
    cellPaddingPx: 2,
    dayColWidthPx: 20,
    nameColWidthPx: 150,
    legendFontPt: 14,
  };

  const [templateOverrides, setTemplateOverrides] = useState<ReportTemplateOverrides>({});
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [templateCloudError, setTemplateCloudError] = useState<string | null>(null);

  const isOfficerScheduled = (officerId: string, dateStr: string): boolean => {
    if (!schedules) return false;
    const daySchedules = schedules.filter(s => s.date === dateStr);
    if (daySchedules.length === 0) return false;

    return daySchedules.some(sched => {
      if (sched.customOfficerIds && sched.customOfficerIds.length > 0) {
        return sched.customOfficerIds.includes(officerId);
      }
      if (!teams) return false;
      const team = teams.find(t => t.id === sched.teamId);
      return team ? team.memberIds.includes(officerId) : false;
    });
  };
  const [activeReport, setActiveReport] = useState<ReportType>('1_bang_cham_cong');
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'word' | 'pdf'>('word');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editTab, setEditTab] = useState<'content' | 'table' | 'wordEmbed'>('content');
  const [selectedCellKey, setSelectedCellKey] = useState<string>('');
  const exportEditorIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const previewViewportRef = React.useRef<HTMLDivElement | null>(null);
  const editorViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [previewViewportWidth, setPreviewViewportWidth] = useState<number>(0);
  const [editorViewportWidth, setEditorViewportWidth] = useState<number>(0);
  const currentTemplate: ReportTemplateOverride = {
    ...defaultTemplate,
    ...(templateOverrides[activeReport] || {}),
  };
  const [draftTemplate, setDraftTemplate] = useState<ReportTemplateOverride>(currentTemplate);
  const hasCustomTemplate = Boolean(templateOverrides[activeReport]);
  const template = isEditingTemplate ? draftTemplate : currentTemplate;
  const activeReportLabel = reportDefinitions.find((item) => item.type === activeReport)?.label || activeReport;
  const orderedOfficers = React.useMemo(() => getFixedPersonnelOfficers(officers), [officers]);
  const sPaternityLeave = settings.symbolPaternityLeave || 'NVS';

  const resolveAttendanceSymbol = (att: Attendance | undefined, isScheduled: boolean) => {
    if (att) {
      if (att.type === 'Làm việc') return { symbol: settings.symbolWork || 'x', countsAsWork: true };
      if (att.type === 'Công tác') return { symbol: settings.symbolMission || 'Ct', countsAsWork: true };
      if (att.type === 'Học tập') return { symbol: settings.symbolStudy || 'H', countsAsWork: true };
      if (att.type === 'Nghỉ phép') return { symbol: settings.symbolLeave || 'P', countsAsWork: false };
      if (att.type === 'Nghỉ vợ sinh') return { symbol: sPaternityLeave, countsAsWork: false };
      if (att.type === 'Nghỉ bù') return { symbol: settings.symbolCompensation || 'Nb', countsAsWork: false };
      if (att.type === 'Nghỉ sinh') return { symbol: settings.symbolMaternity || 'Ts', countsAsWork: false };
      if (att.type === 'Nghỉ dưỡng') return { symbol: settings.symbolRest || 'Nd', countsAsWork: false };
    }

    if (isScheduled) {
      return { symbol: settings.symbolWork || 'x', countsAsWork: true };
    }

    return { symbol: '', countsAsWork: false };
  };

  const EditableText = ({
    value,
    onChange,
    multiline = false,
    className = '',
    inputClassName = '',
  }: {
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
    className?: string;
    inputClassName?: string;
  }) => {
    if (!isEditingTemplate) {
      return <span className={className}>{multiline ? renderMultiline(value) : value}</span>;
    }
    if (multiline) {
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      );
    }
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
      />
    );
  };

  const updateDraft = (patch: Partial<ReportTemplateOverride>) => {
    setDraftTemplate(prev => ({ ...prev, ...patch }));
  };

  const updateSelectedCellStyle = (patch: {
    fontPt?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    textColor?: string;
    widthPx?: number;
    paddingPx?: number;
    lineHeight?: number;
  }) => {
    if (!selectedCellKey) return;
    setDraftTemplate(prev => {
      const prevMap = prev.cellStyleOverrides || {};
      const prevCell = prevMap[selectedCellKey] || {};
      return { ...prev, cellStyleOverrides: { ...prevMap, [selectedCellKey]: { ...prevCell, ...patch } } };
    });
  };

  const clearSelectedCellStyle = () => {
    if (!selectedCellKey) return;
    setDraftTemplate(prev => {
      const prevMap = prev.cellStyleOverrides || {};
      if (!prevMap[selectedCellKey]) return prev;
      const nextMap = { ...prevMap };
      delete (nextMap as any)[selectedCellKey];
      return { ...prev, cellStyleOverrides: nextMap };
    });
  };

  const clearSelectedCellText = () => {
    if (!selectedCellKey || isLockedCellKey(selectedCellKey)) return;
    setDraftTemplate(prev => {
      const prevMap = prev.cellTextOverrides || {};
      if (!Object.prototype.hasOwnProperty.call(prevMap, selectedCellKey)) return prev;
      const nextMap = { ...prevMap };
      delete (nextMap as any)[selectedCellKey];
      return { ...prev, cellTextOverrides: nextMap };
    });
  };

  const isLockedCellKey = (key: string) => {
    return key.startsWith('b1_day_') || key.startsWith('b2_day_') || key.startsWith('b5_day_');
  };

  const buildTemplateVars = (month: number, year: number) => {
    return {
      place: template.placeName || defaultTemplate.placeName || '',
      month,
      year,
      mm: pad2(month),
      team: template.teamName || defaultTemplate.teamName || '',
      issuer: template.issuerUnitName || defaultTemplate.issuerUnitName || '',
      recipient: template.recipientUnitName || defaultTemplate.recipientUnitName || '',
    };
  };

  const EditableTemplateText = ({
    value,
    onChange,
    vars,
    multiline = false,
    className = '',
    inputClassName = '',
  }: {
    value: string;
    onChange: (value: string) => void;
    vars: Record<string, string | number>;
    multiline?: boolean;
    className?: string;
    inputClassName?: string;
  }) => {
    if (isEditingTemplate) {
      return (
        <EditableText
          value={value}
          onChange={onChange}
          multiline={multiline}
          inputClassName={inputClassName}
        />
      );
    }
    const rendered = renderTemplate(value, vars);
    return <span className={className}>{multiline ? renderMultiline(rendered) : rendered}</span>;
  };

  const refreshTemplateOverrides = React.useCallback(async () => {
    if (!currentUser.id) {
      setTemplateOverrides({});
      setTemplateCloudError('Không xác định được tài khoản để tải mẫu biểu cá nhân.');
      setIsTemplateLoading(false);
      return;
    }
    setIsTemplateLoading(true);
    try {
      const next = await loadTemplateOverridesFromSupabase(currentUser.id);
      setTemplateOverrides(next);
      setTemplateCloudError(null);
    } catch (error) {
      console.error('Supabase template overrides load error:', error);
      setTemplateCloudError('Không tải được mẫu biểu cá nhân từ Supabase.');
    } finally {
      setIsTemplateLoading(false);
    }
  }, [currentUser.id]);

  const handleStartEditTemplate = () => {
    setDraftTemplate(currentTemplate);
    setIsEditingTemplate(true);
    setEditTab('content');
    setSelectedCellKey('');
  };

  const handleCancelEditTemplate = () => {
    setDraftTemplate(currentTemplate);
    setIsEditingTemplate(false);
    setEditTab('content');
    setSelectedCellKey('');
  };

  const handleSaveTemplate = async () => {
    if (!currentUser.id) {
      setTemplateCloudError('Không xác định được tài khoản để lưu mẫu biểu.');
      return;
    }
    setIsSavingTemplate(true);
    try {
      await saveTemplateOverrideToSupabase(currentUser.id, activeReport, draftTemplate);
      setTemplateOverrides((prev) => ({ ...prev, [activeReport]: draftTemplate }));
      setTemplateCloudError(null);
      setIsEditingTemplate(false);
      setEditTab('content');
      setSelectedCellKey('');
      addLog('Lưu mẫu báo cáo', `Đã lưu mẫu tùy chỉnh cho biểu ${activeReport} của tài khoản ${currentUser.username}.`);
    } catch (error) {
      console.error('Supabase template override save error:', error);
      setTemplateCloudError('Không lưu được mẫu biểu cá nhân lên Supabase.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!currentUser.id) {
      setTemplateCloudError('Không xác định được tài khoản để đặt lại mẫu biểu.');
      return;
    }
    setIsSavingTemplate(true);
    try {
      await deleteTemplateOverrideFromSupabase(currentUser.id, activeReport);
      setTemplateOverrides((prev) => {
        const next = { ...prev };
        delete next[activeReport];
        return next;
      });
      setDraftTemplate({ ...defaultTemplate });
      setTemplateCloudError(null);
      setIsEditingTemplate(false);
      setEditTab('content');
      setSelectedCellKey('');
      addLog('Khôi phục mẫu mặc định', `Đã khôi phục mẫu mặc định cho biểu ${activeReport} của tài khoản ${currentUser.username}.`);
    } catch (error) {
      console.error('Supabase template override reset error:', error);
      setTemplateCloudError('Không đặt lại được mẫu biểu cá nhân trên Supabase.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  React.useEffect(() => {
    void refreshTemplateOverrides();
  }, [refreshTemplateOverrides]);

  React.useEffect(() => {
    if (!supabase || !currentUser.id) return;
    const channel = supabase
      .channel(`template-overrides-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_template_overrides',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          void refreshTemplateOverrides();
        },
      );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser.id, refreshTemplateOverrides]);

  React.useEffect(() => {
    if (!isEditingTemplate) {
      setDraftTemplate(currentTemplate);
    }
    setExportError(null);
    setIsExporting(false);
  }, [activeReport, isEditingTemplate, templateOverrides]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as any;
      if (!data || typeof data.type !== 'string') return;
      if (data.type === 'selectCell') {
        const nextKey = typeof data.key === 'string' ? data.key : '';
        setSelectedCellKey(nextKey);
        return;
      }
      if (data.type === 'editCellText') {
        const key = typeof data.key === 'string' ? data.key : '';
        const html = typeof data.html === 'string' ? data.html : '';
        if (!key || isLockedCellKey(key)) return;
        setDraftTemplate(prev => {
          const prevMap = prev.cellTextOverrides || {};
          const nextMap = { ...prevMap, [key]: html };
          return { ...prev, cellTextOverrides: nextMap };
        });
        return;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isEditingTemplate]);
  const getReportOrientation = (report: ReportType): 'portrait' | 'landscape' => {
    if (report === '1_bang_cham_cong' || report === '2_bang_dinh_luong' || report === '5_bang_lam_dem') {
      return 'landscape';
    }
    return 'portrait';
  };
  const getActiveOrientation = () => getReportOrientation(activeReport);

  // Inject print styles dynamically
  React.useEffect(() => {
    const styleId = 'print-orientation-style';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    const pageSize = getActiveOrientation() === 'landscape' ? 'A4 landscape' : 'A4 portrait';
    style.innerHTML = `
      @media print {
        @page {
          size: ${pageSize};
          margin: 20mm 20mm 20mm 30mm;
        }
        html, body {
          height: auto !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          margin: 0 !important;
          font-family: 'Times New Roman', serif !important;
          font-size: 14pt !important;
          line-height: 1.15 !important;
          color: #000 !important;
          background: #fff !important;
        }
        #print-area, #print-area * {
          color: #000 !important;
        }
        body * {
          visibility: hidden !important;
        }
        #print-area, #print-area * {
          visibility: visible !important;
        }
        #print-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        #print-area table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          font-family: 'Times New Roman', serif !important;
          font-size: 14pt !important;
          min-width: 0 !important;
        }
        #print-area th, #print-area td {
          padding: 2px 3px !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          vertical-align: top !important;
        }
        #print-area tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        #print-area .print-keep, #print-area .print-keep * {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        #print-area h2 { font-size: 14pt !important; margin: 0 !important; }
        #print-area h3 { font-size: 13pt !important; margin: 0 !important; }
        #print-area p, #print-area span, #print-area div { font-size: 14pt !important; }
        #print-area [class*="min-w-"] { min-width: 0 !important; }
        #print-area [class*="mt-16"] { margin-top: 24px !important; }
        #print-area [class*="mt-13"] { margin-top: 18px !important; }
        #print-area [class*="mt-12"] { margin-top: 20px !important; }
        #print-area [class*="mt-8"] { margin-top: 14px !important; }
        #print-area [class*="h-20"] { height: 32px !important; }
        #print-area [class*="h-14"] { height: 22px !important; }
      }
    `;
    return () => {
      // Keep style stable
    };
  }, [activeReport]);

  const monthParts = selectedMonth.split('-');
  const displayMonthYear = monthParts.length === 2 ? `Tháng ${monthParts[1]} năm ${monthParts[0]}` : selectedMonth;
  const shortMonthYear = monthParts.length === 2 ? `${monthParts[1]}/${monthParts[0]}` : selectedMonth;

  // Filter local records for active month
  const activeAttendance = React.useMemo(() => attendance.filter(a => a.date.startsWith(selectedMonth)), [attendance, selectedMonth]);
  const activeRations = React.useMemo(() => rations.filter(r => r.date.startsWith(selectedMonth)), [rations, selectedMonth]);
  const activeNightShifts = React.useMemo(() => nightShifts.filter(n => n.date.startsWith(selectedMonth)), [nightShifts, selectedMonth]);

  const buildExportHtml = (docType: 'word', options?: { forPrint?: boolean }) => {
    const forPrint = Boolean(options?.forPrint);
    const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
    const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '06';
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const templateVars = {
      place: template.placeName || defaultTemplate.placeName || '',
      month,
      year,
      mm: pad2(month),
      team: template.teamName || defaultTemplate.teamName || '',
      issuer: template.issuerUnitName || defaultTemplate.issuerUnitName || '',
      recipient: template.recipientUnitName || defaultTemplate.recipientUnitName || '',
    };

    const cellStyleCss = (key: string) => {
      const override = template.cellStyleOverrides?.[key];
      if (!override) return '';
      const parts: string[] = [];
      if (typeof override.fontPt === 'number') parts.push(`font-size:${override.fontPt}pt !important`);
      if (typeof override.fontFamily === 'string' && override.fontFamily.trim()) parts.push(`font-family:${override.fontFamily} !important`);
      if (typeof override.bold === 'boolean') parts.push(`font-weight:${override.bold ? 'bold' : 'normal'} !important`);
      if (typeof override.italic === 'boolean') parts.push(`font-style:${override.italic ? 'italic' : 'normal'} !important`);
      if (typeof override.underline === 'boolean') parts.push(`text-decoration:${override.underline ? 'underline' : 'none'} !important`);
      if (override.align) parts.push(`text-align:${override.align} !important`);
      if (typeof override.textColor === 'string' && override.textColor.trim()) parts.push(`color:${override.textColor} !important`);
      if (typeof override.widthPx === 'number') parts.push(`width:${override.widthPx}px !important`);
      if (typeof override.paddingPx === 'number') parts.push(`padding:${override.paddingPx}px !important`);
      if (typeof override.lineHeight === 'number') parts.push(`line-height:${override.lineHeight} !important`);
      return parts.length ? `${parts.join(';')};` : '';
    };

    const cellKeyAttr = (key: string) => `data-cellkey="${key}"`;

    const cellTextHtml = (key: string, defaultHtml: string) => {
      if (!key || isLockedCellKey(key)) return defaultHtml;
      const map = template.cellTextOverrides || {};
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        const value = map[key];
        return typeof value === 'string' ? value : defaultHtml;
      }
      return defaultHtml;
    };

    const noWrapHtml = (value: string) => escapeHtml(value).replace(/ /g, '&nbsp;');

    const renderHeaderUnderline = (variant: 'cqbh' | 'tn', key: string, defaultHtml: string) => {
      const textClass = variant === 'cqbh' ? 'cqbh-text' : 'tn-text';
      const lineClass = variant === 'cqbh' ? 'rule-underline-cqbh' : 'rule-underline-tn';
      const content = cellTextHtml(key, defaultHtml);
      const style = cellStyleCss(key);
      const inlineTextStyle =
        variant === 'cqbh'
          ? `font-size:14pt;font-weight:bold;text-transform:uppercase;white-space:nowrap;${style}`
          : `font-size:13pt;font-weight:bold;white-space:nowrap;${style}`;
      return `<table class="rule-wrap" align="center" style="border-collapse:collapse;border:none;width:auto;margin:0 auto;display:inline-table;"><tr style="border:none;"><td class="rule-text-cell" ${cellKeyAttr(key)}><span class="${textClass}" style="${inlineTextStyle}">${content}</span></td></tr><tr style="border:none;"><td class="rule-line-cell ${lineClass}">&nbsp;</td></tr></table>`;
    };

    const renderSignatureBlock = (
      columns: Array<{
        titleKey: string;
        titleHtml: string;
        nameKey: string;
        nameHtml: string;
        nameFontPt?: number;
      }>,
      options?: {
        marginTopPx?: number;
        spacePx?: number;
        gapWidthPercent?: number;
        colWidthsPercent?: number[];
      },
    ) => {
      const marginTopPx = options?.marginTopPx ?? 20;
      const spacePx = options?.spacePx ?? sigSpace75;
      const gapWidth = options?.gapWidthPercent ?? (columns.length === 2 ? 10 : 2);
      const defaultColWidth = columns.length === 2 ? 45 : 32;
      const colWidths = options?.colWidthsPercent && options.colWidthsPercent.length === columns.length
        ? options.colWidthsPercent
        : columns.map(() => defaultColWidth);
      const totalCells = columns.length * 2 - 1;

      const titleRow = columns
        .map((column, index) => {
          const gapCell = index < columns.length - 1 ? `<td class="sig-gap" style="width: ${gapWidth}%;"></td>` : '';
          const colWidth = colWidths[index] ?? defaultColWidth;
          return `<td class="sig-title" ${cellKeyAttr(column.titleKey)} style="border: none; width: ${colWidth}%; padding: 0; ${cellStyleCss(column.titleKey)}">${cellTextHtml(column.titleKey, column.titleHtml)}</td>${gapCell}`;
        })
        .join('');

      const nameRow = columns
        .map((column, index) => {
          const gapCell = index < columns.length - 1 ? `<td class="sig-gap" style="width: ${gapWidth}%;"></td>` : '';
          const fontPt = column.nameFontPt ?? 14;
          const colWidth = colWidths[index] ?? defaultColWidth;
          return `<td class="sig-name" ${cellKeyAttr(column.nameKey)} style="border: none; width: ${colWidth}%; padding: 0; font-size: ${fontPt}pt !important; ${cellStyleCss(column.nameKey)}">${cellTextHtml(column.nameKey, column.nameHtml)}</td>${gapCell}`;
        })
        .join('');

      return `
      <table class="sig-block" style="width: 100%; border: none; margin-top: ${marginTopPx}px; font-family: 'Times New Roman'; table-layout: fixed;">
        <tr style="border: none;">${titleRow}</tr>
        <tr style="border: none; height: ${spacePx}px; mso-height-rule: exactly; line-height: 1.0;"><td colspan="${totalCells}" style="border: none; height: ${spacePx}px; mso-height-rule: exactly; line-height: 1.0;"></td></tr>
        <tr style="border: none;">${nameRow}</tr>
      </table>`;
    };

    const renderAdminHeader = (options: {
      totalCols: number;
      leftCols: number;
      centerCols: number;
      rightCols: number;
      titleRowsHtml: string;
      includeDateLine?: boolean;
      marginBottomPx?: number;
    }) => {
      const dateLineHtml = cellTextHtml(
        'hdr_dateline',
        renderTemplateHtml(template.dateLineTemplate || defaultTemplate.dateLineTemplate || '', templateVars),
      );
      return `
      <table class="admin-hdr" style="width: 100%; border: none; margin-bottom: ${options.marginBottomPx ?? 20}px; font-family: 'Times New Roman'; table-layout: fixed;">
        <tr style="border: none;">
          <td colspan="${options.leftCols}" style="border: none; text-align: center; font-weight: bold; vertical-align: top; width: 48%;">
            <span class="cqql" ${cellKeyAttr('hdr_cqql')} style="${cellStyleCss('hdr_cqql')}">${cellTextHtml('hdr_cqql', noWrapHtml(unitName.toUpperCase()))}</span>
            ${renderHeaderUnderline('cqbh', 'hdr_cqbh', noWrapHtml(departmentName.toUpperCase()))}
          </td>
          <td colspan="${options.centerCols}" style="border: none; width: 4%;"></td>
          <td colspan="${options.rightCols}" style="border: none; text-align: center; font-weight: bold; vertical-align: top; width: 48%;">
            <span class="qh" ${cellKeyAttr('hdr_qh')} style="${cellStyleCss('hdr_qh')}">${cellTextHtml('hdr_qh', noWrapHtml('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'))}</span>
            ${renderHeaderUnderline('tn', 'hdr_tn', noWrapHtml('Độc lập - Tự do - Hạnh phúc'))}
            ${options.includeDateLine === false ? '' : `<span class="dateline" ${cellKeyAttr('hdr_dateline')} style="${cellStyleCss('hdr_dateline')}">${dateLineHtml}</span>`}
          </td>
        </tr>
        ${options.titleRowsHtml}
      </table>`;
    };

    const isSunday = (day: number) => {
      const d = new Date(year, month - 1, day);
      return d.getDay() === 0;
    };

    const sPreparer = settings.signerPreparer || 'Thiếu tá Đào Hải Dương';
    const sCommander = settings.signerCommander || 'Trung tá Nguyễn Khánh Tiên';
    const sLeader = settings.signerLeader || 'Thượng tá Nguyễn Thành Phương';
    const sigSpace60 = docType === 'word' ? 54 : 60;
    const sigSpace75 = docType === 'word' ? 66 : 75;
    const sigSpace80 = docType === 'word' ? 76 : 80;

    const clampNumber = (value: number, min: number, max: number) => {
      if (Number.isNaN(value)) return min;
      return Math.min(max, Math.max(min, value));
    };

    const isLandscape = getActiveOrientation() === 'landscape';
    const pageSize = isLandscape ? 'A4 landscape' : 'A4 portrait';
    const marginTopMm = clampNumber(Number(template.pageMarginTopMm ?? defaultTemplate.pageMarginTopMm ?? 20), 15, 35);
    const marginRightMm = clampNumber(Number(template.pageMarginRightMm ?? defaultTemplate.pageMarginRightMm ?? 20), 15, 25);
    const marginBottomMm = clampNumber(Number(template.pageMarginBottomMm ?? defaultTemplate.pageMarginBottomMm ?? 20), 15, 35);
    const marginLeftMm = clampNumber(Number(template.pageMarginLeftMm ?? defaultTemplate.pageMarginLeftMm ?? 30), 25, 35);
    const pageMargin = `${marginTopMm}mm ${marginRightMm}mm ${marginBottomMm}mm ${marginLeftMm}mm`;
    const paperWidthMm = isLandscape ? 297 : 210;
    const paperHeightMm = isLandscape ? 210 : 297;

    const bodyFontPt = clampNumber(Number(template.bodyFontPt ?? defaultTemplate.bodyFontPt ?? 14), 12, 16);
    const lineHeight = clampNumber(Number(template.lineHeight ?? defaultTemplate.lineHeight ?? 1.15), 1, 1.8);
    const paragraphSpacingPt = clampNumber(Number(template.paragraphSpacingPt ?? defaultTemplate.paragraphSpacingPt ?? 6), 0, 18);
    const bodyAlign = (template.bodyAlign ?? defaultTemplate.bodyAlign ?? 'justify') as
      | 'left'
      | 'right'
      | 'center'
      | 'justify';
    const recipientAlign = (template.recipientAlign ?? defaultTemplate.recipientAlign ?? 'center') as
      | 'left'
      | 'right'
      | 'center';

    const tableFontPt = clampNumber(Number(template.tableFontPt ?? defaultTemplate.tableFontPt ?? 14), 10, 14);
    const cellPaddingPx = clampNumber(Number(template.cellPaddingPx ?? defaultTemplate.cellPaddingPx ?? 2), 0, 6);
    const dayColWidthPx = clampNumber(Number(template.dayColWidthPx ?? defaultTemplate.dayColWidthPx ?? 20), 14, 28);
    const nameColWidthPx = clampNumber(Number(template.nameColWidthPx ?? defaultTemplate.nameColWidthPx ?? 150), 100, 240);
    const legendFontPt = clampNumber(Number(template.legendFontPt ?? defaultTemplate.legendFontPt ?? 14), 10, 14);

    const wordPageWidthPt = isLandscape ? 841.9 : 595.3;
    const wordPageHeightPt = isLandscape ? 595.3 : 841.9;
    const mmToPt = (mm: number) => mm * 2.834645669;
    const wordMarginTopPt = Number(mmToPt(marginTopMm).toFixed(1));
    const wordMarginRightPt = Number(mmToPt(marginRightMm).toFixed(1));
    const wordMarginBottomPt = Number(mmToPt(marginBottomMm).toFixed(1));
    const wordMarginLeftPt = Number(mmToPt(marginLeftMm).toFixed(1));

    const htmlHeader =
      forPrint
        ? `\ufeff<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${pageSize}; margin: ${pageMargin}; }
  body { margin: 0; }
`
        : `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: ${wordPageWidthPt}pt ${wordPageHeightPt}pt;
    margin: ${wordMarginTopPt}pt ${wordMarginRightPt}pt ${wordMarginBottomPt}pt ${wordMarginLeftPt}pt;
    mso-page-orientation: ${isLandscape ? 'landscape' : 'portrait'};
    mso-first-header: h0;
    mso-header: h1;
  }
  div.Section1 { page: Section1; }
  body { margin: 0; }
`;

    let htmlContent = `${htmlHeader}
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  body {
    font-family: 'Times New Roman', serif;
    color: #000000;
  }
  .doc-shell {
    width: 100%;
    box-sizing: border-box;
  }
  .doc-page {
    width: 100%;
    box-sizing: border-box;
    background: #ffffff;
  }
  @media screen {
    .doc-page {
      width: ${paperWidthMm}mm;
      min-height: ${paperHeightMm}mm;
      padding: ${pageMargin};
      margin: 0 auto;
    }
  }
  @media print {
    .doc-page {
      width: auto !important;
      min-height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  }
  table { 
    border-collapse: collapse; 
    font-family: 'Times New Roman', serif; 
  }
  table { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
  td, th { 
    border: 0.5pt solid #52525b; 
    padding: 6px; 
    text-align: center; 
    font-size: 14pt;
    font-weight: normal;
  }
  .admin-hdr,
  .admin-hdr > tr,
  .admin-hdr > tbody > tr,
  .admin-hdr > tr > td,
  .admin-hdr > tbody > tr > td {
    border: none !important;
  }
  .admin-hdr > tr > td,
  .admin-hdr > tbody > tr > td {
    padding: 0 !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
    vertical-align: top !important;
  }
  .admin-hdr .qh,
  .admin-hdr .cqql,
  .admin-hdr .cqbh-text,
  .admin-hdr .tn-text {
    word-break: keep-all !important;
    overflow-wrap: normal !important;
  }
  .admin-hdr br {
    display: none !important;
  }
  #h0, #h1 { mso-element: header; }
  .pagenum { 
    font-family: 'Times New Roman', serif !important;
    font-size: 13pt !important;
    font-style: normal !important;
    font-weight: normal !important;
    text-align: center !important;
    margin: 0 !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .doc14 { 
    font-family: 'Times New Roman', serif !important;
    font-size: ${bodyFontPt}pt !important;
    line-height: ${lineHeight} !important;
    text-align: ${bodyAlign} !important;
    color: #000000 !important;
  }
  .doc14 * { color: #000000 !important; }
  .doc14 td, .doc14 th { 
    font-family: 'Times New Roman', serif !important;
    font-size: ${bodyFontPt}pt !important;
    line-height: ${lineHeight} !important;
  }
  .doc14 p { margin: 0 0 ${paragraphSpacingPt}pt 0 !important; }
  .line0 { margin: 0 !important; line-height: 1.0 !important; mso-line-height-rule: exactly !important; }
  .qh { display: block !important; font-size: 12pt !important; font-weight: bold !important; text-transform: uppercase !important; white-space: nowrap !important; line-height: 1.0 !important; margin: 0 !important; mso-line-height-rule: exactly !important; }
  .tn-wrap { display: inline-block !important; text-align: center !important; }
  .tn-text { display: inline-block !important; font-size: 13pt !important; font-weight: bold !important; white-space: nowrap !important; }
  .tn-line { display: block !important; border-top: 0.5pt solid #000000 !important; margin-top: 2px !important; width: 100% !important; height: 0 !important; font-size: 0 !important; line-height: 0 !important; }
  .cqql { display: block !important; font-size: 13pt !important; font-weight: normal !important; text-transform: uppercase !important; white-space: nowrap !important; line-height: 1.0 !important; margin: 0 !important; mso-line-height-rule: exactly !important; }
  .cqbh-wrap { display: inline-block !important; text-align: center !important; }
  .cqbh-text { display: inline-block !important; font-size: 14pt !important; font-weight: bold !important; text-transform: uppercase !important; white-space: nowrap !important; }
  .cqbh-line { display: block !important; border-top: 0.5pt solid #000000 !important; margin-top: 2px !important; width: 100% !important; height: 0 !important; font-size: 0 !important; line-height: 0 !important; }
  .rule-wrap {
    border-collapse: collapse !important;
    border: none !important;
    display: inline-table !important;
    width: auto !important;
    margin: 0 auto !important;
  }
  .rule-wrap td {
    border: none !important;
    padding: 0 !important;
    text-align: center !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .rule-text-cell {
    border-top: none !important;
    border-bottom: none !important;
    white-space: nowrap !important;
  }
  .rule-line-cell {
    border-bottom: none !important;
    border-left: none !important;
    border-right: none !important;
    border-top: 0.5pt solid #000000 !important;
    mso-border-top-alt: solid #000000 .5pt !important;
    height: 0 !important;
    line-height: 0 !important;
    font-size: 0 !important;
    padding-top: 2px !important;
  }
  .admin-hdr .rule-line-cell {
    border-top: 0.5pt solid #000000 !important;
    mso-border-top-alt: solid #000000 .5pt !important;
  }
  .rule-underline-tn,
  .rule-underline-cqbh {
    border-bottom: 0.5pt solid #000000 !important;
    mso-border-bottom-alt: solid #000000 .5pt !important;
    padding-bottom: 2px !important;
    margin: 0 !important;
  }
  .dateline { font-size: 13pt !important; font-style: italic !important; font-weight: normal !important; display: block !important; margin: 0 !important; }
  .admin-hdr .dateline { margin-top: 4px !important; line-height: 1.0 !important; mso-line-height-rule: exactly !important; }
  .addr { font-size: 13pt !important; font-weight: bold !important; }
  .narr14, .narr14 * { font-size: 14pt !important; line-height: 1.15 !important; }
  .grid10 td, .grid10 th {
    font-size: ${tableFontPt}pt !important;
  }
  .grid-tight td, .grid-tight th {
    font-size: ${tableFontPt}pt !important;
    padding: ${cellPaddingPx}px !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .daycol {
    width: ${dayColWidthPx}px !important;
    min-width: ${dayColWidthPx}px !important;
    max-width: ${dayColWidthPx}px !important;
    padding: ${Math.max(0, cellPaddingPx - 1)}px !important;
    font-size: ${tableFontPt}pt !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .namecol {
    width: ${nameColWidthPx}px !important;
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
  }
  .legend { font-size: ${legendFontPt}pt !important; line-height: 1.0 !important; mso-line-height-rule: exactly !important; }
  .legend, .legend tr, .legend td, .legend th {
    page-break-inside: avoid !important;
    mso-page-break-inside: avoid !important;
  }
  .recipient { text-align: ${recipientAlign} !important; }
  .title-lbl {
    font-size: 14pt !important;
    font-weight: bold !important;
    text-align: center !important;
  }
  .subtitle-lbl {
    font-size: 14pt !important;
    font-weight: bold !important;
    text-align: center !important;
  }
  .text-left { text-align: left !important; }
  .text-right { text-align: right !important; }
  .font-bold { font-weight: bold !important; }
  .font-black { font-weight: 900 !important; }
  .font-italic { font-style: italic !important; }
  .uppercase { text-transform: uppercase !important; }
  .th-yellow-bar {
    background-color: #fef08a !important; /* Yellow 300 bg */
    font-weight: bold !important;
  }
  .th-green-bar {
    background-color: #bbf7d0 !important; /* Green 200 bg */
    font-weight: bold !important;
  }
  .td-sunday {
    background-color: #e4e4e7 !important; /* Zinc 300 equivalent for Sunday columns */
  }
  .td-name {
    font-weight: bold !important;
    text-align: left !important;
    font-size: 12pt !important;
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .sig-block {
    page-break-inside: avoid !important;
    mso-page-break-inside: avoid !important;
  }
  .sig-block tr {
    page-break-inside: avoid !important;
    mso-page-break-inside: avoid !important;
  }
  table.sig-block {
    border-collapse: collapse !important;
    mso-table-lspace: 0pt !important;
    mso-table-rspace: 0pt !important;
  }
  table.sig-block td {
    padding: 0 !important;
    vertical-align: top !important;
  }
  .sig-gap {
    border: none !important;
    padding: 0 !important;
    font-size: 0 !important;
    line-height: 0 !important;
  }
  .sig-title {
    font-size: 14pt !important;
    font-weight: bold !important;
    text-transform: uppercase !important;
    text-align: center !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
  }
  .sig-note {
    font-size: 14pt !important;
    font-style: italic !important;
    font-weight: normal !important;
    text-align: center !important;
    color: #000000 !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
  }
  .sig-name {
    font-size: 14pt !important;
    font-weight: bold !important;
    text-align: center !important;
    white-space: nowrap !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .legend, .legend td, .legend th, .legend b {
    font-size: ${legendFontPt}pt !important;
    line-height: 1.0 !important;
    mso-line-height-rule: exactly !important;
  }
  .legend td, .legend th { padding: 3px !important; }
</style>
</head>
<body>${!forPrint ? '<div id="h0"></div><div id="h1"><p class="pagenum"><span style=\"mso-field-code:\\\" PAGE \\\"></span></p></div>' : ''}<div class="doc-shell"><div class="${forPrint ? 'doc-print ' : 'Section1 doc-word '}doc14 doc-page">`;

    if (activeReport === '1_bang_cham_cong') {
      const totalColumns = daysInMonth + 4;
      const thirdSpan = Math.floor(totalColumns / 3);
      const headerCenterSpan = 2;
      const headerLeftSpan = Math.floor((totalColumns - headerCenterSpan) / 2);
      const headerRightSpan = totalColumns - headerCenterSpan - headerLeftSpan;

      const sWork = settings.symbolWork || 'x';
      const sMission = settings.symbolMission || 'Ct';
      const sStudy = settings.symbolStudy || 'H';
      const sLeave = settings.symbolLeave || 'P';
      const sCompensation = settings.symbolCompensation || 'Nb';
      const sMaternity = settings.symbolMaternity || 'Ts';
      const sRest = settings.symbolRest || 'Nd';

      htmlContent += `
      ${renderAdminHeader({
        totalCols: totalColumns,
        leftCols: headerLeftSpan,
        centerCols: headerCenterSpan,
        rightCols: headerRightSpan,
        includeDateLine: false,
        marginBottomPx: 20,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="${totalColumns}" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="${totalColumns}" class="title-lbl" ${cellKeyAttr('b1_title')} style="border: none; padding: 0; ${cellStyleCss('b1_title')}">${cellTextHtml('b1_title', 'BẢNG CHẤM CÔNG NGÀY LÀM VIỆC')}</td>
        </tr>
        <tr style="border: none;">
          <td colspan="${totalColumns}" class="subtitle-lbl" ${cellKeyAttr('b1_subtitle')} style="border: none; padding: 0; ${cellStyleCss('b1_subtitle')}">${cellTextHtml('b1_subtitle', `Tháng ${monthStr} năm ${yearStr}`)}</td>
        </tr>
        <tr style="border: none;"><td colspan="${totalColumns}" style="border: none; height: 15px;"></td></tr>`,
      })}

      <!-- Main Daily Grid Table -->
      <table class="grid10 grid-tight" style="border: 0.5pt solid #52525b; width: 100%; table-layout: fixed;">
        <thead>
          <tr>
            <th rowspan="2" class="font-bold" style="border: 0.5pt solid #52525b; background-color: #f4f4f5;">STT</th>
            <th rowspan="2" class="font-bold namecol" style="border: 0.5pt solid #52525b; background-color: #f4f4f5; text-align: left;">Họ và tên</th>
            <th colspan="${daysInMonth}" class="font-bold th-yellow-bar" style="border: 0.5pt solid #52525b; background-color: #fef08a;">Ngày trong tháng</th>
            <th colspan="2" class="font-bold th-green-bar" style="border: 0.5pt solid #52525b; background-color: #bbf7d0;">Số công hưởng trong tháng</th>
          </tr>
          <tr>
            ${daysArray.map((day) => {
              const sun = isSunday(day);
              return `<th ${cellKeyAttr(`b1_day_${day}`)} style="border: 0.5pt solid #52525b; width: 25px; ${sun ? 'background-color: #e4e4e7; font-weight: bold;' : 'background-color: #fef08a;'} ${cellStyleCss(`b1_day_${day}`)}" class="daycol ${sun ? 'td-sunday' : ''}">${day}</th>`;
            }).join('')}
            <th class="th-green-bar" style="border: 0.5pt solid #52525b; background-color: #bbf7d0; width: 62px;">Số ngày</th>
            <th class="th-green-bar" style="border: 0.5pt solid #52525b; background-color: #bbf7d0; width: 62px;">Số ngày nghỉ</th>
          </tr>
        </thead>
        <tbody>
          ${orderedOfficers.map((off, index) => {
            const offAtts = activeAttendance.filter(a => a.officerId === off.id);
            let workDays = 0;
            let blankDays = 0;
            
            const dayCells = daysArray.map((day) => {
              const sun = isSunday(day);
              const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
              const att = offAtts.find(a => a.date === dateStr);
              const isScheduled = isOfficerScheduled(off.id, dateStr);
              
              const { symbol, countsAsWork } = resolveAttendanceSymbol(att, isScheduled);
              if (countsAsWork) workDays++;
              if (!symbol) blankDays++;
              return `<td ${cellKeyAttr(`b1_day_${day}`)} class="daycol" style="border: 0.5pt solid #52525b; ${sun ? 'background-color: #e4e4e7;' : ''} ${cellStyleCss(`b1_day_${day}`)}">${symbol}</td>`;
            }).join('');

            return `<tr>
              <td style="border: 0.5pt solid #52525b; text-align: center;">${index + 1}</td>
              <td class="td-name" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; color: rgb(153, 27, 27);">${off.fullName}</td>
              ${dayCells}
              <td style="border: 0.5pt solid #52525b; background-color: #f0fdf4; font-weight: bold; font-family: monospace;">${workDays}</td>
              <td style="border: 0.5pt solid #52525b; background-color: #f0fdf4; font-weight: bold; font-family: monospace;">${blankDays}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <!-- Commitment text line -->
      <table style="width: 100%; border: none; margin-top: 15px;">
        <tr style="border: none;">
          <td colspan="${totalColumns}" class="bottom-text" style="border: none; text-align: center; font-style: italic; font-size: ${bodyFontPt}pt;">
            <span ${cellKeyAttr('b1_commitment')} style="${cellStyleCss('b1_commitment')}">${cellTextHtml('b1_commitment', renderTemplateHtml(template.attendanceCommitment || defaultTemplate.attendanceCommitment || '', templateVars))}</span>
          </td>
        </tr>
        <tr style="border: none;"><td colspan="${totalColumns}" style="border: none; height: 15px;"></td></tr>
      </table>

      ${renderSignatureBlock([
        {
          titleKey: 'b1_sig_preparer_title',
          titleHtml: `${escapeHtml(signerPreparerTitle)}<br/><span class="sig-note">${cellTextHtml('b1_sig_preparer_note', '(Ký, ghi rõ họ tên)')}</span>`,
          nameKey: 'b1_sig_preparer_name',
          nameHtml: noWrapHtml(sPreparer),
          nameFontPt: 14,
        },
        {
          titleKey: 'b1_sig_commander_title',
          titleHtml: `${escapeHtml(signerCommanderTitle)}<br/><span class="sig-note">${cellTextHtml('b1_sig_commander_note', escapeHtml(signerCommanderSubTitle))}</span>`,
          nameKey: 'b1_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
          nameFontPt: 14,
        },
        {
          titleKey: 'b1_sig_leader_title',
          titleHtml: `${escapeHtml(signerLeaderTitle)}<br/><span class="sig-note">${cellTextHtml('b1_sig_leader_note', escapeHtml(signerLeaderSubTitle))}</span>`,
          nameKey: 'b1_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
          nameFontPt: 14,
        },
      ], { marginTopPx: 10, spacePx: sigSpace60 })}

      <br/><br/>

      <!-- Legend Indicator Table -->
      <table style="width: 100%; border: none; margin-top: 15px; page-break-inside: avoid !important; mso-page-break-inside: avoid !important;">
        <tr style="border: none; page-break-inside: avoid !important; mso-page-break-inside: avoid !important;">
          <td style="border: none; padding: 0; text-align: left; page-break-inside: avoid !important; mso-page-break-inside: avoid !important;">
      <table class="legend" align="left" style="width: 1%; border: 0.5pt solid #52525b; table-layout: auto; white-space: nowrap;">
        <tr>
          <td colspan="3" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; background-color: #f4f4f5; padding: 3px;">
            Ký hiệu chấm công:
          </td>
        </tr>
        <tr>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Làm việc tại đơn vị: <b>${sWork}</b></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Nghỉ phép: <b>${sLeave}</b></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Hội nghị, học tập: <b>${sStudy}</b></td>
        </tr>
        <tr>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Ốm, thai sản: <b>${sMaternity}</b></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Nghỉ bù: <b>${sCompensation}</b></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Đi công tác: <b>${sMission}</b></td>
        </tr>
        <tr>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Nghỉ vợ sinh: <b>${sPaternityLeave}</b></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px; white-space: nowrap;">Điều dưỡng: <b>${sRest}</b></td>
          <td style="border: 0.5pt solid #52525b; text-align: left; padding: 3px;" colspan="1"></td>
        </tr>
      </table>
          </td>
        </tr>
      </table>
      `;
    } else if (activeReport === '2_bang_dinh_luong') {
      const parentColSpan = 4 + daysInMonth + 1; // STT, Họ và tên, Chức vụ, Mức hưởng + daysInMonth + Tổng
      const titleMonth = parseInt(monthStr, 10);
      const titleYear = parseInt(yearStr, 10);
      const headerCenterSpan = 2;
      const headerLeftSpan = Math.floor((parentColSpan - headerCenterSpan) / 2);
      const headerRightSpan = parentColSpan - headerCenterSpan - headerLeftSpan;

      htmlContent += `
      ${renderAdminHeader({
        totalCols: parentColSpan,
        leftCols: headerLeftSpan,
        centerCols: headerCenterSpan,
        rightCols: headerRightSpan,
        marginBottomPx: 20,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="${parentColSpan}" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="${parentColSpan}" ${cellKeyAttr('b2_title')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: 14pt; font-weight: bold; ${cellStyleCss('b2_title')}">
            ${cellTextHtml('b2_title', 'BẢNG CHẤM CÔNG CÁN BỘ, CHIẾN SỸ HƯỞNG CHẾ ĐỘ ĂN ĐỊNH LƯỢNG')}
          </td>
        </tr>
        <tr style="border: none;">
          <td colspan="${parentColSpan}" ${cellKeyAttr('b2_subtitle')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: 12pt; font-weight: bold; color: #b91c1c; ${cellStyleCss('b2_subtitle')}">
            ${cellTextHtml('b2_subtitle', `${escapeHtml((template.teamName || defaultTemplate.teamName || '')).toUpperCase()} - tháng ${titleMonth} năm ${titleYear}`)}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="${parentColSpan}" style="border: none; height: 15px;"></td></tr>`,
      })}

      <!-- Data Table -->
      <table class="grid10 grid-tight" style="border: 0.5pt solid #52525b; width: 100%; border-collapse: collapse; table-layout: fixed;">
        <thead>
          <tr style="background-color: #fffbce; font-weight: bold;">
            <th rowspan="2" style="border: 0.5pt solid #52525b; width: 40px; text-align: center; vertical-align: middle; font-weight: bold;">STT</th>
            <th rowspan="2" class="namecol" style="border: 0.5pt solid #52525b; text-align: left; vertical-align: middle; font-weight: bold;">Họ và tên</th>
            <th rowspan="2" style="border: 0.5pt solid #52525b; width: 90px; text-align: center; vertical-align: middle; font-weight: bold;">Chức vụ</th>
            <th rowspan="2" style="border: 0.5pt solid #52525b; width: 90px; text-align: center; vertical-align: middle; font-weight: bold;">Mức hưởng</th>
            <th colspan="${daysInMonth}" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; background-color: #fffbce;">Ngày trong tháng</th>
            <th rowspan="2" style="border: 0.5pt solid #52525b; width: 50px; text-align: center; vertical-align: middle; font-weight: bold;">Tổng</th>
          </tr>
          <tr style="background-color: #fffbce;">
            ${daysArray.map(day => {
              const greyBg = isSunday(day) ? 'background-color: #cbd5e1;' : '';
              return `<th ${cellKeyAttr(`b2_day_${day}`)} style="border: 0.5pt solid #52525b; width: 25px; text-align: center; font-weight: bold; ${greyBg} ${cellStyleCss(`b2_day_${day}`)}" class="daycol">${day}</th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${orderedOfficers.map((off, index) => {
            const offRations = activeRations.filter(r => r.officerId === off.id);
            const totalDays = offRations.length;

            return `<tr>
              <td style="border: 0.5pt solid #52525b; text-align: center;">${index + 1}</td>
              <td class="td-name" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; font-family: 'Times New Roman'; font-size: 12pt !important;">${off.fullName}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center;">${off.position}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center;">Mức III</td>
              ${daysArray.map(day => {
                const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                const hasRation = offRations.some(r => r.date === dateStr);
                const cellBg = isSunday(day) ? 'background-color: #cbd5e1;' : '';
                return `<td ${cellKeyAttr(`b2_day_${day}`)} class="daycol" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; ${cellBg} ${cellStyleCss(`b2_day_${day}`)}">${hasRation ? 'III' : ''}</td>`;
              }).join('')}
              <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">${totalDays}</td>
            </tr>`;
          }).join('')}
          <tr style="background-color: #f4f4f5; font-weight: bold;">
            <td colspan="4" style="border: 0.5pt solid #52525b; text-align: center;">TỔNG CỘNG</td>
            ${daysArray.map(day => {
              const cellBg = isSunday(day) ? 'background-color: #cbd5e1;' : '';
              return `<td style="border: 0.5pt solid #52525b; ${cellBg}"></td>`;
            }).join('')}
            <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; color: #991b1b;">
              ${orderedOfficers.reduce((acc, curr) => acc + activeRations.filter(r => r.officerId === curr.id).length, 0)}
            </td>
          </tr>
        </tbody>
      </table>

      <p ${cellKeyAttr('b2_commitment')} style="text-align: center; font-size: ${bodyFontPt}pt; font-weight: normal; font-style: italic; margin-top: 15px; margin-bottom: 25px; ${cellStyleCss('b2_commitment')}">
        ${cellTextHtml('b2_commitment', renderTemplateHtml(template.rationCommitment || defaultTemplate.rationCommitment || '', templateVars))}
      </p>

      ${renderSignatureBlock([
        {
          titleKey: 'b2_sig_preparer_title',
          titleHtml: escapeHtml(signerPreparerTitle),
          nameKey: 'b2_sig_preparer_name',
          nameHtml: noWrapHtml(sPreparer),
          nameFontPt: 14,
        },
        {
          titleKey: 'b2_sig_commander_title',
          titleHtml: escapeHtml(signerCommanderTitle),
          nameKey: 'b2_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
          nameFontPt: 14,
        },
        {
          titleKey: 'b2_sig_leader_title',
          titleHtml: `${escapeHtml(signerLeaderTitle)}<br/><span class="sig-note">${escapeHtml(signerLeaderSubTitle)}</span>`,
          nameKey: 'b2_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
          nameFontPt: 14,
        },
      ], { marginTopPx: 20, spacePx: sigSpace60 })}
      `;
    } else if (activeReport === '3_danh_sach_tien_dinh_luong') {
      const titleMonth = parseInt(monthStr, 10);
      const titleYear = parseInt(yearStr, 10);
      const totalDays = orderedOfficers.reduce((acc, curr) => acc + activeRations.filter(r => r.officerId === curr.id).length, 0);
      const totalAmount = activeRations.reduce((acc, curr) => acc + curr.amount, 0);

      htmlContent += `
      ${renderAdminHeader({
        totalCols: 9,
        leftCols: 4,
        centerCols: 1,
        rightCols: 4,
        marginBottomPx: 20,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="9" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="9" ${cellKeyAttr('b3_title')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: 14pt; font-weight: bold; ${cellStyleCss('b3_title')}">
            ${cellTextHtml('b3_title', `DANH SÁCH CÁN BỘ, CHIẾN SỸ HƯỞNG TIỀN ĂN ĐỊNH LƯỢNG <span style="color: #b91c1c;">THÁNG ${String(titleMonth).padStart(2, '0')} NĂM ${titleYear}</span>`)}
          </td>
        </tr>
        <tr style="border: none;">
          <td colspan="9" ${cellKeyAttr('b3_team')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: ${bodyFontPt}pt; font-weight: normal; ${cellStyleCss('b3_team')}">
            ${cellTextHtml('b3_team', escapeHtml(template.teamName || defaultTemplate.teamName || ''))}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="9" style="border: none; height: 5px;"></td></tr>
        <tr style="border: none;">
          <td colspan="9" style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: ${bodyFontPt}pt; font-style: italic;">
            <span ${cellKeyAttr('b3_intro')} style="${cellStyleCss('b3_intro')}">${cellTextHtml('b3_intro', renderTemplateHtml(template.rationIntro || defaultTemplate.rationIntro || '', { place: template.placeName || defaultTemplate.placeName || '', month: titleMonth, year: titleYear, mm: pad2(titleMonth), team: template.teamName || defaultTemplate.teamName || '', issuer: template.issuerUnitName || defaultTemplate.issuerUnitName || '', recipient: template.recipientUnitName || defaultTemplate.recipientUnitName || '' }))}</span>
          </td>
        </tr>
        <tr style="border: none;"><td colspan="9" style="border: none; height: 15px;"></td></tr>`,
      })}

      <!-- Table content -->
      <table class="grid10 grid-tight" style="border: 0.5pt solid #52525b; width: 100%; border-collapse: collapse; font-family: 'Times New Roman'; table-layout: fixed;">
        <thead>
          <tr style="background-color: #f4f4f5; font-weight: bold;">
            <th style="border: 0.5pt solid #52525b; width: 40px; text-align: center; font-weight: bold; padding: 6px;">STT</th>
            <th class="namecol" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 190px; padding: 6px;">Họ và tên</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 90px; padding: 6px;">Mức hưởng</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 90px; padding: 6px;">Mức ăn ngày</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 70px; padding: 6px;">Số ngày</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 110px; padding: 6px;">Tổng tiền</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 110px; padding: 6px;">Số tiền thực nhận (đ)</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; width: 150px; padding: 6px;">Ký nhận<br/>(Ký, nhận ghi rõ họ tên)</th>
          </tr>
        </thead>
        <tbody>
          ${orderedOfficers.map((off, index) => {
            const countDays = activeRations.filter(r => r.officerId === off.id).length;
            const amount = countDays * settings.rationRate;
            return `<tr style="height: 35px;">
              <td style="border: 0.5pt solid #52525b; text-align: center;">${index + 1}</td>
              <td class="td-name" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; padding-left: 6px; font-size: 12pt !important;">${off.fullName}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center;">Mức III</td>
              <td style="border: 0.5pt solid #52525b; text-align: right; padding-right: 6px; font-family: monospace;">${settings.rationRate.toLocaleString('vi-VN')}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; font-family: monospace;">${countDays}</td>
              <td style="border: 0.5pt solid #52525b; text-align: right; font-weight: bold; padding-right: 6px; font-family: monospace;">${amount.toLocaleString('vi-VN')}</td>
              <td style="border: 0.5pt solid #52525b;"></td>
              <td style="border: 0.5pt solid #52525b;"></td>
            </tr>`;
          }).join('')}
          <tr style="background-color: #f4f4f5; font-weight: bold; height: 35px;">
            <td colspan="4" style="border: 0.5pt solid #52525b; text-align: center;">Tổng cộng</td>
            <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; font-family: monospace;">${totalDays}</td>
            <td style="border: 0.5pt solid #52525b; text-align: right; font-weight: bold; padding-right: 6px; font-family: monospace;">${totalAmount.toLocaleString('vi-VN')}</td>
            <td style="border: 0.5pt solid #52525b; background-color: #cbd5e1;"></td>
            <td style="border: 0.5pt solid #52525b;"></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 15px; font-size: ${bodyFontPt}pt; font-weight: normal; text-align: center; color: #b91c1c; font-style: italic;">
        (Bằng chữ: ${numberToVietnameseWords(totalAmount)})
      </div>

      <div ${cellKeyAttr('b3_payment_request')} style="text-align: center; font-style: italic; font-size: ${bodyFontPt}pt; margin-top: 10px; margin-bottom: 25px; ${cellStyleCss('b3_payment_request')}">
        ${cellTextHtml('b3_payment_request', renderTemplateHtml(template.rationPaymentRequest || defaultTemplate.rationPaymentRequest || '', { place: template.placeName || defaultTemplate.placeName || '', month: titleMonth, year: titleYear, mm: pad2(titleMonth), team: template.teamName || defaultTemplate.teamName || '', issuer: template.issuerUnitName || defaultTemplate.issuerUnitName || '', recipient: template.recipientUnitName || defaultTemplate.recipientUnitName || '' }))}
      </div>

      ${renderSignatureBlock([
        {
          titleKey: 'b3_sig_preparer_title',
          titleHtml: noWrapHtml('CÁN BỘ ĐỀ NGHỊ'),
          nameKey: 'b3_sig_preparer_name',
          nameHtml: noWrapHtml(sPreparer),
        },
        {
          titleKey: 'b3_sig_commander_title',
          titleHtml: noWrapHtml(signerCommanderTitle),
          nameKey: 'b3_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
        },
        {
          titleKey: 'b3_sig_leader_title',
          titleHtml: `${noWrapHtml(signerLeaderTitle)}<br/><span class="sig-note">${escapeHtml(signerLeaderSubTitle)}</span>`,
          nameKey: 'b3_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
        },
      ], { marginTopPx: 35, spacePx: sigSpace60 })}
      `;
    } else if (activeReport === '4_de_xuat_dinh_luong') {
      const titleMonth = parseInt(monthStr, 10);
      const titleYear = parseInt(yearStr, 10);
      const totalDays = activeRations.length;
      const totalAmount = activeRations.reduce((acc, curr) => acc + curr.amount, 0);

      htmlContent += `
      ${renderAdminHeader({
        totalCols: 7,
        leftCols: 3,
        centerCols: 1,
        rightCols: 3,
        marginBottomPx: 25,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" ${cellKeyAttr('b4_title')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: 14pt; font-weight: bold; text-transform: uppercase; ${cellStyleCss('b4_title')}">
            ${cellTextHtml('b4_title', 'GIẤY ĐỀ XUẤT')}
          </td>
        </tr>
        <tr style="border: none;">
          <td colspan="7" ${cellKeyAttr('b4_subtitle')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: ${bodyFontPt}pt; font-weight: normal; color: #b91c1c; ${cellStyleCss('b4_subtitle')}">
            ${cellTextHtml('b4_subtitle', `Về việc thanh toán tiền ăn định lượng của CBCS <span style="text-decoration: underline;">tháng ${String(titleMonth).padStart(2, '0')}/${titleYear}</span>`)}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>`,
      })}

      <table style="width: 100%; border: none; font-size: ${bodyFontPt}pt; font-family: 'Times New Roman';">
        <tr style="border: none;">
          <td colspan="7" class="narr14 line0 recipient" ${cellKeyAttr('recipient_line')} style="border: none; text-align: center; padding: 0; font-weight: bold; ${cellStyleCss('recipient_line')}">
            ${cellTextHtml('recipient_line', renderTemplateHtml(template.recipientLine || defaultTemplate.recipientLine || '', templateVars))}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 5px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: left; padding: 5px; line-height: 1.5; text-indent: 30px;">
            <span ${cellKeyAttr('b4_basis')} style="${cellStyleCss('b4_basis')}">${cellTextHtml('b4_basis', renderTemplateHtml(template.rationBasis || defaultTemplate.rationBasis || '', templateVars))}</span>
          </td>
        </tr>
      </table>

      <!-- Formula visual box row like the photo -->
      <table style="width: 100%; border: none; margin: 20px 0; font-family: 'Times New Roman';">
        <tr style="border: none;">
          <td style="border: none; text-align: center; vertical-align: middle;">
            <div style="display: inline-block; margin: 0 auto; text-align: center;">
              <span style="border: 1px solid #000; padding: 4px 20px; font-weight: bold; background-color: #ffffff; font-size: 11pt; font-family: monospace; display: inline-block; min-width: 50px;">
                ${totalDays}
              </span>
              <span style="font-size: 11pt; font-weight: bold; padding: 0 5px;">ngày x</span>
              <span style="border: 1px solid #000; padding: 4px 20px; font-weight: bold; background-color: #ffffff; font-size: 11pt; font-family: monospace; display: inline-block; min-width: 80px;">
                ${settings.rationRate.toLocaleString('vi-VN')} đ/ngày &nbsp;
              </span>
              <span style="font-size: 11pt; font-weight: bold; padding: 0 5px;">=</span>
              <span style="border: 1px solid #000; padding: 4px 20px; font-weight: bold; background-color: #ffffff; font-size: 11pt; font-family: monospace; display: inline-block; min-width: 110px; color: #b91c1c;">
                ${totalAmount.toLocaleString('vi-VN')}
              </span>
              <span style="font-size: 11pt; font-weight: bold; padding-left: 5px;">đ</span>
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 10px; font-size: ${bodyFontPt}pt; font-weight: normal; text-align: center; color: #b91c1c;">
        Bằng chữ: <span style="font-style: italic;">${numberToVietnameseWords(totalAmount)}</span>
      </div>

      <div ${cellKeyAttr('b4_attachment_note')} style="margin-top: 5px; font-size: ${bodyFontPt}pt; text-align: center; font-style: italic; ${cellStyleCss('b4_attachment_note')}">
        ${cellTextHtml('b4_attachment_note', renderTemplateHtml(template.rationAttachmentNote || defaultTemplate.rationAttachmentNote || '', templateVars))}
      </div>

      <!-- Confirmation statement in a box -->
      <table style="width: 100%; border: 1px solid #000; margin: 20px 0; background-color: #ffffff; border-collapse: collapse;">
        <tr style="border: 1px solid #000;">
          <td style="border: none; padding: 12px; font-size: ${bodyFontPt}pt; text-align: justify; line-height: 1.5; font-family: 'Times New Roman';">
            <span ${cellKeyAttr('b4_confirmation')} style="${cellStyleCss('b4_confirmation')}">${cellTextHtml('b4_confirmation', renderTemplateHtml(template.rationConfirmation || defaultTemplate.rationConfirmation || '', templateVars))}</span>
          </td>
        </tr>
      </table>

      <table style="width: 100%; border: none; font-size: ${bodyFontPt}pt; font-family: 'Times New Roman'; margin-bottom: 30px;">
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: left; padding: 5px; line-height: 1.5; text-indent: 30px;">
            <span ${cellKeyAttr('b4_approval_request')} style="${cellStyleCss('b4_approval_request')}">${cellTextHtml('b4_approval_request', renderTemplateHtml(template.rationApprovalRequest || defaultTemplate.rationApprovalRequest || '', templateVars))}</span>
          </td>
        </tr>
      </table>

      ${renderSignatureBlock([
        {
          titleKey: 'b4_sig_commander_title',
          titleHtml: escapeHtml(signerCommanderSubTitle),
          nameKey: 'b4_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
        },
        {
          titleKey: 'b4_sig_leader_title',
          titleHtml: `${escapeHtml(signerLeaderActingTitle)}<br/><span class="sig-note">${escapeHtml(signerLeaderSubTitle)}</span>`,
          nameKey: 'b4_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
        },
      ], { marginTopPx: 0, spacePx: sigSpace75, gapWidthPercent: 0.5, colWidthsPercent: [33, 33, 33] })}
      `;
    } else if (activeReport === '5_bang_lam_dem') {
      const totalHeaderCols = daysInMonth + 5;
      const headerCenterSpan = 2;
      const headerLeftSpan = Math.floor((totalHeaderCols - headerCenterSpan) / 2);
      const headerRightSpan = totalHeaderCols - headerCenterSpan - headerLeftSpan;

      htmlContent += `
      ${renderAdminHeader({
        totalCols: daysInMonth + 5,
        leftCols: headerLeftSpan,
        centerCols: headerCenterSpan,
        rightCols: headerRightSpan,
        marginBottomPx: 25,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="${daysInMonth + 5}" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="${daysInMonth + 5}" ${cellKeyAttr('b5_title')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: 14pt; font-weight: bold; text-transform: uppercase; ${cellStyleCss('b5_title')}">
            ${cellTextHtml('b5_title', 'BẢNG CHẤM CÔNG CBCS ĐƯỢC HƯỞNG TIỀN BỒI DƯỠNG TTKS BAN ĐÊM')}
          </td>
        </tr>
        <tr style="border: none;">
          <td colspan="${daysInMonth + 5}" ${cellKeyAttr('b5_subtitle')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-weight: bold; ${cellStyleCss('b5_subtitle')}">
            ${cellTextHtml('b5_subtitle', `${escapeHtml(template.teamName || defaultTemplate.teamName || '')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Tháng ${String(month).padStart(2, '0')}/${year}`)}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="${daysInMonth + 5}" style="border: none; height: 15px;"></td></tr>`,
      })}

      <!-- Grid Column Table -->
      <table class="grid10 grid-tight" style="border: 0.5pt solid #52525b; width: 100%; border-collapse: collapse; font-family: 'Times New Roman'; table-layout: fixed;">
        <thead>
          <tr style="background-color: #f4f4f5; font-weight: bold; height: 25px;">
            <th rowspan="2" style="border: 0.5pt solid #52525b; width: 40px; text-align: center; font-weight: bold; vertical-align: middle;">STT</th>
            <th rowspan="2" class="namecol" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; width: 190px; vertical-align: middle; padding-left: 6px;">Họ và tên</th>
            <th colspan="${daysInMonth}" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; vertical-align: middle; padding: 4px; background-color: #fef08a;">Ngày trong tháng</th>
            <th colspan="3" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; vertical-align: middle; padding: 4px; background-color: #bbf7d0;">Ghi chú</th>
          </tr>
          <tr style="background-color: #f4f4f5; font-weight: bold; height: 25px;">
            ${daysArray.map(day => {
              const dObj = new Date(year, month - 1, day);
              const dayOfWeek = dObj.getDay();
              const isW = dayOfWeek === 0 || dayOfWeek === 6;
              const bg = isW ? 'background-color: #e4e4e7;' : '';
              return `<th ${cellKeyAttr(`b5_day_${day}`)} style="border: 0.5pt solid #52525b; width: 25px; text-align: center; font-weight: bold; ${bg} ${cellStyleCss(`b5_day_${day}`)}" class="daycol">${day}</th>`;
            }).join('')}
            <th style="border: 0.5pt solid #52525b; width: 55px; text-align: center; font-weight: bold; background-color: #bbf7d0;">Đủ 2h</th>
            <th style="border: 0.5pt solid #52525b; width: 55px; text-align: center; font-weight: bold; background-color: #bbf7d0;">Đủ 4h</th>
            <th style="border: 0.5pt solid #52525b; width: 70px; text-align: center; font-weight: bold; background-color: #bbf7d0;">Tổng thời</th>
          </tr>
        </thead>
        <tbody>
          ${orderedOfficers.map((off, index) => {
            const officerShifts = activeNightShifts.filter(n => n.officerId === off.id);
            let du2hCount = 0;
            let du4hCount = 0;
            let totalTime = 0;

            daysArray.forEach(day => {
              const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
              const dailyShifts = officerShifts.filter(n => n.date === dayStr);
              const dailyPoints = dailyShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);
              totalTime += dailyPoints;
              if (dailyPoints >= 1.0) {
                du4hCount++;
              } else if (dailyPoints >= 0.5) {
                du2hCount++;
              }
            });

            return `<tr style="height: 35px;">
              <td style="border: 0.5pt solid #52525b; text-align: center;">${index + 1}</td>
              <td class="td-name" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; color: #991b1b; padding-left: 6px; font-size: 12pt !important;">${off.fullName}</td>
              ${daysArray.map(day => {
                const dObj = new Date(year, month - 1, day);
                const dayOfWeek = dObj.getDay();
                const isW = dayOfWeek === 0 || dayOfWeek === 6;
                const bg = isW ? 'background-color: #f4f4f5;' : '';
                
                const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                const dailyShifts = activeNightShifts.filter(n => n.officerId === off.id && n.date === dayStr);
                const dailyPoints = dailyShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);
                
                let cellText = '';
                if (dailyPoints >= 1.0) {
                  cellText = 'X';
                } else if (dailyPoints >= 0.5) {
                  cellText = '/';
                }
                return `<td ${cellKeyAttr(`b5_day_${day}`)} class="daycol" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; ${bg} ${cellStyleCss(`b5_day_${day}`)}">${cellText}</td>`;
              }).join('')}
              <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">${du2hCount || 0}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">${du4hCount || 0}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; font-family: monospace;">${totalTime > 0 ? totalTime.toFixed(1) : '-'}</td>
            </tr>`;
          }).join('')}

          <!-- Total Row -->
          <tr style="background-color: #f4f4f5; font-weight: bold; height: 35px;">
            <td colspan="2" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; font-size: ${tableFontPt}pt;">Tổng cộng</td>
            ${daysArray.map(() => `<td style="border: 0.5pt solid #52525b; background-color: #f4f4f5;"></td>`).join('')}
            <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">
              ${(() => {
                let total2h = 0;
                orderedOfficers.forEach(off => {
                  daysArray.forEach(day => {
                    const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                    const dailyPoints = activeNightShifts.filter(n => n.officerId === off.id && n.date === dayStr).reduce((s, c) => s + c.hoursCount, 0);
                    if (dailyPoints >= 0.5 && dailyPoints < 1.0) total2h++;
                  });
                });
                return total2h;
              })()}
            </td>
            <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">
              ${(() => {
                let total4h = 0;
                orderedOfficers.forEach(off => {
                  daysArray.forEach(day => {
                    const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                    const dailyPoints = activeNightShifts.filter(n => n.officerId === off.id && n.date === dayStr).reduce((s, c) => s + c.hoursCount, 0);
                    if (dailyPoints >= 1.0) total4h++;
                  });
                });
                return total4h;
              })()}
            </td>
            <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold; font-family: monospace;">
              ${activeNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0).toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Commitment and signatures -->
      <table style="width: 100%; border: none; margin-top: 15px; font-family: 'Times New Roman';">
        <tr style="border: none;">
          <td colspan="${daysInMonth + 5}" ${cellKeyAttr('b5_commitment')} style="border: none; text-align: center; font-weight: normal; font-size: ${bodyFontPt}pt; padding: 10px 0; ${cellStyleCss('b5_commitment')}">
            ${cellTextHtml('b5_commitment', renderTemplateHtml(template.nightCommitment || defaultTemplate.nightCommitment || '', templateVars))}
          </td>
        </tr>
      </table>

      ${renderSignatureBlock([
        {
          titleKey: 'b5_sig_preparer_title',
          titleHtml: escapeHtml(signerPreparerTitle),
          nameKey: 'b5_sig_preparer_name',
          nameHtml: noWrapHtml(sPreparer),
        },
        {
          titleKey: 'b5_sig_commander_title',
          titleHtml: `${escapeHtml(signerCommanderTitle)}<br/><span class="sig-note">${escapeHtml(signerCommanderSubTitle)}</span>`,
          nameKey: 'b5_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
        },
        {
          titleKey: 'b5_sig_leader_title',
          titleHtml: `${escapeHtml(signerLeaderTitle)}<br/><span class="sig-note">${escapeHtml(signerLeaderSubTitle)}</span>`,
          nameKey: 'b5_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
        },
      ], { marginTopPx: 25, spacePx: sigSpace75 })}
      `;
    } else if (activeReport === '6_danh_sach_tien_lam_dem') {
      htmlContent += `
      ${renderAdminHeader({
        totalCols: 7,
        leftCols: 3,
        centerCols: 1,
        rightCols: 3,
        marginBottomPx: 25,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" class="narr14 line0 recipient" ${cellKeyAttr('recipient_line')} style="border: none; text-align: center; font-weight: bold; font-family: 'Times New Roman'; ${cellStyleCss('recipient_line')}">
            ${cellTextHtml('recipient_line', renderTemplateHtml(template.recipientLine || defaultTemplate.recipientLine || '', templateVars))}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 10px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" class="narr14" style="border: none; text-align: justify; font-family: 'Times New Roman'; text-indent: 30px;">
            <span ${cellKeyAttr('b6_basis')} style="${cellStyleCss('b6_basis')}">${cellTextHtml('b6_basis', renderTemplateHtml(template.nightBasis || defaultTemplate.nightBasis || '', templateVars))}</span>
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>`,
      })}

      <!-- Table content -->
      <table class="grid10 grid-tight" style="border: 0.5pt solid #52525b; width: 100%; border-collapse: collapse; font-family: 'Times New Roman'; table-layout: fixed;">
        <thead>
          <tr style="background-color: #f4f4f5; font-weight: bold; height: 25px;">
            <th style="border: 0.5pt solid #52525b; width: 45px; text-align: center;">STT</th>
            <th class="namecol" style="border: 0.5pt solid #52525b; text-align: left; width: 190px; padding-left: 6px;">HỌ VÀ TÊN</th>
            <th style="border: 0.5pt solid #52525b; text-align: right; width: 100px; padding-right: 6px;">định mức</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; width: 80px;">Số công</th>
            <th style="border: 0.5pt solid #52525b; text-align: right; width: 150px; padding-right: 6px;">Số tiền đề nghị thanh</th>
            <th style="border: 0.5pt solid #52525b; text-align: right; width: 150px;">Số tiền được duyệt</th>
            <th style="border: 0.5pt solid #52525b; text-align: center; width: 220px;">Ký nhận (Ký tên và ghi rõ họ tên)</th>
          </tr>
        </thead>
        <tbody>
          ${orderedOfficers.map((off, index) => {
            const countShifts = activeNightShifts.filter(n => n.officerId === off.id).reduce((acc, curr) => acc + curr.hoursCount, 0);
            const amount = countShifts * settings.nightShiftRate;
            return `<tr style="height: 35px;">
              <td style="border: 0.5pt solid #52525b; text-align: center;">${index + 1}</td>
              <td class="td-name" style="border: 0.5pt solid #52525b; text-align: left; font-weight: bold; color: #991b1b; padding-left: 6px; font-size: 12pt !important;">${off.fullName}</td>
              <td style="border: 0.5pt solid #52525b; text-align: right; font-weight: bold; padding-right: 6px;">${settings.nightShiftRate.toLocaleString('vi-VN')}</td>
              <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">${countShifts.toFixed(1)}</td>
              <td style="border: 0.5pt solid #52525b; text-align: right; font-weight: bold; padding-right: 6px;">${amount.toLocaleString('vi-VN')}</td>
              <td style="border: 0.5pt solid #52525b;"></td>
              <td style="border: 0.5pt solid #52525b;"></td>
            </tr>`;
          }).join('')}
          <tr style="background-color: #f4f4f5; font-weight: bold; height: 35px;">
            <td colspan="2" style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">Tổng cộng:</td>
            <td style="border: 0.5pt solid #52525b;"></td>
            <td style="border: 0.5pt solid #52525b; text-align: center; font-weight: bold;">
              ${activeNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0).toFixed(1)}
            </td>
            <td style="border: 0.5pt solid #52525b; text-align: right; font-weight: bold; padding-right: 6px;">
              ${activeNightShifts.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('vi-VN')}
            </td>
            <td style="border: 0.5pt solid #52525b;"></td>
            <td style="border: 0.5pt solid #52525b;"></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 15px; font-size: ${bodyFontPt}pt; font-weight: normal; text-align: center; color: #b91c1c;">
        (Bằng chữ: <span style="font-style: italic;">${numberToVietnameseWords(activeNightShifts.reduce((acc, curr) => acc + curr.amount, 0))}</span>)
      </div>

      <table style="width: 100%; border: none; font-family: 'Times New Roman'; margin-top: 15px; margin-bottom: 25px;">
        <tr style="border: none;">
          <td colspan="7" class="narr14" style="border: none; text-align: justify; padding: 5px; text-indent: 30px;">
            <span ${cellKeyAttr('b6_payment_request')} style="${cellStyleCss('b6_payment_request')}">${cellTextHtml('b6_payment_request', renderTemplateHtml(template.nightPaymentRequest || defaultTemplate.nightPaymentRequest || '', templateVars))}</span>
          </td>
        </tr>
      </table>

      ${renderSignatureBlock([
        {
          titleKey: 'b6_sig_preparer_title',
          titleHtml: escapeHtml('CÁN BỘ ĐỀ NGHỊ THANH TOÁN'),
          nameKey: 'b6_sig_preparer_name',
          nameHtml: noWrapHtml(sPreparer),
        },
        {
          titleKey: 'b6_sig_commander_title',
          titleHtml: `${escapeHtml(signerCommanderTitle)}<br/><span class="sig-note">${escapeHtml(signerCommanderSubTitle)}</span>`,
          nameKey: 'b6_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
        },
        {
          titleKey: 'b6_sig_leader_title',
          titleHtml: `${escapeHtml(signerLeaderTitle)}<br/><span class="sig-note">${escapeHtml(signerLeaderSubTitle)}</span>`,
          nameKey: 'b6_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
        },
      ], { marginTopPx: 0, spacePx: sigSpace75 })}
      `;
    } else {
      const totalShiftsCount = activeNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);
      const totalAmount = activeNightShifts.reduce((acc, curr) => acc + curr.amount, 0);

      htmlContent += `
      ${renderAdminHeader({
        totalCols: 7,
        leftCols: 3,
        centerCols: 1,
        rightCols: 3,
        marginBottomPx: 25,
        titleRowsHtml: `
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" ${cellKeyAttr('b7_title')} style="border: none; text-align: center; font-family: 'Times New Roman'; font-size: 13pt; font-weight: bold; line-height: 1.2; ${cellStyleCss('b7_title')}">
            ${cellTextHtml('b7_title', `GIẤY ĐỀ XUẤT<br/><span style="font-size: 11pt; font-weight: bold; display: block; margin-top: 5px; text-transform: none;">Về việc thanh toán tiền bồi dưỡng TTKS ban đêm tháng ${month}/${year}</span>`)}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" class="recipient" ${cellKeyAttr('recipient_line')} style="border: none; text-align: center; font-size: 11.5pt; font-weight: bold; font-family: 'Times New Roman'; ${cellStyleCss('recipient_line')}">
            ${cellTextHtml('recipient_line', renderTemplateHtml(template.recipientLine || defaultTemplate.recipientLine || '', templateVars))}
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: justify; font-size: ${bodyFontPt}pt; font-family: 'Times New Roman'; line-height: 1.5; text-indent: 30px;">
            <span ${cellKeyAttr('b7_basis')} style="${cellStyleCss('b7_basis')}">${cellTextHtml('b7_basis', renderTemplateHtml(template.nightBasis || defaultTemplate.nightBasis || '', templateVars))}</span>
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>`,
      })}

      <!-- Formula line formatted nicely in Excel -->
      <table style="width: 100%; border: none; font-family: 'Times New Roman'; margin: 15px auto;">
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: center; font-size: 12pt; font-weight: bold;">
            <span style="border-bottom: 0.5pt solid black; padding: 2px 8px;">${totalShiftsCount.toFixed(1)}</span> lượt &nbsp;&nbsp;&nbsp;&nbsp; 
            x &nbsp;&nbsp;&nbsp;&nbsp; 
            <span style="border-bottom: 0.5pt solid black; padding: 2px 8px;">${settings.nightShiftRate.toLocaleString('vi-VN')} đ</span> &nbsp;&nbsp;&nbsp;&nbsp; 
            = &nbsp;&nbsp;&nbsp;&nbsp; 
            <span style="border-bottom: 0.5pt solid black; padding: 2px 8px;">${totalAmount.toLocaleString('vi-VN')} đ</span>
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 10px;"></td></tr>
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: center; font-size: ${bodyFontPt}pt; font-weight: normal; color: #b91c1c;">
            Bằng chữ: (${numberToVietnameseWords(totalAmount)})
          </td>
        </tr>
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: center; font-size: ${bodyFontPt}pt; font-style: italic; font-weight: normal; padding-top: 5px;">
            <span ${cellKeyAttr('b7_attachment_note')} style="${cellStyleCss('b7_attachment_note')}">${cellTextHtml('b7_attachment_note', renderTemplateHtml(template.nightAttachmentNote || defaultTemplate.nightAttachmentNote || '', templateVars))}</span>
          </td>
        </tr>
        <tr style="border: none;"><td colspan="7" style="border: none; height: 15px;"></td></tr>
      </table>

      <!-- Statement Box (Việc chấm công...) -->
      <table style="width: 100%; border: 0.5pt solid #a1a1aa; border-collapse: collapse; font-family: 'Times New Roman'; background-color: #fafafa; margin-bottom: 20px;">
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: justify; font-size: ${bodyFontPt}pt; font-style: italic; font-weight: normal; padding: 12px; line-height: 1.5; text-indent: 20px;">
            <span ${cellKeyAttr('b7_confirmation')} style="${cellStyleCss('b7_confirmation')}">${cellTextHtml('b7_confirmation', renderTemplateHtml(template.nightConfirmation || defaultTemplate.nightConfirmation || '', templateVars))}</span>
          </td>
        </tr>
      </table>

      <table style="width: 100%; border: none; font-family: 'Times New Roman'; font-size: ${bodyFontPt}pt;">
        <tr style="border: none;">
          <td colspan="7" style="border: none; text-align: justify; padding: 5px 0 20px 0; line-height: 1.5; text-indent: 30px;">
            <span ${cellKeyAttr('b7_approval_request')} style="${cellStyleCss('b7_approval_request')}">${cellTextHtml('b7_approval_request', renderTemplateHtml(template.nightApprovalRequest || defaultTemplate.nightApprovalRequest || '', templateVars))}</span>
          </td>
        </tr>
      </table>
      ${renderSignatureBlock([
        {
          titleKey: 'b7_sig_commander_title',
          titleHtml: `${escapeHtml((template.teamName || defaultTemplate.teamName || '').toUpperCase())}<br/><span class="sig-note">${escapeHtml(signerCommanderSubTitle)}</span>`,
          nameKey: 'b7_sig_commander_name',
          nameHtml: noWrapHtml(sCommander),
        },
        {
          titleKey: 'b7_sig_leader_title',
          titleHtml: `${escapeHtml(signerLeaderActingTitle)}<br/><span class="sig-note">${escapeHtml(signerLeaderSubTitle)}</span>`,
          nameKey: 'b7_sig_leader_name',
          nameHtml: noWrapHtml(sLeader),
        },
      ], { marginTopPx: 0, spacePx: sigSpace80 })}
      `;
    }

    htmlContent += `
</div></div></body>
</html>`;

    return { htmlContent, yearStr, monthStr };
  };

  const exportPreviewDocType: 'word' = 'word';
  const exportPreviewHtml = React.useMemo(() => {
    try {
      const { htmlContent } = buildExportHtml(exportPreviewDocType);
      return htmlContent;
    } catch {
      return '';
    }
  }, [
    exportPreviewDocType,
    activeReport,
    selectedMonth,
    settings,
    template,
    activeAttendance,
    activeRations,
    activeNightShifts,
  ]);

  const exportPreviewEditorHtml = React.useMemo(() => {
    if (!isEditingTemplate || editTab !== 'table') return exportPreviewHtml;
    if (!exportPreviewHtml) return '';
    const extraStyle = `
<style>
  [data-cellkey] { cursor: pointer; }
  [data-cellkey][contenteditable="true"] { cursor: text; white-space: pre-wrap; }
  [data-cellkey].__locked { cursor: not-allowed; }
  .__selected_cellkey { outline: 2px solid #2563eb; outline-offset: -2px; }
  [data-cellkey][contenteditable="true"]:focus { outline: 2px solid #16a34a; outline-offset: -2px; }
</style>`;
    const extraScript = `
<script>
(function () {
  function isLockedKey(key) {
    return /^b(1|2|5)_day_/.test(String(key || ''));
  }
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function textToHtml(text) {
    return escapeHtml(text).replace(/\\n/g, '<br/>');
  }
  function clearSelected() {
    var prev = document.querySelectorAll('.__selected_cellkey');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('__selected_cellkey');
  }
  function sendSelect(el) {
    try {
      window.parent && window.parent.postMessage({ type: 'selectCell', key: el.getAttribute('data-cellkey') }, '*');
    } catch {}
  }
  function sendEdit(key, html) {
    try {
      window.parent && window.parent.postMessage({ type: 'editCellText', key: key, html: html }, '*');
    } catch {}
  }
  function highlightKey(key) {
    clearSelected();
    if (!key) return;
    var el = document.querySelector('[data-cellkey="' + key.replace(/"/g, '&quot;') + '"]');
    if (!el) return;
    el.classList.add('__selected_cellkey');
    if (el.scrollIntoView) {
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {}
    }
  }
  function setupEditable() {
    var nodes = document.querySelectorAll('[data-cellkey]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-cellkey') || '';
      if (!key) continue;
      if (isLockedKey(key)) {
        el.classList.add('__locked');
        el.setAttribute('contenteditable', 'false');
        continue;
      }
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('blur', function (ev) {
        var target = ev && ev.target;
        if (!target || !target.getAttribute) return;
        var k = target.getAttribute('data-cellkey') || '';
        if (!k || isLockedKey(k)) return;
        var text = target.innerText || '';
        var html = textToHtml(text);
        sendEdit(k, html);
      });
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-cellkey]');
    if (!el) return;
    clearSelected();
    el.classList.add('__selected_cellkey');
    sendSelect(el);
  });
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'highlightCell') {
      highlightKey(typeof data.key === 'string' ? data.key : '');
    }
  });
  setupEditable();
})();
</script>`;
    return exportPreviewHtml
      .replace('</head>', `${extraStyle}</head>`)
      .replace('</body>', `${extraScript}</body>`);
  }, [exportPreviewHtml, isEditingTemplate, editTab]);

  React.useEffect(() => {
    if (!isEditingTemplate || editTab !== 'table') return;
    const iframe = exportEditorIframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({ type: 'highlightCell', key: selectedCellKey }, '*');
    } catch {}
  }, [selectedCellKey, isEditingTemplate, editTab, exportPreviewEditorHtml]);

  const downloadHtmlAsFile = (htmlContent: string, mimeType: string, filename: string) => {
    const blob = new Blob([htmlContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportWord = async () => {
    setExportError(null);
    setIsExporting(true);
    setExportFormat('word');
    try {
      const { htmlContent } = buildExportHtml('word');
      downloadHtmlAsFile(htmlContent, 'application/msword;charset=utf-8;', `bao_cao_phong_csgt_${activeReport}_thang_${selectedMonth}.doc`);
      addLog('Xuất Word', `Đã export Word biểu mẫu ${activeReport} Tháng ${shortMonthYear}.`);
    } catch {
      setExportError('Xuất Word thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExportError(null);
    setIsExporting(true);
    setExportFormat('pdf');
    try {
      const { htmlContent } = buildExportHtml('word', { forPrint: true });
      const win = window.open('', '_blank');
      if (!win) {
        setExportError('Không mở được cửa sổ in. Vui lòng cho phép pop-up và thử lại.');
        return;
      }
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
          setExportError('Xuất PDF thất bại. Vui lòng thử lại.');
        }
      }, 300);
      addLog('Xuất PDF', `Đã mở hộp thoại in để lưu PDF biểu mẫu ${activeReport} Tháng ${shortMonthYear}.`);
    } catch {
      setExportError('Xuất PDF thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const previewPaperWidthPx = getActiveOrientation() === 'landscape' ? 1123 : 794;
  const previewPaperHeightPx = getActiveOrientation() === 'landscape' ? 794 : 1123;

  React.useEffect(() => {
    const el = previewViewportRef.current;
    if (!el) return;
    const updateSize = () => setPreviewViewportWidth(el.clientWidth);
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setPreviewViewportWidth(entry ? entry.contentRect.width : el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeReport, exportPreviewHtml, isEditingTemplate]);

  React.useEffect(() => {
    const el = editorViewportRef.current;
    if (!el) return;
    const updateSize = () => setEditorViewportWidth(el.clientWidth);
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setEditorViewportWidth(entry ? entry.contentRect.width : el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeReport, editTab, exportPreviewEditorHtml, isEditingTemplate]);

  const renderPaperFrame = ({
    title,
    srcDoc,
    fitToWidth,
    viewportRef,
    viewportWidth,
    frameRef,
  }: {
    title: string;
    srcDoc: string;
    fitToWidth: boolean;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    viewportWidth: number;
    frameRef?: React.Ref<HTMLIFrameElement>;
  }) => {
    const hashSrcDoc = (text: string) => {
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16);
    };
    const availableWidth = viewportWidth > 0 ? Math.max(320, viewportWidth - 16) : previewPaperWidthPx;
    const scale = fitToWidth ? Math.min(1, availableWidth / previewPaperWidthPx) : 1;
    const stageWidth = Math.round(previewPaperWidthPx * scale);
    const stageHeight = Math.round(previewPaperHeightPx * scale);
    const frameKey = `${title}-${hashSrcDoc(srcDoc)}`;

    return (
      <div
        ref={viewportRef}
        className="overflow-auto rounded-xl border border-slate-200 bg-slate-100/80 p-2 sm:p-4"
      >
        <div className={fitToWidth ? 'flex justify-center' : 'w-max min-w-full'}>
          <div style={{ width: `${stageWidth}px`, height: `${stageHeight}px` }}>
            <iframe
              key={frameKey}
              ref={frameRef}
              title={title}
              className="block bg-white border border-slate-200 rounded-lg shadow-sm"
              style={{
                width: `${previewPaperWidthPx}px`,
                height: `${previewPaperHeightPx}px`,
                transform: scale === 1 ? undefined : `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              srcDoc={srcDoc}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Xuất Báo cáo</h2>
          <p className="text-sm text-slate-500 mt-1">
            Kết xuất các phụ biểu thanh toán tài chính theo quy định
          </p>
        </div>
      </div>

      {/* Control Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Selector sidebar for Report templates */}
        <div className="space-y-4">
          {/* Month selective */}
          <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs space-y-2">
            <label className="block text-xs font-semibold text-slate-500">Chọn kỳ kiểm toán:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={isEditingTemplate}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden font-mono"
            />
          </div>

          {/* List of 7 regulated documents */}
          <div className="bg-white rounded-xl border border-slate-150 overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
              Chọn danh mục biểu mẫu (07 Biểu)
            </div>
            
            <div className="divide-y divide-slate-100">
              {reportDefinitions.map((item) => (
                <button
                  key={item.type}
                  onClick={() => setActiveReport(item.type as ReportType)}
                  disabled={isEditingTemplate}
                  className={`w-full text-left px-4 py-3 text-xs font-semibold transition-all flex items-center justify-between ${
                    activeReport === item.type 
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' 
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    {item.label}
                    {templateOverrides[item.type as ReportType] ? (
                      <span className="text-[10px] font-black text-emerald-700">(đã lưu)</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Orientation Settings */}
          <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs space-y-2 mt-4">
            <label className="block text-xs font-semibold text-slate-500">Khổ in:</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg border ${getActiveOrientation() === 'portrait' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >Dọc</div>
              <div
                className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg border ${getActiveOrientation() === 'landscape' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >Ngang</div>
            </div>
            <div className="text-[11px] text-slate-500">
              Biểu 1, 2, 5 cố định A4 ngang. Các biểu còn lại cố định A4 dọc.
            </div>
          </div>

          {isEditingTemplate ? (
            <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-2xs space-y-3 mt-4">
              <div className="text-xs font-black text-slate-700">Định dạng (như Word)</div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Lề trên (mm)</label>
                  <input
                    type="number"
                    value={draftTemplate.pageMarginTopMm ?? ''}
                    onChange={(e) => updateDraft({ pageMarginTopMm: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Lề dưới (mm)</label>
                  <input
                    type="number"
                    value={draftTemplate.pageMarginBottomMm ?? ''}
                    onChange={(e) => updateDraft({ pageMarginBottomMm: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Lề trái (mm)</label>
                  <input
                    type="number"
                    value={draftTemplate.pageMarginLeftMm ?? ''}
                    onChange={(e) => updateDraft({ pageMarginLeftMm: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Lề phải (mm)</label>
                  <input
                    type="number"
                    value={draftTemplate.pageMarginRightMm ?? ''}
                    onChange={(e) => updateDraft({ pageMarginRightMm: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Cỡ chữ nội dung (pt)</label>
                  <input
                    type="number"
                    value={draftTemplate.bodyFontPt ?? ''}
                    onChange={(e) => updateDraft({ bodyFontPt: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Giãn dòng</label>
                  <input
                    type="number"
                    step="0.05"
                    value={draftTemplate.lineHeight ?? ''}
                    onChange={(e) => updateDraft({ lineHeight: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Khoảng cách đoạn (pt)</label>
                  <input
                    type="number"
                    value={draftTemplate.paragraphSpacingPt ?? ''}
                    onChange={(e) => updateDraft({ paragraphSpacingPt: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Canh nội dung</label>
                  <select
                    value={draftTemplate.bodyAlign ?? 'justify'}
                    onChange={(e) => updateDraft({ bodyAlign: e.target.value as any })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  >
                    <option value="justify">Canh đều</option>
                    <option value="left">Trái</option>
                    <option value="center">Giữa</option>
                    <option value="right">Phải</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Canh dòng Kính gửi</label>
                  <select
                    value={draftTemplate.recipientAlign ?? 'center'}
                    onChange={(e) => updateDraft({ recipientAlign: e.target.value as any })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  >
                    <option value="center">Giữa</option>
                    <option value="left">Trái</option>
                    <option value="right">Phải</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Cỡ chữ bảng (pt)</label>
                  <input
                    type="number"
                    value={draftTemplate.tableFontPt ?? ''}
                    onChange={(e) => updateDraft({ tableFontPt: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Rộng cột ngày (px)</label>
                  <input
                    type="number"
                    value={draftTemplate.dayColWidthPx ?? ''}
                    onChange={(e) => updateDraft({ dayColWidthPx: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Padding ô (px)</label>
                  <input
                    type="number"
                    value={draftTemplate.cellPaddingPx ?? ''}
                    onChange={(e) => updateDraft({ cellPaddingPx: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Cột họ tên (px)</label>
                  <input
                    type="number"
                    value={draftTemplate.nameColWidthPx ?? ''}
                    onChange={(e) => updateDraft({ nameColWidthPx: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Ký hiệu (pt)</label>
                  <input
                    type="number"
                    value={draftTemplate.legendFontPt ?? ''}
                    onChange={(e) => updateDraft({ legendFontPt: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Export / Print */}
          <div className="mt-4 space-y-2 z-50">
            <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-2xs space-y-2">
              <label className="block text-xs font-semibold text-slate-500">Định dạng xem/xuất:</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'word' | 'pdf')}
                disabled={isEditingTemplate || isExporting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
              >
                <option value="word">Word</option>
                <option value="pdf">PDF</option>
              </select>
              {exportError ? (
                <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <div>{exportError}</div>
                  <button
                    onClick={() => setExportError(null)}
                    className="mt-2 text-[11px] font-black text-rose-700 underline"
                  >
                    Thử lại
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
            <button
              onClick={handleExportWord}
              disabled={isEditingTemplate || isExporting}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Xuất Word</span>
            </button>
            </div>
            <button
              onClick={handleExportPdf}
              disabled={isEditingTemplate || isExporting}
              className="w-full flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <span>Xuất PDF</span>
            </button>
          </div>
        </div>

        {/* Right 3 Cols: Premium Administrative document preview */}
        <div className="lg:col-span-3 bg-white p-3 sm:p-5 lg:p-8 rounded-xl border border-slate-150 shadow-sm overflow-hidden min-h-[750px] print:border-none print:shadow-none print:p-0" id="print-area">
          <div className="flex justify-end gap-2 mb-4 print:hidden">
            {!isEditingTemplate ? (
              <button
                onClick={handleStartEditTemplate}
                disabled={isTemplateLoading}
                className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>{isTemplateLoading ? 'Đang tải mẫu...' : 'Chỉnh sửa mẫu'}</span>
                {hasCustomTemplate && <span className="ml-1 text-[10px] font-black text-emerald-700">(đã lưu)</span>}
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingTemplate ? 'Đang lưu...' : 'Lưu'}</span>
                </button>
                <button
                  onClick={() => setEditTab('table')}
                  disabled={isSavingTemplate}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Soạn thảo (Word)</span>
                </button>
                <button
                  onClick={() => {
                    setEditTab('wordEmbed');
                    addLog('Mở Word nhúng', `Đã mở ONLYOFFICE cho biểu mẫu ${activeReport} của tài khoản ${currentUser.username}.`);
                  }}
                  disabled={isSavingTemplate}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Nhúng Word Web</span>
                </button>
                <button
                  onClick={handleCancelEditTemplate}
                  disabled={isSavingTemplate}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Hủy</span>
                </button>
                <button
                  onClick={handleResetTemplate}
                  disabled={isSavingTemplate}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Mặc định</span>
                </button>
              </>
            )}
          </div>
          {templateCloudError ? (
            <div className="mb-4 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 print:hidden">
              {templateCloudError}
            </div>
          ) : null}
          {isEditingTemplate ? (
            <div className="mb-4 text-[11px] font-semibold rounded-lg px-4 py-3 print:hidden border border-slate-200 bg-slate-50 text-slate-700">
              {hasOnlyOfficeConfig
                ? 'Đã bật chế độ Word Web nhúng. Nút "Nhúng Word Web" sẽ gọi backend ONLYOFFICE để mở tài liệu chỉnh sửa trực tiếp trên trình duyệt.'
                : 'Chưa cấu hình ONLYOFFICE Document Server. Bạn vẫn có thể dùng trình soạn thảo hiện tại; muốn nhúng Word thật thì cần thêm VITE_ONLYOFFICE_DOCUMENT_SERVER_URL và backend /api/onlyoffice/config.'}
            </div>
          ) : null}
          
          {!isEditingTemplate ? (
            <div className="w-full">
              {exportPreviewHtml ? (
                renderPaperFrame({
                  title: 'report-export-preview',
                  srcDoc: exportPreviewHtml,
                  fitToWidth: true,
                  viewportRef: previewViewportRef,
                  viewportWidth: previewViewportWidth,
                })
              ) : (
                <div className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                  Không thể dựng bản xem trước theo định dạng xuất. Vui lòng thử lại.
                </div>
              )}
            </div>
          ) : (
            <>
              {editTab === 'table' ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                  <div className="h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1600px)] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <div className="text-sm font-black text-slate-800">Soạn thảo mẫu (như Word)</div>
                      <button
                        onClick={() => {
                          setEditTab('content');
                          setSelectedCellKey('');
                        }}
                        className="px-3 py-1.5 text-xs font-black bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                      >
                        Đóng
                      </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
                      <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 space-y-3">
                        <div className="text-[11px] font-semibold text-slate-500">Ô đang chọn</div>
                        <div className="text-xs font-black text-slate-800 break-all">
                          {selectedCellKey ? selectedCellKey : '(bấm vào phần muốn chỉnh)'}
                        </div>

                        {selectedCellKey && isLockedCellKey(selectedCellKey) ? (
                          <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                            Ô này là ô tính toán/dữ liệu hệ thống: không cho sửa nội dung, nhưng vẫn cho chỉnh định dạng.
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Kiểu chữ</label>
                            <select
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.fontFamily ?? '') : ''}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ fontFamily: e.target.value || undefined });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                            >
                              <option value="">(mặc định)</option>
                              <option value="'Times New Roman', serif">Times New Roman</option>
                              <option value="Arial, sans-serif">Arial</option>
                              <option value="Tahoma, sans-serif">Tahoma</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Cỡ chữ (pt)</label>
                            <input
                              type="number"
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.fontPt ?? '') : ''}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ fontPt: e.target.value === '' ? undefined : Number(e.target.value) });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Màu chữ</label>
                            <input
                              type="color"
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.textColor ?? '#000000') : '#000000'}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ textColor: e.target.value || undefined });
                              }}
                              className="w-full h-[34px] px-1 py-1 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Canh</label>
                            <select
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.align ?? '') : ''}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ align: (e.target.value || undefined) as any });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                            >
                              <option value="">(mặc định)</option>
                              <option value="left">Trái</option>
                              <option value="center">Giữa</option>
                              <option value="right">Phải</option>
                              <option value="justify">Canh đều</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Giãn dòng</label>
                            <input
                              type="number"
                              step="0.05"
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.lineHeight ?? '') : ''}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ lineHeight: e.target.value === '' ? undefined : Number(e.target.value) });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Độ rộng (px)</label>
                            <input
                              type="number"
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.widthPx ?? '') : ''}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ widthPx: e.target.value === '' ? undefined : Number(e.target.value) });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500">Padding (px)</label>
                            <input
                              type="number"
                              value={selectedCellKey ? (draftTemplate.cellStyleOverrides?.[selectedCellKey]?.paddingPx ?? '') : ''}
                              onChange={(e) => {
                                if (!selectedCellKey) return;
                                updateSelectedCellStyle({ paddingPx: e.target.value === '' ? undefined : Number(e.target.value) });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-lg text-xs font-bold outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            disabled={!selectedCellKey}
                            onClick={() =>
                              updateSelectedCellStyle({
                                bold: !draftTemplate.cellStyleOverrides?.[selectedCellKey]?.bold,
                              })
                            }
                            className="flex-1 px-2 py-2 text-xs font-black border border-slate-200 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50"
                          >
                            Đậm
                          </button>
                          <button
                            disabled={!selectedCellKey}
                            onClick={() =>
                              updateSelectedCellStyle({
                                italic: !draftTemplate.cellStyleOverrides?.[selectedCellKey]?.italic,
                              })
                            }
                            className="flex-1 px-2 py-2 text-xs font-black border border-slate-200 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50"
                          >
                            Nghiêng
                          </button>
                          <button
                            disabled={!selectedCellKey}
                            onClick={() =>
                              updateSelectedCellStyle({
                                underline: !draftTemplate.cellStyleOverrides?.[selectedCellKey]?.underline,
                              })
                            }
                            className="flex-1 px-2 py-2 text-xs font-black border border-slate-200 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50"
                          >
                            Gạch
                          </button>
                        </div>

                        <button
                          disabled={!selectedCellKey}
                          onClick={clearSelectedCellStyle}
                          className="w-full px-2 py-2 text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50"
                        >
                          Xóa định dạng ô
                        </button>

                        <div className="text-[11px] text-slate-500">
                          Click vào chỗ cần sửa trong trang bên phải và gõ trực tiếp. Ô tính toán hoặc dữ liệu hệ thống chỉ khóa nội dung; font, cỡ chữ, canh lề và định dạng vẫn chỉnh được.
                        </div>

                        <button
                          disabled={!selectedCellKey || isLockedCellKey(selectedCellKey)}
                          onClick={clearSelectedCellText}
                          className="w-full px-2 py-2 text-xs font-black bg-slate-50 text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                        >
                          Xóa nội dung tùy chỉnh
                        </button>
                      </div>
                      <div className="lg:col-span-3 p-4 min-h-0">
                        <div className="h-full">
                          {renderPaperFrame({
                            title: 'report-table-editor',
                            srcDoc: exportPreviewEditorHtml,
                            fitToWidth: false,
                            viewportRef: editorViewportRef,
                            viewportWidth: editorViewportWidth,
                            frameRef: exportEditorIframeRef,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <React.Suspense fallback={editTab === 'wordEmbed' ? <div className="fixed inset-0 z-[60] bg-slate-950/70" /> : null}>
                <OnlyOfficeEditorModal
                  isOpen={editTab === 'wordEmbed'}
                  onClose={() => setEditTab('content')}
                  requestPayload={{
                    reportId: activeReport,
                    reportLabel: activeReportLabel,
                    selectedMonth,
                    currentUser,
                    sourceHtml: exportPreviewHtml,
                    templateOverride: draftTemplate,
                  }}
                />
              </React.Suspense>

              {/* Document Header (Tiêu ngữ hành chính Nhà nước) */}
              {activeReport !== '2_bang_dinh_luong' && activeReport !== '3_danh_sach_tien_dinh_luong' && activeReport !== '4_de_xuat_dinh_luong' && activeReport !== '5_bang_lam_dem' && activeReport !== '6_danh_sach_tien_lam_dem' && activeReport !== '7_de_xuat_lam_dem' && (
                <div className="flex flex-col sm:flex-row justify-between text-center text-xs text-slate-800 font-bold tracking-tight mb-8">
                  <div className="space-y-0.5 text-center">
                    <p className="uppercase text-[11px] font-medium text-slate-500">{unitName}</p>
                    <div className="inline-block text-center">
                      <p className="uppercase text-[12px] font-bold">{departmentName}</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                    </div>
                  </div>
                  
                  <div className="text-center mt-3 sm:mt-0 space-y-0.5">
                    <p className="uppercase text-[11px] font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="text-[12px] font-bold">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                  </div>
                </div>
              )}

          {/* Dynamic reports content selection */}
          {activeReport === '1_bang_cham_cong' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '06';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const daysInMonth = new Date(year, month, 0).getDate();
            const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            const sWork = settings.symbolWork || 'x';
            const sMission = settings.symbolMission || 'Ct';
            const sStudy = settings.symbolStudy || 'H';
            const sLeave = settings.symbolLeave || 'P';
            const sCompensation = settings.symbolCompensation || 'Nb';
            const sMaternity = settings.symbolMaternity || 'Ts';
            const sRest = settings.symbolRest || 'Nd';

            const isSunday = (day: number) => {
              const d = new Date(year, month - 1, day);
              return d.getDay() === 0;
            };

            return (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">BẢNG CHẤM CÔNG NGÀY LÀM VIỆC</h3>
                  <p className="text-xs text-red-650 font-extrabold uppercase tracking-wide">Tháng {monthStr} năm {yearStr}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-sans border-collapse border border-zinc-400 min-w-[900px]">
                    <thead>
                      {/* Row 1 Headers */}
                      <tr className="bg-zinc-50 font-bold border-b border-zinc-400">
                        <th className="border border-zinc-400 p-1.5 text-center w-8" rowSpan={2}>STT</th>
                        <th className="border border-zinc-400 p-1.5 text-left min-w-[130px]" rowSpan={2}>Họ và tên</th>
                        <th className="border border-zinc-400 p-1 text-center font-extrabold uppercase bg-amber-50" colSpan={daysInMonth}>
                          Ngày trong tháng
                        </th>
                        <th className="border border-zinc-400 p-1 text-center font-bold bg-emerald-50 text-emerald-900 text-[9px]" colSpan={2}>
                          Số công hưởng trong tháng
                        </th>
                      </tr>
                      {/* Row 2 Day columns inside yellow bar */}
                      <tr className="bg-yellow-300/90 font-bold text-center border-b border-zinc-400">
                        {daysArray.map((day) => {
                          const sun = isSunday(day);
                          return (
                            <th 
                              key={day} 
                              className={`border border-zinc-400 p-0.5 w-6 text-[9px] font-mono ${
                                sun ? 'bg-zinc-450 text-white font-extrabold' : 'text-zinc-900'
                              }`}
                            >
                              {day}
                            </th>
                          );
                        })}
                        {/* Right column subheaders inside green bar */}
                        <th className="border border-zinc-400 p-1 text-[9px] bg-emerald-100 text-emerald-950 font-black tracking-tight" style={{ width: '45px' }}>
                          Số ngày
                        </th>
                        <th className="border border-zinc-400 p-1 text-[9px] bg-emerald-100 text-emerald-950 font-black tracking-tight" style={{ width: '45px' }}>
                          Số ngày nghỉ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-300">
                      {orderedOfficers.map((off, index) => {
                        const offAtts = activeAttendance.filter(a => a.officerId === off.id);
                        
                        let workDays = 0;
                        let blankDays = 0;

                        return (
                          <tr key={off.id} className="hover:bg-zinc-50/50 text-center font-medium">
                            <td className="border border-zinc-400 p-1.5 font-mono text-zinc-600">{index + 1}</td>
                            <td className="border border-zinc-400 p-1.5 text-left font-black text-rose-800 tracking-tight text-[11px] whitespace-nowrap">
                              {off.fullName}
                            </td>
                            {daysArray.map((day) => {
                              const sun = isSunday(day);
                              const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                              const att = offAtts.find(a => a.date === dateStr);
                              const isScheduled = isOfficerScheduled(off.id, dateStr);
                              
                              const { symbol, countsAsWork } = resolveAttendanceSymbol(att, isScheduled);
                              if (countsAsWork) workDays++;
                              if (!symbol) blankDays++;

                              return (
                                <td 
                                  key={day} 
                                  className={`border border-zinc-400 p-0.5 font-black text-[10px] ${
                                    sun ? 'bg-zinc-200 text-zinc-900 border-x-zinc-400' : 'text-zinc-800'
                                  }`}
                                >
                                  {symbol}
                                </td>
                              );
                            })}
                            {/* Work count columns loaded in light emerald green backgrounds */}
                            <td className="border border-zinc-400 p-1 font-extrabold text-[11px] bg-emerald-50 text-emerald-800 font-mono">
                              {workDays}
                            </td>
                            <td className="border border-zinc-400 p-1 font-extrabold text-[11px] bg-emerald-50 text-emerald-800 font-mono">
                              {blankDays}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] italic text-center text-zinc-500 font-medium my-4">
                  <EditableText
                    value={template.attendanceCommitment || ''}
                    onChange={(v) => updateDraft({ attendanceCommitment: v })}
                    inputClassName="w-full px-2 py-1 text-[10px] italic text-center text-zinc-600 font-medium border border-dashed border-slate-300 rounded bg-white"
                  />
                </p>

                {/* Legend Table Matching the Bottom of Screenshot */}
                <div className="pt-4 mt-2 border-t border-zinc-200">
                  <h3 className="font-bold text-xs mb-2 text-zinc-900">Ký hiệu chấm công:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Làm việc: <strong className="text-amber-700 font-extrabold">{sWork}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Nghỉ phép: <strong className="font-extrabold">{sLeave}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Nghỉ vợ sinh: <strong className="font-extrabold">{sPaternityLeave}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Hội nghị, học tập: <strong className="font-extrabold">{sStudy}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Công tác: <strong className="font-extrabold">{sMission}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Ốm, thai sản: <strong className="font-extrabold">{sMaternity}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Nghỉ bù: <strong className="font-extrabold">{sCompensation}</strong></div>
                    <div className="p-1.5 border border-zinc-200 bg-zinc-50 rounded">Điều dưỡng: <strong className="font-extrabold">{sRest}</strong></div>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeReport === '2_bang_dinh_luong' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '06';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const daysInMonth = new Date(year, month, 0).getDate();
            const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            const isSunday = (day: number) => {
              const d = new Date(year, month - 1, day);
              return d.getDay() === 0;
            };

            const totalRationSum = orderedOfficers.reduce((acc, curr) => {
              return acc + activeRations.filter(r => r.officerId === curr.id).length;
            }, 0);

            return (
              <div className="space-y-6 font-sans">
                {/* Document Custom Header matching photo */}
                <div className="flex justify-between items-start text-[10px] md:text-xs text-slate-800 font-bold leading-tight mb-6">
                  <div className="text-center space-y-1">
                    <p className="uppercase tracking-tight">{unitName}</p>
                    <div className="space-y-0.5">
                      <div className="inline-block text-center">
                        <p className="uppercase font-black text-[11px]">{departmentName}</p>
                        <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="uppercase font-bold tracking-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="font-extrabold text-[11px]">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium italic mt-2">
                      {isEditingTemplate ? (
                        <span className="block space-y-1">
                          <EditableText
                            value={template.placeName || ''}
                            onChange={(v) => updateDraft({ placeName: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                          <EditableText
                            value={template.dateLineTemplate || ''}
                            onChange={(v) => updateDraft({ dateLineTemplate: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                        </span>
                      ) : (
                        renderTemplate(template.dateLineTemplate || '', {
                          place: template.placeName || '',
                          month,
                          year,
                          mm: pad2(month),
                          team: template.teamName || '',
                          issuer: template.issuerUnitName || '',
                          recipient: template.recipientUnitName || '',
                        })
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-center space-y-2 pt-2">
                  <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight uppercase">
                    BẢNG CHẤM CÔNG CÁN BỘ, CHIẾN SỸ HƯỞNG CHẾ ĐỘ ĂN ĐỊNH LƯỢNG
                  </h3>
                  <p className="text-xs md:text-sm text-red-700 font-bold uppercase tracking-wide">
                    {isEditingTemplate ? (
                      <EditableText
                        value={template.teamName || ''}
                        onChange={(v) => updateDraft({ teamName: v })}
                        inputClassName="w-full px-2 py-1 text-xs md:text-sm font-bold text-center border border-dashed border-slate-300 rounded bg-white"
                      />
                    ) : (
                      (template.teamName || '').toUpperCase()
                    )}{' '}
                    - tháng {month} năm {year}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[9.5px] font-sans border-collapse border border-zinc-400 min-w-[950px]">
                    <thead>
                      {/* Row 1 Headers */}
                      <tr className="bg-[#fffbce]/90 text-zinc-900 font-black border-b border-zinc-400">
                        <th className="border border-zinc-400 p-2 text-center w-8" rowSpan={2}>STT</th>
                        <th className="border border-zinc-400 p-2 text-left min-w-[130px]" rowSpan={2}>Họ và tên</th>
                        <th className="border border-zinc-400 p-2 text-center w-24" rowSpan={2}>Chức vụ</th>
                        <th className="border border-zinc-400 p-2 text-center w-20" rowSpan={2}>Mức hưởng</th>
                        <th className="border border-zinc-400 p-1 text-center font-extrabold uppercase bg-[#fffbce]/90" colSpan={daysInMonth}>
                          Ngày trong tháng
                        </th>
                        <th className="border border-zinc-400 p-2 text-center w-12" rowSpan={2}>Tổng</th>
                      </tr>
                      {/* Row 2 Day columns inside pale-yellow bar */}
                      <tr className="bg-[#fffbce]/95 text-zinc-900 font-bold text-center border-b border-zinc-400">
                        {daysArray.map((day) => {
                          const sun = isSunday(day);
                          return (
                            <th 
                              key={day} 
                              className={`border border-zinc-400 p-0.5 w-6 text-[9px] font-mono ${
                                sun ? 'bg-zinc-300 text-zinc-900 font-extrabold' : 'text-zinc-900 font-medium'
                              }`}
                            >
                              {day}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-300">
                      {orderedOfficers.map((off, index) => {
                        const offRations = activeRations.filter(r => r.officerId === off.id);
                        const totalDays = offRations.length;

                        return (
                          <tr key={off.id} className="hover:bg-zinc-50/50 text-center font-medium">
                            <td className="border border-zinc-400 p-1 font-mono text-zinc-600">{index + 1}</td>
                            <td className="border border-zinc-400 p-1 text-left font-bold text-blue-900 text-[10px] whitespace-nowrap">
                              {off.fullName}
                            </td>
                            <td className="border border-zinc-400 p-1 text-center text-zinc-700 text-[10px]">{off.position}</td>
                            <td className="border border-zinc-400 p-1 text-center text-zinc-650 text-[10px]">Mức III</td>
                            {daysArray.map((day) => {
                              const sun = isSunday(day);
                              const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                              const hasRation = offRations.some(r => r.date === dateStr);

                              return (
                                <td 
                                  key={day} 
                                  className={`border border-zinc-400 p-0.5 font-bold text-[9px] ${
                                    sun ? 'bg-zinc-300 text-zinc-900 font-mono' : 'text-zinc-800'
                                  }`}
                                >
                                  {hasRation ? 'III' : ''}
                                </td>
                              );
                            })}
                            <td className="border border-zinc-400 p-1 font-extrabold text-[10px] text-zinc-900 font-mono">
                              {totalDays}
                            </td>
                          </tr>
                        );
                      })}
                      
                      {/* Total Row */}
                      <tr className="bg-zinc-50 font-bold border-t border-zinc-400 text-zinc-900">
                        <td colSpan={4} className="border border-zinc-400 p-2 text-center text-[10px] font-black uppercase tracking-wider">
                          Tổng Cộng
                        </td>
                        {daysArray.map((day) => {
                          const sun = isSunday(day);
                          return (
                            <td 
                              key={day} 
                              className={`border border-zinc-400 p-0.5 ${sun ? 'bg-zinc-300' : ''}`}
                            ></td>
                          );
                        })}
                        <td className="border border-zinc-400 p-1 text-center font-black text-rose-800 text-[11px] font-mono">
                          {totalRationSum}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Statement */}
                <p className="text-[10px] md:text-[11px] font-bold text-center text-zinc-800 tracking-tight leading-relaxed max-w-4xl mx-auto my-6 border-b border-t border-dashed border-zinc-300 py-3">
                  <EditableTemplateText
                    value={template.rationCommitment || ''}
                    onChange={(v) => updateDraft({ rationCommitment: v })}
                    vars={buildTemplateVars(month, year)}
                    multiline
                    inputClassName="w-full px-2 py-1 text-[10.5px] md:text-[11px] font-bold text-center border border-dashed border-slate-300 rounded bg-white"
                  />
                </p>

                {/* Ranks/Names Signature block matching photo */}
                <div className="grid grid-cols-3 text-center text-[11px] font-black tracking-tight mt-8 gap-4">
                  <div>
                    <p className="uppercase text-zinc-950 font-black">{signerPreparerTitle}</p>
                    <p className="mt-16 font-extrabold text-zinc-950 text-xs text-[11.5px]">{sPreparer}</p>
                  </div>

                  <div>
                    <p className="uppercase text-zinc-950 font-black">{signerCommanderTitle}</p>
                    <p className="mt-16 font-extrabold text-zinc-950 text-xs text-[11.5px]">{sCommander}</p>
                  </div>

                  <div>
                    <p className="uppercase text-zinc-950 font-black">{signerLeaderTitle}</p>
                    <p className="uppercase text-zinc-800 font-medium text-[9px] mt-0.5">{signerLeaderSubTitle}</p>
                    <p className="mt-13 font-extrabold text-zinc-950 text-xs text-[11.5px]">{sLeader}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeReport === '3_danh_sach_tien_dinh_luong' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '03';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);

            const totalDays = orderedOfficers.reduce((acc, curr) => acc + activeRations.filter(r => r.officerId === curr.id).length, 0);
            const totalAmount = activeRations.reduce((acc, curr) => acc + curr.amount, 0);

            return (
              <div className="space-y-6 font-sans">
                {/* Document Custom Header matching photo */}
                <div className="flex justify-between items-start text-[10px] md:text-xs text-slate-800 font-bold leading-tight mb-6">
                  <div className="text-center space-y-1">
                    <p className="uppercase tracking-tight">{unitName}</p>
                    <div className="space-y-0.5">
                      <div className="inline-block text-center">
                        <p className="uppercase font-black text-[11px]">{departmentName}</p>
                        <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="uppercase font-bold tracking-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="font-extrabold text-[11px]">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium italic mt-2">
                      {isEditingTemplate ? (
                        <span className="block space-y-1">
                          <EditableText
                            value={template.placeName || ''}
                            onChange={(v) => updateDraft({ placeName: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                          <EditableText
                            value={template.dateLineTemplate || ''}
                            onChange={(v) => updateDraft({ dateLineTemplate: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                        </span>
                      ) : (
                        renderTemplate(template.dateLineTemplate || '', buildTemplateVars(month, year))
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-center space-y-2 pt-2">
                  <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight uppercase">
                    DANH SÁCH CÁN BỘ, CHIẾN SỸ HƯỞNG TIỀN ĂN ĐỊNH LƯỢNG <span className="text-red-700">THÁNG {String(month).padStart(2, '0')} NĂM {year}</span>
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-900 font-bold uppercase tracking-wide">
                    {isEditingTemplate ? (
                      <EditableText
                        value={template.teamName || ''}
                        onChange={(v) => updateDraft({ teamName: v })}
                        inputClassName="w-full px-2 py-1 text-xs md:text-sm font-bold text-center border border-dashed border-slate-300 rounded bg-white"
                      />
                    ) : (
                      template.teamName || ''
                    )}
                  </p>
                  <p className="text-[10.5px] text-zinc-700 leading-relaxed max-w-4xl mx-auto border-t border-b border-zinc-100 py-1">
                    <EditableTemplateText
                      value={template.rationIntro || ''}
                      onChange={(v) => updateDraft({ rationIntro: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-[10.5px] text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[9.5px] font-sans border-collapse border border-zinc-400 min-w-[850px]">
                    <thead>
                      <tr className="bg-zinc-100 text-zinc-950 font-black border-b border-zinc-400 text-center">
                        <th className="border border-zinc-400 p-2 w-10">STT</th>
                        <th className="border border-zinc-400 p-2 text-left min-w-[130px]">Họ và tên</th>
                        <th className="border border-zinc-400 p-2">Mức hưởng</th>
                        <th className="border border-zinc-400 p-2">Mức ăn/ngày</th>
                        <th className="border border-zinc-400 p-2 w-20">Số ngày</th>
                        <th className="border border-zinc-400 p-2 w-28 text-right pr-3">Tổng tiền</th>
                        <th className="border border-zinc-400 p-2 w-32">Số tiền thực nhận (đ)</th>
                        <th className="border border-zinc-400 p-2 min-w-[140px]">Ký nhận<br/><span className="text-[8px] font-normal font-sans">(Ký, nhận ghi rõ họ tên)</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-300">
                      {orderedOfficers.map((off, index) => {
                        const countDays = activeRations.filter(r => r.officerId === off.id).length;
                        const amount = countDays * settings.rationRate;

                        return (
                          <tr key={off.id} className="hover:bg-zinc-50/50 text-center font-medium h-10">
                            <td className="border border-zinc-400 p-1 font-mono text-zinc-600">{index + 1}</td>
                            <td className="border border-zinc-400 p-1 text-left font-bold text-slate-900 text-[10.5px] whitespace-nowrap">
                              {off.fullName}
                            </td>
                            <td className="border border-zinc-400 p-1 text-center text-zinc-700 text-[10px]">Mức III</td>
                            <td className="border border-zinc-400 p-1 text-right pr-3 text-zinc-750 text-[10px] font-mono">
                              {settings.rationRate.toLocaleString('vi-VN')}
                            </td>
                            <td className="border border-zinc-400 p-1 font-bold text-[10px] text-zinc-900 font-mono">
                              {countDays}
                            </td>
                            <td className="border border-zinc-400 p-1 text-right pr-3 font-bold text-[10px] text-zinc-900 font-mono">
                              {amount.toLocaleString('vi-VN')}
                            </td>
                            <td className="border border-zinc-400 p-1"></td>
                            <td className="border border-zinc-400 p-1"></td>
                          </tr>
                        );
                      })}
                      
                      {/* Total Row */}
                      <tr className="bg-zinc-50 font-bold border-t border-zinc-400 text-zinc-900 h-10">
                        <td colSpan={4} className="border border-zinc-400 p-2 text-center text-[10px] font-black uppercase tracking-wider">
                          Tổng cộng
                        </td>
                        <td className="border border-zinc-400 p-1 text-center font-black text-zinc-950 text-[10.5px] font-mono">
                          {totalDays}
                        </td>
                        <td className="border border-zinc-400 p-1 text-right pr-3 font-black text-rose-850 text-[10.5px] font-mono">
                          {totalAmount.toLocaleString('vi-VN')}
                        </td>
                        <td className="border border-zinc-400 p-1 bg-zinc-200"></td>
                        <td className="border border-zinc-400 p-1"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Words section matching photo */}
                <div className="space-y-4 pt-2">
                  <p className="text-center font-extrabold text-[#b91c1c] text-[11px] italic">
                    (Bằng chữ: {numberToVietnameseWords(totalAmount)})
                  </p>
                  
                  <p className="text-[10px] md:text-[11px] font-bold text-center text-zinc-850 tracking-tight leading-relaxed max-w-4xl mx-auto border-b border-t border-dashed border-zinc-300 py-3">
                    <EditableTemplateText
                      value={template.rationPaymentRequest || ''}
                      onChange={(v) => updateDraft({ rationPaymentRequest: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-[10.5px] md:text-[11px] font-bold text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                {/* Ranks/Names Signature block matching photo */}
                <div className="grid grid-cols-3 text-center tracking-tight mt-8 gap-4 text-[11px]">
                  <div>
                    <p className="uppercase text-zinc-950 font-black">CÁN BỘ ĐỀ NGHỊ</p>
                    <p className="mt-16 font-extrabold text-zinc-1000 text-[11.5px]">{sPreparer}</p>
                  </div>

                  <div>
                    <p className="uppercase text-zinc-950 font-black">{signerCommanderTitle}</p>
                    <p className="mt-16 font-extrabold text-zinc-1000 text-[11.5px]">{sCommander}</p>
                  </div>

                  <div>
                    <p className="uppercase text-zinc-950 font-black font-extrabold">{signerLeaderTitle}</p>
                    <p className="uppercase text-zinc-800 font-bold text-[9px] mt-0.5">{signerLeaderSubTitle}</p>
                    <p className="mt-13 font-extrabold text-zinc-1000 text-[11.5px]">{sLeader}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeReport === '4_de_xuat_dinh_luong' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '03';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const totalDays = activeRations.length;
            const totalAmount = activeRations.reduce((acc, curr) => acc + curr.amount, 0);

            return (
              <div className="space-y-6 font-sans text-slate-900">
                {/* Administrative header matching the photo */}
                <div className="flex flex-col sm:flex-row justify-between items-start text-[10px] md:text-xs text-slate-800 font-bold leading-tight mb-8 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-center space-y-1">
                    <p className="uppercase tracking-tight font-extrabold text-[#141b27]">{unitName}</p>
                    <div className="space-y-0.5">
                      <div className="inline-block text-center">
                        <p className="uppercase font-black text-[11.5px] text-slate-950">{departmentName}</p>
                        <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="uppercase font-extrabold tracking-tight text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="font-black text-[11.5px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                    <p className="text-[10px] text-zinc-500 font-bold italic mt-2">
                      {isEditingTemplate ? (
                        <span className="block space-y-1">
                          <EditableText
                            value={template.placeName || ''}
                            onChange={(v) => updateDraft({ placeName: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                          <EditableText
                            value={template.dateLineTemplate || ''}
                            onChange={(v) => updateDraft({ dateLineTemplate: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                        </span>
                      ) : (
                        renderTemplate(template.dateLineTemplate || '', buildTemplateVars(month, year))
                      )}
                    </p>
                  </div>
                </div>

                {/* Title and Subtitle matching photo */}
                <div className="text-center space-y-2 pt-2 pb-4">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">
                    GIẤY ĐỀ XUẤT
                  </h3>
                  <p className="text-xs md:text-sm text-slate-900 font-bold uppercase tracking-wide underline decoration-red-650 underline-offset-4">
                    Về việc thanh toán tiền ăn định lượng của CBCS <span className="text-red-750">tháng {String(month).padStart(2, '0')}/{year}</span>
                  </p>
                </div>

                {/* Document Body and Statement Paragraphs */}
                <div className="space-y-4 text-xs md:text-sm leading-relaxed max-w-3xl mx-auto font-medium text-slate-850">
                  <p className="font-extrabold text-slate-950 text-[13px] md:text-[14px]">
                    <EditableTemplateText
                      value={template.recipientLine || ''}
                      onChange={(v) => updateDraft({ recipientLine: v })}
                      vars={buildTemplateVars(month, year)}
                      inputClassName="w-full px-2 py-1 text-[13px] md:text-[14px] font-extrabold text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                  
                  <p className="text-[12.5px] md:text-[13.5px] text-slate-950 text-justify leading-relaxed" style={{ textIndent: '30px' }}>
                    <EditableTemplateText
                      value={template.rationBasis || ''}
                      onChange={(v) => updateDraft({ rationBasis: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-[12.5px] md:text-[13.5px] text-justify border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>

                  {/* Formula visual bordered grids matching the boxes in picture */}
                  <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-6 font-mono text-[13.5px] md:text-[15px] font-bold text-slate-950 my-2 select-none">
                    <span className="border border-slate-800 px-6 py-1.5 bg-white shadow-sm rounded text-center min-w-[60px]">
                      {totalDays}
                    </span>
                    <span className="font-sans font-bold text-slate-750 text-xs md:text-sm"> ngày </span>
                    <span className="font-sans text-slate-400">x</span>
                    <span className="border border-slate-800 px-6 py-1.5 bg-white shadow-sm rounded text-center min-w-[120px]">
                      {settings.rationRate.toLocaleString('vi-VN')} đ/ngày
                    </span>
                    <span className="font-sans font-bold text-slate-750 text-xs md:text-sm"> = </span>
                    <span className="border border-slate-800 px-6 py-1.5 bg-white shadow-sm rounded text-center min-w-[150px] text-red-700 font-extrabold">
                      {totalAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  {/* Bằng chữ colored in Red */}
                  <p className="text-center font-extrabold text-red-700 text-xs md:text-[13px] leading-relaxed mb-1">
                    (Bằng chữ: <span className="italic underline underline-offset-2">{numberToVietnameseWords(totalAmount)}</span>)
                  </p>
                  <p className="text-center text-slate-500 font-bold italic text-[11px] mb-6">
                    <EditableTemplateText
                      value={template.rationAttachmentNote || ''}
                      onChange={(v) => updateDraft({ rationAttachmentNote: v })}
                      vars={buildTemplateVars(month, year)}
                      inputClassName="w-full px-2 py-1 text-[11px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>

                  {/* Solid green/dark bordered confirmation box matching the photo */}
                  <div className="p-4 md:p-5 border-y-2 sm:border-2 border-emerald-600 bg-emerald-50/20 rounded-none sm:rounded-xl my-5 text-slate-900 text-[12px] md:text-[13px] font-bold leading-relaxed text-justify shadow-sm">
                    <EditableTemplateText
                      value={template.rationConfirmation || ''}
                      onChange={(v) => updateDraft({ rationConfirmation: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-[12px] md:text-[13px] text-justify border border-dashed border-slate-300 rounded bg-white"
                    />
                  </div>

                  <p className="text-[12.5px] md:text-[13.5px] text-slate-950 text-justify leading-relaxed pt-2" style={{ textIndent: '30px' }}>
                    <EditableTemplateText
                      value={template.rationApprovalRequest || ''}
                      onChange={(v) => updateDraft({ rationApprovalRequest: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-[12.5px] md:text-[13.5px] text-justify border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                {/* Bottom signatures block matching the photo's layout */}
                <div className="grid grid-cols-2 text-center text-[11px] tracking-tight mt-12 gap-6 pt-6 border-t border-dashed border-slate-200">
                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerCommanderSubTitle}</p>
                    <div className="h-20" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sCommander}</p>
                  </div>

                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerLeaderActingTitle}</p>
                    <p className="uppercase text-slate-950 font-black text-[11px] mt-0.5">{signerLeaderSubTitle}</p>
                    <div className="h-14" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sLeader}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeReport === '5_bang_lam_dem' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '03';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const daysInMonth = new Date(year, month, 0).getDate();
            const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            const getDayOfWeek = (d: number) => {
              const dObj = new Date(year, month - 1, d);
              return dObj.getDay(); // 0 is Sunday, 6 is Saturday
            };

            const isW = (d: number) => {
              const dayOfWeek = getDayOfWeek(d);
              return dayOfWeek === 0 || dayOfWeek === 6;
            };

            return (
              <div className="space-y-6 font-sans text-slate-900">
                {/* Administrative header matching the photo */}
                <div className="flex flex-col sm:flex-row justify-between items-start text-[10px] md:text-xs text-slate-800 font-bold leading-tight mb-8 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-center space-y-1">
                    <p className="uppercase tracking-tight font-extrabold text-[#141b27]">{unitName}</p>
                    <div className="space-y-0.5">
                      <div className="inline-block text-center">
                        <p className="uppercase font-black text-[11.5px] text-slate-950">{departmentName}</p>
                        <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="uppercase font-extrabold tracking-tight text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="font-black text-[11.5px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                    <p className="text-[10px] text-zinc-500 font-bold italic mt-2">
                      {isEditingTemplate ? (
                        <span className="block space-y-1">
                          <EditableText
                            value={template.placeName || ''}
                            onChange={(v) => updateDraft({ placeName: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                          <EditableText
                            value={template.dateLineTemplate || ''}
                            onChange={(v) => updateDraft({ dateLineTemplate: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                        </span>
                      ) : (
                        renderTemplate(template.dateLineTemplate || '', buildTemplateVars(month, year))
                      )}
                    </p>
                  </div>
                </div>

                {/* Title and Subtitle matching photo */}
                <div className="text-center space-y-2 pt-2">
                  <h3 className="text-sm md:text-base font-black text-slate-900 tracking-wide uppercase">
                    BẢNG CHẤM CÔNG CBCS ĐƯỢC HƯỞNG TIỀN BỒI DƯỠNG TTKS BAN ĐÊM
                  </h3>
                  <div className="flex justify-center items-center gap-12 font-bold text-xs md:text-sm text-slate-800">
                    <span className="italic">
                      {isEditingTemplate ? (
                        <EditableText
                          value={template.teamName || ''}
                          onChange={(v) => updateDraft({ teamName: v })}
                          inputClassName="w-full px-2 py-1 text-xs md:text-sm font-bold text-center border border-dashed border-slate-300 rounded bg-white"
                        />
                      ) : (
                        template.teamName || ''
                      )}
                    </span>
                    <span className="text-red-750 font-black">Tháng {String(month).padStart(2, '0')}/{year}</span>
                  </div>
                </div>

                {/* Scrollable container for the table */}
                <div className="overflow-x-auto select-none print:overflow-x-visible">
                  <table className="min-w-full text-center text-[10px] border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-zinc-50 font-black text-slate-950 border-b border-slate-400 divide-x divide-slate-400">
                        <th rowSpan={2} className="p-1 w-8 font-black align-middle border border-slate-400">STT</th>
                        <th rowSpan={2} className="p-1 text-left font-black align-middle border border-slate-400 w-32 whitespace-nowrap">Họ và tên</th>
                        <th colSpan={daysInMonth} className="p-1 font-black bg-yellow-105 border border-slate-400 text-[10px]">Ngày trong tháng</th>
                        <th colSpan={3} className="p-1 font-black bg-emerald-105 border border-slate-400 text-[10px]">Ghi chú</th>
                      </tr>
                      <tr className="bg-zinc-50 font-black text-slate-950 border-b border-slate-400 divide-x divide-slate-400">
                        {daysArray.map(day => (
                          <th key={day} className={`p-0.5 w-5 font-black border border-slate-400 text-[9px] ${isW(day) ? 'bg-zinc-200' : ''}`}>
                            {day}
                          </th>
                        ))}
                        <th className="p-0.5 w-10 font-black bg-emerald-100/70 border border-slate-400 text-[9px]">Đủ 2h</th>
                        <th className="p-0.5 w-10 font-black bg-emerald-100/70 border border-slate-400 text-[9px]">Đủ 4h</th>
                        <th className="p-0.5 w-12 font-black bg-emerald-100/70 border border-slate-400 text-[9px]">Tổng thời</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-850">
                      {orderedOfficers.map((off, index) => {
                        const officerShifts = activeNightShifts.filter(n => n.officerId === off.id);
                        let du2hCount = 0;
                        let du4hCount = 0;
                        let totalTime = 0;

                        daysArray.forEach(day => {
                          const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                          const dailyShifts = officerShifts.filter(n => n.date === dayStr);
                          const dailyPoints = dailyShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);
                          totalTime += dailyPoints;
                          if (dailyPoints >= 1.0) {
                            du4hCount++;
                          } else if (dailyPoints >= 0.5) {
                            du2hCount++;
                          }
                        });

                        return (
                          <tr key={off.id} className="divide-x divide-slate-350 text-center font-semibold hover:bg-slate-50/50">
                            <td className="p-1 border border-slate-300 text-zinc-650">{index + 1}</td>
                            <td className="p-1 border border-slate-300 font-bold text-red-800 text-left whitespace-nowrap">{off.fullName}</td>
                            
                            {daysArray.map(day => {
                              const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                              const dailyShifts = activeNightShifts.filter(n => n.officerId === off.id && n.date === dayStr);
                              const dailyPoints = dailyShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);
                              
                              let cellText = "";
                              if (dailyPoints >= 1.0) {
                                cellText = "X";
                              } else if (dailyPoints >= 0.5) {
                                cellText = "/";
                              }
                              return (
                                <td 
                                  key={day} 
                                  className={`p-0.5 border border-slate-300 font-black text-[11px] ${cellText === 'X' ? 'text-zinc-950' : 'text-slate-650'} ${isW(day) ? 'bg-zinc-150' : ''}`}
                                >
                                  {cellText}
                                </td>
                              );
                            })}

                            <td className="p-1 border border-slate-300 font-bold bg-slate-50/10">{du2hCount || 0}</td>
                            <td className="p-1 border border-slate-300 font-bold bg-slate-50/10">{du4hCount || 0}</td>
                            <td className="p-1 border border-slate-300 font-extrabold font-mono text-slate-950">{totalTime > 0 ? totalTime.toFixed(1) : '-'}</td>
                          </tr>
                        );
                      })}

                      {/* Summary Row */}
                      <tr className="bg-slate-100 font-bold text-slate-950 divide-x divide-slate-350">
                        <td colSpan={2} className="p-1.5 border border-slate-300 text-center uppercase text-[10px] tracking-wider font-extrabold animate-pulse">Tổng cộng</td>
                        {daysArray.map(day => (
                          <td key={day} className={`p-0.5 border border-slate-300 ${isW(day) ? 'bg-zinc-200' : ''}`} />
                        ))}
                        <td className="p-1 border border-slate-300 font-black text-[11px] text-center bg-slate-100">
                          {(() => {
                            let total2h = 0;
                            orderedOfficers.forEach(off => {
                              daysArray.forEach(day => {
                                const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                                const dailyPoints = activeNightShifts.filter(n => n.officerId === off.id && n.date === dayStr).reduce((s, c) => s + c.hoursCount, 0);
                                if (dailyPoints >= 0.5 && dailyPoints < 1.0) total2h++;
                              });
                            });
                            return total2h;
                          })()}
                        </td>
                        <td className="p-1 border border-slate-300 font-black text-[11px] text-center bg-slate-100">
                          {(() => {
                            let total4h = 0;
                            orderedOfficers.forEach(off => {
                              daysArray.forEach(day => {
                                const dayStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
                                const dailyPoints = activeNightShifts.filter(n => n.officerId === off.id && n.date === dayStr).reduce((s, c) => s + c.hoursCount, 0);
                                if (dailyPoints >= 1.0) total4h++;
                              });
                            });
                            return total4h;
                          })()}
                        </td>
                        <td className="p-1 border border-slate-300 font-black text-[11px] text-center bg-slate-100 font-mono">
                          {activeNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0).toFixed(1)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Commitment text below table */}
                <div className="text-center font-extrabold text-[11px] md:text-[11.5px] uppercase text-zinc-950 py-3 block leading-snug border border-slate-200 bg-slate-50/50 rounded-lg max-w-4xl mx-auto px-4">
                  <EditableTemplateText
                    value={template.nightCommitment || ''}
                    onChange={(v) => updateDraft({ nightCommitment: v })}
                    vars={buildTemplateVars(month, year)}
                    multiline
                    inputClassName="w-full px-2 py-1 text-[11px] md:text-[11.5px] font-extrabold text-center border border-dashed border-slate-300 rounded bg-white"
                  />
                </div>

                {/* Bottom Signatures Block */}
                <div className="grid grid-cols-3 text-center text-[10px] sm:text-[11px] tracking-tight mt-12 gap-4 pt-6 border-t border-dashed border-slate-200 font-bold text-slate-900 leading-snug print-keep">
                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerPreparerTitle}</p>
                    <div className="h-20" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sPreparer}</p>
                  </div>

                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerCommanderTitle}</p>
                    <p className="uppercase text-slate-950 font-black text-[10px] mt-0.5">{signerCommanderSubTitle}</p>
                    <div className="h-14" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sCommander}</p>
                  </div>

                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerLeaderTitle}</p>
                    <p className="uppercase text-slate-950 font-black text-[10px] mt-0.5">{signerLeaderSubTitle}</p>
                    <div className="h-14" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sLeader}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeReport === '6_danh_sach_tien_lam_dem' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '03';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const totalAmount = activeNightShifts.reduce((acc, curr) => acc + curr.amount, 0);
            const totalWorkDays = activeNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);

            return (
              <div className="space-y-6 font-sans text-slate-900">
                {/* Administrative header matching the photo */}
                <div className="flex flex-col sm:flex-row justify-between items-start text-[10px] md:text-xs text-slate-800 font-bold leading-tight mb-8 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-center space-y-1">
                    <p className="uppercase tracking-tight font-extrabold text-[#141b27]">{unitName}</p>
                    <div className="space-y-0.5">
                      <div className="inline-block text-center">
                        <p className="uppercase font-black text-[11.5px] text-slate-950">{departmentName}</p>
                        <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="uppercase font-extrabold tracking-tight text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="font-black text-[11.5px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                    <p className="text-[10px] text-zinc-500 font-bold italic mt-2">
                      {isEditingTemplate ? (
                        <span className="block space-y-1">
                          <EditableText
                            value={template.placeName || ''}
                            onChange={(v) => updateDraft({ placeName: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                          <EditableText
                            value={template.dateLineTemplate || ''}
                            onChange={(v) => updateDraft({ dateLineTemplate: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                        </span>
                      ) : (
                        renderTemplate(template.dateLineTemplate || '', buildTemplateVars(month, year))
                      )}
                    </p>
                  </div>
                </div>

                {/* Kính gửi */}
                <div className="space-y-4 text-xs md:text-sm max-w-3xl mx-auto text-slate-850">
                  <p className="font-extrabold text-slate-950 text-center text-[13px] md:text-[14px]">
                    <EditableTemplateText
                      value={template.recipientLine || ''}
                      onChange={(v) => updateDraft({ recipientLine: v })}
                      vars={buildTemplateVars(month, year)}
                      inputClassName="w-full px-2 py-1 text-[13px] md:text-[14px] font-extrabold text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                  
                  <div className="text-[12px] md:text-[13px] text-slate-950 text-justify leading-relaxed space-y-2">
                    <EditableTemplateText
                      value={template.nightBasis || ''}
                      onChange={(v) => updateDraft({ nightBasis: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-[12px] md:text-[13px] text-justify border border-dashed border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>

                {/* Table matching the photo */}
                <div className="overflow-x-auto select-none print:overflow-x-visible">
                  <table className="min-w-full text-center text-[10.5px] border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-zinc-50 font-black text-slate-950 border-b border-slate-400 divide-x divide-slate-400">
                        <th className="p-2 w-10 font-black border border-slate-400 text-center">STT</th>
                        <th className="p-2 text-left font-black border border-slate-400 w-48 pl-4">HỌ VÀ TÊN</th>
                        <th className="p-2 font-black border border-slate-400 w-28 text-right pr-4">định mức</th>
                        <th className="p-2 font-black border border-slate-400 w-20 text-center">Số công</th>
                        <th className="p-2 font-black border border-slate-400 w-36 text-right pr-4">Số tiền đề nghị thanh</th>
                        <th className="p-2 font-black border border-slate-400 w-36">Số tiền được duyệt</th>
                        <th className="p-2 font-black border border-slate-400 text-center">Ký nhận (Ký tên và ghi rõ họ tên)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-850">
                      {orderedOfficers.map((off, index) => {
                        const countShifts = activeNightShifts.filter(n => n.officerId === off.id).reduce((acc, curr) => acc + curr.hoursCount, 0);
                        const amount = countShifts * settings.nightShiftRate;

                        return (
                          <tr key={off.id} className="divide-x divide-slate-350 text-center font-bold hover:bg-slate-50/50">
                            <td className="p-2 border border-slate-300 font-semibold text-zinc-600 text-[11px]">{index + 1}</td>
                            <td className="p-2 border border-slate-300 text-left font-bold text-red-800 text-[12px] pl-4 whitespace-nowrap">{off.fullName}</td>
                            <td className="p-2 border border-slate-300 text-right font-mono font-bold text-[11.5px] pr-4">{settings.nightShiftRate.toLocaleString('vi-VN')}</td>
                            <td className="p-2 border border-slate-300 font-bold text-[11.5px] font-mono text-center">{countShifts.toFixed(1)}</td>
                            <td className="p-2 border border-slate-300 text-right font-mono font-bold text-[11.5px] pr-4">{amount.toLocaleString('vi-VN')}</td>
                            <td className="p-2 border border-slate-300 bg-slate-50/10"></td>
                            <td className="p-2 border border-slate-300"></td>
                          </tr>
                        );
                      })}

                      {/* Total row matching photo */}
                      <tr className="bg-slate-100 font-black text-slate-950 divide-x divide-slate-350">
                        <td colSpan={2} className="p-2.5 border border-slate-300 text-center uppercase text-[11px] tracking-wider font-extrabold">Tổng cộng:</td>
                        <td className="p-2 border border-slate-300"></td>
                        <td className="p-2 border border-slate-300 font-black text-[11.5px] text-center font-mono bg-slate-100">
                          {totalWorkDays.toFixed(1)}
                        </td>
                        <td className="p-2 border border-slate-300 font-black text-[11.5px] text-right pr-4 font-mono bg-slate-100">
                          {totalAmount.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 border border-slate-300 bg-slate-100"></td>
                        <td className="p-2 border border-slate-300 bg-slate-100"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bằng chữ row below the table */}
                <div className="text-center font-black text-red-700 text-xs md:text-[13px] leading-relaxed my-2 select-all">
                  (Bằng chữ: <span className="italic underline underline-offset-2">{numberToVietnameseWords(totalAmount)}</span>)
                </div>

                {/* Footnote below Bằng chữ */}
                <div className="space-y-4 text-xs md:text-sm max-w-3xl mx-auto text-slate-850 text-justify leading-relaxed">
                  <p style={{ textIndent: '30px' }}>
                    <EditableTemplateText
                      value={template.nightPaymentRequest || ''}
                      onChange={(v) => updateDraft({ nightPaymentRequest: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-xs md:text-sm text-justify border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                {/* Bottom Signatures Block */}
                <div className="grid grid-cols-3 text-center text-[10px] sm:text-[11px] tracking-tight mt-12 gap-4 pt-6 border-t border-dashed border-slate-200 font-bold text-slate-900 leading-snug print-keep">
                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">CÁN BỘ ĐỀ NGHỊ THANH TOÁN</p>
                    <div className="h-20" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sPreparer}</p>
                  </div>

                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerCommanderTitle}</p>
                    <p className="uppercase text-slate-950 font-black text-[10px] mt-0.5">{signerCommanderSubTitle}</p>
                    <div className="h-14" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sCommander}</p>
                  </div>

                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerLeaderTitle}</p>
                    <p className="uppercase text-slate-950 font-black text-[10px] mt-0.5">{signerLeaderSubTitle}</p>
                    <div className="h-14" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sLeader}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeReport === '7_de_xuat_lam_dem' && (() => {
            const yearStr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
            const monthStr = selectedMonth ? selectedMonth.split('-')[1] : '03';
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const totalShiftsCount = activeNightShifts.reduce((acc, curr) => acc + curr.hoursCount, 0);
            const totalAmount = activeNightShifts.reduce((acc, curr) => acc + curr.amount, 0);

            return (
              <div className="space-y-6 font-sans text-slate-900">
                {/* Administrative header matching the photo */}
                <div className="flex flex-col sm:flex-row justify-between items-start text-[10px] md:text-xs text-slate-800 font-bold leading-tight mb-8 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-center space-y-1">
                    <p className="uppercase tracking-tight font-extrabold text-[#141b27]">{unitName}</p>
                    <div className="space-y-0.5">
                      <div className="inline-block text-center">
                        <p className="uppercase font-black text-[11.5px] text-slate-950">{departmentName}</p>
                        <div className="h-px bg-slate-700 mx-auto mt-1" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="uppercase font-extrabold tracking-tight text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <div className="inline-block text-center">
                      <p className="font-black text-[11.5px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="h-px bg-slate-700 mx-auto mt-1 w-full" />
                    </div>
                    <p className="text-[10px] text-zinc-500 font-bold italic mt-2">
                      {isEditingTemplate ? (
                        <span className="block space-y-1">
                          <EditableText
                            value={template.placeName || ''}
                            onChange={(v) => updateDraft({ placeName: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                          <EditableText
                            value={template.dateLineTemplate || ''}
                            onChange={(v) => updateDraft({ dateLineTemplate: v })}
                            inputClassName="w-full px-2 py-1 text-[10px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                          />
                        </span>
                      ) : (
                        renderTemplate(template.dateLineTemplate || '', buildTemplateVars(month, year))
                      )}
                    </p>
                  </div>
                </div>

                {/* Title block */}
                <div className="text-center space-y-1 py-2">
                  <h3 className="text-sm md:text-base font-black text-slate-900 tracking-wide uppercase">
                    GIẤY ĐỀ XUẤT
                  </h3>
                  <p className="font-bold text-xs md:text-sm text-slate-800">
                    Về việc thanh toán tiền bồi dưỡng TTKS ban đêm <span className="text-red-750 font-black font-semibold">tháng {month}/{year}</span>
                  </p>
                </div>

                {/* Salutation */}
                <div className="text-center">
                  <p className="font-extrabold text-slate-950 text-[13px] md:text-[14px]">
                    <EditableTemplateText
                      value={template.recipientLine || ''}
                      onChange={(v) => updateDraft({ recipientLine: v })}
                      vars={buildTemplateVars(month, year)}
                      inputClassName="w-full px-2 py-1 text-[13px] md:text-[14px] font-extrabold text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                {/* Body paragraphs */}
                <div className="space-y-4 text-xs md:text-sm max-w-3xl mx-auto text-slate-850 text-justify leading-relaxed">
                  <EditableTemplateText
                    value={template.nightBasis || ''}
                    onChange={(v) => updateDraft({ nightBasis: v })}
                    vars={buildTemplateVars(month, year)}
                    multiline
                    inputClassName="w-full px-2 py-1 text-xs md:text-sm text-justify border border-dashed border-slate-300 rounded bg-white"
                  />
                </div>

                {/* Styled Formula line center block */}
                <div className="flex justify-center items-center gap-4 text-slate-900 py-3 text-center bg-slate-50 border border-slate-200 rounded-lg max-w-xl mx-auto px-6">
                  <span className="font-extrabold text-lg border-b-2 border-slate-800 px-3 pb-0.5">{totalShiftsCount.toFixed(1)}</span>
                  <span className="text-xs font-bold text-slate-500">lượt</span>
                  <span className="font-bold text-slate-400">×</span>
                  <span className="font-extrabold text-lg border-b-2 border-slate-800 px-3 pb-0.5">{settings.nightShiftRate.toLocaleString('vi-VN')} đ</span>
                  <span className="font-bold text-slate-400">=</span>
                  <span className="font-extrabold text-lg text-red-750 border-b-2 border-slate-800 px-3 pb-0.5">{totalAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                {/* Spelling and attachment notes */}
                <div className="text-center space-y-1">
                  <p className="font-black text-red-700 text-xs md:text-[13px]">
                    Bằng chữ: <span className="italic underline underline-offset-2">({numberToVietnameseWords(totalAmount)})</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 italic mt-1 font-semibold">
                    <EditableTemplateText
                      value={template.nightAttachmentNote || ''}
                      onChange={(v) => updateDraft({ nightAttachmentNote: v })}
                      vars={buildTemplateVars(month, year)}
                      inputClassName="w-full px-2 py-1 text-[11px] italic text-center border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                {/* Statement text box */}
                <div className="max-w-3xl mx-auto bg-slate-50 border border-slate-300 rounded-lg p-4 font-bold text-xs md:text-[12.5px] italic text-zinc-950 text-justify leading-relaxed shadow-xs" style={{ textIndent: '20px' }}>
                  <EditableTemplateText
                    value={template.nightConfirmation || ''}
                    onChange={(v) => updateDraft({ nightConfirmation: v })}
                    vars={buildTemplateVars(month, year)}
                    multiline
                    inputClassName="w-full px-2 py-1 text-xs md:text-[12.5px] italic text-justify border border-dashed border-slate-300 rounded bg-white"
                  />
                </div>

                {/* Ending request row */}
                <div className="space-y-4 text-xs md:text-sm max-w-3xl mx-auto text-slate-850 text-justify leading-relaxed">
                  <p style={{ textIndent: '30px' }}>
                    <EditableTemplateText
                      value={template.nightApprovalRequest || ''}
                      onChange={(v) => updateDraft({ nightApprovalRequest: v })}
                      vars={buildTemplateVars(month, year)}
                      multiline
                      inputClassName="w-full px-2 py-1 text-xs md:text-sm text-justify border border-dashed border-slate-300 rounded bg-white"
                    />
                  </p>
                </div>

                {/* Signatures block matches photo */}
                <div className="grid grid-cols-2 text-center text-[10px] sm:text-[11px] tracking-tight mt-12 gap-8 pt-6 border-t border-dashed border-slate-200 font-bold text-slate-900 leading-snug print-keep">
                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{(template.teamName || '').toUpperCase()}</p>
                    <p className="uppercase text-slate-950 font-black text-[10px] mt-0.5">{signerCommanderSubTitle}</p>
                    <div className="h-20" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sCommander}</p>
                  </div>

                  <div>
                    <p className="uppercase text-slate-950 font-black text-xs">{signerLeaderActingTitle}</p>
                    <p className="uppercase text-slate-950 font-black text-[10px] mt-0.5">{signerLeaderSubTitle}</p>
                    <div className="h-20" />
                    <p className="font-black text-zinc-950 text-[12.5px]">{sLeader}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Document Signatures (Chữ ký hành chính phê duyệt) */}
          {activeReport !== '2_bang_dinh_luong' && activeReport !== '3_danh_sach_tien_dinh_luong' && activeReport !== '4_de_xuat_dinh_luong' && activeReport !== '5_bang_lam_dem' && activeReport !== '6_danh_sach_tien_lam_dem' && activeReport !== '7_de_xuat_lam_dem' && (
            <div className="grid grid-cols-2 text-center text-[11px] font-bold mt-12 gap-4 print-keep">
              <div>
                <p className="uppercase text-slate-400">Người lập biểu</p>
                <p className="text-slate-500 font-medium text-[10px] italic mt-0.5">(Ký, ghi rõ họ tên)</p>
                <p className="mt-14 font-bold text-slate-800">{sPreparer}</p>
              </div>

              <div>
                <p className="uppercase text-slate-900">Thủ trưởng đơn vị duyệt</p>
                <p className="text-slate-500 font-medium text-[10px] italic mt-0.5">(Ký tên và đóng dấu)</p>
                <div className="mt-14 space-y-1">
                  <p className="font-extrabold text-slate-900 mt-1">{signerLeaderSealTitle}</p>
                </div>
              </div>
            </div>
          )}

            </>
          )}

        </div>

      </div>
    </div>
  );
}
