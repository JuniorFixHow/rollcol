-- Part 9b: a guardian's message delivered in the RollCol app instead of by SMS.
-- On its own because a new enum value can only be used after it is committed.
alter type public.sms_status add value if not exists 'in_app';
