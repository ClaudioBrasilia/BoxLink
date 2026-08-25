# Auditoria de publicação — BoxLink e BoxLeague

**Data da atualização:** 25 de agosto de 2026

**Escopo:** verificar se o BoxLeague é um aplicativo individual realmente separado do BoxLink e confirmar a presença das entregas recentes de HRV, Insights, performance e observabilidade.

## Veredito executivo

> **Veredito:** a separação web/PWA e a estratégia de identidade nativa estão implementadas e foram validadas localmente. O BoxLeague já pode seguir uma esteira de release própria; ainda não deve ser declarado pronto para publicação em loja sem domínio, arte, registros de loja, validação em dispositivo real e revisão de segurança do Supabase.

O projeto continua em um repositório e usa o mesmo Supabase de propósito. Isso permite que uma conta individual entre posteriormente em um box sem migrar histórico, XP, recordes pessoais e diário. Compartilhar backend não significa compartilhar a experiência: rotas, navegação, bundle, manifest, nome e identificadores nativos são separados por modo.

## Estado por camada

| Área | BoxLink | BoxLeague | Estado |
|---|---|---|---|
| Modo de build | Padrão ou `VITE_APP_MODE=box` | `VITE_APP_MODE=individual` | Implementado |
| Rota inicial | Dashboard do box | Diário | Implementado |
| Cadastro | Fluxo de box disponível | `accountType='individual'` forçado | Implementado |
| Onboarding | Check-in, Feed e ranking do box | Treino como check-in, Liga e duelo por código | Implementado |
| Rotas exclusivas | Admin, Coach, WOD, TV, Feed, desafios, clãs, ranking e MyBox | Não registradas | Implementado com imports condicionais em `src/App.tsx` |
| PWA | Nome e manifest BoxLink | Nome e manifest BoxLeague | Implementado em `vite.config.ts` |
| Android | `com.crosscity.hub` / BoxLink | `com.crosscity.boxleague` / BoxLeague | Implementado por `cap:sync:box` e `cap:sync:solo` |
| iOS | `com.crosscity.hub` / BoxLink | `com.crosscity.boxleague` / BoxLeague | Implementado pelos mesmos comandos |
| Backend | Supabase compartilhado | Supabase compartilhado | Intencional; RLS precisa continuar seguro |
| Domínio | Origem histórica do projeto | Ainda sem origem própria versionada | Pendente |
| Ícones de loja | Assets atuais | Ainda compartilha os assets existentes | Pendente |

## Confirmação das entregas recentes no Individual

A presença foi verificada no artefato compilado do modo Individual. Os chunks `Diario`, `Frequencia`, `Insights`, `HeartRateWidget`, `HeartRateSummary`, `hrv`, `readiness`, `vendor-charts` e `vendor-react` foram emitidos. As entregas são, portanto, compartilhadas no código quando apropriado e efetivamente publicadas no bundle Individual.

| Entrega | Resultado |
|---|---|
| HRV, prontidão e gráficos de tendência | Presente no Individual; associado à entrega mesclada do PR #145 |
| Qualidade e validação por fonte de HRV | Presente no Individual; associado à entrega mesclada do PR #146 |
| Code splitting e performance | Presente no Individual; rotas exclusivas do Box não são emitidas |
| Smoke E2E | `/login` e `/insights` renderizados no preview Individual e aprovados em Chromium headless |
| Observabilidade | Presente nos dois modos; só transmite quando `VITE_PERFORMANCE_ENDPOINT` está configurado |
| Migrações | O responsável informou `base_hrv=READY` e `validation_hrv=READY` no Supabase; esta auditoria não presume acesso remoto próprio |

## Evidência de bundles

A correção mais importante foi trocar imports dinâmicos declarados incondicionalmente por imports condicionais estáticos nas páginas exclusivas do Box. Com isso, o bundler consegue eliminar essas páginas do modo Individual.

| Métrica | BoxLink | BoxLeague |
|---|---:|---:|
| Arquivos JavaScript | 68 | 40 |
| Entradas precache PWA | 82 | 54 |
| Chunks exclusivos do Box emitidos no Individual | — | 0 |
| Famílias de chunks necessárias verificadas no Individual | — | 12 |

