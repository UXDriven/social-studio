/* UXDriven Social Studio / client-only workspace.
   All data is scoped by Supabase RLS; never load the agency app for client accounts. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const stages = {backlog:'Planejado',progress:'Em produção',internal:'Revisão interna',client:'Aguardando aprovação',done:'Concluído'};
  const icon = '<span aria-hidden="true" class="cp-spark">✳</span>';
  const date = value => value ? new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z')) : 'A definir';

  window.UXDrivenClientPortal = async function ({db,user,memberships,signOut}) {
    const root = document.getElementById('auth-root');
    const authorizedIds = [...new Set(memberships.map(row => row.client_id))];
    let selectedId = authorizedIds[0] || null;
    let data = {clients:[],projects:[],tasks:[],comments:[],approvals:[]};
    let openTaskId = null;
    let busy = false;
    let error = '';
    const assistantThreads = {};
    let assistantBusy = false;

    // Keep the locked agency shell hidden. Only the client-facing root is rendered.
    document.body.classList.add('locked','client-session');
    root.hidden = false;
    function currentClient() { return data.clients.find(c => c.id === selectedId); }
    function currentTasks() { return data.tasks.filter(t => t.client_id === selectedId && t.client_visible); }
    function latestDecision(task) {
      return data.approvals.filter(a => a.task_id === task.id)
        .sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
    }
    function pending(task) {
      const decision = latestDecision(task);
      return task.stage === 'client' && (!decision || decision.created_at < task.updated_at);
    }
    function taskLabel(task) {
      const decision = latestDecision(task);
      if (decision && task.stage === 'internal' && decision.decision === 'changes_requested')
        return 'Ajustes solicitados · Em revisão';
      if (decision && task.stage === 'done' && decision.decision === 'approved')
        return 'Aprovado por você';
      if (task.stage === 'client' && decision && !pending(task))
        return decision.decision === 'approved' ? 'Aprovado por você' : 'Ajustes solicitados';
      return stages[task.stage] || 'Em andamento';
    }
    function header() {
      const client = currentClient();
      return `<header class="cp-header"><div class="cp-header-inner">
        <a class="cp-brand" href="https://uxdriven-lab.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Visitar UXDriven"><img src="./assets/uxdriven-logo.svg" width="32" height="32" alt=""><span>uxdriven<span class="cp-dot">.</span></span><small>SOCIAL STUDIO / CLIENTES</small></a>
        <div class="cp-header-right"><span class="cp-live"><i></i> ESPAÇO PRIVADO</span><button type="button" class="cp-exit" id="cp-logout">Sair da conta <span aria-hidden="true">↗</span></button></div>
      </div></header>
      <div class="cp-topline"><span>CLIENT EXPERIENCE / 2026</span><span>${client ? esc(client.name).toUpperCase() : 'WORKSPACE'}</span></div>`;
    }
    function taskCard(task) {
      const isPending = pending(task);
      return `<article class="cp-task"><div class="cp-task-top"><span class="cp-type">${esc(task.task_type || 'Demanda')}</span><span class="cp-status ${isPending ? 'cp-status-attention' : ''}">${esc(taskLabel(task))}</span></div>
        <h3>${esc(task.title)}</h3><p>${esc(task.public_summary || 'A equipe está preparando uma atualização para você.')}</p>
        <div class="cp-task-bottom"><span>PREVISÃO <strong>${date(task.due_date)}</strong></span><button type="button" class="cp-inline" data-task-open="${esc(task.id)}">Acompanhar demanda <span aria-hidden="true">↗</span></button></div></article>`;
    }

    function assistantPanel(){
      return `<section class="cp-assistant cp-assistant-coming" aria-label="Assistente do cliente em desenvolvimento">
        <div class="cp-assistant-head">
          <span class="cp-aside-kicker">${icon} UXDRIVEN / FUTURE EXPERIENCE</span>
          <h2>Assistente do cliente.<br><em>Em desenvolvimento.</em></h2>
          <p>Estamos preparando um espaço para consultar projetos, esclarecer dúvidas e sugerir novas demandas com inteligência artificial.</p>
        </div>
        <div class="cp-assistant-coming-body">
          <span class="cp-assistant-coming-tag">EM DESENVOLVIMENTO</span>
          <p>Essa funcionalidade ainda não está disponível. Enquanto isso, você pode acompanhar as demandas e conversar diretamente com a equipe pelo histórico de mensagens de cada entrega.</p>
          <small>NENHUMA CHAMADA DE IA OU COBRANÇA POR GERAÇÃO</small>
        </div>
      </section>`;
    }
    function unusedAssistantPanel(){

      const messages=assistantThreads[selectedId]||[];
      const clientName=currentClient()?.name||'seu workspace';
      const prompts=[
        'Quais demandas estão em andamento?',
        'Quais são os prazos previstos?',
        'Quais ajustes já foram solicitados?',
        'Sugira ideias para uma próxima campanha.'
      ];
      return `<section class="cp-assistant" aria-label="Assistente do seu workspace">
        <div class="cp-assistant-head"><span class="cp-aside-kicker">${icon} ASSISTENTE DO CLIENTE</span><h2>Seu projeto.<br><em>Suas respostas.</em></h2>
          <p>Consulte demandas e prazos do ${esc(clientName)}. Ideias criativas serão habilitadas quando a IA estiver ativa.</p></div>
        <div class="cp-assistant-prompts">${prompts.map(q=>`<button type="button" data-assistant-question="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="cp-assistant-conversation" id="cp-assistant-conversation" role="log" aria-live="polite">
          ${messages.length?messages.map(m=>`<div class="cp-assistant-message ${m.role==='user'?'mine':'reply'}"><small>${m.role==='user'?'VOCÊ':m.mode==='ai'?'ASSISTENTE COM IA':'ASSISTENTE · DADOS VERIFICADOS'}</small><p>${esc(m.text)}</p></div>`).join(''):
            '<div class="cp-assistant-empty">Pergunte sobre o andamento do seu projeto. As respostas consultam apenas as informações compartilhadas pela UXDriven.</div>'}
          ${assistantBusy?'<div class="cp-assistant-empty">Consultando seus dados…</div>':''}
        </div>
        <form id="cp-assistant-form" class="cp-assistant-form"><label for="cp-assistant-input">SUA MENSAGEM</label>
          <textarea id="cp-assistant-input" name="question" required maxlength="1600" placeholder="Como está a entrega do meu site?"></textarea>
          <button class="cp-btn cp-btn-primary" type="submit" ${assistantBusy?'disabled':''}>Perguntar ao assistente ↗</button>
        </form>
        <small class="cp-assistant-disclaimer">Este assistente não modifica demandas nem acessa notas internas. Sugestões não são solicitações registradas.</small>
      </section>`;
    }
    function render() {
      const client = currentClient();
      const tasks = currentTasks();
      const pendingTasks = tasks.filter(pending);
      const completed = tasks.filter(t => t.stage === 'done');
      const projects = data.projects.filter(p => p.client_id === selectedId && p.client_visible && !p.is_archived);
      root.innerHTML = `<div class="cp-page">${header()}<main class="cp-container">
        <div class="cp-eyebrow">${icon} WORKSPACE CONECTADO <span>/</span> ${esc(client?.name || 'CLIENTE')}</div>
        <section class="cp-hero"><div class="cp-hero-text"><div class="cp-hero-index">UXDRIVEN® / CLIENT COLLABORATION / 01</div><h1>Seu projeto.<br><em>Em boas mãos.</em></h1><p>Um lugar para acompanhar o que estamos criando, participar das decisões e enxergar cada avanço com clareza.</p>
          ${data.clients.length > 1 ? `<label class="cp-select-label" for="cp-client-select">SELECIONAR EMPRESA</label><select id="cp-client-select" class="cp-select">${data.clients.map(c => `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
        </div><div class="cp-hero-art" aria-hidden="true"><div class="cp-orbit cp-orbit-one"></div><div class="cp-orbit cp-orbit-two"></div><div class="cp-art-core"><span>CREATIVE OPERATIONS</span><strong>make it<br><em>matter.</em></strong><small>ESTRATÉGIA × DESIGN × EXECUÇÃO</small></div><span class="cp-art-float">${icon} MADE FOR HUMANS</span></div></section>
        ${error ? `<div class="cp-alert" role="alert">${esc(error)}</div>` : ''}
        <section class="cp-metrics" aria-label="Resumo das entregas"><div><small>DEMANDAS EM ANDAMENTO</small><strong>${String(tasks.filter(t => t.stage !== 'done').length).padStart(2,'0')}</strong><span>Visíveis para você</span></div><div><small>PRECISAM DA SUA ATENÇÃO</small><strong class="cp-metric-accent">${String(pendingTasks.length).padStart(2,'0')}</strong><span>${pendingTasks.length ? 'Aguardando sua avaliação' : 'Tudo em dia por aqui'}</span></div><div><small>ENTREGAS CONCLUÍDAS</small><strong>${String(completed.length).padStart(2,'0')}</strong><span>Histórico compartilhado</span></div></section>
        <div class="cp-content"><div class="cp-primary"><section class="cp-section"><div class="cp-section-head"><div><small>01 / ACOMPANHAMENTO</small><h2>O que estamos <em>criando.</em></h2></div><span class="cp-section-count">${tasks.length} DEMANDAS</span></div>
          <div class="cp-task-list">${tasks.length ? tasks.slice().sort((a,b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')).map(taskCard).join('') : '<div class="cp-empty">Nenhuma demanda foi compartilhada ainda. Quando a equipe liberar uma entrega, ela aparecerá aqui.</div>'}</div></section>
          <section class="cp-section cp-projects"><div class="cp-section-head"><div><small>02 / PROJETOS</small><h2>Frentes <em>ativas.</em></h2></div><span class="cp-section-count">${projects.length} PROJETOS</span></div><div class="cp-project-list">${projects.length ? projects.map(p => `<div class="cp-project"><span class="cp-project-icon">${icon}</span><div><strong>${esc(p.name)}</strong><p>${esc(p.description || 'Projeto acompanhado pela UXDriven.')}</p></div><span class="cp-project-badge">ATIVO</span></div>`).join('') : '<div class="cp-empty">Projetos detalhados serão disponibilizados aqui pela equipe UXDriven.</div>'}</div></section></div>
          <aside class="cp-aside"><div class="cp-review-panel"><span class="cp-aside-kicker">${icon} SUA PARTICIPAÇÃO</span><h2>Sua visão faz<br><em>a diferença.</em></h2><p>As entregas abaixo estão aguardando sua decisão.</p>
            ${pendingTasks.length ? pendingTasks.map(t => `<div class="cp-review-item"><strong>${esc(t.title)}</strong><span>${date(t.due_date)}</span><button type="button" class="cp-btn cp-btn-primary" data-task-open="${esc(t.id)}">Revisar entrega <span aria-hidden="true">↗</span></button></div>`).join('') : '<div class="cp-clear">✓ Nenhuma aprovação pendente no momento.</div>'}
          </div>${assistantPanel()}<div class="cp-help"><span>UMA EXPERIÊNCIA MAIS PRÓXIMA.</span><h3>Estamos juntos<br>em cada etapa.</h3><p>Este espaço reúne o acompanhamento e as decisões que fazem parte da sua entrega.</p><a href="https://uxdriven-lab.vercel.app/" target="_blank" rel="noopener noreferrer">Conheça a UXDriven ↗</a></div></aside></div>
        <footer class="cp-footer"><span>UXDRIVEN® SOCIAL STUDIO</span><span>DESIGNED AROUND THE USER ${icon}</span></footer>
      </main><div id="cp-modal-root"></div></div>`;
      document.title = `${client?.name || 'Portal do Cliente'} — UXDriven Social Studio`;
    }
    function modal(task) {
      openTaskId = task.id;
      const messages = data.comments.filter(c => c.task_id === task.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
      const decision = latestDecision(task);
      const slot = document.getElementById('cp-modal-root');
      slot.innerHTML = `<div class="cp-overlay" data-dismiss><section class="cp-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-dialog-title"><button type="button" class="cp-dialog-close" data-dismiss aria-label="Fechar">×</button>
        <div class="cp-eyebrow">${icon} ACOMPANHAMENTO / DEMANDA</div><h2 id="cp-dialog-title">${esc(task.title)}</h2><div class="cp-dialog-meta"><span>${esc(taskLabel(task))}</span><span>Previsão: ${date(task.due_date)}</span></div><div class="cp-summary">${esc(task.public_summary || 'Sem resumo compartilhado ainda.')}</div>
        ${decision ? `<div class="cp-last-decision"><strong>ÚLTIMA AVALIAÇÃO</strong><span>${decision.decision === 'approved' ? '✓ Aprovado' : '↻ Ajustes solicitados'} · ${date(decision.created_at)}</span>${decision.message ? `<p>${esc(decision.message)}</p>` : ''}</div>` : ''}
        <div class="cp-dialog-heading">HISTÓRICO DE MENSAGENS</div><div class="cp-message-list">${messages.length ? messages.map(c => `<div class="cp-message"><strong>${c.author_id === user.id ? 'Você' : 'Equipe / participante'} <span>${date(c.created_at)}</span></strong><p>${esc(c.body)}</p></div>`).join('') : '<p class="cp-no-messages">Nenhuma mensagem compartilhada nesta demanda.</p>'}</div>
        <form id="cp-comment-form"><label for="cp-comment">ENVIAR UMA MENSAGEM À EQUIPE</label><textarea id="cp-comment" name="message" maxlength="5000" required placeholder="Escreva sua dúvida ou observação…"></textarea><button type="submit" class="cp-btn" ${busy ? 'disabled' : ''}>Enviar mensagem ↗</button></form>
        ${pending(task) ? `<div class="cp-decision-panel"><strong>PRONTO PARA SUA DECISÃO?</strong><p>Aprovar confirma a avaliação desta entrega. Pedir ajustes registra sua solicitação para a equipe.</p><div class="cp-decision-actions"><button type="button" class="cp-btn cp-btn-primary" data-decision="approved">✓ Aprovar entrega</button><button type="button" class="cp-btn" data-decision="changes_requested">Solicitar ajustes</button></div><form id="cp-decision-form" class="cp-decision-form" hidden><label for="cp-decision-message">COMENTÁRIO SOBRE SUA DECISÃO</label><textarea id="cp-decision-message" maxlength="5000" name="message" placeholder="Conte à equipe o que precisa mudar…"></textarea><div class="cp-decision-actions"><button type="button" class="cp-btn" data-cancel-decision>Cancelar</button><button type="submit" class="cp-btn cp-btn-primary">Confirmar decisão</button></div></form></div>` : ''}
      </section></div>`;
      slot.querySelector('.cp-dialog-close').focus();
    }
    function closeModal() { openTaskId = null; const slot = document.getElementById('cp-modal-root'); if (slot) slot.innerHTML = ''; }
    function spinner(message) { root.innerHTML = `<div class="cp-loading"><img src="./assets/uxdriven-logo.svg" alt="UXDriven" width="46" height="46"><div>${icon} ${esc(message)}</div></div>`; }
    async function loadData() {
      const [clients,projects,tasks,comments,approvals] = await Promise.all([
        db.from('clients').select('id,organization_id,name,category').in('id', authorizedIds).order('name'),
        db.from('projects').select('id,client_id,name,description,is_archived,client_visible').in('client_id', authorizedIds).eq('client_visible',true),
        db.from('tasks').select('id,client_id,organization_id,title,task_type,stage,due_date,public_summary,client_visible,updated_at').in('client_id', authorizedIds).eq('client_visible',true),
        db.from('task_comments').select('id,task_id,client_id,author_id,body,created_at').in('client_id', authorizedIds).eq('visibility','shared'),
        db.from('task_approvals').select('id,task_id,client_id,decision,message,created_at').in('client_id', authorizedIds)
      ]);
      for (const result of [clients,projects,tasks,comments,approvals]) if (result.error) throw result.error;
      data = {clients:clients.data || [], projects:projects.data || [], tasks:tasks.data || [], comments:comments.data || [], approvals:approvals.data || []};
      if (!data.clients.some(c => c.id === selectedId)) selectedId = data.clients[0]?.id || null;
    }
    async function refresh() {
      await loadData(); render();
      if (openTaskId) { const task = data.tasks.find(t => t.id === openTaskId); if (task) modal(task); else closeModal(); }
    }
    function handleFailure(err) { error = 'Não foi possível concluir a ação. Verifique sua conexão e tente novamente.'; console.error('Client workspace action failed:',err); render(); }

    root.addEventListener('click', async event => {
      if (event.target.closest('#cp-logout')) { await signOut(); return; }
      const suggestion=event.target.closest('[data-assistant-question]');
      if(suggestion){const input=root.querySelector('#cp-assistant-input');if(input){input.value=suggestion.dataset.assistantQuestion||'';input.focus();}return;}
      const dismiss = event.target.closest('[data-dismiss]');
      if (dismiss && (event.target === dismiss || dismiss.classList.contains('cp-dialog-close'))) { closeModal(); return; }
      const open = event.target.closest('[data-task-open]');
      if (open) { const task = currentTasks().find(t => t.id === open.dataset.taskOpen); if (task) modal(task); return; }
      if (event.target.closest('[data-cancel-decision]')) { const form = root.querySelector('#cp-decision-form'); if (form) form.hidden = true; return; }
      const decision = event.target.closest('[data-decision]');
      if (decision) {
        const task = currentTasks().find(t => t.id === openTaskId);
        if (!task || !pending(task)) return;
        const form = root.querySelector('#cp-decision-form');
        form.dataset.decision = decision.dataset.decision;
        form.hidden = false;
        form.querySelector('textarea').required = decision.dataset.decision === 'changes_requested';
        form.querySelector('textarea').focus();
      }
    });
    root.addEventListener('change', event => {
      if (event.target.id === 'cp-client-select' && data.clients.some(c => c.id === event.target.value)) { selectedId = event.target.value; closeModal(); render(); }
    });
    root.addEventListener('submit', async event => {
      const form = event.target;
      if(form.id==='cp-assistant-form'){
        event.preventDefault();
        if(assistantBusy)return;
        const question=String(new FormData(form).get('question')||'').trim();
        if(!question||question.length>1600)return;
        const scopeId=selectedId;
        const messages=(assistantThreads[scopeId]||[]).slice();
        messages.push({role:'user',text:question});
        assistantThreads[scopeId]=messages.slice(-12);
        assistantBusy=true;render();
        try{
          const auth=await db.auth.getSession();
          const token=auth.data?.session?.access_token;
          if(!token)throw new Error('Sua sessão expirou. Entre novamente.');
          const response=await fetch('/api/assistant',{
            method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
            body:JSON.stringify({message:question,clientId:scopeId})
          });
          const result=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(result.reply||'O assistente está indisponível neste momento.');
          assistantThreads[scopeId].push({role:'assistant',mode:result.mode,text:result.reply});
          assistantThreads[scopeId]=assistantThreads[scopeId].slice(-12);
        }catch(err){
          assistantThreads[scopeId].push({role:'assistant',mode:'error',text:err.message||'Falha de conexão.'});
        }finally{
          assistantBusy=false;render();
          const box=root.querySelector('#cp-assistant-conversation');
          if(box)box.scrollTop=box.scrollHeight;
        }
        return;
      }
      if (!['cp-comment-form','cp-decision-form'].includes(form.id)) return;
      event.preventDefault();
      if (busy) return;
      const task = currentTasks().find(t => t.id === openTaskId);
      if (!task) return;
      const message = String(new FormData(form).get('message') || '').trim();
      if (message.length > 5000 || (form.id === 'cp-comment-form' && !message)) return;
      if (form.id === 'cp-decision-form' && (!pending(task) || (form.dataset.decision === 'changes_requested' && !message))) return;
      busy = true;
      form.querySelectorAll('button').forEach(button => button.disabled = true);
      try {
        const insert = form.id === 'cp-comment-form'
          ? db.from('task_comments').insert({organization_id:task.organization_id,client_id:task.client_id,task_id:task.id,author_id:user.id,visibility:'shared',body:message})
          : db.from('task_approvals').insert({organization_id:task.organization_id,client_id:task.client_id,task_id:task.id,actor_id:user.id,decision:form.dataset.decision,message});
        const result = await insert;
        if (result.error) throw result.error;
        error = '';
        await refresh();
      } catch (err) { handleFailure(err); }
      finally { busy = false; }
    });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

    spinner('Preparando seu espaço criativo…');
    try {
      await loadData();
      if (!data.clients.length) throw new Error('O vínculo do seu usuário com um cliente precisa ser revisado pela equipe UXDriven.');
      render();
    } catch (err) {
      console.error('Client workspace load failed:',err);
      root.innerHTML = `<div class="cp-loading"><img src="./assets/uxdriven-logo.svg" alt="UXDriven" width="46" height="46"><h1>Não foi possível abrir seu espaço.</h1><p>${esc(err.message)}</p><button id="cp-retry" class="cp-btn cp-btn-primary">Tentar novamente</button><button id="cp-logout" class="cp-btn">Sair da conta</button></div>`;
      root.querySelector('#cp-retry').onclick = () => location.reload();
    }
  };
})();
