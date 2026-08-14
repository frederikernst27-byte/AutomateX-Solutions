-- Gmail OAuth connections and durable AI-classified inbox messages.
-- Refresh tokens are encrypted by the application before storage.
create table public.gmail_connections (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  google_email text not null,
  refresh_token_ciphertext text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'reauthorization_required', 'disconnected')),
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gmail_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  google_message_id text not null,
  google_thread_id text,
  sender text not null,
  subject text not null,
  excerpt text not null default '',
  received_at timestamptz not null,
  intent text not null check (intent in ('confirm', 'cancel', 'reschedule', 'unknown')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  ai_reason text,
  work_order_id uuid references public.work_orders(id) on delete set null,
  action_status text not null default 'pending' check (action_status in ('pending', 'applied', 'ignored')),
  created_at timestamptz not null default now(),
  unique (org_id, google_message_id)
);

create index gmail_inbox_messages_org_received_idx on public.gmail_inbox_messages(org_id, received_at desc);
alter table public.gmail_connections enable row level security;
alter table public.gmail_inbox_messages enable row level security;
create policy gmail_connections_admin_read on public.gmail_connections for select using (public.has_org_role(org_id, 'admin'));
create policy gmail_connections_admin_write on public.gmail_connections for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));
create policy gmail_inbox_messages_admin_read on public.gmail_inbox_messages for select using (public.has_org_role(org_id, 'admin'));
create policy gmail_inbox_messages_admin_write on public.gmail_inbox_messages for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

create trigger gmail_connections_updated before update on public.gmail_connections for each row execute function public.touch_organization_settings();
