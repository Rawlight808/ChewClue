-- ═══════════════════════════════════════════════════
-- Migration 001: morning/evening periods + customizable metrics
-- ═══════════════════════════════════════════════════
-- Adds the `period` column (so a day can have both a morning and evening
-- check-in) and the jsonb columns that back custom category labels,
-- directions, and extra user-defined metrics.
--
-- Safe to run more than once (uses IF EXISTS / IF NOT EXISTS).

alter table daily_checkins add column if not exists period text not null default 'morning';

-- Uniqueness moves from (user, date) to (user, date, period)
alter table daily_checkins drop constraint if exists daily_checkins_user_id_date_key;
alter table daily_checkins add constraint daily_checkins_user_date_period_key unique (user_id, date, period);

drop index if exists daily_checkins_user_date;
create index if not exists daily_checkins_user_date on daily_checkins (user_id, date, period);

alter table daily_checkins drop constraint if exists daily_checkins_period_check;
alter table daily_checkins add constraint daily_checkins_period_check check (period in ('morning', 'evening'));

alter table daily_checkins add column if not exists custom_labels jsonb not null default '{}'::jsonb;
alter table daily_checkins add column if not exists custom_directions jsonb not null default '{}'::jsonb;
alter table daily_checkins add column if not exists extra_metrics jsonb not null default '[]'::jsonb;
