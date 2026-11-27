'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const api = read('api/assistant.js');
const agency = read('dist/app.js');
const client = read('dist/client-portal.js');
const shell = read('dist/index.html');

test('AI endpoint blocks paid and free model calls even with a valid-looking session token', async () => {
  const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(api).toString('base64'));
  let requestedNetwork = false;
  const previousFetch = global.fetch;
  global.fetch = async () => { requestedNetwork = true; throw new Error('Network must never be reached'); };
  const previousEnabled = process.env.AI_ASSISTANTS_ENABLED;
  const previousClients = process.env.AI_CLIENT_ASSISTANT_ENABLED;
  process.env.AI_ASSISTANTS_ENABLED = 'true';
  process.env.AI_CLIENT_ASSISTANT_ENABLED = 'true';
  try {
    let code = 0, payload;
    const res = { setHeader() { return this; }, status(n) { code = n; return this; }, json(x) { payload = x; return x; } };
    await handler({
      method: 'POST',
      headers: { origin: 'https://studio-uxdriven.vercel.app', authorization: 'Bearer abc.def.ghi' },
      body: { message: 'Crie uma campanha para dezembro' }
    }, res);
    assert.equal(code, 503);
    assert.equal(payload.error, 'ai_in_development');
    assert.match(payload.reply, /em desenvolvimento/i);
    assert.equal(requestedNetwork, false);
  } finally {
    global.fetch = previousFetch;
    if (previousEnabled == null) delete process.env.AI_ASSISTANTS_ENABLED; else process.env.AI_ASSISTANTS_ENABLED = previousEnabled;
    if (previousClients == null) delete process.env.AI_CLIENT_ASSISTANT_ENABLED; else process.env.AI_CLIENT_ASSISTANT_ENABLED = previousClients;
  }
});

test('Studio IA and AI Agents display in-development screens instead of chat forms', () => {
  const studio = agency.slice(agency.indexOf('  function renderStudio(){'), agency.indexOf('  function renderStudioResult(){'));
  const agents = agency.slice(agency.indexOf('  function renderAgents(){'), agency.indexOf('  function renderClients(){'));
  assert.match(studio, /EM DESENVOLVIMENTO/);
  assert.match(agents, /EM DESENVOLVIMENTO/);
  assert.doesNotMatch(studio, /id="copilot-form"/);
  assert.doesNotMatch(studio, /id="ai-form"/);
  assert.doesNotMatch(agents, /data-agent=/);
  assert.match(shell, /Studio IA<span class="nav-pill nav-pill-future">EM BREVE<\/span>/);
  assert.match(shell, /Agentes de IA<span class="nav-pill nav-pill-future">EM BREVE<\/span>/);
});

test('client portal explicitly shows AI as in development with no message composer', () => {
  const section = client.slice(client.indexOf('    function assistantPanel(){'), client.indexOf('    function render() {'));
  assert.match(section, /EM DESENVOLVIMENTO/);
  assert.match(section, /ainda não está disponível/);
  assert.doesNotMatch(section, /<form/);
  assert.doesNotMatch(section, /<textarea/);
  assert.match(client, /\$\{assistantPanel\(\)\}/);
});

test('normal workload features remain accessible through active navigation links', () => {
  for (const view of ['tasks','calendar','approvals','reports']) {
    assert.match(shell, new RegExp('data-view="'+view+'"'));
  }
  assert.match(agency, /function renderLiveReports\(\)/);
});
