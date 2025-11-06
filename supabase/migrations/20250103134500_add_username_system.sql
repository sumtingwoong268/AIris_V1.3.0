-- Ensure pgcrypto is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add username columns if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

-- Function to generate a unique random username
CREATE OR REPLACE FUNCTION public.generate_random_username()
RETURNS TEXT AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := '@' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE username = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply defaults for new rows
ALTER TABLE public.profiles
  ALTER COLUMN username SET DEFAULT public.generate_random_username(),
  ALTER COLUMN username_changed_at SET DEFAULT NOW();

-- Backfill existing usernames and change timestamps
UPDATE public.profiles
SET username = public.generate_random_username()
WHERE username IS NULL OR username = '';

UPDATE public.profiles
SET username_changed_at = NOW() - INTERVAL '14 days'
WHERE username_changed_at IS NULL;

-- Enforce not-null and format rules
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN username_changed_at SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format,
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^@[A-Za-z0-9_.-]{1,19}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Trigger to normalize and throttle username changes
CREATE OR REPLACE FUNCTION public.enforce_username_rules()
RETURNS TRIGGER AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := '@' || lower(regexp_replace(COALESCE(trim(BOTH FROM NEW.username), ''), '^@?', ''));

  IF normalized = '@' THEN
    RAISE EXCEPTION 'Username is required';
  END IF;

  IF normalized !~ '^@[a-z0-9_.-]{1,19}$' THEN
    RAISE EXCEPTION 'Username must start with @, be 2-20 characters, and use only letters, numbers, ".", "_", or "-"';
  END IF;

  IF TG_OP = 'UPDATE' AND normalized <> OLD.username THEN
    IF OLD.username_changed_at > NOW() - INTERVAL '14 days' THEN
      RAISE EXCEPTION 'Username can only be changed every 14 days';
    END IF;
    NEW.username_changed_at = NOW();
  ELSIF TG_OP = 'INSERT' AND NEW.username_changed_at IS NULL THEN
    NEW.username_changed_at = NOW();
  END IF;

  NEW.username = normalized;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profiles_username_rules ON public.profiles;
CREATE TRIGGER trg_profiles_username_rules
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_rules();

-- Ensure the signup trigger seeds usernames and preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  seeded_username TEXT := public.generate_random_username();
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    username,
    username_changed_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    seeded_username,
    NOW() - INTERVAL '14 days',
    NOW(),
    NOW()
  );

  INSERT INTO public.user_preferences (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
