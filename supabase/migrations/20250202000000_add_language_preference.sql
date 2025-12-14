-- Add language preference to user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

UPDATE public.user_preferences
SET language = COALESCE(language, 'en')
WHERE language IS NULL;
