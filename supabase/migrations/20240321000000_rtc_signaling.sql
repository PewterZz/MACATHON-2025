-- Create RTC signaling table for WebRTC peer connections
create table rtc_signaling (
  id bigserial primary key,
  request_id uuid references requests(id) on delete cascade,
  type text not null,
  data jsonb not null,
  from_helper boolean not null,
  created_at timestamptz default now()
);

-- Add RLS policies
alter table rtc_signaling enable row level security;

create policy "Allow read access to signaling messages for request participants"
  on rtc_signaling for select
  using (
    exists (
      select 1 from requests r
      where r.id = rtc_signaling.request_id
      and (
        r.claimed_by = auth.uid() -- Helper
        or exists ( -- Original requester
          select 1 from messages m
          where m.request_id = r.id
          and m.sender = 'caller'
          limit 1
        )
      )
    )
  );

create policy "Allow insert access to signaling messages for request participants"
  on rtc_signaling for insert
  with check (
    exists (
      select 1 from requests r
      where r.id = rtc_signaling.request_id
      and (
        r.claimed_by = auth.uid() -- Helper
        or exists ( -- Original requester
          select 1 from messages m
          where m.request_id = r.id
          and m.sender = 'caller'
          limit 1
        )
      )
    )
  ); 