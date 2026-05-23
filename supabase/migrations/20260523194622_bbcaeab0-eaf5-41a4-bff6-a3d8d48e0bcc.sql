
-- Events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_date timestamptz not null,
  venue text not null,
  brand_color text not null default '#ed2100',
  banner_url text,
  organizer_name text not null,
  organizer_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Owners can view their events"
  on public.events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Owners can insert their events"
  on public.events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Owners can update their events"
  on public.events for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Owners can delete their events"
  on public.events for delete
  to authenticated
  using (auth.uid() = user_id);

-- Attendees table
create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  ticket_type text not null default 'General',
  pass_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'unused' check (status in ('unused','used')),
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index attendees_event_id_idx on public.attendees(event_id);
create index attendees_pass_code_idx on public.attendees(pass_code);

alter table public.attendees enable row level security;

create policy "Event owners can view attendees"
  on public.attendees for select
  to authenticated
  using (exists (select 1 from public.events e where e.id = attendees.event_id and e.user_id = auth.uid()));

create policy "Event owners can insert attendees"
  on public.attendees for insert
  to authenticated
  with check (exists (select 1 from public.events e where e.id = attendees.event_id and e.user_id = auth.uid()));

create policy "Event owners can update attendees"
  on public.attendees for update
  to authenticated
  using (exists (select 1 from public.events e where e.id = attendees.event_id and e.user_id = auth.uid()));

create policy "Event owners can delete attendees"
  on public.attendees for delete
  to authenticated
  using (exists (select 1 from public.events e where e.id = attendees.event_id and e.user_id = auth.uid()));

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
