-- Notification triggers
-- Populates the `notifications` table when someone follows you, likes your plant,
-- or comments on your plant. The app only reads/updates notifications
-- (logic/notificationLogic.ts) — these triggers are the only writers.
--
-- How to apply: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run: every statement drops its old version first.
--
-- SECURITY DEFINER is required: the actor (the person following/liking/commenting)
-- is inserting a row into the *recipient's* notifications, which the
-- `auth.uid() = user_id` RLS policy would otherwise block.

-- ─── follows → 'follow' notification ─────────────────────────────────────────

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.notifications (user_id, actor_id, type, read)
    values (new.following_id, new.follower_id, 'follow', false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ─── plant_likes → 'like' notification ───────────────────────────────────────

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id <> new.plant_owner_id then
    insert into public.notifications (user_id, actor_id, type, read)
    values (new.plant_owner_id, new.user_id, 'like', false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_like on public.plant_likes;
create trigger trg_notify_on_like
  after insert on public.plant_likes
  for each row execute function public.notify_on_like();

-- ─── plant_comments → 'comment' notification ─────────────────────────────────

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id <> new.plant_owner_id then
    insert into public.notifications (user_id, actor_id, type, read)
    values (new.plant_owner_id, new.user_id, 'comment', false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment on public.plant_comments;
create trigger trg_notify_on_comment
  after insert on public.plant_comments
  for each row execute function public.notify_on_comment();
