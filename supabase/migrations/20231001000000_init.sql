-- Create profiles table (extends auth.users)
create table profiles (
  id uuid primary key references auth.users,
  name text,
  is_helper boolean default false,
  helper_score int default 0
);

-- Create requests table
create table requests (
  id uuid primary key default gen_random_uuid(),
  channel text, -- phone | whatsapp | discord
  external_id text, -- CallSid / msgId
  summary text,
  risk numeric,
  status text default 'open', -- open | claimed | closed
  created_at timestamptz default now(),
  claimed_by uuid references profiles(id)
);

-- Create messages table
create table messages (
  id bigserial primary key,
  request_id uuid references requests(id),
  sender text, -- caller | helper | ai
  content text,
  ts timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table requests enable row level security;
alter table messages enable row level security;

-- Create RLS policies for profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Create RLS policies for requests
create policy "Helpers can view requests"
  on requests for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_helper = true));

create policy "Helpers can claim open requests"
  on requests for update
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_helper = true) and
    status = 'open'
  )
  with check (
    claimed_by = auth.uid() and
    status = 'claimed'
  );

-- Create RLS policies for messages
create policy "Helpers can view messages for their claimed requests"
  on messages for select
  using (
    exists (
      select 1 from requests
      where requests.id = request_id
      and requests.claimed_by = auth.uid()
    )
  );

create policy "Helpers can insert messages to their claimed requests"
  on messages for insert
  with check (
    exists (
      select 1 from requests
      where requests.id = request_id
      and requests.claimed_by = auth.uid()
    ) and
    (sender = 'helper' or sender = 'ai')
  );

-- Create or replace function to notify on new message
create or replace function notify_on_message_insert()
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
$$ language plpgsql;

-- Create trigger for the function
create trigger on_message_insert
  after insert on messages
  for each row
  execute procedure notify_on_message_insert();

-- Create function to send SMS when a request is claimed
create or replace function notify_on_request_claim() 
returns trigger as $$
declare
  caller_phone text;
begin
  -- Only proceed if status changed from 'open' to 'claimed'
  if OLD.status = 'open' and NEW.status = 'claimed' then
    -- Get the phone number from the request
    if NEW.channel = 'phone' or NEW.channel = 'whatsapp' then
      caller_phone := NEW.external_id;
      
      -- This would normally call an edge function to send the SMS
      -- For this example, we'll just log it
      insert into messages (request_id, sender, content)
      values (
        NEW.id,
        'ai',
        'System: Request claimed, notification sent to caller.'
      );
    end if;
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Create trigger for the claim notification function
create trigger on_request_claim
  after update on requests
  for each row
  execute procedure notify_on_request_claim(); 