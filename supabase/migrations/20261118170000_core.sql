-- UXDriven Social Studio: MVP operational data model.
-- This migration is intentionally create-only. Apply after reviewing docs/SUPABASE_SETUP.md.
-- All sample customer data must remain fictional until authentication and policies are tested.

create extension if not exists pgcrypto;
create schema if not exists app_private;

create type public.agency_role as enum ('owner', 'admin', 'collaborator');
create type public.task_stage as enum ('backlog', 'progress', 'internal', 'client', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.comment_visibility as enum ('internal', 'shared');
create type public.approval_decision as enum ('approved', 'changes_requested');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Membro da equipe',
  created_at timestamptz not null default now()
);

-- Memberships are granted only by trusted administrators, never by public signup.
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.agency_role not null default 'collaborator',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_by_user on public.organization_members(user_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 160),
  category text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index clients_by_organization on public.clients(organization_id, name);

create table public.client_members (
  client_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id) on delete cascade
);
create index client_members_by_user on public.client_members(user_id, organization_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 180),
  description text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id) on delete cascade,
  unique (id, organization_id, client_id)
);
create index projects_by_client on public.projects(organization_id, client_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  project_id uuid,
  title text not null check (length(btrim(title)) between 2 and 240),
  task_type text not null default 'Social media',
  stage public.task_stage not null default 'backlog',
  priority public.task_priority not null default 'medium',
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  public_summary text not null default '',
  client_visible boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id)
    references public.clients(id, organization_id) on delete cascade,
  foreign key (project_id, organization_id, client_id)
    references public.projects(id, organization_id, client_id),
  unique (id, organization_id, client_id),
  unique (id, organization_id)
);
create index tasks_by_organization_stage on public.tasks(organization_id, stage, due_date);
create index tasks_by_client on public.tasks(client_id, client_visible, due_date);
create index tasks_by_assignee on public.tasks(assigned_to, due_date);

-- Internal notes are in a SEPARATE table. RLS is row-level, not column-level:
-- placing private notes on public.tasks would expose them to client SELECT *.
create table public.task_internal_notes (
  task_id uuid primary key,
  organization_id uuid not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  foreign key (task_id, organization_id)
    references public.tasks(id, organization_id) on delete cascade
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  organization_id uuid not null,
  client_id uuid not null,
  author_id uuid not null default auth.uid() references auth.users(id),
  visibility public.comment_visibility not null default 'shared',
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (task_id, organization_id, client_id)
    references public.tasks(id, organization_id, client_id) on delete cascade
);
create index task_comments_by_task on public.task_comments(task_id, created_at);

-- Append-only decisions; an approval does not silently modify the task stage.
create table public.task_approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  organization_id uuid not null,
  client_id uuid not null,
  actor_id uuid not null default auth.uid() references auth.users(id),
  decision public.approval_decision not null,
  message text not null default '' check (length(message) <= 5000),
  created_at timestamptz not null default now(),
  foreign key (task_id, organization_id, client_id)
    references public.tasks(id, organization_id, client_id) on delete cascade
);
create index task_approvals_by_task on public.task_approvals(task_id, created_at desc);

-- SECURITY DEFINER helpers avoid recursive RLS on membership tables.
-- app_private is not an exposed PostgREST API schema.
create function app_private.is_agency_member(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
    );
$$;

create function app_private.is_client_member(p_client_id uuid, p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.client_members m
      where m.client_id = p_client_id
        and m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
    );
$$;

create function app_private.is_agency_admin(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
        and m.role in ('owner', 'admin')
    );
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
revoke all on function app_private.is_agency_member(uuid) from public;
revoke all on function app_private.is_client_member(uuid, uuid) from public;
revoke all on function app_private.is_agency_admin(uuid) from public;
grant execute on function app_private.is_agency_member(uuid) to authenticated;
grant execute on function app_private.is_client_member(uuid, uuid) to authenticated;
grant execute on function app_private.is_agency_admin(uuid) to authenticated;

create function app_private.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_updated before update on public.organizations
for each row execute function app_private.touch_updated_at();
create trigger clients_updated before update on public.clients
for each row execute function app_private.touch_updated_at();
create trigger projects_updated before update on public.projects
for each row execute function app_private.touch_updated_at();
create trigger tasks_updated before update on public.tasks
for each row execute function app_private.touch_updated_at();
create trigger task_notes_updated before update on public.task_internal_notes
for each row execute function app_private.touch_updated_at();

create function app_private.create_profile_for_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, 'membro'), '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.touch_updated_at() from public;
revoke all on function app_private.create_profile_for_new_user() from public;

