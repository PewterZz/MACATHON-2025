-- Combined Migration: Initial Setup and Subsequent Changes

-- ==================================
-- Phase 1: Initial Table Creations (from init)
-- ==================================

-- Create profiles table (extends auth.users) if it doesn't exist
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  is_helper boolean default false not null,
  helper_score int default 0 not null,
  contact_email text
);

-- Create requests table if it doesn't exist
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  external_id text,
  summary text,
  risk numeric default 0.5 not null,
  status text default 'open' not null,
  created_at timestamptz default now() not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  user_id uuid -- Placeholder, will be properly defined later
);

-- Create messages table if it doesn't exist
create table if not exists public.messages (
  id bigserial primary key,
  request_id uuid references public.requests(id) on delete cascade,
  sender text not null,
  content text,
  ts timestamptz default now() not null
);

-- Create RTC signaling table for WebRTC peer connections if it doesn't exist (from rtc_signaling)
create table if not exists public.rtc_signaling (
  id bigserial primary key,
  request_id uuid references public.requests(id) on delete cascade,
  type text not null,
  data jsonb not null,
  from_helper boolean not null,
  created_at timestamptz default now() not null
);

-- ==================================
-- Phase 2: Table Alterations & Constraints (Add user_id properly)
-- ==================================

-- Add user_id column to requests table if it doesn't exist (originally added in init, ensure FK here)
alter table public.requests add column if not exists user_id uuid;

-- Drop constraint first in case it exists with a different definition
alter table public.requests drop constraint if exists requests_user_id_fkey;

-- Add foreign key constraint to link user_id to auth.users
alter table public.requests
add constraint requests_user_id_fkey
foreign key (user_id)
references auth.users (id)
on delete set null; -- Or choose 'on delete cascade' if requests should be deleted when user is deleted

-- ==================================
-- Phase 3: Enable RLS (Run once per table)
-- ==================================

alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.rtc_signaling enable row level security;

-- Ensure RLS is forced (Optional, uncomment if needed, usually default)
-- alter table public.messages force row level security;

-- ==================================
-- Phase 4: Drop ALL potentially existing policies (clean slate)
-- ==================================

-- Profiles
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- Requests
drop policy if exists "Helpers can view requests" on public.requests;
drop policy if exists "Helpers can claim open requests" on public.requests;
drop policy if exists "Users can view their own requests" on public.requests;
drop policy if exists "Users can create their own requests" on public.requests;

-- Messages
drop policy if exists "Messages are viewable by request owner or helper" on public.messages;
drop policy if exists "Messages are insertable by authenticated users" on public.messages;
drop policy if exists "Messages are viewable by helpers" on public.messages;
drop policy if exists "Helpers can view messages for their claimed requests" on public.messages;
drop policy if exists "Helpers can insert messages to their claimed requests" on public.messages;
drop policy if exists "Messages are viewable by helpers and service role" on public.messages;
drop policy if exists "Messages are insertable by helpers and service role" on public.messages;
drop policy if exists "System and AI messages are always allowed" on public.messages;
drop policy if exists "Helpers can read messages" on public.messages;
drop policy if exists "Helpers can read their claimed messages" on public.messages;
drop policy if exists "AI messages are readable by all" on public.messages;
drop policy if exists "Users can insert messages for their claimed requests" on public.messages;
drop policy if exists "Users can view messages for their own requests" on public.messages;
drop policy if exists "Users can insert messages to their own requests" on public.messages;

-- RTC Signaling
drop policy if exists "Allow read access to signaling messages for request participants" on public.rtc_signaling;
drop policy if exists "Allow insert access to signaling messages for request participants" on public.rtc_signaling;

-- ==================================
-- Phase 5: Create Final RLS Policies
-- ==================================

-- Profiles
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Requests (User specific)
create policy "Users can view their own requests" on public.requests for select using ( auth.uid() = user_id );
create policy "Users can create their own requests" on public.requests for insert with check ( auth.uid() = user_id );

-- Requests (Helper specific)
create policy "Helpers can view requests" on public.requests for select using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_helper = true));
create policy "Helpers can claim open requests" on public.requests for update using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_helper = true) and status = 'open') with check (claimed_by = auth.uid() and status = 'claimed');

