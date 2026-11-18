(async function boot() {
  "use strict";
  const root = document.getElementById("auth-root");
  const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
  function screen(kicker, title, description, body="") {
    root.hidden=false;
    root.innerHTML=`<main class="auth-page"><section class="auth-panel"><div class="auth-logo">UX<span>✳</span></div><div class="auth-kicker">${kicker}</div><h1>${title}</h1><p>${description}</p>${body}<small class="auth-footer">UXDRIVEN® SOCIAL STUDIO / SECURE WORKSPACE</small></section></main>`;
  }
  const btn=(id,txt)=>`<button id="${id}" class="auth-submit">${txt}</button>`;
  screen("INICIALIZANDO", "Conectando seu <em>workspace.</em>", "Validando sessão e permissões.");
  try {
    const configResp=await fetch("/api/public-config",{cache:"no-store"});
    if(!configResp.ok) {
      screen("CONFIGURAÇÃO NECESSÁRIA","Conecte o <em>Supabase.</em>",
        "Faltam as variáveis de ambiente públicas no projeto da Vercel.",
        `<div class="auth-alert">Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente Production e faça Redeploy.</div>${btn("retry","Verificar novamente")}`);
      document.getElementById("retry").onclick=()=>location.reload();
      return;
    }
    const cfg=await configResp.json();
    if(!cfg.configured||!window.supabase?.createClient) throw new Error("Configuração ou SDK indisponível.");
    const db=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
    const signOut=async()=>{await db.auth.signOut();location.reload();};
    const makeClient=(c,i)=>({id:c.id,name:c.name,type:c.category||"Cliente",short:c.name.split(/\s+/).slice(0,2).map(t=>t[0]).join("").toUpperCase(),hex:["#573999","#307446","#bc8731","#385b82"][i%4],light:"#f6ffe9",slug:"ux"});
    const makeTask=(t,note="")=>({id:t.id,client:t.client_id,title:t.title,type:t.task_type,stage:t.stage,priority:t.priority,assignee:"Equipe UXDriven",due:t.due_date||new Date().toISOString().slice(0,10),publicSummary:t.public_summary||"",internalNote:note,clientVisible:t.client_visible,comments:[]});
    const fail=message=>{
      screen("ACESSO NÃO LIBERADO","Conta sem <em>workspace.</em>",message,btn("signout","Sair desta conta"));
      document.getElementById("signout").onclick=signOut;
    };
    async function openWorkspace(user) {
      const memberships=await db.from("organization_members").select("organization_id,role").eq("user_id",user.id);
      if(memberships.error)throw memberships.error;
      const member=memberships.data?.[0];
      if(!member)return fail("Seu usuário ainda não está associado à organização UXDriven no banco de dados.");
      const org=await db.from("organizations").select("id,name").eq("id",member.organization_id).single();
      if(org.error)throw org.error;
      const organization=org.data;
      const [c,t,n,cm]=await Promise.all([
        db.from("clients").select("id,name,category,is_active").eq("organization_id",organization.id).order("name"),
        db.from("tasks").select("id,client_id,title,task_type,stage,priority,due_date,public_summary,client_visible").eq("organization_id",organization.id),
        db.from("task_internal_notes").select("task_id,body").eq("organization_id",organization.id),
        db.from("task_comments").select("task_id,body,visibility,author_id").eq("organization_id",organization.id)
      ]);
      for(const r of [c,t,n,cm])if(r.error)throw r.error;
      const notes=new Map((n.data||[]).map(x=>[x.task_id,x.body]));
      const tasks=(t.data||[]).map(x=>makeTask(x,notes.get(x.id)||""));
      for(const co of cm.data||[]) {
        const task=tasks.find(x=>x.id===co.task_id);
        if(task)task.comments.push({author:co.author_id===user.id?"Você":"Participante",text:co.body,visibility:co.visibility});
      }
      const live={
        enabled:true,user,role:member.role,organization,
        clients:(c.data||[]).map(makeClient),tasks,signOut,
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
          const r=await db.from("tasks").update({stage:input.stage,due_date:input.due,public_summary:input.publicSummary}).eq("id",input.id).eq("organization_id",organization.id);
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