create trigger studio_auth_user_profile after insert on auth.users
for each row execute function app_private.create_profile_for_new_user();

-- Supports accounts created before this migration.
insert into public.profiles (user_id, display_name)
select id, split_part(coalesce(email, 'membro'), '@', 1) from auth.users
on conflict (user_id) do nothing;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_internal_notes enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_approvals enable row level security;

-- Authenticated users can see only their own profile; roles are never stored
-- in editable user metadata.
create policy profiles_read_self on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy organizations_read on public.organizations
  for select to authenticated using (app_private.is_agency_member(id));

create policy organization_members_read on public.organization_members
  for select to authenticated using (
    user_id = (select auth.uid()) or app_private.is_agency_member(organization_id)
  );

create policy clients_read on public.clients
  for select to authenticated using (
    app_private.is_agency_member(organization_id) or
    app_private.is_client_member(id, organization_id)
  );
create policy clients_insert on public.clients
  for insert to authenticated with check (app_private.is_agency_admin(organization_id));
create policy clients_update on public.clients
  for update to authenticated using (app_private.is_agency_admin(organization_id))
  with check (app_private.is_agency_admin(organization_id));

create policy client_members_read on public.client_members
  for select to authenticated using (
    user_id = (select auth.uid()) or app_private.is_agency_member(organization_id)
  );

create policy projects_read on public.projects
  for select to authenticated using (
    app_private.is_agency_member(organization_id) or
    app_private.is_client_member(client_id, organization_id)
  );
create policy projects_insert on public.projects
  for insert to authenticated with check (app_private.is_agency_admin(organization_id));
create policy projects_update on public.projects
  for update to authenticated using (app_private.is_agency_admin(organization_id))
  with check (app_private.is_agency_admin(organization_id));

-- A client sees only explicitly shared tasks for their own company.
create policy tasks_read on public.tasks
  for select to authenticated using (
    app_private.is_agency_member(organization_id) or
    (client_visible and app_private.is_client_member(client_id, organization_id))
  );
create policy tasks_insert on public.tasks
  for insert to authenticated with check (
    app_private.is_agency_member(organization_id) and created_by = (select auth.uid())
  );
create policy tasks_update on public.tasks
  for update to authenticated using (app_private.is_agency_member(organization_id))
  with check (app_private.is_agency_member(organization_id));

create policy task_internal_notes_read on public.task_internal_notes
  for select to authenticated using (app_private.is_agency_member(organization_id));
create policy task_internal_notes_insert on public.task_internal_notes
  for insert to authenticated with check (app_private.is_agency_member(organization_id));
create policy task_internal_notes_update on public.task_internal_notes
  for update to authenticated using (app_private.is_agency_member(organization_id))
  with check (app_private.is_agency_member(organization_id));

create policy task_comments_read on public.task_comments
  for select to authenticated using (
    app_private.is_agency_member(organization_id) or
    (
      visibility = 'shared' and
      app_private.is_client_member(client_id, organization_id) and
      exists (select 1 from public.tasks t
        where t.id = task_id and t.client_visible)
    )
  );
create policy task_comments_insert on public.task_comments
  for insert to authenticated with check (
    author_id = (select auth.uid()) and (
      app_private.is_agency_member(organization_id) or
      (
        visibility = 'shared' and
        app_private.is_client_member(client_id, organization_id) and
        exists (select 1 from public.tasks t
          where t.id = task_id and t.client_visible)
      )
    )
  );

create policy task_approvals_read on public.task_approvals
  for select to authenticated using (
    app_private.is_agency_member(organization_id) or
    (
      app_private.is_client_member(client_id, organization_id) and
      exists (select 1 from public.tasks t
        where t.id = task_id and t.client_visible)
    )
  );
create policy task_approvals_insert on public.task_approvals
  for insert to authenticated with check (
    actor_id = (select auth.uid()) and
    app_private.is_client_member(client_id, organization_id) and
    exists (select 1 from public.tasks t
      where t.id = task_id and t.client_visible and t.stage = 'client')
  );

-- Apply least-privilege API grants on OUR tables only.
revoke all on public.organizations, public.profiles, public.organization_members,
  public.clients, public.client_members, public.projects, public.tasks,
  public.task_internal_notes, public.task_comments, public.task_approvals
  from anon, public;

grant select on public.organizations, public.organization_members,
  public.client_members to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.clients, public.projects, public.tasks,
  public.task_internal_notes to authenticated;
grant select, insert on public.task_comments, public.task_approvals to authenticated;

-- Membership tables intentionally have no INSERT/UPDATE/DELETE for authenticated.
-- Bootstrap the first owner in Supabase SQL Editor, then implement server-only invitations.