-- Messages (Combined Logic - View)
create policy "Messages are viewable by participants or AI" on public.messages for select using (
  -- User viewing messages for their request
  (exists (select 1 from public.requests where requests.id = messages.request_id and requests.user_id = auth.uid()))
  or
  -- Helper viewing messages for their claimed request
  (exists (select 1 from public.requests where requests.id = messages.request_id and requests.claimed_by = auth.uid()))
  or
  -- Any helper can view messages (Consider if this is too broad)
  -- (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_helper = true))
  -- or
  -- AI messages are viewable by all authenticated users
  (messages.sender = 'ai')
);

-- Messages (Combined Logic - Insert)
create policy "Messages can be inserted by participants or service_role" on public.messages for insert with check (
  -- User inserting for their request ('caller' sender)
  (exists (select 1 from public.requests where requests.id = messages.request_id and requests.user_id = auth.uid()) and messages.sender = 'caller')
  or
  -- Helper inserting for claimed request ('helper' or 'ai' sender)
  (exists (select 1 from public.requests where requests.id = messages.request_id and requests.claimed_by = auth.uid()) and (messages.sender = 'helper' or messages.sender = 'ai'))
  or
  -- Service role always allowed
  (auth.role() = 'service_role')
);


-- RTC Signaling (Policies depend on user_id and claimed_by)
create policy "Allow read access to signaling messages for request participants" on public.rtc_signaling for select using (
    exists (
      select 1 from public.requests r
      where r.id = rtc_signaling.request_id
      and (r.claimed_by = auth.uid() or r.user_id = auth.uid())
    )
  );

create policy "Allow insert access to signaling messages for request participants" on public.rtc_signaling for insert with check (
    exists (
      select 1 from public.requests r
      where r.id = rtc_signaling.request_id
      and (
        (r.claimed_by = auth.uid() and rtc_signaling.from_helper = true) -- Helper inserting
        or
        (r.user_id = auth.uid() and rtc_signaling.from_helper = false) -- Requester inserting
      )
    )
  );

-- ==================================
-- Phase 6: Functions and Triggers
-- ==================================

-- Function: notify_on_message_insert
create or replace function public.notify_on_message_insert()
returns trigger as $$
begin
  perform pg_notify(
    'new_message',
    json_build_object(
      'request_id', NEW.request_id,
      'sender', NEW.sender,
      'content', NEW.content
    )::text
  );
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger: on_message_insert
drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert
  after insert on public.messages
  for each row
  execute procedure public.notify_on_message_insert();

-- Function: notify_on_request_claim
create or replace function public.notify_on_request_claim()
returns trigger as $$
declare
  caller_phone text;
begin
  -- Only proceed if status changed from 'open' to 'claimed'
  if OLD.status = 'open' and NEW.status = 'claimed' then
    if NEW.channel = 'phone' or NEW.channel = 'whatsapp' then
      caller_phone := NEW.external_id;
      -- Log system message instead of direct edge function call
      insert into public.messages (request_id, sender, content)
      values (NEW.id, 'ai', 'System: Request claimed, notification logged.');
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger: on_request_claim
drop trigger if exists on_request_claim on public.requests;
create trigger on_request_claim
  after update on public.requests
  for each row
  when (OLD.status is distinct from NEW.status) -- Only trigger if status changes
  execute procedure public.notify_on_request_claim();

-- ==================================
-- Phase 7: Grants (Consolidated)
-- ==================================

-- Grant usage on sequences
grant usage on sequence public.messages_id_seq to service_role, authenticated;
-- grant usage on sequence public.rtc_signaling_id_seq to service_role, authenticated; -- Assuming sequence name: rtc_signaling_id_seq - Check if this exists

-- Grant table permissions (adjust based on least privilege principle)
grant select on public.profiles to authenticated;
grant update (name, contact_email) on public.profiles to authenticated; -- Only allow updating specific columns

grant select, insert, update on public.requests to authenticated; -- Users/helpers need broad access based on RLS
grant select, insert, update, delete on public.requests to service_role;

grant select, insert on public.messages to authenticated; -- RLS controls specifics
grant select, insert, update, delete on public.messages to service_role;

grant select, insert on public.rtc_signaling to authenticated; -- RLS controls specifics
grant select, insert, update, delete on public.rtc_signaling to service_role; 