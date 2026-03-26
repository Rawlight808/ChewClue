-- ═══════════════════════════════════════════════════
-- ChewClue database setup
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Food entries table
create table food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Daily check-ins table
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date date not null,
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  mood smallint not null check (mood between 1 and 5),
  pain smallint not null check (pain between 1 and 5),
  bowel smallint not null check (bowel between 1 and 5),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Indexes for fast date lookups
create index food_entries_user_date on food_entries (user_id, date);
create index daily_checkins_user_date on daily_checkins (user_id, date);

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
