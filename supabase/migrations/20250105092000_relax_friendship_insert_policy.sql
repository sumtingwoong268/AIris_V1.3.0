-- Allow users to insert reciprocal friendship rows for accepted requests
drop policy if exists "Users can insert own friendships" on friendships;

create policy "Users can insert own friendships"
  on friendships for insert
  to authenticated
  with check (auth.uid() = user_id or auth.uid() = friend_id);
