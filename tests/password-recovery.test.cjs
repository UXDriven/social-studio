'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'auth-recovery.js'), 'utf8');

function harness(url = 'https://studio-uxdriven.vercel.app/') {
  const link = new URL(url);
  const elements = new Map();
  const screens = [];
  const calls = { sent: [], passwords: [], signOuts: 0, cleaned: [], login: 0 };
  let authEvent;
  const submit = { disabled: false, textContent: '' };
  const document = {
    title: 'UXDriven Social Studio',
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          value: '', hidden: true, textContent: '',
          setAttribute() {},
          querySelector() { return submit; },
          onclick: undefined, onsubmit: undefined
        });
      }
      return elements.get(id);
    }
  };
  const window = {
    location: { search: link.search, hash: link.hash, pathname: link.pathname },
    history: { replaceState(...args) { calls.cleaned.push(args[2]); } }
  };
  const auth = {
    onAuthStateChange(fn) { authEvent = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    async resetPasswordForEmail(email, options) {
      calls.sent.push({ email, options });
      return { error: null };
    },
    async updateUser(input) {
      calls.passwords.push(input);
      return { error: null };
    },
    async signOut() { calls.signOuts++; return { error: null }; }
  };
  vm.runInNewContext(source, { window, document, URLSearchParams });
  const controller = window.UXDrivenPasswordRecovery.init({
    db: { auth },
    screen(...args) { screens.push(args); },
    esc(str) { return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); },
    showLogin() { calls.login++; }
  });
  return { controller, auth, calls, document, screens, elements, submit, event: (...args) => authEvent(...args) };
}
const submitEvent = form => ({ preventDefault() {}, currentTarget: form });

test('request sends reset email to fixed production return address and shows generic response', async () => {
  const h = harness();
  h.controller.showRequest('example@domain.com');
  h.document.getElementById('recovery-email').value = 'example@domain.com';
  const form = h.document.getElementById('recovery-request-form');
  await form.onsubmit(submitEvent(form));
  assert.equal(h.calls.sent.length, 1);
  assert.equal(h.calls.sent[0].email, 'example@domain.com');
  assert.equal(h.calls.sent[0].options.redirectTo, 'https://studio-uxdriven.vercel.app/?auth=recovery');
  assert.match(h.screens.at(-1)[1], /Confira seu/);
  assert.match(h.screens.at(-1)[2], /Se existir uma conta/);
  assert.equal(h.submit.disabled, false);
});

test('recovery links with verified user display reset form instead of workspace', () => {
  const h = harness('https://studio-uxdriven.vercel.app/?auth=recovery#access_token=example&type=recovery');
  assert.equal(h.controller.isRecoveryReturn(), true);
  h.controller.handleReturn(true);
  assert.match(h.screens.at(-1)[1], /Escolha uma nova/);
  assert.deepEqual(h.calls.cleaned, ['/']);
  assert.equal(h.calls.login, 0);
});

test('new password requires matching values and signs out on success', async () => {
  const h = harness('https://studio-uxdriven.vercel.app/?auth=recovery');
  h.controller.handleReturn(true);
  const form = h.document.getElementById('recovery-password-form');
  h.document.getElementById('recovery-password').value = 'VeryStrong!2026';
  h.document.getElementById('recovery-confirm').value = 'differentpass';
  await form.onsubmit(submitEvent(form));
  assert.equal(h.calls.passwords.length, 0);
  assert.match(h.document.getElementById('recovery-error').textContent, /não coincidem/);
  h.document.getElementById('recovery-confirm').value = 'VeryStrong!2026';
  await form.onsubmit(submitEvent(form));
  assert.equal(h.calls.passwords.length, 1);
  assert.equal(h.calls.passwords[0].password, 'VeryStrong!2026');
  assert.equal(h.calls.signOuts, 1);
  assert.match(h.screens.at(-1)[1], /Novo começo/);
});

test('expired or invalid recovery link never offers password update', () => {
  const h = harness('https://studio-uxdriven.vercel.app/?auth=recovery#error=access_denied&error_code=otp_expired');
  h.controller.handleReturn(true);
  assert.match(h.screens.at(-1)[1], /não está/);
  assert.equal(h.calls.passwords.length, 0);
  assert.deepEqual(h.calls.cleaned, ['/']);
});

test('recovery return without verified user is rejected', () => {
  const h = harness('https://studio-uxdriven.vercel.app/?auth=recovery');
  h.controller.handleReturn(false);
  assert.match(h.screens.at(-1)[1], /não está/);
  assert.equal(h.calls.passwords.length, 0);
});

test('PASSWORD_RECOVERY auth event is recognized even without query marker', () => {
  const h = harness();
  assert.equal(h.controller.isRecoveryReturn(), false);
  h.event('PASSWORD_RECOVERY', { user: { id: 'test' } });
  assert.equal(h.controller.isRecoveryReturn(), true);
});

test('unauthenticated request failure does not disclose if account exists', async () => {
  const h = harness();
  h.auth.resetPasswordForEmail = async () => ({ error: { status: 429, message: 'User not found' } });
  h.controller.showRequest('missing@example.com');
  h.document.getElementById('recovery-email').value = 'missing@example.com';
  const form = h.document.getElementById('recovery-request-form');
  await form.onsubmit(submitEvent(form));
  assert.match(h.document.getElementById('recovery-error').textContent, /Muitas solicitações/);
  assert.doesNotMatch(h.document.getElementById('recovery-error').textContent, /User not found/);
});
