'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','dist','boot.js'),'utf8');

async function agencyHarness() {
  const calls=[];
  const state={
    organization_members:[{organization_id:'org-ux',user_id:'agency-user',role:'owner'}],
    organizations:[{id:'org-ux',name:'UXDriven'}],
    clients:[{id:'client-xande',organization_id:'org-ux',name:'Xande Lakiss',category:'Sites',is_active:true}],
    tasks:[{id:'task-1',organization_id:'org-ux',client_id:'client-xande',title:'Site institucional',stage:'progress',task_type:'Site institucional',priority:'medium',due_date:'2026-12-02',public_summary:'Site pronto para revisar',client_visible:false}],
    task_internal_notes:[],task_comments:[],task_approvals:[]
  };
  const db={
    auth:{async getUser(){return {data:{user:{id:'agency-user'}},error:null};}},
    from(table){
      const query={
        data:state[table]||[],
        action:null,payload:null,
        select(){return this;},
        eq(field,value){this.data=this.data.filter(record=>record[field]===value);return this;},
        order(){return this;},
        update(payload){this.action='update';this.payload=payload;calls.push({table,method:'update',payload});return this;},
        insert(payload){this.action='insert';this.payload=payload;calls.push({table,method:'insert',payload});return this;},
        upsert(payload){this.action='upsert';this.payload=payload;calls.push({table,method:'upsert',payload});return this;},
        async single(){
          if(this.action==='update'){
            for(const row of this.data)Object.assign(row,this.payload);
            return {data:this.data[0]||null,error:this.data.length===1?null:{message:'Not found'}};
          }
          if(this.action==='insert'){
            const row={id:'created-task',...this.payload};
            state[table].push(row);
            return {data:row,error:null};
          }
          return {data:this.data[0]||null,error:null};
        },
        then(resolve,reject){return Promise.resolve({data:this.data,error:null}).then(resolve,reject);}
      };
      return query;
    }
  };
  let onReady;
  const ready=new Promise(resolve=>onReady=resolve);
  let live;
  const window={
    supabase:{createClient(){return db;}},
    UXDrivenPasswordRecovery:{init(){return {isRecoveryReturn(){return false;},handleReturn(){}};}}
  };
  Object.defineProperty(window,'UXDrivenLive',{configurable:true,get(){return live;},set(value){live=value;onReady(value);}});
  const root={hidden:false,innerHTML:''};
  const document={
    body:{classList:{remove(){}}},
    getElementById(){return root;},
    createElement(){return {}; }
  };
  const context={
    window,document,console,
    fetch:async()=>({ok:true,json:async()=>({configured:true,url:'https://example.supabase.co',key:'sb_publishable_test'})})
  };
  vm.runInNewContext(source,context);
  await ready;
  return {live,calls,state};
}
const payloads=(calls,method)=>calls.filter(c=>c.table==='tasks'&&c.method===method).map(c=>JSON.parse(JSON.stringify(c.payload)));

test('Kanban move to Com cliente updates stage and visibility atomically',async()=>{
  const {live,calls}=await agencyHarness();
  const saved=await live.moveTask('task-1','client');
  assert.equal(saved.stage,'client');
  assert.equal(saved.client_visible,true);
  assert.deepEqual(payloads(calls,'update'),[{stage:'client',client_visible:true}]);
});

test('moving to internal review does not unexpectedly revoke earlier client sharing',async()=>{
  const {live,calls}=await agencyHarness();
  await live.moveTask('task-1','client');
  const saved=await live.moveTask('task-1','internal');
  assert.equal(saved.client_visible,true);
  assert.deepEqual(payloads(calls,'update')[1],{stage:'internal'});
});

test('creating a task directly at Com cliente shares it with that client',async()=>{
  const {live,calls}=await agencyHarness();
  const saved=await live.createTask({client:'client-xande',title:'Novo site',type:'Site institucional',stage:'client',priority:'medium',due:'2026-12-03',publicSummary:'Pronto para análise',internalNote:''});
  assert.equal(saved.clientVisible,true);
  assert.equal(payloads(calls,'insert')[0].client_visible,true);
});

test('creating an internal task keeps it hidden from the client',async()=>{
  const {live,calls}=await agencyHarness();
  const saved=await live.createTask({client:'client-xande',title:'Novo site',type:'Site institucional',stage:'progress',priority:'medium',due:'2026-12-03',publicSummary:'Em produção',internalNote:''});
  assert.equal(saved.clientVisible,false);
  assert.equal(payloads(calls,'insert')[0].client_visible,false);
});

test('editing a task into Com cliente forces visibility even if checkbox is false',async()=>{
  const {live,calls}=await agencyHarness();
  const saved=await live.updateTask({id:'task-1',stage:'client',due:'2026-12-03',publicSummary:'Aguardando Xande',internalNote:'',clientVisible:false});
  assert.equal(saved.client_visible,true);
  assert.equal(payloads(calls,'update')[0].client_visible,true);
});

test('agency can explicitly keep task hidden at internal stages',async()=>{
  const {live,calls}=await agencyHarness();
  const saved=await live.updateTask({id:'task-1',stage:'progress',due:'2026-12-03',publicSummary:'Produção',internalNote:'',clientVisible:false});
  assert.equal(saved.client_visible,false);
  assert.equal(payloads(calls,'update')[0].client_visible,false);
});
