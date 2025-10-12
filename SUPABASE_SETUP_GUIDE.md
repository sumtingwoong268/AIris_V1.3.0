# 🔧 Complete Supabase Setup Guide for AIris V1.3.0

## ⚠️ IMPORTANT: Fresh Start Instructions

If your current Supabase project isn't working properly, follow these steps for a **complete reset**.

---

## Step 1: Create New Supabase Project (Recommended)

### Option A: Create Brand New Project (Cleanest)
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose your organization
4. Fill in:
   - **Name**: `AIris-V1.3`
   - **Database Password**: (Save this securely!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine
5. Wait for project to initialize (~2 minutes)

### Option B: Reset Existing Project
1. Go to your Supabase Dashboard
2. Settings → Database → Reset database password (to reset)
3. Or manually drop tables (see SQL script)

---

## Step 2: Run the Setup SQL Script

1. In your Supabase Dashboard, go to **SQL Editor**
2. Click **"+ New Query"**
3. Copy **ALL** contents from `supabase/setup.sql`
4. Paste into the SQL editor
5. Click **"Run"**
6. Wait for "Success. No rows returned" message

### What This Does:
- ✅ Creates all tables (profiles, test_results, reports, friendships, friend_requests)
- ✅ Sets up Row Level Security (RLS) policies
- ✅ Creates functions for XP updates
- ✅ Sets up auto-profile creation on signup
- ✅ Creates avatars storage bucket
- ✅ Sets up storage policies
- ✅ Creates performance indexes

---

## Step 3: Update Your .env File

1. In Supabase Dashboard, go to **Settings → API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

3. Update your `.env` or `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. **IMPORTANT**: Restart your dev server after changing .env:
```bash
# Stop server (Ctrl+C)
npm run dev
# or
bun run dev
```

---

## Step 4: Verify Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. You should see an **"avatars"** bucket
3. Click on it
4. Settings → Make sure **Public bucket** is checked ✅
5. If bucket doesn't exist:
   - Click "New Bucket"
   - Name: `avatars`
   - Public: ✅ Yes
   - Click "Create"

---

## Step 5: Test the Setup

### Test 1: Create Account
```
1. Go to your app
2. Sign up with new email/password
3. Check Supabase Dashboard → Authentication → Users
   → Should see your user!
4. Check Database → profiles table
   → Should see profile created automatically!
```

### Test 2: Profile Persistence
```
1. Login to your app
2. Go to Profile page
3. Change display name and bio
4. Click "Save Changes"
5. Refresh page
   → Data should persist!
6. Check Supabase Database → profiles
   → Should see your updates
```

### Test 3: Avatar Upload
```
1. Go to Profile page
2. Click "Upload Photo"
3. Select image < 5MB
4. Should see success message
5. Check Supabase Storage → avatars bucket
   → Should see your uploaded image!
```

### Test 4: Complete a Test
```
1. Go to Dashboard
2. Start any test (Ishihara, Reading Stress, etc.)
3. Complete it
4. Check Supabase Database → test_results
   → Should see new entry with your score!
5. Check profiles table
   → XP should have increased!
```

### Test 5: Dark Mode
```
1. Go to Profile page
2. Toggle Dark Mode ON
3. Refresh page
   → Should stay dark!
4. Check browser DevTools → Application → Local Storage
   → Should see "darkMode": "true"
```

---

## Step 6: Enable Email Confirmation (Optional but Recommended)

1. Go to **Authentication → Settings**
2. **Email Auth** section:
   - Toggle **"Enable email confirmations"** to ON
   - This prevents fake signups
3. Configure email templates if desired

---

## Step 7: (Optional) Enable Google OAuth

1. Go to **Authentication → Providers**
2. Find **Google** and toggle it ON
3. You'll need:
   - Google Client ID
   - Google Client Secret
   
### Get Google OAuth Credentials:
1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Go to **APIs & Services → Credentials**
4. Click **"+ CREATE CREDENTIALS" → OAuth client ID**
5. Application type: **Web application**
6. Name: `AIris`
7. **Authorized JavaScript origins**:
   - `http://localhost:5173` (for development)
   - `https://your-production-domain.com`
8. **Authorized redirect URIs**:
   - `https://your-project-id.supabase.co/auth/v1/callback`
   - `http://localhost:5173/auth/callback`
9. Click **Create**
10. Copy **Client ID** and **Client Secret**
11. Paste into Supabase Google OAuth settings
12. Click **Save**

---

## Common Issues & Solutions

### Issue 1: "Users not showing up in database"
**Solution**:
- Check if trigger `on_auth_user_created` exists (it should auto-create profiles)
- Run this in SQL Editor:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- If it doesn't exist, run the setup.sql again
```

### Issue 2: "Cannot upload avatar - Bucket not found"
**Solution**:
- Go to Storage → Create bucket named exactly `avatars`
- Make it Public
- Run the storage policy section of setup.sql again

### Issue 3: "Dark mode doesn't persist"
**Solution**:
- Check browser console for errors
- Verify localStorage is enabled in browser
- Try clearing browser cache
- Make sure Tailwind config has `darkMode: 'class'`

### Issue 4: "Friends not working"
**Solution**:
- Verify friendships and friend_requests tables exist
- Check RLS policies are set up correctly
- Run setup.sql again to ensure all policies exist

### Issue 5: "Test results not saving"
**Solution**:
- Check test_results table exists
- Verify RLS policies allow inserts
- Check console for errors
- Make sure user_id matches authenticated user

### Issue 6: "XP not updating"
**Solution**:
- Verify `update_user_xp` function exists:
```sql
SELECT * FROM pg_proc WHERE proname = 'update_user_xp';
```
- If missing, run setup.sql again

---

## Verification Checklist

After setup, verify everything works:

- [ ] Can create new account
- [ ] Profile auto-created on signup
- [ ] Can see user in Authentication tab
- [ ] Can update profile (display name, bio)
- [ ] Changes persist after refresh
- [ ] Can upload avatar image
- [ ] Avatar appears in Storage bucket
- [ ] Avatar shows on Dashboard
- [ ] Dark mode toggles and persists
- [ ] Can complete tests
- [ ] Test results save to database
- [ ] XP increases after tests
- [ ] Can send friend requests
- [ ] Can accept friend requests
- [ ] Friends appear in list
- [ ] Can generate reports
- [ ] Reports save to database

---

## Database Schema Overview

```
profiles
├── id (UUID, references auth.users)
├── display_name (TEXT)
├── bio (TEXT)
├── avatar_url (TEXT)
├── xp (INTEGER)
├── current_streak (INTEGER)
├── last_active_week (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

test_results
├── id (UUID)
├── user_id (UUID, references auth.users)
├── test_type (TEXT)
├── score (NUMERIC)
├── xp_earned (INTEGER)
├── details (JSONB)
└── created_at (TIMESTAMPTZ)

reports
├── id (UUID)
├── user_id (UUID, references auth.users)
├── title (TEXT)
├── summary (TEXT)
├── pdf_url (TEXT)
└── created_at (TIMESTAMPTZ)

friendships
├── id (UUID)
├── user_id (UUID, references auth.users)
├── friend_id (UUID, references auth.users)
└── created_at (TIMESTAMPTZ)

friend_requests
├── id (UUID)
├── sender_id (UUID, references auth.users)
├── receiver_id (UUID, references auth.users)
├── status (TEXT)
└── created_at (TIMESTAMPTZ)
```

---

## Need Help?

If you're still having issues after following this guide:

1. Check Supabase Dashboard → Logs for error messages
2. Check browser console for JavaScript errors
3. Verify all environment variables are correct
4. Try creating a fresh Supabase project
5. Make sure you ran the entire setup.sql script

---

## Quick Reset (If Needed)

To completely wipe and start fresh:

```sql
-- Run this in SQL Editor to drop everything
DROP TABLE IF EXISTS test_results CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_user_xp(UUID, INTEGER) CASCADE;

-- Then run setup.sql again
```

---

**You're all set!** 🎉 

Your Supabase backend should now be working properly with all features enabled.
