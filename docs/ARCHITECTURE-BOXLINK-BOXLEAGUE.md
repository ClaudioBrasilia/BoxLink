# Arquitetura de produto — BoxLink e BoxLeague

**Data da auditoria:** 26 de agosto de 2026

**Repositório:** `ClaudioBrasilia/BoxLink`

**Escopo:** separar claramente o produto para atletas vinculados a um box do produto para atletas individuais, sem duplicar o backend de propósito.

## Resumo executivo

O repositório produz dois aplicativos a partir do mesmo código. O **BoxLink** é o produto para academias e boxes, com turmas, WOD administrado, ranking do box, Feed, TV, coach e administração. O **BoxLeague** é o produto individual, para quem treina sem vínculo necessário a uma academia, com Diário, registro do próprio WOD, Liga, Duelos, Perfil, Insights, Frequência, evolução, benchmarks e loja.

A separação web/PWA está implementada no nível correto: `VITE_APP_MODE=individual` altera rotas, guards, navegação, textos, manifest e o conjunto de chunks emitidos. A separação nativa usa `com.crosscity.boxleague` e `BoxLeague` no Individual, enquanto o BoxLink preserva `com.crosscity.hub` e `BoxLink`. A captura BLE em segundo plano foi implementada nos dois sistemas: Android usa `connectedDevice` Foreground Service e iOS usa Core Bluetooth com state restoration e persistência local. O backend Supabase permanece compartilhado por intenção, porque essa é a ponte que permite a um atleta individual entrar em um box levando sua conta, XP, PRs e diário.

O resultado é **apto para seguir para uma esteira de release separada**, mas não equivale, sozinho, à publicação nas lojas. Ainda é necessário configurar registros de aplicativo, assinatura, ícones, links/deep links, domínios e políticas de cada canal, além de validar a segurança do Supabase em produção.

## Limite entre os produtos

| Camada | BoxLink | BoxLeague | Estado da separação |
|---|---|---|---|
| Seleção de build | `VITE_APP_MODE=box` ou padrão | `VITE_APP_MODE=individual` | Implementada em `src/lib/appMode.ts` |
| Entrada principal | Dashboard e fluxos do box | Diário e fluxos do atleta | Implementada em `src/components/Layout.tsx` e `src/App.tsx` |
| Cadastro | Pode escolher conta vinculada a box | Força `accountType = 'individual'` | Implementada em `src/pages/Signup.tsx` |
| Conteúdo de onboarding | Check-in no box, Feed e ranking da academia | Treino registrado como check-in, Liga e duelo por código | Implementada em `src/components/Onboarding.tsx` |
| Rotas exclusivas | Admin, Coach, WOD do box, TV, Feed, desafios, clãs, ranking e MyBox | Não registradas no build | Implementada com imports estáticos condicionais em `src/App.tsx` |
| Backend | Supabase compartilhado | Supabase compartilhado | Intencional; exige RLS correto |
| PWA | Manifest e título BoxLink | Manifest e título BoxLeague | Implementada em `vite.config.ts` |
| App Android | `com.crosscity.hub`, nome BoxLink | `com.crosscity.boxleague`, nome BoxLeague | Implementada via `cap:sync:box` e `cap:sync:solo` |
| App iOS | Bundle ID `com.crosscity.hub`, nome BoxLink | Bundle ID `com.crosscity.boxleague`, nome BoxLeague | Implementada via os mesmos comandos |
| Captura BLE em segundo plano | Core Bluetooth/serviço nativo compartilhado | Core Bluetooth/serviço nativo compartilhado | Implementada; Android com Foreground Service e iOS com state restoration |
| Domínio de produção | Não há domínio definitivo versionado | Não há domínio próprio versionado | Pendente de decisão de distribuição |
| Ícones e assets de loja | Usa os assets nativos existentes | Ainda compartilha os assets existentes | Pendente de arte e configuração de loja próprias |

## Por que o backend é compartilhado

