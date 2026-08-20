import React from 'react';
import { AlertTriangle, FileText, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { DocumentEditor } from '@onlyoffice/document-editor-react';
import {
  buildAbsoluteOnlyOfficeConfigUrl,
  hasOnlyOfficeConfig,
  onlyOfficeDocumentServerUrl,
  type OnlyOfficeEditorRequestPayload,
} from '../lib/onlyOffice';

interface OnlyOfficeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestPayload: OnlyOfficeEditorRequestPayload;
  onOpened?: () => void;
}

type OnlyOfficeConfigResponse =
  | Record<string, unknown>
  | {
      config?: Record<string, unknown>;
      documentServerUrl?: string;
    };

export default function OnlyOfficeEditorModal({
  isOpen,
  onClose,
  requestPayload,
  onOpened,
}: OnlyOfficeEditorModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [configError, setConfigError] = React.useState<string>('');
  const [editorConfig, setEditorConfig] = React.useState<Record<string, unknown> | null>(null);
  const [reloadSeed, setReloadSeed] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
      setConfigError('');
      setEditorConfig(null);
      return;
    }

    if (!hasOnlyOfficeConfig) {
      setConfigError(
        'Chưa cấu hình ONLYOFFICE Document Server. Hãy thêm VITE_ONLYOFFICE_DOCUMENT_SERVER_URL và endpoint backend /api/onlyoffice/config trước khi mở trình soạn thảo Word nhúng.'
      );
      return;
    }

    let cancelled = false;

    const loadEditorConfig = async () => {
      setIsLoading(true);
      setConfigError('');

      try {
        const response = await fetch(buildAbsoluteOnlyOfficeConfigUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        const payload = (await response.json()) as OnlyOfficeConfigResponse;
        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload && 'message' in payload ? String(payload.message || '') : '';
          throw new Error(message || `Backend ONLYOFFICE trả về lỗi HTTP ${response.status}.`);
        }

        const nextConfig =
          typeof payload === 'object' && payload && 'config' in payload && payload.config
            ? (payload.config as Record<string, unknown>)
            : (payload as Record<string, unknown>);

        if (!nextConfig || typeof nextConfig !== 'object' || !('document' in nextConfig)) {
          throw new Error('Backend ONLYOFFICE chưa trả về cấu hình editor hợp lệ.');
        }

        if (cancelled) return;
        setEditorConfig(nextConfig);
        onOpened?.();
      } catch (error) {
        if (cancelled) return;
        console.error('OnlyOffice config load error:', error);
        setEditorConfig(null);
        setConfigError(
          error instanceof Error
            ? error.message
            : 'Không thể lấy cấu hình ONLYOFFICE từ backend. Kiểm tra endpoint /api/onlyoffice/config và callback save.'
        );
      } finally {
        if (cancelled) return;
        setIsLoading(false);
      }
    };

    void loadEditorConfig();

    return () => {
      cancelled = true;
    };
  }, [isOpen, onOpened, reloadSeed, requestPayload]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1800px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <FileText className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="truncate">Soạn thảo Word nhúng bằng ONLYOFFICE</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              Trình duyệt sẽ mở editor Word-like ngay trong web. Việc lưu file thật do backend và ONLYOFFICE callback xử lý.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReloadSeed((prev) => prev + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" />
              Tải lại
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Đóng
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-[11px] text-slate-600">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>
              <strong>Biểu:</strong> {requestPayload.reportLabel}
            </span>
            <span>
              <strong>Kỳ:</strong> {requestPayload.selectedMonth}
            </span>
            <span>
              <strong>Tài khoản:</strong> {requestPayload.currentUser.username}
            </span>
            <span className="truncate">
              <strong>Document Server:</strong> {onlyOfficeDocumentServerUrl || '(chưa cấu hình)'}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" />
              <div className="text-base font-black text-slate-900">Đang khởi tạo trình soạn thảo Word</div>
              <p className="max-w-2xl text-sm font-medium text-slate-500">
                App đang yêu cầu backend tạo cấu hình ONLYOFFICE, tài liệu nguồn và callback save cho biểu mẫu này.
              </p>
            </div>
          ) : null}

          {!isLoading && configError ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-black">Không thể mở ONLYOFFICE Editor</div>
                      <p className="mt-1 text-sm font-medium">{configError}</p>
                    </div>
                    <div className="text-xs font-medium text-amber-800">
                      Backend cần trả về cấu hình editor qua `POST /api/onlyoffice/config`, trong đó bao gồm `document.url`,
                      `document.key`, `editorConfig.callbackUrl` và thông tin người dùng.
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-white/70 p-3 text-xs font-semibold text-amber-900">
                      Hợp đồng dữ liệu client đang gửi gồm: `reportId`, `reportLabel`, `selectedMonth`, `currentUser`,
                      `sourceHtml`, `templateOverride`.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!isLoading && !configError && editorConfig ? (
            <DocumentEditor
              id={`onlyoffice-report-editor-${requestPayload.reportId}-${reloadSeed}`}
              documentServerUrl={onlyOfficeDocumentServerUrl}
              config={editorConfig}
              events_onDocumentReady={() => {
                console.log('OnlyOffice document is ready');
              }}
              onLoadComponentError={(errorCode, errorDescription) => {
                console.error('OnlyOffice load error:', errorCode, errorDescription);
                setConfigError(errorDescription || `ONLYOFFICE load error ${String(errorCode)}`);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
