# Supabase — implantação inicial e segurança

Esta etapa prepara o banco do UXDriven Social Studio sem alterar a interface demonstrativa publicada na Vercel.

## 1. Confirmar integração com o GitHub

No Supabase, abra **Project Settings → Integrations → GitHub** e confira:

- Repositório: `UXDriven/social-studio`.
- Working directory: `.` (a pasta `supabase/` ficará na raiz).
- Production branch: `main`.
- **Deploy to production:** confira se está habilitado. Se estiver, qualquer nova migração da `main` poderá ser aplicada automaticamente ao banco.

O PR da primeira migração fica em uma branch separada para revisão. Não é necessário habilitar Supabase Branching (prévia de banco por PR), recurso que pode exigir plano pago.

> Não execute o mesmo arquivo uma vez pelo SQL Editor e depois outra vez pelo deploy automático. Escolha um único mecanismo de aplicação, preferencialmente a integração GitHub.

## 2. O que a migração cria

Arquivo: `supabase/migrations/20261118170000_core.sql`.

| Tabela | Finalidade |
| --- | --- |
| `organizations` | Agência hoje; outras agências apenas no futuro |
| `profiles` | Perfil público mínimo de usuários autenticados |
| `organization_members` | Equipe UXDriven e papéis (owner/admin/collaborator) |
| `clients` | Empresas atendidas pela agência |
| `client_members` | Clientes autorizados a acessar seus dados |
| `projects` | Agrupamento de demandas por cliente |
| `tasks` | Demandas, responsáveis, prazos e fluxo Kanban |
| `task_internal_notes` | Notas privadas, em tabela separada |
| `task_comments` | Comentários internos ou compartilhados |
| `task_approvals` | Decisões de aprovação/ajuste com autoria e data |

Todas as tabelas ativam Row Level Security (RLS). Sem associação de usuário a uma organização ou cliente, o usuário autenticado não consegue ler nenhuma demanda. A chave publicável do projeto pode estar no navegador **somente porque o RLS foi implementado e deve ser testado**.

As relações têm chaves estrangeiras compostas para impedir que uma demanda aponte para um cliente de outra organização.

## 3. Aplicar a migração com segurança

1. Revise o Pull Request da migração no GitHub.
2. Confirme no Supabase que o banco é o projeto esperado e verifique a opção **Deploy to production**.
3. Faça merge do PR na `main` somente quando decidir aplicar o schema.
4. Confira o status no histórico de deploy da integração Supabase e verifique que as 10 tabelas existem.
5. Se a integração não aplica automaticamente, escolha **uma** alternativa de execução conforme a documentação oficial do Supabase; não faça as duas.

Não coloque senhas ou chaves secretas no repositório público.

## 4. Criar o primeiro usuário administrador

1. Abra **Authentication → Users** no Supabase.
2. Crie ou convide a sua conta de acesso. O e-mail de login é independente do acesso ao GitHub.
3. Copie o UUID desse usuário (campo `id`).
4. No **SQL Editor** do Supabase, execute o comando abaixo, substituindo apenas o UUID indicado:

```sql
with agency as (
  insert into public.organizations (name, slug)
  values ('UXDriven', 'uxdriven')
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.organization_members (organization_id, user_id, role)
select agency.id, 'COLE_AQUI_O_UUID_DO_USUARIO'::uuid, 'owner'::public.agency_role
from agency
on conflict (organization_id, user_id)
do update set role = excluded.role;
```

**Não use o SQL Editor para convidar clientes reais nesta etapa.** Primeiro validaremos a leitura e a escrita com contas fictícias separadas.

## 5. Preparar a conexão com a Vercel (próxima entrega)

Depois que o frontend passar a usar um build configurável, vamos adicionar ao projeto da Vercel:

- `VITE_SUPABASE_URL`: URL pública do projeto.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publicável do projeto.

Esses valores identificam o projeto e não substituem a autenticação. Os dados devem ser protegidos por RLS. **Nunca** coloque `service_role`, `sb_secret_...`, senha do banco ou connection string no código do navegador nem no GitHub.

A opção **Authentication → URL Configuration** também deverá incluir o endereço de produção `https://social-studio-sage.vercel.app` e os redirecionamentos explícitos usados pelo login.

Conectar o Supabase ao GitHub não injeta automaticamente variáveis no projeto da Vercel.

## 6. Matriz mínima de testes antes de dados reais

| Caso | Resultado esperado |
| --- | --- |
| Usuário autenticado sem associação | Não enxerga organizações, clientes ou demandas |
| Colaborador UXDriven | Lê e atualiza apenas demandas da organização associada |
| Cliente A | Lê apenas projetos e demandas compartilhados com A |
| Cliente B | Não lê nada pertencente ao cliente A |
| Cliente A consulta `task_internal_notes` | Nenhuma linha |
| Cliente A consulta comentários `internal` | Nenhuma linha |
| Cliente A tenta atualizar uma demanda | A operação é negada |
| Cliente A tenta aprovar demanda não compartilhada | A operação é negada |
| Cliente A tenta se adicionar à tabela `client_members` | A operação é negada |

Estas verificações dependem de executar consultas autenticadas com contas distintas. **Não foram realizadas neste commit**, pois não temos conexão autenticada com seu projeto.

## Próximo passo de desenvolvimento

Após a aplicação e validação do schema, o próximo PR conecta autenticação e Kanban à API Supabase. O protótipo estático continuará como demonstração até o fluxo seguro estar pronto.
