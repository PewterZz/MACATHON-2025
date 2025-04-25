-- Drop existing RLS policies for messages table if they exist
drop policy if exists "Messages are viewable by request owner or helper" on messages;
drop policy if exists "Messages are insertable by authenticated users" on messages;
drop policy if exists "Messages are viewable by helpers" on messages;

-- Enable RLS on messages table
alter table messages enable row level security;

-- Allow service role full access
alter table messages force row level security;
alter table messages enable row level security;
grant all privileges on messages to service_role;

-- Policy for viewing messages
create policy "Messages are viewable by helpers and service role"
  on messages
  for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and (
        profiles.is_helper = true
        or exists (
          select 1 from requests
          where requests.id = messages.request_id
          and requests.claimed_by = auth.uid()
        )
      )
    )
    or auth.role() = 'service_role'
  );

-- Policy for inserting messages
create policy "Messages are insertable by helpers and service role"
  on messages
  for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and (
        profiles.is_helper = true
        or exists (
          select 1 from requests
          where requests.id = messages.request_id
          and requests.claimed_by = auth.uid()
        )
      )
    )
    or auth.role() = 'service_role'
  );

-- Policy for system/AI messages
create policy "System and AI messages are always allowed"
  on messages
  for all
  using (sender = 'ai')
  with check (sender = 'ai');

-- Grant necessary permissions
grant all on messages to authenticated;
grant all on messages to service_role; 