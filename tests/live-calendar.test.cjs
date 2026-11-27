'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const code=fs.readFileSync(path.join(__dirname,'../dist/live-calendar.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
function calendar(){
  const context={window:{}, Date, Intl};
  vm.runInNewContext(code,context,{filename:'live-calendar.js'});
  return context.window.UXDrivenDemandCalendar;
}
const today='2026-11-27';
const tasks=[
  {id:'ib',client:'ib',title:'Desenvolvimento do site IB Cidade',stage:'internal',due:'2026-11-27',type:'Site'},
  {id:'hum',client:'hum',title:'Análise do site institucional',stage:'progress',due:'2026-12-04',type:'Relatório'},
  {id:'xande',client:'xande',title:'Site Xande Lakiss',stage:'client',due:'2026-12-04',type:'Site'},
  {id:'private',client:'ib',title:'<img src=x onerror=alert(1)>',stage:'done',due:'2026-11-27',type:'Design'}
];
const clientName=id=>({ib:'IB Cidade Caruaru',hum:'Humgroup',xande:'Xande Lakiss'})[id];

test('date lookup groups real tasks by due date, not editorial publication date',()=>{
  const cal=calendar();
  assert.deepEqual(cal.forDate(tasks,'2026-12-04').map(t=>t.id),['hum','xande']);
  assert.deepEqual(cal.forDate(tasks,'2026-11-28').map(t=>t.id),[]);
});

test('month view shows November deadlines and next-month deadlines in boundary days',()=>{
  const cal=calendar();
  const november=cal.month({tasks,today,month:0});
  const december=cal.month({tasks,today,month:1});
  assert.match(november,/Desenvolvimento do site IB Cidade/);
  assert.match(december,/Site Xande Lakiss/);
  assert.match(december,/Análise do site institucional/);
  assert.match(december,/data-date="2026-12-04"/);
  assert.match(november,/data-date="2026-11-27"/);
  assert.match(november,/aria-label="Hoje/);
});

test('week view anchors to Monday and respects week navigation',()=>{
  const cal=calendar();
  const current=cal.week({tasks,today,week:0});
  const next=cal.week({tasks,today,week:1});
  assert.match(current,/data-date="2026-11-23"/);
  assert.match(current,/data-date="2026-11-27"/);
  assert.doesNotMatch(current,/data-date="2026-12-04"/);
  assert.match(next,/data-date="2026-12-04"/);
  assert.match(next,/Site Xande Lakiss/);
});

test('due KPIs count today, next 7 days and overdue from real stages',()=>{
  const cal=calendar();
  const result=cal.dueSummary(tasks,today);
  assert.equal(result.total,4);
  assert.equal(result.today,1); // completed design excluded
  assert.equal(result.next7,2);
  assert.equal(result.overdue,0);
  const updated=[...tasks,{id:'late',stage:'progress',due:'2026-11-20'}];
  assert.equal(cal.dueSummary(updated,today).overdue,1);
  assert.equal(cal.overdue({due:'2026-11-20',stage:'done'},today),false);
});

test('list displays client and stage; HTML in task title is safely escaped',()=>{
  const cal=calendar();
  const html=cal.list({tasks,today,clientName});
  assert.match(html,/Humgroup/);
  assert.match(html,/Com cliente/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img src=x onerror=/);
  assert.match(html,/data-task="xande"/);
});

test('day drilldown opens exact demand and provides a due-date creation action',()=>{
  const cal=calendar();
  const html=cal.details({tasks,date:'2026-12-04',clientName});
  assert.match(html,/Humgroup/);
  assert.match(html,/Xande Lakiss/);
  assert.match(html,/data-task="hum"/);
  assert.match(html,/data-action="new-task-for-date" data-date="2026-12-04"/);
  assert.doesNotMatch(html,/IB Cidade Caruaru/);
});

test('module never queries other clients: filtered task input produces filtered calendar',()=>{
  const cal=calendar();
  const filtered=tasks.filter(t=>t.client==='xande');
  const html=cal.month({tasks:filtered,today,month:1});
  assert.match(html,/Site Xande Lakiss/);
  assert.doesNotMatch(html,/Análise do site institucional/);
  assert.doesNotMatch(html,/Desenvolvimento do site IB Cidade/);
});

test('agency app routes LIVE calendar to real tasks, without replacing demo fallback',()=>{
  assert.match(app,/function renderLiveCalendar\(\)/);
  assert.match(app,/if\(window\.UXDrivenLive\?\.enabled\)return renderLiveCalendar\(\)/);
  assert.match(app,/if\(window\.UXDrivenLive\?\.enabled\)return window\.UXDrivenDemandCalendar\.week/);
  assert.match(app,/function calendarDayModal\(date\)/);
  assert.match(app,/initialDue=shift\(today,3\)/);
  assert.match(app,/calendarDayModal\(d\.dataset\.date\)/);
  assert.match(html,/<script src="\.\/live-calendar\.js" defer><\/script>/);
});
