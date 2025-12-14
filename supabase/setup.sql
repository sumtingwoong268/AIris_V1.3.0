-- =====================================================
-- AIris V1.3.0 Complete Supabase Setup Script
-- =====================================================
-- Run this in your Supabase SQL Editor to set up everything

-- Drop existing tables if you want a fresh start (CAREFUL - THIS DELETES ALL DATA!)
-- Uncomment these lines if you want to reset:
-- DROP TABLE IF EXISTS test_results CASCADE;
-- DROP TABLE IF EXISTS reports CASCADE;
-- DROP TABLE IF EXISTS friend_requests CASCADE;
-- DROP TABLE IF EXISTS friendships CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['postgres', 'supabase_admin', 'auth_admin', 'anon', 'authenticated', 'service_role']
  LOOP
    BEGIN
      EXECUTE format('GRANT USAGE ON SCHEMA extensions TO %I', role_name);
    EXCEPTION
      WHEN undefined_object THEN
        NULL;
    END;
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  username TEXT,
  username_changed_at TIMESTAMPTZ,
  bio TEXT,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_active_week TEXT,
  
  -- Extended profile fields
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  ethnicity TEXT,
  
  -- Vision information
  wears_correction TEXT,
  correction_type TEXT,
  last_eye_exam TEXT,
  
  -- Lifestyle
  screen_time_hours NUMERIC,
  outdoor_time_hours NUMERIC,
  symptoms TEXT[], -- array of symptoms
  sleep_quality TEXT,
  
  -- Eye health history
  eye_conditions TEXT[], -- array of conditions
  eye_surgeries TEXT,
  family_history TEXT[], -- array of family conditions
  uses_eye_medication BOOLEAN DEFAULT false,
  medication_details TEXT,
  
  -- Setup completion
  setup_completed BOOLEAN DEFAULT false,
  tos_accepted BOOLEAN DEFAULT false,
  privacy_accepted BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Username helpers
CREATE OR REPLACE FUNCTION public.generate_random_username()
RETURNS TEXT AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := '@' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate);
    -- Keep looping until we find a unique candidate
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE profiles
  ALTER COLUMN username SET DEFAULT public.generate_random_username(),
  ALTER COLUMN username_changed_at SET DEFAULT NOW();

UPDATE profiles
SET
  username = COALESCE(username, public.generate_random_username()),
  username_changed_at = COALESCE(username_changed_at, NOW() - INTERVAL '14 days');

ALTER TABLE profiles
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN username_changed_at SET NOT NULL;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format,
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^@[A-Za-z0-9_.-]{1,19}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

CREATE OR REPLACE FUNCTION public.enforce_username_rules()
RETURNS TRIGGER AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := '@' || lower(regexp_replace(COALESCE(trim(BOTH FROM NEW.username), ''), '^@?', ''));

  IF normalized IS NULL OR normalized = '@' THEN
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

DROP TRIGGER IF EXISTS trg_profiles_username_rules ON profiles;
CREATE TRIGGER trg_profiles_username_rules
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_rules();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" 
  ON profiles FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- 2. TEST RESULTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL,
  score NUMERIC,
  xp_earned INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test_results
DROP POLICY IF EXISTS "Users can view own results" ON test_results;
CREATE POLICY "Users can view own results" 
  ON test_results FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own results" ON test_results;
CREATE POLICY "Users can insert own results" 
  ON test_results FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports" 
  ON reports FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reports" ON reports;
CREATE POLICY "Users can insert own reports" 
  ON reports FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. FRIENDSHIPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friendships
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" 
  ON friendships FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can insert own friendships" ON friendships;
CREATE POLICY "Users can insert own friendships" 
  ON friendships FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" 
  ON friendships FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. USER PREFERENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  dark_mode BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" 
  ON user_preferences FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" 
  ON user_preferences FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" 
  ON user_preferences FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. FRIEND REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friend_requests
DROP POLICY IF EXISTS "Users can view own requests" ON friend_requests;
CREATE POLICY "Users can view own requests" 
  ON friend_requests FOR SELECT 
  TO authenticated 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert own requests" ON friend_requests;
CREATE POLICY "Users can insert own requests" 
  ON friend_requests FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update received requests" ON friend_requests;
CREATE POLICY "Users can update received requests" 
  ON friend_requests FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = receiver_id);

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Function to update XP
CREATE OR REPLACE FUNCTION update_user_xp(p_user_id UUID, p_xp_delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET xp = GREATEST(0, xp + p_xp_delta),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create profile and preferences on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  seeded_username TEXT := public.generate_random_username();
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, display_name, username, username_changed_at, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    seeded_username,
    NOW() - INTERVAL '14 days',
    NOW(),
    NOW()
  );
  
  -- Create preferences
  INSERT INTO public.user_preferences (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 7. STORAGE BUCKET FOR AVATARS
-- =====================================================

-- Insert bucket if it doesn't exist (this may fail if bucket exists, that's okay)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_created_at ON test_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_test_type ON test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================

-- Verify setup
SELECT 'Setup complete! Run this to verify:' AS message;
SELECT 'SELECT * FROM profiles;' AS verification_query;
