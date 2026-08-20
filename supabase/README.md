# Supabase Setup

## Files
- `schema.sql`: tao toan bo bang cho app.
- `seed-defaults.sql`: seed cau hinh va tai khoan mac dinh dang dung trong app.

## How To Run
1. Mo Supabase SQL Editor.
2. Chay `schema.sql`.
3. Chay `seed-defaults.sql`.

## Default Accounts
- `admin` / `123`
- `lanhdao` / `123`
- `chihuy` / `123`
- `totruong` / `123`
- `canbo` / `123`

## Important
- URL dung cho SDK phai la dang: `https://<project-ref>.supabase.co`
- Khong dung URL co hau to `/rest/v1/`
- Khong dua `SUPABASE_SERVICE_ROLE_KEY` vao client app
- Neu da lo key, nen rotate key sau khi cau hinh xong
