'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../dist/live-reports.js'),'utf8');
const ctx={window:{},Date};vm.runInNewContext(src,ctx);const reports=ctx.window.UXDrivenLiveReports;
const tasks=[
{id:'1',client:'a',title:'Novo site',stage:'internal',createdAt:'2026-11-27T10:00:00Z',due:'2026-11-27',approvals:[{decision:'changes_requested',created_at:'2026-11-27T12:00:00Z'}]},
{id:'2',client:'b',title:'Relatório',stage:'progress',createdAt:'2026-11-20T10:00:00Z',due:'2026-12-04',approvals:[]},
{id:'3',client:'a',title:'Concluído',stage:'done',createdAt:'2026-11-01T10:00:00Z',due:'2026-11-01',approvals:[{decision:'approved',created_at:'2026-11-26T12:00:00Z'}]},
{id:'4',client:'c',title:'<script>alert(1)</script>',stage:'client',createdAt:'2026-11-23T10:00:00Z',due:'2026-11-24',approvals:[]}
];
test('operational summary uses actual deadlines and status, not marketing metrics',()=>{
const s=reports.summarize(tasks,'2026-11-27',30);
assert.equal(s.total,4);assert.equal(s.active,3);assert.equal(s.overdue,1);
assert.equal(s.created,4);assert.equal(s.revisions,1);assert.equal(s.approvals,1);
assert.equal(s.stageCounts.client,1);assert.equal(s.stageCounts.internal,1);
});
test('period filter adjusts new tasks and decisions',()=>{
const s=reports.summarize(tasks,'2026-11-27',7);
assert.equal(s.created,3);assert.equal(s.revisions,1);assert.equal(s.approvals,1);
assert.equal(reports.summarize(tasks,'2026-11-27',90).created,4);
});
test('zero activity is reported as zero, never fabricated',()=>{
const s=reports.summarize([],'2026-11-27',30);
assert.equal(s.total,0);assert.equal(s.created,0);assert.equal(s.overdue,0);
const bins=reports.series([],'2026-11-27',30);
assert(bins.every(x=>x.count===0));
});
test('render escapes untrusted titles and client names',()=>{
const s=reports.report({tasks,clients:[{id:'a',name:'<script>steal()</script>'},{id:'b',name:'Humgroup'},{id:'c',name:'Xande'}],today:'2026-11-27',days:30});
assert.match(s,/&lt;script&gt;steal\(\)&lt;\/script&gt;/);
assert.doesNotMatch(s,/<script>steal\(\)<\/script>/);
assert.match(s,/Vencidos|Prazos vencidos/);assert.match(s,/Dados operacionais reais/);
assert.doesNotMatch(s,/48k|126\.4k/);
});
test('client scope is applied using only supplied tasks',()=>{
const s=reports.report({tasks:tasks.filter(t=>t.client==='b'),clients:[{id:'b',name:'Humgroup'}],today:'2026-11-27',days:30});
assert.match(s,/Humgroup/);assert.doesNotMatch(s,/Novo site/);assert.doesNotMatch(s,/steal/);
});
