-- Test drivers are usable in planning and live maps without creating an
-- authentication user or sending an invitation email.
alter table public.drivers
  alter column email drop not null,
  add column if not exists is_test boolean not null default false;

-- Production drivers still need an email address and a linked auth user.
alter table public.drivers
  add constraint drivers_account_or_test_check
  check (
    is_test
    or (email is not null and btrim(email) <> '' and user_id is not null)
  );
