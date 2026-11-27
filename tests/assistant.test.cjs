'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../api/assistant.js'),'utf8');
const modelUrl='data:text/javascript;base64,'+Buffer.from(src).toString('base64');
const userA='11000000-0000-4000-8000-000000000001';
const userB='11000000-0000-4000-8000-000000000002';
const org='22000000-0000-4000-8000-000000000001';
const clientA='33000000-0000-4000-8000-000000000001';
const clientB='33000000-0000-4000-8000-000000000002';
async function module(){return import(modelUrl);}
function mockScopeFetch({user=userA,agency=false}={}){
  const seen=[];
  const original=global.fetch;
  global.fetch=async(url,opts={})=>{
    const parsed=new URL(url);
    seen.push(parsed.pathname+parsed.search);
    let result;
    if(parsed.pathname==='/auth/v1/user')result={id:user,email:'test@example.invalid'};
    else if(parsed.pathname.endsWith('/organization_members'))result=agency?[{organization_id:org,role:'owner'}]:[];
    else if(parsed.pathname.endsWith('/client_members'))result=[{organization_id:org,client_id:clientA}];
    else if(parsed.pathname.endsWith('/clients'))result=parsed.searchParams.get('id')==='eq.'+clientB?[]:[{id:clientA,organization_id:org,name:'Cliente A'}];
    else if(parsed.pathname.endsWith('/tasks'))result=[
      {id:'task-1',client_id:clientA,title:'Site Institucional',stage:'client',due_date:'2026-12-04',public_summary:'Aguardando aprovação',client_visible:true},
    ];
    else if(parsed.pathname.endsWith('/task_approvals'))result=[];
    else throw Error('Unexpected path '+parsed.pathname);
    return {ok:true,status:200,async json(){return result;}};
  };
  return {seen,restore(){global.fetch=original;}};
}
test('client cannot request a workspace outside memberships',async()=>{
  const {authScope}=await module();
  const mock=mockScopeFetch();
  try {
    const result=await authScope({clientId:clientB},'test-jwt','https://fake.supabase.co','sb_publishable_dummy');
    assert.equal(result.error,'forbidden_client');
    assert(mock.seen.every(path=>!path.startsWith('/rest/v1/tasks')));
  }finally{mock.restore();}
});
test('client scope queries only shared tasks and never internal notes',async()=>{
  const {authScope,safeContext}=await module();
  const mock=mockScopeFetch();
  try{
    const result=await authScope({clientId:clientA},'test-jwt','https://fake.supabase.co','sb_publishable_dummy');
    assert.equal(result.role,'client');
    assert(result.tasks.length===1);
    assert(mock.seen.some(url=>url.includes('client_visible=eq.true')));
    assert(mock.seen.every(url=>!url.includes('task_internal_notes')));
    const publicContext=safeContext({...result,tasks:[{...result.tasks[0],internalNote:'Internal instructions must not leak',secret:'hidden'}]});
    assert(!JSON.stringify(publicContext).includes('Internal instructions'));
    assert(!JSON.stringify(publicContext).includes('secret'));
  }finally{mock.restore();}
});
test('agency may query same-organization tasks via RLS with verified membership',async()=>{
  const {authScope}=await module();
  const mock=mockScopeFetch({agency:true});
  try{
    const result=await authScope({clientId:clientA},'test-jwt','https://fake.supabase.co','sb_publishable_dummy');
    assert.equal(result.role,'agency');
    assert.equal(result.organizationId,org);
    assert(mock.seen.some(url=>url.includes('organization_id=eq.'+org)));
  }finally{mock.restore();}
});
test('unauthenticated request is rejected before any Supabase or AI call',async()=>{
  const {default:handler}=await module();
  const req={method:'POST',headers:{origin:'https://studio-uxdriven.vercel.app'},body:{message:'Quais demandas?'}};
  let status,reply;
  const res={setHeader(){return this;},status(s){status=s;return this;},json(v){reply=v;return v;}};
  await handler(req,res);
  assert.equal(status,401);
  assert.equal(reply.error,'login_required');
});
test('factual fallback states only actual task information when model is not enabled',async()=>{
  const {answerFromContext}=await module();
  const text=answerFromContext('Qual o prazo?',{
    clientName:'Cliente A',
    tasks:[{title:'Site Institucional',stage:'client',due_date:'2026-12-04'}],
    approvals:[]
  });
  assert.match(text,/Site Institucional/);
  assert.match(text,/dezembro/);
  assert.doesNotMatch(text,/60%|aumento de alcance|impressões/i);
});
test('unsupported creative generation does not claim to have run a model',async()=>{
  const {answerFromContext}=await module();
  const s=answerFromContext('Crie uma campanha para novembro',{
    clientName:'Cliente A',tasks:[{title:'Site',stage:'progress',due_date:'2026-12-04'}],approvals:[]
  });
  assert.match(s,/habilitar o modelo/);
  assert.doesNotMatch(s,/Aqui está sua campanha/);
});
