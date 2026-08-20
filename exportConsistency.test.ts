import fs from 'fs';
import path from 'path';
import assert from 'assert';

const projectRoot = process.cwd();
const approvalPath = path.join(projectRoot, 'src', 'components', 'ApprovalAndReports.tsx');
const src = fs.readFileSync(approvalPath, 'utf8');

assert.ok(src.includes('title="report-export-preview"'), 'Thiếu iframe preview theo định dạng xuất');
assert.ok(src.includes('srcDoc={exportPreviewHtml}'), 'Preview chưa dùng đúng exportPreviewHtml');

assert.ok(src.includes("buildExportHtml('excel')"), 'Thiếu buildExportHtml(excel) cho xuất Excel');
assert.ok(src.includes("buildExportHtml('word')"), 'Thiếu buildExportHtml(word) cho xuất Word/PDF');
assert.ok(src.includes('win.print()'), 'Thiếu gọi in để xuất PDF');
