(async function boot() {
  "use strict";
  const root = document.getElementById("auth-root");
  const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
  function screen(kicker, title, description, body="") {
    root.hidden=false;
    root.innerHTML=`<main class="auth-page">
      <div class="auth-background-grid" aria-hidden="true"></div>
      <div class="auth-container">
        <section class="auth-editorial" aria-label="Universo UXDriven">
          <a class="auth-brand" href="https://uxdriven-lab.vercel.app/" target="_blank" rel="noopener" aria-label="UXDriven — site institucional">
            <img src="./assets/uxdriven-logo.svg" width="44" height="44" alt="">
            <span>uxdriven<span class="auth-period">.</span></span><sup>®</sup>
          </a>
          <div class="auth-editorial-body">
            <div class="auth-eyebrow"><span class="auth-pulse"></span> CREATIVE TECHNOLOGY STUDIO <i></i> BRASIL / WORLDWIDE</div>
            <h2>Design que entende <em>pessoas.</em><br>Operações que movem <span class="auth-outline">ideias.</span></h2>
            <p>A experiência é o ponto de partida. Planejamento, criação e colaboração integrados em um só universo.</p>
            <div class="auth-visual" aria-hidden="true">
              <div class="auth-orbit auth-orbit-one"></div><div class="auth-orbit auth-orbit-two"></div>
              <div class="auth-visual-card"><span>UX / SOCIAL STUDIO</span><strong>make it<br><em>matter.</em></strong><small>CONTENT / WORKFLOW / INTELLIGENCE</small></div>
              <div class="auth-floating-pill auth-pill-a">✳ CREATIVE SYSTEMS</div>
              <div class="auth-floating-pill auth-pill-b"><span></span> WORKSPACE CONNECTED</div>
            </div>
          </div>
          <div class="auth-editorial-footer"><span>DESIGN × CÓDIGO × INTELIGÊNCIA</span><span>MADE FOR HUMANS · © 2026</span></div>
        </section>
        <section class="auth-panel">
          <div class="auth-panel-top"><span>UXDRIVEN® / SOCIAL STUDIO</span><span>PRIVATE WORKSPACE / 01</span></div>
          <div class="auth-panel-body">
            <div class="auth-kicker">${esc(kicker)}</div>
            <h1>${title}</h1><p class="auth-panel-description">${esc(description)}</p>${body}
          </div>
          <div class="auth-footer"><span>SECURE CREATIVE OPERATIONS</span><span>DESIGNED AROUND THE USER <b>✳</b></span></div>
        </section>
      </div>
    </main>`;
  }
  const btn=(id,txt)=>`<button id="${id}" class="auth-submit">${txt}</button>`;
  screen("INICIALIZANDO", "Conectando seu <em>workspace.</em>", "Validando sessão e permissões.");
  try {
    const configResp=await fetch("/api/public-config",{cache:"no-store"});
    const cfg=await configResp.json().catch(()=>({}));
    if(!configResp.ok) {
      const envName=cfg.environment==="preview"?"Preview":cfg.environment==="production"?"Production":cfg.environment==="development"?"Development":"não identificado";
      const missing=Array.isArray(cfg.missing)?cfg.missing.filter(v=>["SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY"].includes(v)):[];
      const issue=cfg.error==="invalid_url"?"A URL do Supabase foi informada em formato inválido.":
        cfg.error==="invalid_publishable_key"?"A chave informada não é uma chave pública válida.":
        missing.length?"Estão ausentes neste deployment: "+missing.join(" e ")+".":"A função de configuração não retornou uma resposta válida.";
      screen("CONEXÃO / AMBIENTE", "Estamos quase <em>conectados.</em>",
        "O deployment ainda não recebeu uma configuração pública válida do Supabase.",
        `<div class="auth-alert" role="alert"><strong>Ambiente detectado: ${esc(envName)}</strong><span>${esc(issue)}</span></div>
        <p class="auth-helper">Confira as variáveis em Vercel → Social Studio → Settings → Environment Variables.
        Elas precisam estar no <strong>mesmo ambiente deste deployment</strong>. Depois, gere um novo deployment da branch de teste.</p>
        ${btn("retry","Verificar novamente ↗")}`);
      document.getElementById("retry").onclick=()=>location.reload();
      return;
    }
    if(!cfg.configured||!window.supabase?.createClient) throw new Error("Configuração ou SDK indisponível.");
    const db=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
    const signOut=async()=>{await db.auth.signOut();location.reload();};
    const makeClient=(c,i)=>({id:c.id,name:c.name,type:c.category||"Cliente",short:c.name.split(/\s+/).slice(0,2).map(t=>t[0]).join("").toUpperCase(),hex:["#573999","#307446","#bc8731","#385b82"][i%4],light:"#f6ffe9",slug:"ux"});
    const makeTask=(t,note="")=>({id:t.id,client:t.client_id,title:t.title,type:t.task_type,stage:t.stage,priority:t.priority,assignee:"Equipe UXDriven",due:t.due_date||new Date().toISOString().slice(0,10),publicSummary:t.public_summary||"",internalNote:note,clientVisible:t.client_visible,updatedAt:t.updated_at||"",comments:[],approvals:[]});
    const hydrateTasks=(rows,notes,comments,decisions,userId)=>{
      const notesById=new Map((notes||[]).map(n=>[n.task_id,n.body]));
      const tasks=(rows||[]).map(t=>makeTask(t,notesById.get(t.id)||""));
      const byId=new Map(tasks.map(t=>[t.id,t]));
      for(const co of comments||[]){
        const task=byId.get(co.task_id);
        if(task)task.comments.push({author:co.author_id===userId?"Você":"Cliente / participante",text:co.body,visibility:co.visibility,created_at:co.created_at});
      }
      for(const approval of decisions||[]){
        const task=byId.get(approval.task_id);
        if(task)task.approvals.push(approval);
      }
      for(const task of tasks)task.approvals.sort((a,b)=>b.created_at.localeCompare(a.created_at));
      return tasks;
    };
    const fail=message=>{
      screen("ACESSO NÃO LIBERADO","Conta sem <em>workspace.</em>",message,btn("signout","Sair desta conta"));
      document.getElementById("signout").onclick=signOut;
    };
    function openClientPortal(user,memberships) {
      // No agency dashboard bundle or internal notes are loaded for a client account.
      const css=document.createElement("link");
      css.rel="stylesheet";
      css.href="./client-portal.css";
      document.head.appendChild(css);
      const script=document.createElement("script");
      script.src="./client-portal.js";
      script.onload=()=>window.UXDrivenClientPortal({db,user,memberships,signOut});
      script.onerror=()=>fail("Não foi possível carregar o Portal do Cliente.");
      document.body.appendChild(script);
    }
    async function openWorkspace(user) {
      const memberships=await db.from("organization_members").select("organization_id,role").eq("user_id",user.id);
      if(memberships.error)throw memberships.error;
      const member=memberships.data?.[0];
      if(!member){
        const clientMemberships=await db.from("client_members").select("client_id,organization_id").eq("user_id",user.id);
        if(clientMemberships.error)throw clientMemberships.error;
        if(clientMemberships.data?.length)return openClientPortal(user,clientMemberships.data);
        return fail("Seu usuário ainda não está associado à equipe UXDriven ou a um cliente autorizado.");
      }
      const org=await db.from("organizations").select("id,name").eq("id",member.organization_id).single();
      if(org.error)throw org.error;
      const organization=org.data;
      const [c,t,n,cm,ap]=await Promise.all([
        db.from("clients").select("id,name,category,is_active").eq("organization_id",organization.id).order("name"),
        db.from("tasks").select("id,client_id,title,task_type,stage,priority,due_date,public_summary,client_visible,updated_at").eq("organization_id",organization.id),
        db.from("task_internal_notes").select("task_id,body").eq("organization_id",organization.id),
        db.from("task_comments").select("task_id,body,visibility,author_id,created_at").eq("organization_id",organization.id),
        db.from("task_approvals").select("id,task_id,decision,message,actor_id,created_at").eq("organization_id",organization.id)
      ]);
      for(const r of [c,t,n,cm,ap])if(r.error)throw r.error;
      const tasks=hydrateTasks(t.data,n.data,cm.data,ap.data,user.id);
      const live={
        enabled:true,user,role:member.role,organization,
        clients:(c.data||[]).map(makeClient),tasks,signOut,
        async refreshWorkspace(){
          const [t,n,cm,ap]=await Promise.all([
            db.from("tasks").select("id,client_id,title,task_type,stage,priority,due_date,public_summary,client_visible,updated_at").eq("organization_id",organization.id),
            db.from("task_internal_notes").select("task_id,body").eq("organization_id",organization.id),
            db.from("task_comments").select("task_id,body,visibility,author_id,created_at").eq("organization_id",organization.id),
            db.from("task_approvals").select("id,task_id,decision,message,actor_id,created_at").eq("organization_id",organization.id)
          ]);
          for(const result of [t,n,cm,ap])if(result.error)throw result.error;
          this.tasks=hydrateTasks(t.data,n.data,cm.data,ap.data,user.id);
          return this.tasks;
        },
        async createClient(input){
          const r=await db.from("clients").insert({organization_id:organization.id,name:input.name,category:input.category||""}).select("id,name,category").single();
          if(r.error)throw r.error;
          return makeClient(r.data,this.clients.length);
        },
        async createTask(input){
          const r=await db.from("tasks").insert({organization_id:organization.id,client_id:input.client,title:input.title,task_type:input.type,stage:input.stage,priority:input.priority,due_date:input.due,public_summary:input.publicSummary,client_visible:false}).select("id,client_id,title,task_type,stage,priority,due_date,public_summary,client_visible").single();
          if(r.error)throw r.error;
          if(input.internalNote?.trim()){
            const note=await db.from("task_internal_notes").insert({task_id:r.data.id,organization_id:organization.id,body:input.internalNote});
            if(note.error)throw new Error("Demanda criada; nota interna não salva: "+note.error.message);
          }
          return makeTask(r.data,input.internalNote);
        },
        async updateTask(input){
          const r=await db.from("tasks").update({stage:input.stage,due_date:input.due,public_summary:input.publicSummary,client_visible:input.clientVisible===true}).eq("id",input.id).eq("organization_id",organization.id);
          if(r.error)throw r.error;
          const n=await db.from("task_internal_notes").upsert({task_id:input.id,organization_id:organization.id,body:input.internalNote||""},{onConflict:"task_id"});
          if(n.error)throw new Error("Etapa atualizada; nota interna não salva: "+n.error.message);
        },
        async moveTask(id,stage){
          const r=await db.from("tasks").update({stage}).eq("id",id).eq("organization_id",organization.id);
          if(r.error)throw r.error;
        }
      };
      window.UXDrivenLive=live;
      document.body.classList.remove("locked");
      root.hidden=true;
      const script=document.createElement("script");
      script.src="./app.js";
      script.onload=()=>{document.getElementById("ux-signout")?.addEventListener("click",signOut);};
      script.onerror=()=>screen("ERRO","Interface indisponível.","Não foi possível carregar o dashboard.");
      document.body.appendChild(script);
    }
    function showLogin(error=""){
      screen("UXDRIVEN / LOGIN","Sua operação. <em>Uma nova era.</em>",
        "Acesso exclusivo à equipe autorizada.",
        `${error?`<div class="auth-alert" role="alert">${esc(error)}</div>`:""}
        <form class="auth-form" id="auth-form">
          <label for="auth-email">E-mail</label><input id="auth-email" type="email" name="email" autocomplete="username" required placeholder="seu@email.com">
          <label for="auth-password">Senha</label><input id="auth-password" type="password" name="password" autocomplete="current-password" required placeholder="Sua senha">
          <button class="auth-submit" type="submit">Acessar Social Studio →</button>
        </form>`);
      document.getElementById("auth-form").onsubmit=async e=>{
        e.preventDefault();
        const button=e.currentTarget.querySelector("button");button.disabled=true;button.textContent="Autenticando...";
        const form=new FormData(e.currentTarget);
        const r=await db.auth.signInWithPassword({email:String(form.get("email")),password:String(form.get("password"))});
        if(r.error)return showLogin("E-mail ou senha inválidos, ou conta ainda não confirmada.");
        try{await openWorkspace(r.data.user);}catch(err){showLogin(err.message);}
      };
    }
    const session=await db.auth.getUser();
    if(session.data.user&&!session.error)await openWorkspace(session.data.user);
    else showLogin();
  } catch(error) {
    screen("ERRO DE CONEXÃO","Não conseguimos <em>entrar.</em>",
      "Verifique a configuração do Supabase e tente novamente.",
      `<div class="auth-alert">${esc(error.message)}</div>${btn("retry","Tentar novamente")}`);
    document.getElementById("retry").onclick=()=>location.reload();
  }
})();