A separação de produto não exige dois bancos. O modelo atual usa `profiles.account_type` para distinguir `box` e `individual`, preserva `box_id` quando aplicável e permite que o fluxo “Entrar no Box” transforme uma conta individual sem migrar o histórico para outro projeto. Diário, XP, PRs, recompensas, duelos e dados biométricos continuam sujeitos às políticas de acesso do Supabase.

Essa decisão é adequada somente se as políticas RLS e as consultas públicas forem revisadas por coluna. A política de produto não deve ser confundida com isolamento de segurança: esconder um campo na interface ou selecionar menos colunas no cliente não impede que outra seleção aprovada pelo banco tente lê-lo.

## Cobertura das alterações recentes no Individual

O build Individual contém os módulos necessários para HRV, validação por fonte, prontidão, tendências, Insights, performance e observabilidade. A presença foi verificada no artefato compilado, não apenas no código-fonte.

| Entrega | Evidência no código | Presença no Individual |
|---|---|---|
| HRV e prontidão | `src/lib/hrv.ts`, `src/lib/readiness.ts`, `src/components/HeartRateWidget.tsx`, `src/components/HeartRateSummary.tsx` | Sim; chunks `hrv`, `readiness`, `HeartRateWidget` e `HeartRateSummary` |
| Validação por fonte | `src/lib/hrvValidation.ts` e respectivos testes | Sim; módulo utilizado pela superfície de HRV |
| Tendências e Insights | `src/lib/readinessTrend.ts`, `src/pages/Insights.tsx`, `src/pages/Frequencia.tsx` | Sim; chunks `Insights`, `Frequencia` e dependências de gráficos |
| Performance e code splitting | `vite.config.ts` e imports lazy em `src/App.tsx` | Sim; Individual emite 40 arquivos JavaScript e remove chunks exclusivos do Box |
| Smoke E2E | `scripts/e2e-smoke.mjs` | Sim; `/login` e `/insights` aprovados em Chromium headless no artefato Individual |
| Observabilidade | `src/lib/observability.ts` | Sim; módulo comum aos dois modos, opcional por endpoint de performance |
| Migrações de HRV | `supabase/verify_hrv_migrations.sql` | O responsável informou `base_hrv=READY` e `validation_hrv=READY`; este documento não presume consulta remota própria |

## Evidência dos bundles

A comparação executada depois da correção dos imports dinâmicos mostra a diferença entre publicar duas cascas e publicar dois conjuntos de rotas.

| Métrica | BoxLink | BoxLeague | Interpretação |
|---|---:|---:|---|
| Arquivos JavaScript emitidos | 68 | 40 | O Individual não carrega as famílias de páginas do Box |
| Entradas precache PWA | 82 | 54 | O service worker individual é menor |
| Famílias exclusivas verificadas no Individual | — | 0 | Admin, Coach, Challenges, Clans, Feed, Leaderboard, MyBox, TV e Wod não aparecem |
| Famílias necessárias verificadas no Individual | — | 12 | Diário, Duelos, Frequência, Insights, Perfil, HRV, prontidão e vendors principais aparecem |

O teste reproduzível `npm run test:separation` recompila os dois modos, confere `index.html`, `manifest.webmanifest`, chunks obrigatórios e chunks proibidos. A validação terminou com BoxLink e BoxLeague aprovados.

## Identidade nativa e procedimento de release

O arquivo `capacitor.config.ts` agora deriva `appId` e `appName` do mesmo `VITE_APP_MODE` usado pelo web bundle. Os comandos oficiais são:

```bash
npm run cap:sync:box
npm run cap:sync:solo
```

Cada comando compila o modo correspondente e sincroniza Android e iOS. O wrapper `scripts/sync-native.mjs` também atualiza o `applicationId`, `namespace`, pacote da `MainActivity`, strings e esquema de URL do Android, além do `PRODUCT_BUNDLE_IDENTIFIER`, `CFBundleDisplayName` e mensagens de permissão do iOS.

A árvore nativa é única e é sincronizada para um modo por vez. Portanto, a regra operacional é: executar o comando do modo, arquivar o APK/AAB ou IPA correspondente e somente depois sincronizar o outro modo. O teste local confirmou `com.crosscity.boxleague`/`BoxLeague` no modo individual e restaurou `com.crosscity.hub`/`BoxLink` ao final.

