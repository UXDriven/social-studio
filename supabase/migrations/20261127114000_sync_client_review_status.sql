-- Synchronize a client's approval/revision with the agency Kanban atomically.
-- Client accounts retain INSERT-only access to task_approvals, never UPDATE on tasks.
-- Existing approvals and task stages remain unchanged; applies to NEW decisions only.
create or replace function app_private.sync_client_decision_to_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare next_stage public.task_stage;
begin
  -- An inserted decision must come from a member authorized for that client.
  if (select auth.uid()) is null
     or new.actor_id is distinct from (select auth.uid())
     or not app_private.is_client_member(new.client_id, new.organization_id) then
    raise exception 'Client decision is not authorized' using errcode = '42501';
  end if;

  next_stage := case new.decision
    when 'approved'::public.approval_decision then 'done'::public.task_stage
    when 'changes_requested'::public.approval_decision then 'internal'::public.task_stage
  end;

  -- This runs as a trusted database trigger, but only for the exact shared task.
  -- The task stage and decision are saved in the SAME transaction, or both fail.
  update public.tasks
     set stage = next_stage
   where id = new.task_id
     and organization_id = new.organization_id
     and client_id = new.client_id
     and client_visible = true
     and stage = 'client'::public.task_stage;

  if not found then
    raise exception 'Task is not awaiting client approval' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Trigger function isn't an exposed RPC. It is invoked only by the DB trigger.
revoke all on function app_private.sync_client_decision_to_task() from public;
revoke all on function app_private.sync_client_decision_to_task() from anon, authenticated;

drop trigger if exists on_client_decision_sync_task on public.task_approvals;
create trigger on_client_decision_sync_task
  after insert on public.task_approvals
  for each row execute function app_private.sync_client_decision_to_task();
