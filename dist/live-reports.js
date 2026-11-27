/* UXDriven Social Studio — operational reports from RLS-authorized task rows.
   Metrics describe agency workflow, NOT social-platform audience analytics. */
(function(){
  'use strict';
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const STAGES={backlog:'Planejado',progress:'Em produção',internal:'Revisão interna',client:'Com cliente',done:'Concluído'};
  const COLORS={backlog:'#8c9b89',progress:'#caff5b',internal:'#ae9aff',client:'#ffbb72',done:'#70d9a6'};
  const date = input => String(input||'').slice(0,10);
  const shift = (today,n) => { const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const dateLabel = iso => new Date(iso+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'short'}).replace('.','');
  const duePassed = (t,today) => t.stage!=='done'&&date(t.due)<today;
  function summarize(tasks,today,days) {
    const from=shift(today,-days+1);
    const rows=(tasks||[]).slice();
    const created=rows.filter(t=>date(t.createdAt)>=from&&date(t.createdAt)<=today);
    const completed=rows.filter(t=>t.stage==='done');
    const approvals=rows.flatMap(t=>(t.approvals||[]).map(a=>({...a,taskId:t.id}))).filter(a=>date(a.created_at)>=from&&date(a.created_at)<=today);
    const stageCounts=Object.fromEntries(Object.keys(STAGES).map(stage=>[stage,rows.filter(t=>t.stage===stage).length]));
    return {total:rows.length,active:rows.length-completed.length,completed:completed.length,
      overdue:rows.filter(t=>date(t.due)&&duePassed(t,today)).length,
      awaiting:stageCounts.client,internal:stageCounts.internal,created:created.length,
      revisions:approvals.filter(a=>a.decision==='changes_requested').length,
      approvals:approvals.filter(a=>a.decision==='approved').length,
      stageCounts,rows,from,today,days};
  }
  function series(tasks,today,days){
    const start=shift(today,-days+1);
    const parts=days<=7?7:days<=30?10:13;
    const bucketSize=Math.ceil(days/parts);
    const result=[];
    for(let i=0;i<parts;i++){
      const begin=shift(start,i*bucketSize);
      if(begin>today)break;
      const end=shift(begin,bucketSize-1)>today?today:shift(begin,bucketSize-1);
      const count=(tasks||[]).filter(t=>date(t.createdAt)>=begin&&date(t.createdAt)<=end).length;
      result.push({label:dateLabel(begin),count,begin,end});
    }
    return result;
  }
  function report({tasks,clients,today,days=30}){
    const sum=summarize(tasks,today,days);
    const data=series(tasks,today,days);
    const max=Math.max(1,...data.map(r=>r.count));
    const clientName=new Map((clients||[]).map(c=>[c.id,c.name]));
    const perClient=(clients||[]).map(c=>({name:c.name,id:c.id,rows:sum.rows.filter(t=>t.client===c.id)})).filter(c=>c.rows.length);
    const stat=(label,count,tag)=>'<div class="live-report-stat"><span>'+label+'</span><strong>'+String(count).padStart(2,'0')+'</strong><small>'+tag+'</small></div>';
    const chart='<div class="live-report-chart" role="img" aria-label="Demandas criadas no período: '+data.map(p=>p.label+' '+p.count).join(', ')+'">'+data.map(p=>
      '<div class="live-report-bar"><span class="live-report-value">'+p.count+'</span><div class="live-report-barfill" style="height:'+Math.max(p.count?7:2,Math.round(100*p.count/max))+'%"></div><small>'+p.label+'</small></div>'
    ).join('')+'</div>';
    const clientsHtml=perClient.map(c=>{
      const overdue=c.rows.filter(t=>date(t.due)&&duePassed(t,today)).length;
      return '<div class="live-report-client"><div><strong>'+escapeHTML(c.name)+'</strong><small>'+c.rows.length+' demanda(s) · '+c.rows.filter(t=>t.stage==='client').length+' aguardando cliente</small></div><div><span>'+overdue+' vencida(s)</span><button class="btn btn-small" data-report-client="'+escapeHTML(c.id)+'">Ver demandas ↗</button></div></div>';
    }).join('')||'<p class="portal-muted">Nenhuma demanda encontrada no filtro.</p>';
    const stageHtml=Object.keys(STAGES).map(s=>
      '<div class="live-report-stage"><span class="deadline-stage-icon" style="background:'+COLORS[s]+'"></span><span>'+STAGES[s]+'</span><strong>'+sum.stageCounts[s]+'</strong></div>'
    ).join('');
    return '<div class="notice"><div><strong>Dados operacionais reais.</strong> Estes números vêm das demandas e decisões registradas no Supabase. Não são métricas de alcance ou engajamento das redes sociais.</div></div>'+
      '<div class="live-report-stats">'+
      stat('Demandas ativas',sum.active,'ESTADO ATUAL')+
      stat('Prazos vencidos',sum.overdue,'AINDA NÃO CONCLUÍDAS')+
      stat('Aguardando cliente',sum.awaiting,'ESTADO ATUAL')+
      stat('Novas demandas',sum.created,'ÚLTIMOS '+days+' DIAS')+
      '</div>'+
      '<div class="content-grid" style="margin-top:20px">'+
        '<section class="panel panel-inner"><div class="panel-head"><div><div class="panel-kicker">DADOS / DEMANDAS CRIADAS</div><h2 class="panel-title">Volume de trabalho</h2></div><span class="demo-note">'+days+' DIAS · DADOS REAIS</span></div>'+chart+
        '<div class="demo-note">Os períodos sem novas demandas exibem zero. Os dados não são estimativas.</div></section>'+
        '<section class="panel panel-inner"><div class="panel-kicker">OPERAÇÃO / SITUAÇÃO ATUAL</div><h2 class="panel-title" style="margin:10px 0 20px">Etapas do Kanban</h2><div class="live-report-stages">'+stageHtml+'</div>'+
        '<div class="live-report-decision"><span>Revisões recebidas no período</span><strong>'+sum.revisions+'</strong><span>Aprovações recebidas no período</span><strong>'+sum.approvals+'</strong></div></section>'+
      '</div><section class="panel panel-inner" style="margin-top:20px"><div class="panel-head"><h2 class="panel-title">Distribuição por cliente</h2><span class="demo-note">'+perClient.length+' CLIENTE(S) COM DEMANDAS</span></div>'+
      clientsHtml+'</section>';
  }
  window.UXDrivenLiveReports={summarize,series,report};
})();
