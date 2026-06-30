# Tich Hop Word Nhung Tren Web Bang ONLYOFFICE

## 1. Lua chon cong cu

- Giai phap duoc chon: `ONLYOFFICE Docs` + React wrapper `@onlyoffice/document-editor-react`.
- Ly do:
  - Ho tro editor Word-like thuc su tren trinh duyet.
  - Co the chinh sua noi dung, doan van, canh le, giay, bang bieu tot hon viec dung `contenteditable` thuan.
  - Tich hop duoc vao app React hien tai.
  - Ho tro callback de luu file sau khi nguoi dung sua.

## 2. Thanh phan da duoc tich hop trong repo

- Frontend:
  - `src/components/OnlyOfficeEditorModal.tsx`
  - `src/lib/onlyOffice.ts`
  - Nut `Nhung Word Web` trong `src/components/ApprovalAndReports.tsx`
- Cau hinh:
  - `.env.example`
  - `src/vite-env.d.ts`

## 3. Bien moi truong can cau hinh

```env
VITE_ONLYOFFICE_DOCUMENT_SERVER_URL="https://your-onlyoffice-docs.example.com"
VITE_ONLYOFFICE_CONFIG_ENDPOINT="/api/onlyoffice/config"
```

## 4. Hop dong backend can trien khai

Frontend se goi:

```http
POST /api/onlyoffice/config
Content-Type: application/json
```

Body gui len:

```json
{
  "reportId": "1_bang_cham_cong",
  "reportLabel": "1. Bang cham cong thang",
  "selectedMonth": "2026-06",
  "currentUser": {
    "id": "U001",
    "username": "admin",
    "fullName": "Quan tri vien"
  },
  "sourceHtml": "<html>...</html>",
  "templateOverride": {}
}
```

Backend can:

1. Tao hoac cap nhat tai lieu nguon cho bieu mau dang chinh sua.
2. Cung cap file tai lieu qua mot `document.url` cong khai ma Document Server doc duoc.
3. Tao `document.key` moi khi noi dung thay doi de ONLYOFFICE refresh dung.
4. Tao `editorConfig.callbackUrl` de ONLYOFFICE gui trang thai luu file ve backend.
5. Tra ve object config cho React component.

Vi du response:

```json
{
  "config": {
    "document": {
      "fileType": "docx",
      "key": "report-U001-1_bang_cham_cong-2026-06-v1",
      "title": "bao-cao-1-bang-cham-cong.docx",
      "url": "https://your-app.example.com/api/onlyoffice/files/report-U001-1_bang_cham_cong-2026-06.docx"
    },
    "documentType": "word",
    "editorConfig": {
      "mode": "edit",
      "lang": "vi",
      "callbackUrl": "https://your-app.example.com/api/onlyoffice/callback?reportId=1_bang_cham_cong&userId=U001",
      "user": {
        "id": "U001",
        "name": "Quan tri vien"
      },
      "customization": {
        "autosave": true,
        "forcesave": true
      }
    }
  }
}
```

## 5. Luu file va dong bo

- Khuyen nghi luu file `.docx` trong Supabase Storage hoac mot object storage cong khai.
- Callback `/api/onlyoffice/callback` nhan trang thai tu ONLYOFFICE va cap nhat file moi nhat.
- Neu muon giu rieng theo tung tai khoan:
  - dat key theo `userId + reportId + month`.
- Neu muon dung chung theo bieu mau:
  - dat key theo `reportId + month`.

## 6. Huong dan su dung tren giao dien

1. Vao `Bao cao`.
2. Chon bieu mau.
3. Bat `Chinh sua mau`.
4. Bam `Nhung Word Web`.
5. Cho backend tra ve config.
6. Soan thao truc tiep trong ONLYOFFICE editor.
7. Luu trong editor; backend se nhan callback va cap nhat file.

## 7. Kiem thu trinh duyet

Can kiem thu toi thieu tren:

- Chrome moi nhat
- Edge moi nhat
- Firefox moi nhat
- Safari moi nhat

Checklist:

- Mo editor thanh cong.
- Sua noi dung van ban truc tiep.
- Canh le trai/phai/giua/deu.
- Chinh page margin, paragraph spacing, line height.
- Luu file va mo lai thay doi van con.
- Chuyen tab, doi kich thuoc cua so khong vo layout.

## 8. Kiem thu hieu nang

Checklist:

- Thoi gian mo editor voi tai lieu thong thuong < 5 giay tren mang noi bo/on dinh.
- Chuyen giua cac bieu mau khong treo UI.
- Editor khong tai lai khong can thiet khi chi thay doi bo loc ngoai editor.
- File lon phai duoc giam anh/nhung tai san de tranh editor khoi dong cham.

## 9. Gioi han hien tai cua repo

- Repo hien da co frontend nhung ONLYOFFICE.
- Backend `/api/onlyoffice/config` va `/api/onlyoffice/callback` chua duoc viet trong repo nay.
- Luong chuyen doi `sourceHtml` sang `.docx` that su va luu lai file sua can duoc hoan tat o backend/server.
- Khi chua cau hinh backend, app se hien thong bao loi ro rang thay vi vo giao dien.

## 10. De xuat trien khai backend

- Neu ban deploy web tren Vercel:
  - Viet serverless function `/api/onlyoffice/config`.
  - Viet serverless function `/api/onlyoffice/callback`.
  - Luu file vao Supabase Storage.
- Neu ban deploy tren VPS:
  - Dung Node/Express cho hai endpoint tren.
  - Chay ONLYOFFICE Document Server bang Docker.
  - Cau hinh public URL de callback tu ONLYOFFICE goi ve duoc.
