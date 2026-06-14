-- ═══════════════════════════════════════════════════
-- ChewClue database setup
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Food entries table
create table food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'supplement')),
  description text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Daily check-ins table
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date date not null,
  period text not null default 'morning' check (period in ('morning', 'evening')),
  sleep_quality smallint not null default 0 check (sleep_quality between 0 and 5),
  energy smallint not null default 0 check (energy between 0 and 5),
  mood smallint not null default 0 check (mood between 0 and 5),
  pain smallint not null default 0 check (pain between 0 and 5),
  bowel smallint not null default 0 check (bowel between 0 and 5),
  notes text not null default '',
  custom_labels jsonb not null default '{}'::jsonb,
  custom_directions jsonb not null default '{}'::jsonb,
  extra_metrics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date, period)
);

-- Indexes for fast date lookups
create index food_entries_user_date on food_entries (user_id, date);
create index daily_checkins_user_date on daily_checkins (user_id, date, period);

-- ── Upgrading an existing database? ──────────────────
-- This file is the full schema for a FRESH project. If your database was
-- created with an older version, do NOT re-run this file — instead apply the
-- incremental migrations in supabase/migrations/ in numbered order.
-- See supabase/migrations/README.md.

-- Row Level Security: each user only sees their own data
alter table food_entries enable row level security;
alter table daily_checkins enable row level security;

create policy "Users can view own food entries"
  on food_entries for select using (auth.uid() = user_id);

create policy "Users can insert own food entries"
  on food_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own food entries"
  on food_entries for update using (auth.uid() = user_id);

create policy "Users can delete own food entries"
  on food_entries for delete using (auth.uid() = user_id);

create policy "Users can view own checkins"
  on daily_checkins for select using (auth.uid() = user_id);

create policy "Users can insert own checkins"
  on daily_checkins for insert with check (auth.uid() = user_id);

create policy "Users can update own checkins"
  on daily_checkins for update using (auth.uid() = user_id);

create policy "Users can delete own checkins"
  on daily_checkins for delete using (auth.uid() = user_id);
