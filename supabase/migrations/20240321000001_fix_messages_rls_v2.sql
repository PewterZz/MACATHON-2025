-- Reset RLS
drop policy if exists "Messages are viewable by helpers and service role" on messages;
drop policy if exists "Messages are insertable by helpers and service role" on messages;
drop policy if exists "System and AI messages are always allowed" on messages;

-- Enable RLS
alter table messages enable row level security;

-- Policy for helpers to read messages
create policy "Helpers can read messages"
  on messages
  for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_helper = true
    )
  );

-- Policy for helpers to read their claimed messages
create policy "Helpers can read their claimed messages"
  on messages
  for select
  using (
    exists (
      select 1 from requests
      where requests.id = messages.request_id
      and requests.claimed_by = auth.uid()
    )
  );

-- Policy for AI messages
create policy "AI messages are readable by all"
  on messages
  for select
  using (sender = 'ai');

-- Policy for inserting messages
create policy "Users can insert messages for their claimed requests"
  on messages
  for insert
  with check (
    exists (
      select 1 from requests
      where requests.id = messages.request_id
      and requests.claimed_by = auth.uid()
    )
    or 
    auth.role() = 'service_role'
    or
    sender = 'ai'
  );

-- Grant permissions
grant usage on sequence messages_id_seq to service_role, authenticated;
grant all on messages to service_role, authenticated; 