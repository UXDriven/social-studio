-- Client portal hardening: a project can contain internal planning details.
-- Keep every existing project private until the agency explicitly shares it.
-- Run once in Supabase SQL Editor on the same project as core.sql.

alter table public.projects
  add column if not exists client_visible boolean not null default false;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select to authenticated using (
    app_private.is_agency_member(organization_id)
    or (client_visible and app_private.is_client_member(client_id, organization_id))
  );

create index if not exists projects_shared_by_client
  on public.projects (client_id, client_visible)
  where is_archived = false;
