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

## Verificação das migrações de HRV

O arquivo `supabase/verify_hrv_migrations.sql` contém uma consulta somente leitura. Execute-o no SQL Editor do Supabase. O grupo `base_hrv` deve retornar `READY` para as colunas da primeira migração, e `validation_hrv` deve retornar `READY` para as colunas da segunda migração. Se algum resultado for `MISSING`, execute a migration correspondente antes de testar os gráficos e a persistência de qualidade.

## Deploy

A migração base é `supabase/migrations/20260825_add_hrv_to_heart_rate_sessions.sql`. A migração de qualidade é `supabase/migrations/20260825_add_hrv_validation_metadata.sql`. A ordem recomendada é executar a base primeiro e a de qualidade em seguida. Ambas devem ser executadas no banco de produção antes de avaliar o histórico completo de HRV.

Depois do deploy frontend, monitore o primeiro carregamento, as rotas mais acessadas, erros de chunks e falhas de sincronização. O endpoint de performance deve responder rapidamente e aceitar `POST` com JSON. Se ele estiver indisponível, o BoxLink descarta o evento sem bloquear navegação, autenticação ou coleta de FC.
