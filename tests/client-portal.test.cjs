const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname,'../dist/client-portal.js'),'utf8');
function fixture() {
  const organization_id = 'org-a';
  const clients = [
    {id:'client-a',organization_id,name:'Piloto A <script>alert(1)</script>',category:'Teste'},
    {id:'client-b',organization_id,name:'Piloto B',category:'Teste'}
  ];
  const projects = [
    {id:'project-a',client_id:'client-a',name:'Site A',description:'Escopo A',is_archived:false,client_visible:true},
    {id:'project-b',client_id:'client-b',name:'Site B confidencial',description:'Escopo B',is_archived:false,client_visible:true},
    {id:'project-internal',client_id:'client-a',name:'Projeto interno secreto',description:'Privado',is_archived:false,client_visible:false}
  ];
  const tasks = [
    {id:'shared-a',client_id:'client-a',organization_id,title:'Aprovando <img src=x onerror=alert(1)>',public_summary:'Resumo compartilhado',task_type:'Design',stage:'client',due_date:'2026-11-25',client_visible:true,updated_at:'2026-11-19T12:00:00Z'},
    {id:'private-a',client_id:'client-a',organization_id,title:'Notas privadas da agência',public_summary:'Não deve aparecer',task_type:'Interno',stage:'internal',due_date:'2026-11-25',client_visible:false,updated_at:'2026-11-19T12:00:00Z'},
    {id:'shared-b',client_id:'client-b',organization_id,title:'Demanda secreta do B',public_summary:'B',task_type:'Design',stage:'progress',due_date:'2026-11-25',client_visible:true,updated_at:'2026-11-19T12:00:00Z'}
  ];
  const rows = {clients,projects,tasks,task_comments:[],task_approvals:[]};
  const queried = [];
  const db = {from(table) {
    queried.push(table);
    let records = rows[table];
    if (!records) throw new Error('Unexpected table '+table);
    const query = {
      select() { return query; },
      in(field,values) { records = records.filter(r => values.includes(r[field])); return query; },
      eq(field,value) { records = records.filter(r => r[field] === value); return query; },
      order(field) { records = [...records].sort((a,b) => String(a[field]||'').localeCompare(String(b[field]||''))); return query; },
      then(resolve,reject) { return Promise.resolve({data:records,error:null}).then(resolve,reject); }
    };
    return query;
  }};
  const root = {innerHTML:'',hidden:true,addEventListener() {},querySelector() { return {onclick:null}; }};
  const document = {getElementById(id) { assert.equal(id,'auth-root'); return root; },body:{classList:{add() {}}},title:''};
  const context = {window:{},document,Intl,Date,console};
  vm.runInNewContext(code,context,{filename:'client-portal.js'});
  return {db,root,document,context,queried};
}

test('cliente recebe somente seus registros explicitamente compartilhados',async () => {
  const {db,root,context,queried} = fixture();
  await context.window.UXDrivenClientPortal({db,user:{id:'user-a'},memberships:[{client_id:'client-a',organization_id:'org-a'}],signOut:async()=>{}});
  assert.match(root.innerHTML,/Resumo compartilhado/);
  assert.match(root.innerHTML,/Site A/);
  assert.doesNotMatch(root.innerHTML,/Notas privadas da agência/);
  assert.doesNotMatch(root.innerHTML,/Demanda secreta do B/);
  assert.doesNotMatch(root.innerHTML,/Site B confidencial/);
  assert.doesNotMatch(root.innerHTML,/Projeto interno secreto/);
  assert(!queried.includes('task_internal_notes'),'portal jamais consulta notas internas');
});

test('campos vindos do banco são escapados na interface',async () => {
  const {db,root,context} = fixture();
  await context.window.UXDrivenClientPortal({db,user:{id:'user-a'},memberships:[{client_id:'client-a',organization_id:'org-a'}],signOut:async()=>{}});
  assert.match(root.innerHTML,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(root.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(root.innerHTML,/<script>alert\(1\)<\/script>/);
});

test('usuário sem associação de cliente não vê dados',async () => {
  const {db,root,context} = fixture();
  await context.window.UXDrivenClientPortal({db,user:{id:'user-z'},memberships:[],signOut:async()=>{}});
  assert.match(root.innerHTML,/Não foi possível abrir seu espaço/);
  assert.doesNotMatch(root.innerHTML,/Resumo compartilhado/);
});
