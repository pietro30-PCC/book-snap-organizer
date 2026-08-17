do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','user');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- Reset policies on domain tables: public read, admin write
do $$
declare t text; p record;
begin
  foreach t in array array['livros','alunos','emprestimos'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy "livros_public_read" on public.livros for select to anon, authenticated using (true);
create policy "livros_admin_write" on public.livros for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "alunos_public_read" on public.alunos for select to anon, authenticated using (true);
create policy "alunos_admin_write" on public.alunos for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "emprestimos_public_read" on public.emprestimos for select to anon, authenticated using (true);
create policy "emprestimos_admin_write" on public.emprestimos for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

grant select on public.livros to anon, authenticated;
grant select on public.alunos to anon, authenticated;
grant select on public.emprestimos to anon, authenticated;
grant insert, update, delete on public.livros to authenticated;
grant insert, update, delete on public.alunos to authenticated;
grant insert, update, delete on public.emprestimos to authenticated;
grant all on public.livros to service_role;
grant all on public.alunos to service_role;
grant all on public.emprestimos to service_role;

-- Storage: capas bucket
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like '%capas%' loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "capas_read" on storage.objects for select using (bucket_id = 'capas');
create policy "capas_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'capas' and public.has_role(auth.uid(),'admin'));
create policy "capas_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'capas' and public.has_role(auth.uid(),'admin'));