As famílias ausentes no Individual são Admin, Coach, Challenges, Clans, Feed, Leaderboard, MyBox, TV e Wod. O teste reproduzível `npm run test:separation` recompila os dois modos e verifica manifest, título, copy de login, chunks obrigatórios e chunks proibidos; a execução foi aprovada.

## Identidade nativa

`capacitor.config.ts` agora deriva o `appId` e o `appName` de `VITE_APP_MODE`. O wrapper `scripts/sync-native.mjs` compila o web bundle e sincroniza os projetos Android/iOS, atualizando também `applicationId`, `namespace`, caminho/pacote da `MainActivity`, strings Android, esquema de URL, bundle identifier iOS, nome exibido e mensagens de permissão.

Os comandos oficiais são:

```bash
npm run cap:sync:box
npm run cap:sync:solo
```

A árvore nativa é única e deve ser sincronizada para um modo por vez. O procedimento seguro é arquivar o APK/AAB ou IPA do modo atual antes de sincronizar o outro. A prova local executou o modo Individual com `com.crosscity.boxleague` e depois restaurou o estado BoxLink com `com.crosscity.hub`.

Isso ainda não cria registros no Google Play Console ou App Store Connect. Antes da publicação, é necessário confirmar a disponibilidade do identificador, criar os registros de loja, configurar assinatura/provisioning, fornecer ícones e screenshots próprias, revisar deep links e definir uma origem pública estável para o BoxLeague.

## Políticas e distribuição pública

`public/privacy.html` e `public/delete-account.html` agora são documentos duais: distinguem BoxLink e BoxLeague, deixam claro que o Individual não exige box e não afirmam que ele exibe dados em TV de academia. O Android continua apontando para `/privacy.html`, que passou a ser compatível com os dois produtos.

O deploy ainda não está separado no repositório. O código usa `window.location.origin` para links de compartilhamento e a URL histórica `https://box-link.vercel.app/privacy.html` continua como endereço da política no recurso Android. Para o BoxLeague ser percebido e operado como produto independente, o deploy deve usar domínio ou subdomínio próprio, service worker/origem próprios e variáveis de ambiente alinhadas ao canal Individual.

## Validações executadas

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Aprovado |
| `npm test` | 175 testes aprovados em 16 arquivos |
| `npm run build` | Aprovado; BoxLink com 68 arquivos JS e 82 entradas precache |
| `npm run build:solo` | Aprovado; BoxLeague com 40 arquivos JS e 54 entradas precache |
| `npm run test:separation` | Aprovado para os dois modos |
| Smoke E2E Individual | Aprovado em `/login` e `/insights` com Chromium headless |
| `npm run cap:sync:solo` | Aprovado; identificadores nativos BoxLeague conferidos |
| `npm run cap:sync:box` | Aprovado; identificadores nativos BoxLink restaurados |
| Sintaxe dos scripts `.mjs` | Aprovada com `node --check` |
| `npm run lint` | Não executável: o repositório não possui configuração ESLint |

## Pendências antes da publicação

A separação técnica de produto está concluída para web/PWA e preparada para o empacotamento nativo por modo. Os bloqueadores restantes são operacionais e de publicação: definir o domínio Individual, criar e conferir os aplicativos nas lojas, produzir ícones/arte próprios, validar permissões e links em Android/iOS reais, e confirmar as políticas RLS no Supabase de produção com dois usuários distintos.

A revisão de RLS é especialmente importante porque isolamento de interface não substitui segurança de banco. Perfis, dados biométricos, plano, e-mail e métricas de saúde devem permanecer protegidos por coluna e por usuário, enquanto Liga, duelos e outros recursos públicos devem expor somente o mínimo necessário.

Para a visão consolidada de arquitetura, cobertura funcional e procedimento de release, consulte [`ARCHITECTURE-BOXLINK-BOXLEAGUE.md`](ARCHITECTURE-BOXLINK-BOXLEAGUE.md).
