# UXDriven Social Studio — visão de produto e MVP

## Estratégia

**Primeiro cliente do produto:** a equipe da própria UXDriven.

**Proposta:** centralizar demandas, clientes, produção de conteúdo e aprovações em uma operação clara, rápida e visualmente consistente com a identidade UXDriven.

**Portal do cliente:** cada cliente acompanha somente seus próprios projetos, entregas, prazos, materiais e solicitações de aprovação.

**Possível expansão:** SaaS para outras agências somente após a validação do fluxo interno.

## Perfis e permissões planejados

| Perfil | Acesso esperado |
| --- | --- |
| Administrador UXDriven | Gerenciamento da agência, clientes, equipe e configurações |
| Colaborador UXDriven | Demandas e projetos atribuídos, calendário, criativos e comentários |
| Cliente | Apenas projetos, entregas e aprovações explicitamente compartilhados com sua empresa |

No MVP conectado, autorização deve ser verificada no servidor em **todas** as consultas e mutações. Esconder itens da interface não substitui isolamento de dados.

## Jornada essencial

1. A UXDriven cadastra o cliente e abre um projeto.
2. A equipe cria demandas com responsável, prazo, prioridade, etapas e briefing.
3. Os materiais passam por produção e revisão interna.
4. Uma entrega aprovada internamente é disponibilizada ao cliente.
5. O cliente comenta, aprova ou solicita ajustes em seu próprio portal.
6. A UXDriven acompanha histórico, pendências e entregas concluídas no dashboard.

## Entrega por fases

### Fase 0 — conceito navegável (repositório atual)

- Interface premium com dashboard, Kanban, calendário, biblioteca e portal simulado.
- Exemplos fictícios, sem autenticação, backend ou integrações.
- Objetivo: validar navegação, hierarquia, linguagem visual e fluxos principais.

### Fase 1 — MVP operacional

- Login e convites; papéis de administrador, colaborador e cliente.
- Clientes, projetos, demandas, responsáveis, prazos, comentários e histórico.
- Fluxo de revisão e aprovação de entregas.
- Portal seguro para cada cliente.
- Armazenamento persistente e upload de criativos.
- Dashboard de operação e notificações básicas.

### Fase 2 — social media conectado

- Calendário editorial persistente e gestão de campanhas.
- Aprovação de posts, legendas e materiais.
- Primeira integração com redes sociais, respeitando permissões e APIs oficiais.
- Relatórios com métricas reais quando autorizadas.

### Fase 3 — inteligência e plataforma

- Assistentes de IA contextualizados por cliente e identidade visual.
- Automações e geração assistida com revisão humana.
- Recursos multiagência e cobrança somente se houver validação comercial.

## Arquitetura-alvo sugerida

- **Web:** Next.js + TypeScript e design system reutilizável.
- **Dados:** PostgreSQL com migrações e esquema para organização, cliente, projeto, demanda, publicação, arquivo, comentário, aprovação e evento de auditoria.
- **Identidade:** autenticação confiável e controle de acesso em servidor, incluindo convites e recuperação de conta.
- **Arquivos:** armazenamento privado com URLs temporárias e permissões.
- **Integrações:** provedores oficiais com OAuth, tokens armazenados no servidor e rotinas assíncronas.
- **Infraestrutura:** GitHub UXDriven, Vercel em plano compatível com operação comercial, banco gerenciado e observabilidade.

Mesmo com apenas uma agência no início, o modelo de dados pode incluir `organization_id` nas entidades principais. Isto prepara uma futura arquitetura multi-tenant sem expor clientes entre si.

## Critérios de aceite do MVP operacional

- Um colaborador consegue criar e atualizar demandas com estado persistente.
- Cada cliente acessa apenas seus próprios projetos.
- Aprovações e comentários registram autoria e horário.
- Materiais internos não são retornados pela API do portal do cliente.
- O histórico permanece disponível em dispositivos diferentes.
- A agência vê pendências e prazos por cliente e responsável.
- O processo de criação, revisão e aprovação funciona sem planilhas externas.

## Fora do primeiro MVP operacional

- Publicação automática em três redes sociais.
- Agentes autônomos com permissões para publicar.
- Dashboards completos de métricas de redes sociais.
- Pagamentos, planos, white-label e self-service de outras agências.
