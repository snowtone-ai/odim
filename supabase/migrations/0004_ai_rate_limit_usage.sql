create table if not exists ai_rate_limit_usage (
  org_id text not null,
  model text not null,
  window_type text not null,
  window_key text not null,
  requests int not null default 0,
  tokens int not null default 0,
  updated_at timestamptz default now(),
  primary key (org_id, model, window_type, window_key)
);

alter table ai_rate_limit_usage enable row level security;

create or replace function consume_ai_rate_limit(
  p_org_id text,
  p_model text,
  p_minute_key text,
  p_day_key text,
  p_estimated_tokens int,
  p_rpm int,
  p_rpd int,
  p_tpm int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_minute_requests int;
  current_minute_tokens int;
  current_day_requests int;
begin
  perform pg_advisory_xact_lock(hashtext(p_org_id || ':' || p_model));

  select requests, tokens
  into current_minute_requests, current_minute_tokens
  from ai_rate_limit_usage
  where org_id = p_org_id
    and model = p_model
    and window_type = 'minute'
    and window_key = p_minute_key
  for update;

  select requests
  into current_day_requests
  from ai_rate_limit_usage
  where org_id = p_org_id
    and model = p_model
    and window_type = 'day'
    and window_key = p_day_key
  for update;

  current_minute_requests := coalesce(current_minute_requests, 0);
  current_minute_tokens := coalesce(current_minute_tokens, 0);
  current_day_requests := coalesce(current_day_requests, 0);

  if current_minute_requests + 1 > p_rpm then
    return false;
  end if;
  if current_minute_tokens + p_estimated_tokens > p_tpm then
    return false;
  end if;
  if current_day_requests + 1 > p_rpd then
    return false;
  end if;

  insert into ai_rate_limit_usage (org_id, model, window_type, window_key, requests, tokens, updated_at)
  values (p_org_id, p_model, 'minute', p_minute_key, 1, p_estimated_tokens, now())
  on conflict (org_id, model, window_type, window_key) do update
  set requests = ai_rate_limit_usage.requests + 1,
      tokens = ai_rate_limit_usage.tokens + excluded.tokens,
      updated_at = now();

  insert into ai_rate_limit_usage (org_id, model, window_type, window_key, requests, tokens, updated_at)
  values (p_org_id, p_model, 'day', p_day_key, 1, 0, now())
  on conflict (org_id, model, window_type, window_key) do update
  set requests = ai_rate_limit_usage.requests + 1,
      updated_at = now();

  return true;
end;
$$;

grant all privileges on ai_rate_limit_usage to service_role;
grant execute on function consume_ai_rate_limit(text, text, text, text, int, int, int, int) to service_role;
