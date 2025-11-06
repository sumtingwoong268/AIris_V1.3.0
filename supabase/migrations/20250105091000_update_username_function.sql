-- Refresh generate_random_username to use fully qualified pgcrypto call
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['postgres', 'supabase_admin', 'auth_admin', 'anon', 'authenticated', 'service_role']
  loop
    begin
      execute format('grant usage on schema extensions to %I', role_name);
    exception
      when undefined_object then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.generate_random_username()
returns text
language plpgsql
security definer
as $$
declare
  candidate text;
begin
  loop
    candidate := '@' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10);
    exit when not exists (select 1 from public.profiles where username = candidate);
  end loop;
  return candidate;
end;
$$;
