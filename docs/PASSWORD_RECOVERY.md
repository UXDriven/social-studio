# Recuperação de senha — UXDriven Social Studio

## Fluxo implementado
1. No login de `https://studio-uxdriven.vercel.app/`, clicar em **Esqueci minha senha**.
2. Informar o e-mail cadastrado. O navegador chama `supabase.auth.resetPasswordForEmail` usando somente a publishable key.
3. O Supabase envia um link temporário; a interface não informa se o e-mail existe.
4. O link leva para `https://studio-uxdriven.vercel.app/?auth=recovery`. O Supabase valida o token e cria uma sessão de recuperação.
5. A tela solicita senha nova e confirmação; `auth.updateUser({ password })` altera a senha apenas mediante sessão autenticada pela recuperação.
6. Após sucesso, o app encerra a sessão local e leva o usuário ao login normal.

Tokens, segredos e novas senhas não são enviados para a agência nem armazenados no GitHub. O JavaScript remove parâmetros de recuperação da URL quando o token é processado.

## Configurações indispensáveis no Supabase hospedado

**1. URL Configuration**

Abrir **Supabase → Authentication → URL Configuration** (projeto `uxdriven-social-studio`):
- **Site URL:** `https://studio-uxdriven.vercel.app/`
- **Redirect URLs adicionais:** adicionar exatamente `https://studio-uxdriven.vercel.app/?auth=recovery` (além de URLs legítimas já necessárias)

O endereço `studio-uxdriven.vercel.app` é o domínio definitivo de Production, não um Preview.

**2. Serviço de e-mail (SMTP)**

O SMTP embutido do Supabase é para desenvolvimento e **só entrega a endereços autorizados da equipe Supabase**. Para recuperação de senha de clientes reais (Humgroup, IB Cidade, Xande Lakiss), configurar um SMTP próprio em **Authentication → SMTP Settings** (provedor escolhido pela UXDriven). Sem isso, o envio de links a clientes pode retornar `Email address not authorized`, mesmo com usuários existentes e confirmados.

Confirmar também em **Authentication → Email Templates → Reset Password** que o botão usa `{{ .ConfirmationURL }}` (ou um link equivalente que preserve o `redirect_to` escolhido), para respeitar o destino da recuperação.

## Teste de aceite após configuração
- [ ] Solicitar recuperação para uma conta de teste com caixa postal acessível; e-mail recebido.
- [ ] Abrir o link; tela mostra **Escolha uma nova senha** em vez de acessar o workspace.
- [ ] Confirmar senha diferente: erro local, nenhuma alteração no Supabase.
- [ ] Alterar senha; ver a mensagem de sucesso e voltar ao login.
- [ ] Entrar com a nova senha; workspace correto continua associado ao mesmo usuário (a senha não altera `auth.users.id`).
- [ ] Reutilizar ou expirar link: tela de link inválido.
- [ ] Um e-mail inexistente não revela publicamente a existência ou ausência de conta.

## Limitações
- O deploy e os testes automatizados validam o código, não comprovam entrega de e-mails. A plataforma precisa das configurações de URL e SMTP descritas.
- O SDK Supabase limita frequência e expiração dos pedidos; a UI mostra mensagem genérica e alerta de limite quando recebe 429.
- Não executar redefinições em massa nem recolher senhas dos clientes; cada pessoa redefine a própria senha.
