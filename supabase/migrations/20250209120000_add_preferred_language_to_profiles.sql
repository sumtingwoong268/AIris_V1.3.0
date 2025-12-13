-- Add preferred language support for multilingual UI
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'hi', 'mr', 'pa', 'ta', 'bn', 'ko'));

COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred language for the application UI';
