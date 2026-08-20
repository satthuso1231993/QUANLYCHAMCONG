import type { ReportTemplateId, ReportTemplateOverride } from '../types';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const rawDocumentServerUrl = (import.meta.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL as string | undefined) || '';
const rawConfigEndpoint = (import.meta.env.VITE_ONLYOFFICE_CONFIG_ENDPOINT as string | undefined) || '/api/onlyoffice/config';

export const onlyOfficeDocumentServerUrl = rawDocumentServerUrl ? trimTrailingSlash(rawDocumentServerUrl.trim()) : '';
export const onlyOfficeConfigEndpoint = rawConfigEndpoint.trim() || '/api/onlyoffice/config';
export const hasOnlyOfficeConfig = Boolean(onlyOfficeDocumentServerUrl);

export interface OnlyOfficeEditorRequestPayload {
  reportId: ReportTemplateId;
  reportLabel: string;
  selectedMonth: string;
  currentUser: {
    id: string;
    username: string;
    fullName: string;
  };
  sourceHtml: string;
  templateOverride: ReportTemplateOverride;
}

export const buildAbsoluteOnlyOfficeConfigUrl = () => {
  if (/^https?:\/\//i.test(onlyOfficeConfigEndpoint)) {
    return onlyOfficeConfigEndpoint;
  }

  if (typeof window === 'undefined') {
    return onlyOfficeConfigEndpoint;
  }

  return new URL(onlyOfficeConfigEndpoint, window.location.origin).toString();
};
