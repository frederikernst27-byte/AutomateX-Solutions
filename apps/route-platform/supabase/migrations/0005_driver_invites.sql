-- A driver email identifies one account within an organization. Enforce the
-- same rule in PostgreSQL so concurrent invitations cannot create duplicates.
create unique index if not exists drivers_org_email_unique_idx
  on public.drivers (org_id, lower(email));
