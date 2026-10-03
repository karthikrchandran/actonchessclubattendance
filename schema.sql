create extension if not exists pgcrypto;

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text not null,
  grade text not null,
  contact_hash text not null,
  contact_hint text,
  member_code text,
  qr_token text,
  created_at timestamptz not null default now(),
  unique (normalized_name, grade, contact_hash)
);

-- Safe migration if you created the original v1 schema first.
alter table members add column if not exists member_code text;
alter table members add column if not exists qr_token text;

create unique index if not exists idx_members_member_code on members(member_code) where member_code is not null;
create unique index if not exists idx_members_qr_token on members(qr_token) where qr_token is not null;

-- Migrate any older alphanumeric member codes to unique 4-digit numeric PINs.
-- Existing 4-digit PINs are preserved. This supports up to 10,000 members.
do $$
declare
  r record;
  candidate text;
begin
  for r in
    select id from members
    where member_code is null or member_code !~ '^[0-9]{4}$'
  loop
    loop
      candidate := lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (select 1 from members where member_code = candidate);
    end loop;
    update members set member_code = candidate where id = r.id;
  end loop;
end $$;


create table if not exists attendance (
  id bigint generated always as identity primary key,
  member_id uuid not null references members(id) on delete cascade,
  session_date date not null,
  checked_in_at timestamptz not null default now(),
  unique (member_id, session_date)
);

create index if not exists idx_attendance_session_date on attendance(session_date);
create index if not exists idx_attendance_member_id on attendance(member_id);

alter table members enable row level security;
alter table attendance enable row level security;
-- No public policies: browser clients cannot read club data directly.
-- The Next.js server routes use the Supabase service-role key.
