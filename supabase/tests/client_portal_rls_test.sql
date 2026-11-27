-- UXDriven / two-client RLS contract.
-- Run on a LOCAL Supabase stack: supabase test db
-- This transaction rolls back every fixture and inserted audit row.
-- Requires 20261118170000_core.sql and 20261119190000_client_portal_projects_rls.sql.

begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- The IDs are reserved for this rollback-only fixture; no real client is used.
insert into auth.users (id, email) values
  ('11000000-0000-4000-8000-000000000001','rls-client-a@example.invalid'),
  ('11000000-0000-4000-8000-000000000002','rls-client-b@example.invalid'),
  ('11000000-0000-4000-8000-000000000003','rls-agency@example.invalid');

insert into public.organizations(id,name,slug)
values ('22000000-0000-4000-8000-000000000001','UXDriven RLS Test','rls-uxdriven-test');
insert into public.organization_members(organization_id,user_id,role)
values ('22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','owner');
insert into public.clients(id,organization_id,name) values
  ('33000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','RLSTest Client A'),
  ('33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','RLSTest Client B');
insert into public.client_members(client_id,organization_id,user_id) values
  ('33000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001'),
  ('33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002');

insert into public.projects(id,organization_id,client_id,name,client_visible) values
  ('55000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','Shared Project A',true),
  ('55000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','Private Project A',false),
  ('55000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','Shared Project B',true);
insert into public.tasks(id,organization_id,client_id,title,stage,client_visible,created_by) values
  ('44000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','A private task','internal',false,'11000000-0000-4000-8000-000000000003'),
  ('44000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','A shared approval task','client',true,'11000000-0000-4000-8000-000000000003'),
  ('44000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','B shared approval task','client',true,'11000000-0000-4000-8000-000000000003');
insert into public.task_internal_notes(task_id,organization_id,body) values
  ('44000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Secret A'),
  ('44000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','Secret B');
insert into public.task_comments(id,task_id,organization_id,client_id,author_id,visibility,body) values
  ('66000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','shared','A shared comment'),
  ('66000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','internal','A internal comment'),
  ('66000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000003','shared','B shared comment');


-- CLIENT A: all reads must be restricted to explicit shared A records.
set local role authenticated;
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
select results_eq(
  $$select id from public.clients where id in ('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002') order by id$$,
  array['33000000-0000-4000-8000-000000000001'::uuid], 'A sees only client A');
select results_eq(
  $$select id from public.projects where id::text like '55000000-%' order by id$$,
  array['55000000-0000-4000-8000-000000000001'::uuid], 'A sees only shared project A');
select results_eq(
  $$select id from public.tasks where id::text like '44000000-%' order by id$$,
  array['44000000-0000-4000-8000-000000000002'::uuid], 'A sees only shared task A');
select is_empty(
  $$select task_id from public.task_internal_notes where organization_id='22000000-0000-4000-8000-000000000001'::uuid$$,
  'A cannot read private notes');
select results_eq(
  $$select id from public.task_comments where id::text like '66000000-%' order by id$$,
  array['66000000-0000-4000-8000-000000000001'::uuid], 'A sees only shared comments A');
select is_empty(
  $$select id from public.task_approvals where id::text like '77000000-%' order by id$$,
  'A sees no other client approvals');
select is_empty(
  $$update public.tasks set title='Unexpected update' where id='44000000-0000-4000-8000-000000000002'::uuid returning id$$,
  'A cannot update agency tasks');
select is_empty(
  $$update public.projects set name='Unexpected update' where id='55000000-0000-4000-8000-000000000001'::uuid returning id$$,
  'A cannot update agency projects');
select results_eq(
  $$insert into public.task_comments(id,task_id,organization_id,client_id,author_id,visibility,body)
    values ('66000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','shared','Client A reply') returning id$$,
  array['66000000-0000-4000-8000-000000000004'::uuid], 'A can write shared comment A');
