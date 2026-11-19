# Portal do Cliente UXDriven — MVP de validação

## O que esta branch entrega

- Login já existente com Supabase Auth: agência continua no dashboard; usuários que pertencem **somente** a `client_members` entram diretamente no Portal do Cliente.
- Área independente do dashboard da agência (`dist/client-portal.js` e `dist/client-portal.css`). Ela não importa `dist/app.js` nem consulta `task_internal_notes`.
- Demandas aparecem no portal **somente quando** `tasks.client_visible = true`. O padrão é `false`.
- Projetos ativos **explicitamente compartilhados**, prazo, status, resumo público, histórico de comentários compartilhados e decisões de aprovação.
- Cliente pode registrar comentários (`task_comments`, `visibility = shared`) e decidir uma entrega em fase `client` (`task_approvals`). A decisão é append-only; a agência é responsável por atualizar a etapa da demanda.
- Todos os acessos dependem das policies RLS já existentes no Supabase. A seleção de cliente na interface não substitui RLS.

## Pré-requisitos

1. A migration `supabase/migrations/20261118170000_core.sql` deve ter sido aplicada previamente.
2. **Antes de testar o portal**, execute também `supabase/migrations/20261119190000_client_portal_projects_rls.sql` no SQL Editor. Ela adiciona `projects.client_visible` com padrão `false` e fecha a leitura de projetos internos para contas de cliente. Nenhum projeto preexistente é compartilhado automaticamente.
3. `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` devem existir no ambiente **Preview** da Vercel. Nunca coloque `service_role` no navegador ou GitHub.
4. Trabalhe somente com clientes e contas **fictícios** enquanto a validação de isolamento entre contas não terminar.

## Como habilitar a primeira conta de cliente de teste

1. Faça login como proprietário da UXDriven e crie dois clientes fictícios, por exemplo **Cliente Piloto A** e **Cliente Piloto B**.
2. Crie uma demanda para cada cliente. Na demanda do Piloto A, abra os detalhes, preencha o resumo público e marque **Compartilhar esta demanda com o cliente**. Faça uma segunda demanda do mesmo cliente sem compartilhar; esta deverá permanecer invisível ao cliente.
3. Deixe a demanda compartilhada do Piloto A na etapa **Aguardando aprovação**.
4. No Supabase Dashboard, vá em **Authentication → Users → Add user** e crie um usuário **de teste**, com e-mail distinto do proprietário. Não envie credenciais aqui na conversa.
5. No Supabase SQL Editor, substitua **somente** os dois valores de exemplo abaixo pelos valores fictícios que você criou e execute:

```sql
-- Execute no SQL Editor com permissão administrativa; não execute no navegador.
insert into public.client_members (client_id, organization_id, user_id)
select c.id, c.organization_id, u.id
from public.clients c
join auth.users u on lower(u.email) = lower('cliente-a-teste@example.com')
where c.name = 'Cliente Piloto A'
  and exists (select 1 from public.organizations o
              where o.id = c.organization_id and o.slug = 'uxdriven')
on conflict (client_id, user_id) do nothing;
```

6. Saia da conta da agência (ou abra uma janela anônima) e entre com o usuário do Cliente Piloto A no Preview da branch `feat/client-portal-rls`.
7. Repita com **outro usuário e outro cliente** para confirmar o isolamento. Não insira o cliente de teste em `organization_members` — isso daria acesso ao dashboard interno.

**Projetos:** a interface de criação/compartilhamento de projetos virá depois. Nesta primeira fase, eles permanecem ocultos por padrão. Caso haja um projeto fictício criado previamente, um administrador pode definir `client_visible = true` somente nesse projeto pelo SQL Editor após verificar seu conteúdo.

## Checklist de aceite — executar antes de abrir acesso a clientes reais

- [ ] Proprietário da UXDriven continua acessando o dashboard normal.
- [ ] Conta do Cliente Piloto A abre apenas o portal, sem menu ou código do painel interno.
- [ ] Cliente A vê somente a demanda marcada como compartilhada; nunca a privada.
- [ ] Cliente A não vê demandas, comentários ou projetos do Cliente B.
- [ ] Cliente B não vê demandas ou projetos do Cliente A.
- [ ] Cliente A envia comentário e ele permanece após F5; agência o visualiza na demanda.
- [ ] Cliente A aprova ou solicita ajustes; o registro persiste após F5, sem alterar automaticamente a etapa.
- [ ] Ao mover a demanda para outra etapa e devolvê-la a **Aguardando aprovação**, uma nova decisão pode ser registrada.
- [ ] Notas internas jamais aparecem no portal ou nas respostas de rede ao login de cliente.
- [ ] Tentativas diretas de ler/escrever recursos de outra empresa são negadas pelo banco (RLS), inclusive URLs/API requests manipulados.

## Implantação segura

Este desenvolvimento pertence à **PR do Portal do Cliente** e ainda precisa de testes integrados com **duas contas distintas**. O código sozinho não comprova o isolamento RLS em um Supabase real.

Para consolidar a **PR #2** em `main`, antes confira Vercel → Social Studio → Settings → Environment Variables:

1. `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` devem estar ativadas em **Production** além de Preview.
2. Gere um novo deployment (as mudanças de variáveis não reconfiguram automaticamente deployments antigos).
3. Confira o login com a conta da agência na URL de Production e teste uma demanda fictícia.
4. Só então considere a base pronta para publicar a PR do Portal do Cliente.

**Atenção:** não habilite dados ou acessos comerciais reais no plano Vercel Hobby. Reavalie o plano e a conformidade antes do piloto comercial.

## Próximas evoluções

- Convite seguro de usuários via função server-side com autorização de `owner/admin` (não inserir `client_members` via navegador).
- Arquivos e versões de criativos com políticas de Storage por cliente.
- Notificações, logs de auditoria de decisões e trilha de revisão por versão da entrega.
- Testes automatizados de RLS executados contra banco de testes com usuários diferentes.
