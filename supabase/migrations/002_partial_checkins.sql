-- ═══════════════════════════════════════════════════
-- Migration 002: allow partial check-ins (0 = unanswered)
-- ═══════════════════════════════════════════════════
-- Widens each rating's allowed range to 0–5 and defaults it to 0, so a
-- check-in can be saved with some categories left unanswered.
--
-- Safe to run more than once.

alter table daily_checkins drop constraint if exists daily_checkins_sleep_quality_check;
alter table daily_checkins add constraint daily_checkins_sleep_quality_check check (sleep_quality between 0 and 5);
alter table daily_checkins drop constraint if exists daily_checkins_energy_check;
alter table daily_checkins add constraint daily_checkins_energy_check check (energy between 0 and 5);
alter table daily_checkins drop constraint if exists daily_checkins_mood_check;
alter table daily_checkins add constraint daily_checkins_mood_check check (mood between 0 and 5);
alter table daily_checkins drop constraint if exists daily_checkins_pain_check;
alter table daily_checkins add constraint daily_checkins_pain_check check (pain between 0 and 5);
alter table daily_checkins drop constraint if exists daily_checkins_bowel_check;
alter table daily_checkins add constraint daily_checkins_bowel_check check (bowel between 0 and 5);

alter table daily_checkins alter column sleep_quality set default 0;
alter table daily_checkins alter column energy set default 0;
alter table daily_checkins alter column mood set default 0;
alter table daily_checkins alter column pain set default 0;
alter table daily_checkins alter column bowel set default 0;
