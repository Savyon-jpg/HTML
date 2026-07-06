drop table if exists public.progress cascade;
create table public.progress (
  id bigint generated always as identity primary key,
  student_id text not null,
  lesson_id text not null,
  lesson_title text,
  score integer,
  total integer,
  percent integer,
  mistakes jsonb default '[]'::jsonb,
  wrong_words jsonb default '[]'::jsonb,
  completed_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index progress_student_lesson_idx on public.progress(student_id, lesson_id);
alter table public.progress enable row level security;
create policy "Allow public read" on public.progress for select to anon using (true);
create policy "Allow public insert" on public.progress for insert to anon with check (true);
create policy "Allow public update" on public.progress for update to anon using (true) with check (true);
create policy "Allow public delete" on public.progress for delete to anon using (true);
