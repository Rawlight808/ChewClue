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

-- If you already created the table before this update, run this migration too:
-- alter table daily_checkins add column if not exists period text not null default 'morning';
-- alter table daily_checkins drop constraint if exists daily_checkins_user_id_date_key;
-- alter table daily_checkins add constraint daily_checkins_user_date_period_key unique (user_id, date, period);
-- drop index if exists daily_checkins_user_date;
-- create index if not exists daily_checkins_user_date on daily_checkins (user_id, date, period);
-- alter table daily_checkins drop constraint if exists daily_checkins_period_check;
-- alter table daily_checkins add constraint daily_checkins_period_check check (period in ('morning', 'evening'));
-- alter table daily_checkins add column if not exists custom_labels jsonb not null default '{}'::jsonb;
-- alter table daily_checkins add column if not exists custom_directions jsonb not null default '{}'::jsonb;
-- alter table daily_checkins add column if not exists extra_metrics jsonb not null default '[]'::jsonb;

-- Allow partial check-ins (0 = unanswered):
-- alter table daily_checkins drop constraint if exists daily_checkins_sleep_quality_check;
-- alter table daily_checkins add constraint daily_checkins_sleep_quality_check check (sleep_quality between 0 and 5);
-- alter table daily_checkins drop constraint if exists daily_checkins_energy_check;
-- alter table daily_checkins add constraint daily_checkins_energy_check check (energy between 0 and 5);
-- alter table daily_checkins drop constraint if exists daily_checkins_mood_check;
-- alter table daily_checkins add constraint daily_checkins_mood_check check (mood between 0 and 5);
-- alter table daily_checkins drop constraint if exists daily_checkins_pain_check;
-- alter table daily_checkins add constraint daily_checkins_pain_check check (pain between 0 and 5);
-- alter table daily_checkins drop constraint if exists daily_checkins_bowel_check;
-- alter table daily_checkins add constraint daily_checkins_bowel_check check (bowel between 0 and 5);
-- alter table daily_checkins alter column sleep_quality set default 0;
-- alter table daily_checkins alter column energy set default 0;
-- alter table daily_checkins alter column mood set default 0;
-- alter table daily_checkins alter column pain set default 0;
-- alter table daily_checkins alter column bowel set default 0;

-- Rename the "snack" meal slot to "supplement" (run if your table predates this change):
-- update food_entries set meal = 'supplement' where meal = 'snack';
-- alter table food_entries drop constraint if exists food_entries_meal_check;
-- alter table food_entries add constraint food_entries_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'supplement'));

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
