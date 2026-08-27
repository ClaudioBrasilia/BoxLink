# Fase 5 — Performance, E2E e observabilidade

## O que foi implementado

O carregamento das páginas agora usa `React.lazy` e `Suspense` em `src/App.tsx`. O shell de autenticação e layout continua pequeno e as páginas são baixadas sob demanda quando o usuário acessa a rota. O `vite.config.ts` separa React, animações, gráficos, ícones e Supabase em chunks próprios. Na versão validada, o maior chunk JavaScript ficou abaixo de 400 KiB, enquanto páginas como Admin, Insights e Diario são carregadas em arquivos separados.

O arquivo `src/lib/observability.ts` registra, de forma opcional, erros globais, erros do ErrorBoundary, navegação, tempo de resposta inicial e métricas de carregamento como LCP, FID e CLS. Nenhuma chamada de telemetria é feita por padrão. Para enviar eventos a um endpoint próprio, configure `VITE_PERFORMANCE_ENDPOINT` no ambiente de build. O payload inclui tipo do evento, versão, rota e timestamp; não inclui token de autenticação nem dados fisiológicos.

O script `scripts/e2e-smoke.mjs` sobe o preview de produção, confirma as rotas `/login` e `/insights`, verifica o shell React, abre as duas rotas no Chromium headless e aplica um orçamento máximo por chunk. Os comandos disponíveis são:

```bash
npm run test:e2e
npm run check:perf
```

O teste requer Chromium no ambiente. Para usar outro binário, defina `CHROMIUM_BIN`. O limite padrão é 700 KiB por arquivo JavaScript e pode ser ajustado com `MAX_JS_ASSET_BYTES`.

## Chunks de rota e versão em cache

Com as rotas divididas em arquivos com hash no nome, um deploy novo troca esses nomes e os arquivos antigos deixam de existir. Se a casca do app que está aberta veio do cache do service worker (a versão anterior), todo `import()` de rota passa a pedir um arquivo que não existe mais e falha com `Failed to fetch dynamically imported module` — na web isso aparecia como "Erro de Conexão" e, no aplicativo nativo, como um menu em que nenhum botão levava a lugar nenhum.

O `src/lib/pwa.ts` cuida disso em três frentes:

- **Nativo**: o service worker é removido e os caches apagados. Dentro do WebView os arquivos já vêm dentro do APK, então ele não traz nada além do risco de servir a casca da versão anterior depois de uma atualização.
- **Web**: o registro é feito pelo app (não mais pelo script injetado pelo plugin) e, quando um service worker novo assume o controle de uma página que já estava sendo controlada, a página recarrega sozinha — antes que algum `import()` peça um arquivo já removido.
- **Nos dois**: `src/lib/lazyRoute.ts` envolve cada rota. Se o chunk não carrega, ele tenta de novo, e só então limpa caches e recarrega uma vez por sessão. Persistindo a falha, a ErrorBoundary explica que a versão está desatualizada em vez de falar em internet ou Supabase.

O reload de recuperação espera o documento terminar de carregar: recarregar no meio do carregamento faz o Chrome trazer a página nova sem executar os scripts dela, o que deixaria o app em branco justamente na hora de se recuperar.

## Onde fica a fronteira de Suspense

A página tem a sua própria fronteira de Suspense, dentro do `Layout` (`src/components/Layout.tsx`), e não uma única em volta de todas as rotas.

Com a fronteira única, qualquer rota que precisasse baixar o seu chunk fazia o React esconder o app inteiro — o `Layout` junto — para mostrar o "CARREGANDO...". O painel do menu MAIS ficava nesse trecho escondido no meio da animação de saída; efeitos não rodam em árvore escondida, então o framer-motion nunca concluía a saída e nunca removia o painel. Ao reaparecer, ele voltava por cima da página, opaco e com `pointer-events` ativo: a rota tinha carregado atrás, invisível, e todo toque seguinte batia no painel. Para quem usava, era "cliquei no Coach e não carrega nada" — e, a partir dali, nenhum botão respondia.

Com a fronteira dentro do `Layout`, só a área da página espera pelo chunk. O menu e a barra inferior continuam montados, a animação de saída conclui e o painel some. De quebra, some também o piscar de tela cheia a cada primeira visita a uma rota.

## Verificação das migrações de HRV

O arquivo `supabase/verify_hrv_migrations.sql` contém uma consulta somente leitura. Execute-o no SQL Editor do Supabase. O grupo `base_hrv` deve retornar `READY` para as colunas da primeira migração, e `validation_hrv` deve retornar `READY` para as colunas da segunda migração. Se algum resultado for `MISSING`, execute a migration correspondente antes de testar os gráficos e a persistência de qualidade.

## Deploy

A migração base é `supabase/migrations/20260825_add_hrv_to_heart_rate_sessions.sql`. A migração de qualidade é `supabase/migrations/20260825_add_hrv_validation_metadata.sql`. A ordem recomendada é executar a base primeiro e a de qualidade em seguida. Ambas devem ser executadas no banco de produção antes de avaliar o histórico completo de HRV.

Depois do deploy frontend, monitore o primeiro carregamento, as rotas mais acessadas, erros de chunks e falhas de sincronização. O endpoint de performance deve responder rapidamente e aceitar `POST` com JSON. Se ele estiver indisponível, o BoxLink descarta o evento sem bloquear navegação, autenticação ou coleta de FC.
