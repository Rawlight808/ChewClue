-- ═══════════════════════════════════════════════════
-- Migration 003: rename the "snack" meal slot to "supplement"
-- ═══════════════════════════════════════════════════
-- Order matters: the old check constraint only allows 'snack', so it must be
-- dropped BEFORE converting rows, then re-added with 'supplement' allowed.
--
-- Safe to run more than once (the UPDATE simply affects 0 rows on a second run).

-- 1. Drop the old constraint that only allows 'snack'
alter table food_entries drop constraint if exists food_entries_meal_check;

-- 2. Convert existing snack rows to supplement
update food_entries set meal = 'supplement' where meal = 'snack';

-- 3. Re-add the constraint with 'supplement' allowed
alter table food_entries add constraint food_entries_meal_check
  check (meal in ('breakfast', 'lunch', 'dinner', 'supplement'));
