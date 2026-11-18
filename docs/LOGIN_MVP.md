# Primeiro login real — UXDriven Social Studio

## Status
Esta implementação mantém o protótipo em HTML/CSS/JS, adiciona Supabase Auth e
grava **clientes e demandas** no PostgreSQL usando as policies RLS existentes.
Sem login válido, o dashboard não é carregado.

Ainda são **demonstrações**: calendário editorial, Studio IA, biblioteca, métricas,
agendamento em redes sociais e prévia do portal do cliente. Não cadastre clientes
reais enquanto não concluirmos autorização, auditoria e testes com contas diferentes.

## 1. Antes de publicar
- Confirmar que a migration `supabase/migrations/20261118170000_core.sql` foi executada
  e que o usuário administrador existe em `organization_members` como `owner`.
- Nenhuma senha, token pessoal, `service_role` ou chave secreta deve ser salva no GitHub.
- Não misturar credenciais de outros projetos Supabase.

## 2. Variáveis públicas da Vercel
Em **Vercel → social-studio → Settings → Environment Variables**:

| Nome | Valor | Obter em |
| --- | --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto (`https://…supabase.co`) | Supabase Project Settings → API / Connect |
| `SUPABASE_PUBLISHABLE_KEY` | Chave **publishable** (`sb_publishable_...`) | Supabase → Project Settings → API Keys |

Se o projeto tiver apenas a chave `anon` legada, o endpoint também a aceita,
mas prefira a nova publishable key.

Adicione **Production** e **Preview** apenas se for testar também no Preview. Depois
faça um novo deployment (a Vercel não retroage variáveis a deploys anteriores).

O código em `api/public-config.js` retorna exclusivamente URL e chave
**publicáveis** ao navegador. Isso é esperado. **Nunca** use `service_role`,
`sb_secret_...`, senha PostgreSQL ou string de conexão em nenhuma variável
que esse endpoint retorne.

## 3. Configuração do Supabase Auth

O domínio de validação associado à branch `feat/auth-live-supabase` é:
`https://login-uxdsocialstudio.vercel.app` (Preview). Antes de usá-lo em recuperação de senha, confirme que abre o deployment correto. Ao promover a aplicação para produção, remova a associação de Preview e configure o domínio para `main` / Production, junto com as variáveis de produção.

Em **Authentication → URL Configuration**:
- Site URL: `https://social-studio-sage.vercel.app`.
- Adicionar `https://login-uxdsocialstudio.vercel.app/**` aos Redirect URLs permitidos para fluxos futuros de e-mail e recuperação de senha; mantenha Site URL de produção conforme a estratégia de publicação.
- Não utilizar dados reais de clientes no ambiente Preview.
- Para login com e-mail/senha pré-criado no dashboard não há OAuth a configurar.

## 4. Primeiro teste controlado
1. Não faça merge do PR antes de verificar o status do CI.
2. Configure as variáveis no ambiente **Preview** da Vercel.
3. Abra o preview deployment do PR e verifique que surge a tela de login.
4. Entre com seu usuário **já cadastrado** no Supabase.
5. Se surgir 'Conta sem workspace', confira sua associação de `owner`
   em `organization_members` (não altere as políticas para contornar erro).
6. Em **Meus clientes**, crie um registro **fictício**, por exemplo `Cliente Teste UX`.
7. Em **Demandas**, crie uma demanda e mude sua etapa.
8. Recarregue a página e confira que cliente e demanda continuam lá.
9. Confirme os mesmos registros no Table Editor do Supabase.

## 5. Depois de validar
- Fazer merge do PR para `main`.
- Cadastrar dados reais **apenas** depois dos testes de RLS com usuários distintos,
  políticas de privacidade e hospedagem comercial compatível.
- Próximo sprint: convites de clientes e aprovação assinada por usuário
  de cliente, upload privado de arquivos, histórico de alterações.

## Importante: status da Vercel Hobby
O plano Hobby é para projetos pessoais / não comerciais. Este MVP está no plano
de **validação técnica**, sem operação comercial nem clientes reais.