A separação técnica de identificadores não cria automaticamente os registros no Google Play Console ou App Store Connect. Ainda precisam ser cadastrados o aplicativo Individual, a assinatura Android, certificados e provisioning iOS, ícones/adaptive icons, screenshots, descrição, URLs de suporte e eventuais associações de domínio. O identificador `com.crosscity.boxleague` é uma convenção técnica desta branch e deve ser confirmado contra a disponibilidade e a propriedade dos registros de loja antes do primeiro envio.

## Políticas, URLs e origem pública

`public/privacy.html` e `public/delete-account.html` foram reescritas como páginas duais. Elas distinguem BoxLink e BoxLeague, não afirmam que o BoxLeague mostra dados em uma TV de box e explicam que recursos de acompanhamento por academia pertencem ao contexto do BoxLink. O Android continua apontando para `/privacy.html`, que agora é compatível com os dois produtos.

A origem pública ainda não está separada no repositório. O código usa `window.location.origin` para compartilhamentos e o endereço histórico `https://box-link.vercel.app/privacy.html` continua gravado no recurso Android. Para uma percepção plenamente independente, o deploy deve definir um domínio ou subdomínio próprio para o BoxLeague, com variáveis do Supabase, service worker, manifest, política, links de recuperação e configurações de loja alinhados a essa origem.

## Estado atual e decisão recomendada

| Estado | Itens |
|---|---|
| **Já separado e validado** | Rotas, guards, menu, onboarding, cadastro individual, cópia de login/instalação, manifest PWA, code splitting, chunks do Individual, HRV, validação, Insights, tendências, prontidão, performance, smoke E2E, observabilidade, identificadores nativos por modo e captura BLE nativa Android/iOS |
| **Compartilhado por intenção** | Código de domínio, Supabase, autenticação, economia de XP/recompensas, parte dos componentes de FC/HRV e estrutura Capacitor |
| **Ainda pendente para publicação independente** | Domínio/deploy próprio, arte e ícones de loja do BoxLeague, contas de loja e assinatura, links/deep links, revisão de RLS/privacidade no Supabase de produção e testes manuais em Android/iOS reais |
| **Bloqueador de processo** | `npm run lint` não é um gate disponível porque o repositório não possui configuração ESLint; typecheck e testes unitários continuam aprovados |

A recomendação é tratar o BoxLeague como produto de release separado a partir desta branch, mas não declarar “publicado” antes de fechar domínio, loja, arte, segurança de dados e validação em dispositivo real. A arquitetura não precisa ser duplicada em dois repositórios para atingir essa separação.

## Referências internas

1. [`src/lib/appMode.ts`](../src/lib/appMode.ts) — modo, nome lógico e decisão de backend compartilhado.
2. [`src/App.tsx`](../src/App.tsx) — rotas, guards e imports condicionais por modo.
3. [`vite.config.ts`](../vite.config.ts) — título, manifest, PWA e code splitting.
4. [`capacitor.config.ts`](../capacitor.config.ts) — identidade nativa derivada do modo.
5. [`scripts/sync-native.mjs`](../scripts/sync-native.mjs) — sincronização de web bundle e recursos nativos.
6. [`scripts/audit-app-separation.mjs`](../scripts/audit-app-separation.mjs) — teste automatizado de separação.
7. [`scripts/e2e-smoke.mjs`](../scripts/e2e-smoke.mjs) — smoke E2E de preview e Chromium.
8. [`public/privacy.html`](../public/privacy.html) e [`public/delete-account.html`](../public/delete-account.html) — páginas públicas duais.
9. [`supabase/verify_hrv_migrations.sql`](../supabase/verify_hrv_migrations.sql) — consulta de verificação das migrações de HRV.
10. [`docs/ANDROID-BLE-FOREGROUND-SERVICE.md`](ANDROID-BLE-FOREGROUND-SERVICE.md) e [`docs/IOS-BLE-BACKGROUND.md`](IOS-BLE-BACKGROUND.md) — captura BLE nativa, persistência, state restoration e limites por plataforma.
