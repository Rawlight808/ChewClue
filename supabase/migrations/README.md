# Supabase migrations

`supabase-setup.sql` (in the repo root) is the **complete schema for a fresh
project** — run it once when creating a brand-new ChewClue database and you're
done. Do not run it again afterward.

These migrations are for databases that were created with an **older** version
of the schema and need to catch up. Each file is one self-contained change.

## How to apply

1. Open the Supabase dashboard → **SQL Editor** → **New query**
2. Paste the contents of the lowest-numbered migration you haven't run yet
3. Click **Run**, then repeat for each later migration **in numbered order**

Every migration is written to be safe to run more than once (`if exists` /
`if not exists` guards, idempotent updates), so re-running one you've already
applied won't hurt.

## Migrations

| File | What it does |
|---|---|
| `001_checkin_periods_and_custom_metrics.sql` | Adds `period` (morning/evening) and the jsonb columns for custom labels, directions, and extra metrics |
| `002_partial_checkins.sql` | Allows ratings of 0 so a check-in can be saved with some categories unanswered |
| `003_snack_to_supplement.sql` | Renames the `snack` meal slot to `supplement` |

## Not sure what's already applied?

Inspect the current shape of a table:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'daily_checkins' order by ordinal_position;

select meal, count(*) from food_entries group by meal order by meal;
```

If a migration's changes are already present, you can skip it (or run it
anyway — it's idempotent).
