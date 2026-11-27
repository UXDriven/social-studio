/* UXDriven Social Studio — e-mail password recovery, no privileged keys. */
(function () {
  'use strict';

  function init(options) {
    const db = options.db;
    const screen = options.screen;
    const esc = options.esc;
    const showLogin = options.showLogin;
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const markedForRecovery = query.get('auth') === 'recovery' || fragment.get('type') === 'recovery';
    const authLinkError = query.get('error') || fragment.get('error') || query.get('error_code') || fragment.get('error_code');
    let recoveryEvent = false;

    db.auth.onAuthStateChange(function (event) {
      if (event === 'PASSWORD_RECOVERY') recoveryEvent = true;
    });

    const backLink = '<div class="auth-support-actions"><button type="button" class="auth-text-action" id="back-to-login">← Voltar ao login</button></div>';

    function attachBackLink() {
      const back = document.getElementById('back-to-login');
      if (back) back.onclick = function () { showLogin(); };
    }

    function cleanRecoveryUrl() {
      // Remove one-time tokens, error details, and the recovery marker from browser history.
      window.history.replaceState(null, document.title, window.location.pathname);
    }

    function displayError(message) {
      const alert = document.getElementById('recovery-error');
      if (alert) {
        alert.textContent = message;
        alert.hidden = false;
        alert.setAttribute('role', 'alert');
      }
    }

    function showEmailRequested() {
      screen('RECUPERAÇÃO DE ACESSO', 'Confira seu <em>e-mail.</em>',
        'Se existir uma conta para esse endereço, você receberá as instruções para criar uma nova senha.',
        '<div class="auth-success" role="status">Verifique também a pasta de spam. O link de recuperação é temporário e só deve ser utilizado por você.</div>' +
        '<button type="button" class="auth-submit" id="go-to-login">Voltar para o login →</button>');
      document.getElementById('go-to-login').onclick = function () { showLogin(); };
    }

    function showRequest(initialEmail) {
      screen('SEGURANÇA / ACESSO', 'Recupere sua <em>senha.</em>',
        'Informe o e-mail associado ao seu workspace. Enviaremos um link seguro de redefinição.',
        '<form class="auth-form" id="recovery-request-form">' +
          '<label for="recovery-email">E-mail cadastrado</label>' +
          '<input id="recovery-email" name="email" type="email" autocomplete="email" required placeholder="seu@email.com" value="' + esc(initialEmail || '') + '">' +
          '<p id="recovery-error" class="auth-alert" role="alert" hidden></p>' +
          '<button class="auth-submit" type="submit">Enviar link de recuperação →</button>' +
        '</form>' +
        '<p class="auth-helper">Por segurança, não informamos se o endereço possui uma conta.</p>' + backLink);
      attachBackLink();

      document.getElementById('recovery-request-form').onsubmit = async function (event) {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        const email = document.getElementById('recovery-email').value.trim();
        if (!email || button.disabled) return;
        button.disabled = true;
        button.textContent = 'Solicitando...';
        try {
          const redirectTo = 'https://studio-uxdriven.vercel.app/?auth=recovery';
          const result = await db.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
          if (result.error) {
            displayError(result.error.status === 429 ?
              'Muitas solicitações recentes. Aguarde alguns minutos antes de tentar novamente.' :
              'Não foi possível processar o pedido agora. Tente novamente em instantes.');
            return;
          }
          showEmailRequested();
        } catch (error) {
          displayError('Não foi possível conectar ao serviço de autenticação. Tente novamente.');
        } finally {
          button.disabled = false;
          button.textContent = 'Enviar link de recuperação →';
        }
      };
    }

    function showExpired() {
      cleanRecoveryUrl();
      screen('LINK EXPIRADO', 'Este link não está <em>disponível.</em>',
        'O link de recuperação pode ter expirado, já ter sido usado ou estar inválido. Solicite um novo para continuar.',
        '<button id="request-new-link" class="auth-submit" type="button">Solicitar outro link →</button>' + backLink);
      document.getElementById('request-new-link').onclick = function () { showRequest(''); };
      attachBackLink();
    }

    function showFinished() {
      screen('SENHA ATUALIZADA', 'Novo começo. <em>Mesmo workspace.</em>',
        'Sua senha foi atualizada com sucesso. Entre novamente para acessar seu espaço.',
        '<div class="auth-success" role="status">A nova senha já pode ser usada no Social Studio.</div>' +
        '<button id="finish-recovery" class="auth-submit" type="button">Entrar com a nova senha →</button>');
      document.getElementById('finish-recovery').onclick = function () { showLogin(); };
    }

    function showNewPassword() {
      screen('REDEFINIÇÃO DE SENHA', 'Escolha uma nova <em>senha.</em>',
        'Crie uma senha forte para sua conta. Ela substituirá a senha anterior.',
        '<form class="auth-form" id="recovery-password-form">' +
          '<label for="recovery-password">Nova senha</label>' +
          '<input id="recovery-password" name="password" type="password" autocomplete="new-password" minlength="10" required placeholder="Pelo menos 10 caracteres">' +
          '<label for="recovery-confirm">Confirmar nova senha</label>' +
          '<input id="recovery-confirm" name="confirm" type="password" autocomplete="new-password" minlength="10" required placeholder="Repita a senha">' +
          '<p id="recovery-error" class="auth-alert" role="alert" hidden></p>' +
          '<button class="auth-submit" type="submit">Salvar nova senha →</button>' +
        '</form>' +
        '<p class="auth-helper">Escolha uma senha exclusiva, com letras, números e caracteres especiais.</p>');

      document.getElementById('recovery-password-form').onsubmit = async function (event) {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        const password = document.getElementById('recovery-password').value;
        const confirm = document.getElementById('recovery-confirm').value;
        if (button.disabled) return;
        if (password.length < 10) return displayError('A senha precisa ter pelo menos 10 caracteres.');
        if (password !== confirm) return displayError('As senhas não coincidem. Verifique e tente novamente.');
        button.disabled = true;
        button.textContent = 'Atualizando...';
        try {
          const result = await db.auth.updateUser({ password: password });
          if (result.error) {
            displayError('Não foi possível atualizar a senha. Se o link expirou, solicite outro.');
            return;
          }
          const signout = await db.auth.signOut({ scope: 'local' });
          if (signout.error) {
            displayError('A senha foi atualizada, mas não foi possível encerrar esta sessão. Saia da conta antes de continuar.');
            return;
          }
          showFinished();
        } catch (error) {
          displayError('Erro de conexão. Confirme se a alteração foi realizada antes de tentar novamente.');
        } finally {
          button.disabled = false;
          button.textContent = 'Salvar nova senha →';
        }
      };
    }

    return {
      showRequest: showRequest,
      isRecoveryReturn: function () { return markedForRecovery || recoveryEvent; },
      handleReturn: function (verifiedUser) {
        if (authLinkError || !verifiedUser) showExpired();
        else {
          cleanRecoveryUrl();
          showNewPassword();
        }
      }
    };
  }

  window.UXDrivenPasswordRecovery = { init: init };
})();
