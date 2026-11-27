/* UXDriven Social Studio — real due-date calendar for authenticated agency workspaces.
   Reads only rows supplied by the agency's RLS-scoped Supabase session. */
(function () {
  'use strict';
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const stageColors = {backlog:'#8c9b89',progress:'#caff5b',internal:'#ae9aff',client:'#ffbb72',done:'#70d9a6'};
  const stageLabels = {backlog:'Planejado',progress:'Em produção',internal:'Revisão interna',client:'Com cliente',done:'Concluído'};
  const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0,10)) ? String(value).slice(0,10) : '';
  const day = value => new Date(dateOnly(value) + 'T12:00:00Z');
  const shift = (value,days) => {const d=day(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const pt = value => day(value).toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'short'}).replace('.','');
  const stage = value => stageLabels[value] || 'Planejado';
  const color = value => stageColors[value] || stageColors.backlog;
  const overdue = (task,today) => !!(dateOnly(task.due) && dateOnly(task.due)<today && task.stage!=='done');
  function forDate(tasks,date) {
    return (tasks||[]).filter(t=>dateOnly(t.due)===date).slice().sort((a,b)=>{
      const aRank=a.stage==='done'?2:overdue(a,date)?0:1;
      const bRank=b.stage==='done'?2:overdue(b,date)?0:1;
      return aRank-bRank || (a.title||'').localeCompare(b.title||'');
    });
  }
  function week({tasks,today,week=0,compact=false}){
    const wd=day(today).getUTCDay();
    const monday=shift(today,-((wd+6)%7)+(week*7));
    const names=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
    const dates=Array.from({length:7},(_,i)=>shift(monday,i));
    return '<div class="calendar-week live-demand-week">'+dates.map((date,i)=>{
      const entries=forDate(tasks,date);
      return '<div class="day-col '+(date===today?'today':'')+'" data-date="'+date+'" role="button" tabindex="0" aria-label="'+names[i]+' '+date.slice(-2)+', '+entries.length+' demandas com prazo">'+
       '<span class="day-label">'+names[i]+'</span><span class="day-number">'+day(date).getUTCDate()+'</span>'+
       '<div class="day-posts">'+(entries.length?entries.slice(0,2).map(t=>'<div class="day-post live-calendar-task" style="--task-color:'+color(t.stage)+'" title="'+escapeHTML(t.title)+'"><i></i><span>'+escapeHTML(t.title)+'</span></div>').join(''):'<div class="day-empty">·</div>')+
       (entries.length>2?'<small class="calendar-extra">+'+(entries.length-2)+' prazos</small>':'')+'</div></div>';
    }).join('')+'</div>'+legend(compact);
  }
  function legend(compact=false) {
    return '<div class="calendar-legend live-legend">'+
      Object.keys(stageColors).map(k=>'<span><i style="background:'+color(k)+'"></i>'+stage(k)+'</span>').join('')+
      (compact?'':'')+'</div>';
  }
  function month({tasks,today,month=0}){
    const current=day(today); current.setUTCDate(1); current.setUTCMonth(current.getUTCMonth()+month);
    const first=new Date(current);first.setUTCDate(1-((first.getUTCDay()+6)%7));
    const label=current.toLocaleDateString('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'}).replace(/^./,s=>s.toUpperCase());
    const dates=Array.from({length:42},(_,i)=>{const d=new Date(first);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
    return '<div class="panel panel-inner live-calendar-panel"><div class="month-toolbar"><h2>'+label+'</h2><div class="month-controls">'+
      '<button data-action="prev-month" aria-label="Mês anterior">‹</button><button data-action="today-month">Hoje</button><button data-action="next-month" aria-label="Próximo mês">›</button>'+
      '</div></div><div class="live-calendar-scroll"><div class="month-calendar">'+['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(name=>'<div class="month-day-header">'+name+'</div>').join('')+
      dates.map(date=>{
        const entries=forDate(tasks,date);
        const outside=day(date).getUTCMonth()!==current.getUTCMonth();
        const label=date===today?'Hoje, ':'';
        return '<div class="month-cell '+(outside?'outside ':'')+(date===today?'today ':'')+(entries.length?'has-deadlines':'')+'" data-date="'+date+'" role="button" tabindex="0" aria-label="'+label+pt(date)+', '+entries.length+' demandas"><div class="cell-top"><span class="cell-date">'+day(date).getUTCDate()+'</span><span class="cell-count">'+(entries.length||'')+'</span></div>'+
         entries.slice(0,3).map(t=>'<span class="month-entry live-month-entry" style="--task-color:'+color(t.stage)+'" title="'+escapeHTML(t.title)+'"><i></i>'+escapeHTML(t.title)+'</span>').join('')+
         (entries.length>3?'<span class="calendar-extra">+'+(entries.length-3)+' demandas</span>':'')+'</div>';
      }).join('')+'</div></div>'+legend(true)+'</div>';
  }
  function list({tasks,today,clientName}){
    const ordered=(tasks||[]).filter(t=>dateOnly(t.due)).slice().sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title));
    return '<section class="panel panel-inner"><div class="panel-head"><h2 class="panel-title">Prazos de todas as demandas</h2><span class="demo-note">'+ordered.length+' DEMANDAS</span></div>'+
      (ordered.length?ordered.map(t=>'<div class="list-row live-deadline-row '+(overdue(t,today)?'is-overdue':'')+'"><div class="deadline-stage-icon" style="background:'+color(t.stage)+'"></div><div><strong>'+escapeHTML(t.title)+'</strong><small>'+escapeHTML(clientName(t.client))+' · '+escapeHTML(t.type||'Demanda')+'</small></div><time>'+pt(t.due)+'</time><span class="live-stage-chip" style="--task-color:'+color(t.stage)+'">'+stage(t.stage)+'</span><button class="action" data-task="'+escapeHTML(t.id)+'">Abrir</button></div>').join(''):'<div class="empty-state"><p>Nenhuma demanda com prazo para este cliente.</p></div>')+
     '</section>';
  }
  function dueSummary(tasks,today) {
    const all=tasks||[];
    const overdueCount=all.filter(t=>overdue(t,today)).length;
    const todayCount=all.filter(t=>dateOnly(t.due)===today && t.stage!=='done').length;
    const upcoming=all.filter(t=>dateOnly(t.due)>today && dateOnly(t.due)<=shift(today,7) && t.stage!=='done').length;
    return {overdue:overdueCount,today:todayCount,next7:upcoming,total:all.length};
  }
  function details({tasks,date,clientName}){
    const entries=forDate(tasks,date);
    return '<div class="live-day-details">'+(entries.length?entries.map(t=>
      '<button type="button" class="live-day-task" data-task="'+escapeHTML(t.id)+'">'+
      '<span class="deadline-stage-icon" style="background:'+color(t.stage)+'"></span><span><strong>'+escapeHTML(t.title)+'</strong><small>'+escapeHTML(clientName(t.client))+' · '+stage(t.stage)+'</small></span><span aria-hidden="true">↗</span></button>'
    ).join(''):'<p class="portal-muted">Nenhuma demanda com entrega prevista para esta data.</p>')+
    '<div class="modal-actions"><button class="btn" data-action="close-modal">Fechar</button><button class="btn btn-primary" data-action="new-task-for-date" data-date="'+escapeHTML(date)+'">+ Nova demanda nesta data</button></div></div>';
  }
  window.UXDrivenDemandCalendar={week,month,list,details,forDate,dueSummary,dateOnly,overdue};
})();
