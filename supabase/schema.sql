-- Supabase schema for "Chấm Công và Định lượng CSGT"
-- Run this file in Supabase SQL Editor before seeding data.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  username text not null unique,
  password text not null,
  role text not null check (role in ('admin', 'leader', 'commander', 'team_leader', 'officer_self')),
  full_name text not null,
  officer_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.officers (
  id text primary key,
  full_name text not null,
  rank text not null,
  position text not null,
  badge_number text not null default '',
  department text not null default '',
  phone_number text not null default '',
  year_of_birth integer null,
  status text not null check (status in ('Đang công tác', 'Tạm nghỉ', 'Chuyển công tác')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  leader_id text null references public.officers(id) on delete set null,
  member_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patrol_schedules (
  id text primary key,
  date date not null,
  start_time text not null,
  end_time text not null,
  route text null,
  area text null,
  topic text not null,
  mission_type text not null,
  team_id text null references public.teams(id) on delete set null,
  custom_officer_ids text[] not null default '{}',
  notes text null,
  status text not null check (status in ('Bản nháp', 'Đã ban hành')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id text primary key,
  officer_id text not null references public.officers(id) on delete cascade,
  date date not null,
  type text not null check (type in ('Làm việc', 'Công tác', 'Học tập', 'Nghỉ bù', 'Nghỉ phép', 'Nghỉ vợ sinh', 'Nghỉ sinh', 'Nghỉ dưỡng')),
  source_schedule_id text null references public.patrol_schedules(id) on delete set null,
  hours numeric(10,2) null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ration_records (
  id text primary key,
  officer_id text not null references public.officers(id) on delete cascade,
  date date not null,
  schedule_id text not null references public.patrol_schedules(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.night_shift_records (
  id text primary key,
  officer_id text not null references public.officers(id) on delete cascade,
  date date not null,
  schedule_id text not null references public.patrol_schedules(id) on delete cascade,
  hours_count numeric(10,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id text primary key,
  month_string text not null,
  status text not null check (status in ('Đã khóa', 'Chưa khóa')),
  approved_by text not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  user_id text not null,
  username text not null,
  user_full_name text not null,
  "timestamp" timestamptz not null,
  action text not null,
  details text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id text primary key default 'default',
  ration_rate numeric(12,2) not null default 75000,
  night_shift_rate numeric(12,2) not null default 200000,
  department_name text not null,
  unit_name text not null,
  overnight_shift_attendance_mode text not null default 'standard',
  symbol_work text not null default 'x',
  symbol_mission text not null default 'Ct',
  symbol_study text not null default 'H',
  symbol_leave text not null default 'P',
  symbol_paternity_leave text not null default 'NVS',
  symbol_compensation text not null default 'Nb',
  symbol_maternity text not null default 'Ts',
  symbol_rest text not null default 'Nd',
  signer_preparer text null,
  signer_commander text null,
  signer_leader text null,
  signer_preparer_title text null,
  signer_commander_title text null,
  signer_commander_sub_title text null,
  signer_leader_title text null,
  signer_leader_acting_title text null,
  signer_leader_sub_title text null,
  signer_leader_seal_title text null,
  max_night_shift_compensation_turns integer not null default 10,
  paternity_leave_max_days integer not null default 14,
  paternity_leave_eligibility text null,
  paternity_leave_registration_process text null,
  paternity_leave_approval_process text null,
  paternity_leave_payroll_policy text null,
  paternity_leave_attendance_policy text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.officers
add column if not exists year_of_birth integer null;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'attendance'
      and constraint_name = 'attendance_type_check'
  ) then
    alter table public.attendance drop constraint attendance_type_check;
  end if;
exception
  when undefined_table then
    null;
end;
$$;

do $$
begin
  alter table public.attendance
  add constraint attendance_type_check
  check (type in ('Làm việc', 'Công tác', 'Học tập', 'Nghỉ bù', 'Nghỉ phép', 'Nghỉ vợ sinh', 'Nghỉ sinh', 'Nghỉ dưỡng'));
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
end;
$$;

alter table if exists public.system_settings
add column if not exists symbol_paternity_leave text not null default 'NVS';

alter table if exists public.system_settings
add column if not exists paternity_leave_max_days integer not null default 14;

alter table if exists public.system_settings
add column if not exists paternity_leave_eligibility text null;

alter table if exists public.system_settings
add column if not exists paternity_leave_registration_process text null;

alter table if exists public.system_settings
add column if not exists paternity_leave_approval_process text null;

alter table if exists public.system_settings
add column if not exists paternity_leave_payroll_policy text null;

alter table if exists public.system_settings
add column if not exists paternity_leave_attendance_policy text null;

create table if not exists public.report_template_overrides (
  user_id text not null references public.users(id) on delete cascade,
  report_id text not null check (report_id in (
    '1_bang_cham_cong',
    '2_bang_dinh_luong',
    '3_danh_sach_tien_dinh_luong',
    '4_de_xuat_dinh_luong',
    '5_bang_lam_dem',
    '6_danh_sach_tien_lam_dem',
    '7_de_xuat_lam_dem'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, report_id)
);

alter table if exists public.report_template_overrides
add column if not exists user_id text;

update public.report_template_overrides
set user_id = coalesce(user_id, 'U001')
where user_id is null;

alter table if exists public.report_template_overrides
alter column user_id set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'report_template_overrides_pkey'
      and conrelid = 'public.report_template_overrides'::regclass
  ) then
    alter table public.report_template_overrides drop constraint report_template_overrides_pkey;
  end if;
exception
  when undefined_table then
    null;
end;
$$;

do $$
begin
  alter table public.report_template_overrides
  add primary key (user_id, report_id);
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
end;
$$;

create index if not exists idx_attendance_officer_date on public.attendance(officer_id, date);
create index if not exists idx_ration_records_officer_date on public.ration_records(officer_id, date);
create index if not exists idx_night_shift_records_officer_date on public.night_shift_records(officer_id, date);
create index if not exists idx_patrol_schedules_date on public.patrol_schedules(date);
create index if not exists idx_approvals_month_string on public.approvals(month_string);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_officers_updated_at on public.officers;
create trigger trg_officers_updated_at
before update on public.officers
for each row execute function public.set_updated_at();

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists trg_patrol_schedules_updated_at on public.patrol_schedules;
create trigger trg_patrol_schedules_updated_at
before update on public.patrol_schedules
for each row execute function public.set_updated_at();

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

drop trigger if exists trg_ration_records_updated_at on public.ration_records;
create trigger trg_ration_records_updated_at
before update on public.ration_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_night_shift_records_updated_at on public.night_shift_records;
create trigger trg_night_shift_records_updated_at
before update on public.night_shift_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_approvals_updated_at on public.approvals;
create trigger trg_approvals_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

drop trigger if exists trg_system_settings_updated_at on public.system_settings;
create trigger trg_system_settings_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_report_template_overrides_updated_at on public.report_template_overrides;
create trigger trg_report_template_overrides_updated_at
before update on public.report_template_overrides
for each row execute function public.set_updated_at();

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated, service_role;
