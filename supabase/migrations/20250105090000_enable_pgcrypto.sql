-- Ensure pgcrypto is available for functions using gen_random_bytes
create extension if not exists pgcrypto with schema extensions;

-- Make sure application roles can access functions in the extensions schema
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
        -- Some managed projects do not have every listed role; ignore missing ones.
        null;
    end;
  end loop;
end;
$$;
