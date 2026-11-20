-- Part 1: extensions RollCol relies on.
-- PostGIS: geofence checks (ST_DWithin) for tertiary check-in.
-- pg_cron: closing reminders, auto-closing registers, SMS grace periods, weekly summaries.
-- pg_net: lets scheduled jobs call Edge Functions over HTTP.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
