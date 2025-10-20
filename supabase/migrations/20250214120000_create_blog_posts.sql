create extension if not exists "pgcrypto" with schema public;

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  hero_gradient text not null,
  read_time text not null,
  publish_date date not null,
  sections jsonb not null default '[]'::jsonb,
  key_takeaways text[] not null default '{}',
  resources jsonb,
  tags text[] not null default '{}',
  related_slugs text[] not null default '{}',
  author_id uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger blog_posts_updated_at
  before update on blog_posts
  for each row
  execute procedure public.handle_updated_at();

alter table blog_posts enable row level security;

drop policy if exists "Allow read access for blog posts" on blog_posts;
create policy "Allow read access for blog posts"
  on blog_posts
  for select
  using (true);

drop policy if exists "Staff can manage blog posts" on blog_posts;
create policy "Staff can manage blog posts"
  on blog_posts
  for all
  using (coalesce(auth.jwt() ->> 'role', '') = 'staff')
  with check (coalesce(auth.jwt() ->> 'role', '') = 'staff');
