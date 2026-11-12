-- Feedback on individual saved AI responses, separate from email scan feedback.
-- Requires the existing public.chat_messages table with UUID primary key.
create table if not exists public.ai_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  rating text not null check (rating in ('accurate', 'incorrect')),
  reason text not null default '' check (char_length(reason) <= 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, message_id)
);

create index if not exists ai_answer_feedback_user_idx on public.ai_answer_feedback(user_id);
alter table public.ai_answer_feedback enable row level security;
revoke all on public.ai_answer_feedback from anon;
grant select, insert, update, delete on public.ai_answer_feedback to authenticated;

create policy "ai feedback own select" on public.ai_answer_feedback
  for select to authenticated using (auth.uid() = user_id);
create policy "ai feedback own insert" on public.ai_answer_feedback
  for insert to authenticated with check (
    auth.uid() = user_id and exists (
      select 1 from public.chat_messages m
      where m.id = message_id and m.user_id = auth.uid() and m.role = 'assistant'
    )
  );
create policy "ai feedback own update" on public.ai_answer_feedback
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.chat_messages m
      where m.id = message_id and m.user_id = auth.uid() and m.role = 'assistant'
    )
  );
create policy "ai feedback own delete" on public.ai_answer_feedback
  for delete to authenticated using (auth.uid() = user_id);
notify pgrst, 'reload schema';
