# UXDriven Social Studio

Protótipo interativo do **UXDriven Social Studio**, a futura central de operações e conteúdo da agência UXDriven.

> **Status: protótipo visual e funcional para validação. Não é uma aplicação pronta para clientes reais.**

O foco do MVP é a gestão interna da agência, com uma experiência futura de acompanhamento e aprovação para cada cliente. O produto será estruturado para uma possível evolução para SaaS multiagência, sem assumir esse custo e complexidade no primeiro lançamento.

## Experimente o conceito

- Dashboard de operação e demandas
- Kanban de demandas com criação, edição e movimentação entre etapas
- Calendário editorial
- Biblioteca visual e peças de exemplo
- Prévia do portal de acompanhamento/aprovação
- Fluxos demonstrativos de Studio IA, relatórios, agentes e integrações

**Limitações importantes**

- A interface é construída com HTML, CSS e JavaScript, sem backend.
- Alterações ficam apenas no `localStorage` do navegador atual. Não há sincronização entre usuários ou dispositivos.
- O portal de cliente é uma simulação na mesma página, **sem autenticação ou autorização**. Qualquer pessoa com acesso ao protótipo pode alternar entre a visão da agência e as visões simuladas de clientes.
- Integrações, geração de IA, agendamento nas redes sociais e métricas são demonstrações: nenhuma ação externa real acontece.
- Marcas, demandas, textos e métricas ilustrativos são fictícios.
- **Não inserir dados internos, pessoais ou confidenciais de clientes neste protótipo.**

## Estrutura

```text
dist/
  index.html       Interface principal
  styles.css       Estilos e design system do protótipo
  app.js           Navegação, dados simulados e interações locais
docs/
  PRODUCT_BLUEPRINT.md
vercel.json        Configuração para servir a pasta dist
```

## Desenvolvimento local

Não há instalação de dependências nem processo de compilação nesta versão.

Para servir os arquivos localmente, execute um servidor estático apontando para `dist/`:

```bash
python3 -m http.server 3000 --directory dist
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Importe o repositório `UXDriven/social-studio` na Vercel.
2. Selecione **Framework Preset: Other**.
3. Deixe **Root Directory** na raiz do repositório.
4. Use **Output Directory: dist**. A configuração também está em `vercel.json`.
5. Não é necessário comando de build nem variáveis de ambiente para este protótipo.
6. Publique apenas depois de conferir que a conta e o plano de hospedagem permitem o uso pretendido.

**Atenção:** a Vercel restringe o plano Hobby a uso pessoal e não comercial. Operação interna de uma agência é uso comercial; confirme um plano adequado antes de utilizar o produto para essa finalidade.

## Próximo ciclo — MVP conectado

1. Autenticação de equipe e clientes; controle de acesso por organização, cliente e projeto.
2. Banco de dados persistente para organizações, clientes, projetos, demandas, arquivos, comentários, aprovações e auditoria.
3. Fluxos reais de gestão de demandas e portal individual por cliente.
4. Calendário editorial e biblioteca de criativos conectados ao banco e armazenamento.
5. Integrações e automações conforme prioridades validadas.

Arquitetura e recorte sugeridos em [docs/PRODUCT_BLUEPRINT.md](docs/PRODUCT_BLUEPRINT.md).

O primeiro esquema PostgreSQL com isolamento por organização e cliente está em
[`supabase/migrations/`](supabase/migrations/). Antes de aplicá-lo ao banco,
leia [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). A migração não ativa o
backend na interface estática automaticamente.

## MVP com login e dados reais (branch de implementação)

A primeira versão conectada usa Supabase Auth e PostgreSQL para clientes e demandas.
Ela adiciona um endpoint Vercel que expõe apenas a URL e chave **publishable**
do projeto; nenhum segredo precisa ser colocado no GitHub.

**Antes de publicar**, siga [docs/LOGIN_MVP.md](docs/LOGIN_MVP.md) para configurar
`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no projeto da Vercel e testar o
login em um Preview. O cliente externo continua como prévia, sem aprovação real.

---

UXDriven · Design orientado às pessoas.
