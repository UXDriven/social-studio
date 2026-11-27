# UXDriven Social Studio — relatórios operacionais e Copilot

## Estado da implementação
- **Relatórios / Production:** métricas reais de tarefas do Supabase, prazos, etapas, volume de demandas, retornos de cliente no período e distribuição por cliente. Nenhuma métrica de Instagram/LinkedIn é inventada.
- **Studio IA / agência:** chat com endpoint protegido que lê demandas autorizadas; perguntas de status, prazos e revisões são respondidas em modo **Consulta** sem IA paga. Se o Vercel AI Gateway for habilitado, passa a gerar estratégia, briefings, copies e análises em modo **IA**.
- **Portal do Cliente:** assistente contextual com as mesmas duas modalidades, mas **somente** acesso às demandas explicitamente compartilhadas, da conta associada a `client_members`.
- **Não há ações automáticas de escrita:** nenhum modelo envia e-mail, cria demanda, aprova, publica ou altera dados. Na agência, o botão de usar resposta como briefing abre um formulário para revisão humana, sem salvar automaticamente.
- **Histórico:** mensagens permanecem na memória da aba durante a sessão, não são salvas no banco ou publicadas; futuramente, um chat persistente exigirá tabelas com RLS próprio.

## Segurança do endpoint
`POST /api/assistant` exige sessão Supabase de usuário autenticado, validada em `/auth/v1/user` com a chave **publicável**. O servidor consulta `organization_members` ou `client_members`, sempre com JWT do usuário para que o PostgreSQL aplique RLS. Um `clientId` enviado pelo navegador nunca concede acesso: é validado contra as associações autorizadas. Para cliente, a consulta à tabela `tasks` inclui **`client_visible=eq.true`**. A consulta **nunca** acessa `task_internal_notes` no modo cliente. O contexto enviado ao modelo passa por uma projeção explícita dos campos permitidos.

Limites no endpoint: mensagem de até 1.600 caracteres, no máximo 60 demandas, 80 decisões (apenas das demandas selecionadas), conteúdo reduzido e no máximo 850 tokens de saída. O modelo não recebe a credencial Supabase e nunca recebe permissão de escrita. A chave de modelo permanece somente no ambiente de servidor da Vercel. O endpoint responde com `no-store` e bloqueia origens fora do domínio oficial/Preview.

Os registros são dados de negócio, **não instruções ao modelo**; ainda será necessário executar testes de prompt injection e de cotas antes de uma abertura em escala.

## Ativação opcional do AI Gateway — exige decisão sobre consumo

No momento o modo **Consulta** funciona sem chamadas ao modelo. Para ativar geração em ambiente real, ajustar **Vercel → Social Studio → Settings → Environment Variables**:
- `AI_ASSISTANTS_ENABLED=true` em Production, apenas quando a agência autorizar cobranças e confirmar os limites.
- `AI_CLIENT_ASSISTANT_ENABLED=true` **somente após o piloto interno**, testes de isolamento e implantação de um limitador persistente de solicitações. Sem essa flag, clientes continuam com consultas factuais, mesmo se o modelo pago estiver ativo para a agência.
- `AI_GATEWAY_MODEL=<ID de modelo validado no catálogo atual>` (por exemplo, usar um modelo realmente listado pelo AI Gateway na data da ativação).
- **Autenticação:** em deployment na Vercel, o runtime oferece o token OIDC de função. Alternativamente, configurar `AI_GATEWAY_API_KEY` como segredo de servidor — nunca no JavaScript público. Se for criada uma chave, definir validade e orçamento no serviço.
- Configurar **orçamento por projeto** e alertas de custo em Vercel AI Gateway. Implantar limitação persistente de chamadas por usuário antes do rollout para clientes.
- Depois de mudar as variáveis, criar um novo deployment de Production e realizar uma chamada de teste, conferindo custo e resultado no AI Gateway Logs.

Sem as variáveis habilitadas, o backend não tenta chamar modelos nem consumir créditos, mas responde consultas operacionais simples usando dados reais. As respostas de estratégia/copy informam a necessidade de ativação.

## Testes necessários para validação visual
1. Entrar na agência e abrir **Relatórios**; conferir com o Kanban, selecionar 7/30/90 dias e filtrar Humgroup/IB Cidade/Xande.
2. Abrir **Studio IA**, perguntar “Quais demandas vencem?” e conferir status real e identificação **CONSULTA DE DADOS**.
3. Entrar como Xande e perguntar sobre o site. Deve responder apenas sobre as demandas do Xande.
4. Entrar com Humgroup e procurar informações da IB Cidade: não deve encontrar.
5. Informar um clientId não associado no endpoint: erro 403. Sem JWT: erro 401.
6. Pedir “Crie uma campanha”: antes do gateway, a resposta deve informar que o modelo precisa ser habilitado; não inventar execução.
7. Após ativar AI Gateway e orçamento, solicitar uma copy e fazer verificação manual. Confirmar que nenhuma demanda é criada sem sua ação.
8. Analisar os logs para erros e custos. Atenção a cotas e requisitos do plano Vercel para uso comercial.

## Próximas fases
- **Planejamento editorial real:** tabela de publicações com datas de produção/publicação, canais, arquivos e permissões separados do prazo da demanda.
- **Brand knowledge:** brand kits, manuais e briefings por cliente em Storage + tabelas com RLS; indexação e recuperação somente dentro do workspace autorizado.
- **Solicitação de demanda pelo cliente:** formulário próprio e fluxo de aprovação da agência, jamais escrita direta pelo modelo.
- **Relatórios sociais:** somente após conexão OAuth e sincronização autorizada com Meta/LinkedIn, sem números demonstrativos.
- **Limite de gastos e rate limit persistente:** requisito antes de liberar geração de IA para múltiplos clientes.