select throws_ok(
  $$insert into public.task_comments(task_id,organization_id,client_id,author_id,visibility,body)
    values ('44000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','shared','Forged B comment')$$,
  '42501',null,'A cannot comment on B task');
select results_eq(
  $$insert into public.task_approvals(id,task_id,organization_id,client_id,actor_id,decision)
    values ('77000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','approved') returning id$$,
  array['77000000-0000-4000-8000-000000000003'::uuid], 'A can approve own shared task');
select results_eq(
  $$select stage::text from public.tasks where id='44000000-0000-4000-8000-000000000002'::uuid$$,
  array['done'::text], 'An approval moves its task to Done automatically');
select throws_ok(
  $$insert into public.task_approvals(task_id,organization_id,client_id,actor_id,decision)
    values ('44000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','approved')$$,
  '42501',null,'A cannot approve B task');
select throws_ok(
  $$insert into public.task_approvals(task_id,organization_id,client_id,actor_id,decision)
    values ('44000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','approved')$$,
  '42501',null,'A cannot approve private task');
select throws_ok(
  $$insert into public.client_members(client_id,organization_id,user_id)
    values ('33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001')$$,
  '42501',null,'A cannot self-assign membership B');

-- CLIENT B: mirrored checks prove denial is not a special case for A.
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
select results_eq(
  $$select id from public.clients where id::text like '33000000-%' order by id$$,
  array['33000000-0000-4000-8000-000000000002'::uuid], 'B sees only client B');
select results_eq(
  $$select id from public.tasks where id::text like '44000000-%' order by id$$,
  array['44000000-0000-4000-8000-000000000003'::uuid], 'B sees only shared task B');
select is_empty(
  $$select task_id from public.task_internal_notes where organization_id='22000000-0000-4000-8000-000000000001'::uuid$$,
  'B cannot read private notes');
select results_eq(
  $$select id from public.task_comments where id::text like '66000000-%' order by id$$,
  array['66000000-0000-4000-8000-000000000003'::uuid], 'B sees only shared comments B');
select is_empty(
  $$select id from public.task_approvals where id::text like '77000000-%' order by id$$,
  'B cannot read approvals issued by A');
select results_eq(
  $$insert into public.task_approvals(id,task_id,organization_id,client_id,actor_id,decision,message)
    values ('77000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','changes_requested','Please revise copy') returning id$$,
  array['77000000-0000-4000-8000-000000000004'::uuid], 'B can request changes on own visible task');
select results_eq(
  $$select stage::text from public.tasks where id='44000000-0000-4000-8000-000000000003'::uuid$$,
  array['internal'::text], 'A revision moves its task to Internal review automatically');
-- After both clients submit decisions, A can see only A records.
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
select results_eq(
  $$select id from public.task_approvals where id::text like '77000000-%' order by id$$,
  array['77000000-0000-4000-8000-000000000003'::uuid], 'A cannot read B client revision');


-- AGENCY: internal notes remain available to an explicitly appointed owner.
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000003';
select results_eq(
  $$select task_id from public.task_internal_notes where organization_id='22000000-0000-4000-8000-000000000001'::uuid order by task_id$$,
  array['44000000-0000-4000-8000-000000000001'::uuid,'44000000-0000-4000-8000-000000000003'::uuid],
  'Agency owner sees internal notes');
select results_eq(
  $$select id from public.tasks where id::text like '44000000-%' order by id$$,
  array['44000000-0000-4000-8000-000000000001'::uuid,'44000000-0000-4000-8000-000000000002'::uuid,'44000000-0000-4000-8000-000000000003'::uuid],
  'Agency owner sees its tasks, including private tasks');

-- ANON: even a known task ID must not grant access.
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok(
  $$select id from public.tasks where id='44000000-0000-4000-8000-000000000002'::uuid$$,
  '42501',null,'Anonymous role cannot read tasks');

reset role;
select * from finish();
rollback;
