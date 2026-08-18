# Auditoria de publicação — BoxLink Individual

**Escopo.** Auditoria do aplicativo Individual/BoxLeague existente, sem criação de novo aplicativo e sem alteração de código nesta fase. Foram avaliados isolamento de rotas, cadastro, onboarding, autenticação, fluxo “Entrar no Box”, build, testes, configuração PWA/Capacitor e políticas Supabase.

## Veredito executivo

> **Veredito: não recomendar publicação pública do Individual ainda.**
>
> O produto está tecnicamente próximo de uma versão publicável como **web/PWA controlado**, mas ainda há bloqueadores para tratá-lo como aplicativo Individual separado em produção. O principal é que a identidade nativa não é separada do BoxLink: `capacitor.config.ts` mantém `appId: 'com.crosscity.hub'` e `appName: 'BoxLink'`. Há também um risco de privacidade de alta severidade no RLS de `profiles`, cuja política permite leitura pública de todas as colunas, incluindo campos potencialmente pessoais.

A avaliação não indica regressão imediata nas funcionalidades já implementadas. Os testes existentes, o typecheck e os dois builds compilam. Entretanto, “compila” não equivale a “está pronto para loja”: identidade de pacote, privacidade, operação de migrações e testes de jornada ainda precisam ser tratados.

## O que está funcionando bem

| Área | Evidência | Avaliação |
|---|---|---|
| Isolamento de rotas | `src/App.tsx` usa `VITE_APP_MODE`; no modo individual, rotas de WOD, ranking do Box, desafios, Feed, TV, admin e coach não são registradas | **Bom**. O build individual não é apenas um menu diferente; as rotas coletivas são removidas do conjunto publicado. |
| Navegação | `src/components/Layout.tsx` alterna o menu para Diário, Duelos, Liga e Perfil, deixando Frequência, Insights, Progresso, Benchmarks e Loja no menu “Mais” | **Bom**, sujeito a teste visual em dispositivos pequenos. |
| Cadastro individual | `src/pages/Signup.tsx` força `accountType = 'individual'` no build individual | **Bom**. Reduz a chance de o aluno escolher o fluxo errado. |
| Aprovação da conta | `20260722_boxlink_individual.sql` altera `handle_new_user()` para aprovar automaticamente contas individuais e manter contas de Box pendentes | **Coerente** com a proposta de acesso imediato. |
| Onboarding | `AuthContext.tsx` controla `profiles.onboarding_done`; `Onboarding.tsx` usa slides específicos do Individual | **Bom conceito**. O tutorial é persistido na conta e não depende de `localStorage`. |
| Entrada no Box | `Diario.tsx` mostra estados pendente, aprovado e recusado; `20260722_boxlink_individual.sql` cria a tabela e o RLS; `20260729_multi_box.sql` adiciona `box_id` | **Funcional em princípio**, mas requer testes de integração no Supabase real. |
| Qualidade de compilação | `npm test -- --run`: 13 arquivos, 148 testes aprovados; `npx tsc --noEmit`: aprovado; `npm run build`: aprovado; `npm run build:solo`: aprovado | **Sinal positivo** de estabilidade do código atual. |

## Auditoria do onboarding e da entrada no Box

O cadastro individual tem a mensagem correta de acesso imediato e não expõe a seleção “Sou de um Box” no build Individual. O login, porém, ainda exibe a marca **BOXLINK**, o texto “A Arena Espera Por Você” e o convite “Criar conta individual”, mesmo quando a tela está sendo usada pelo próprio aplicativo Individual. Isso cria uma experiência de marca inconsistente e pode confundir o usuário sobre qual produto instalou. A evidência está em `src/pages/Login.tsx`, especialmente no título e no bloco de cadastro.

O onboarding individual explica a mecânica principal — registrar treino, usar duelos por código, acompanhar Liga, PRs e avatar — e termina apontando para um checklist. A maior lacuna é que a jornada não deixa explícitos os limites de privacidade, a diferença entre “registrar um treino” e “check-in”, nem como conectar dados de saúde/FC. Isso não impede o uso, mas reduz a compreensão e pode gerar expectativa errada sobre sincronização automática.

O fluxo “Entrar no Box” está implementado no Diário. Ele carrega boxes ativos, permite selecionar um Box, grava `user_id` e `box_id`, exibe o status e informa que a aprovação exige sair e entrar novamente. A aprovação administrativa em `src/pages/Admin.tsx` altera o perfil para `account_type: 'box'`, preserva `box_id` e envia notificação.

Há quatro riscos operacionais nesse fluxo:

1. **A aprovação não é refletida em tempo real na sessão atual.** O próprio texto pede logout/login. Isso é aceitável como fallback, mas a experiência deveria orientar o usuário para o aplicativo BoxLink correto e oferecer um caminho claro para abrir/instalar esse app.
2. **Não há evidência de teste automatizado de integração** para criar pedido, impedir duplicidade pendente, aprovar, rejeitar e confirmar a transição de conta.
3. **O banco não declara unicidade para pedidos pendentes por usuário e Box.** A interface bloqueia o caso pendente mais comum, mas concorrência, múltiplas abas ou retries podem criar duplicatas.
4. **O escopo de administração é somente `role = 'admin'`.** Se a operação do produto considerar coaches ou administradores de um Box específico como aprovadores, o RLS atual não cobre esse modelo; se apenas o administrador global aprova, isso deve ser documentado.

## Estabilidade e publicação

Os resultados técnicos atuais são bons, mas há pendências claras de release:

| Verificação | Resultado | Impacto |
|---|---|---|
| Testes unitários | 148 aprovados | Sem bloqueio identificado nessa camada. |
| TypeScript | Aprovado | Sem erro de tipos detectado. |
| Build BoxLink | Aprovado | Sem bloqueio de compilação. |
| Build Individual | Aprovado | Sem bloqueio de compilação. |
| ESLint | Falha porque não existe configuração ESLint | **P1**. A qualidade está sem gate de lint reproduzível. |
| Tamanho do bundle | Chunk principal individual de aproximadamente 1,2 MB minificado; o build emite warning acima de 500 kB | **P1**. Não impede publicação, mas prejudica primeiro carregamento e pode afetar redes móveis. |
| Identidade nativa | `capacitor.config.ts` usa sempre `com.crosscity.hub` e `BoxLink` | **P0 para lojas**. O Individual não pode ser publicado como app separado com a mesma identidade. |
| Documentação | README descreve principalmente o app do Box, usa referências antigas e não documenta `build:solo` | **P1**. Aumenta risco operacional no processo de release. |
| Marca no login | `Login.tsx` hardcodifica BoxLink | **P1**. Inconsistência visível na primeira tela. |

Além disso, os dois modos compartilham o mesmo service worker e a mesma estrutura de assets. Isso pode funcionar se cada produto tiver domínio/origem e ciclo de release próprios; se forem publicados no mesmo domínio ou subcaminho sem estratégia de cache separada, deve-se validar colisão de cache e atualização. Essa validação ainda não está demonstrada no repositório.

## Privacidade e segurança

O risco mais importante está em `supabase_schema.sql`. A tabela `profiles` possui a política:

> `create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);`

Como o cliente e outros pontos do código usam `select('*')`, a política permite que qualquer usuário autenticado — e potencialmente qualquer cliente conforme a configuração de acesso — leia todas as colunas expostas de `profiles`, não apenas nome, nível e código de amigo. O mesmo registro contém `email`, `weight_kg`, `height_cm`, `birth_date`, `sex`, inventário, plano e identificadores de Box. Para uma publicação do Individual, isso é um **bloqueador de privacidade**, mesmo que a interface não mostre todos esses campos.

Há um segundo problema de princípio: `wod_results`, `duels`, `box_settings`, WODs, desafios e itens têm leituras amplas. Algumas dessas leituras são intencionais para Liga ou catálogo, mas a aplicação deve confirmar, coluna por coluna, o que é público. O fato de o usuário individual consultar apenas algumas colunas não substitui uma política de banco segura, pois um cliente externo pode fazer outra seleção permitida pelo RLS.

O modelo recomendado para publicação é separar dados públicos de perfil em uma view/tabela mínima — por exemplo, identificador, nome exibido, avatar, nível e código de amigo — e manter dados pessoais, biométricos, de saúde, plano e contato em uma superfície protegida pelo próprio usuário e por administradores autorizados. A correção deve ser validada contra o Supabase Advisor e por testes com dois usuários distintos.

## Backlog priorizado — sem implementação nesta fase

| Prioridade | Item | Motivo | Critério de aceite |
|---|---|---|---|
| **P0** | Separar identidade nativa do Individual | `appId` e `appName` ainda são BoxLink | Build individual com bundle ID/package name, nome, ícones, deep links e configuração de loja próprios. |
| **P0** | Corrigir exposição pública de `profiles` | RLS atual libera todas as colunas de perfil | Usuário A não consegue ler e-mail, biometria, nascimento, sexo, plano ou dados privados de B; Liga continua funcionando com campos mínimos. |
| **P0** | Validar migrações no projeto Supabase de produção | O fluxo depende de `box_join_requests`, `box_id`, `onboarding_done`, dados de FC e outras migrações | Execução ordenada em ambiente limpo e validação pós-migração; nenhum erro de schema em cadastro, Diário ou pedido de Box. |
| **P1** | Testar jornada ponta a ponta do Join Box | Não há teste automatizado da transição Individual → Box | Teste cobre criação, retry, duplicidade, aprovação, rejeição, notificação, sessão antiga e abertura do app correto. |
| **P1** | Impedir duplicidade de pedido pendente | Ausência de constraint permite duplicatas em concorrência | Constraint ou função transacional garante no máximo um pedido pendente por usuário e Box. |
| **P1** | Corrigir marca e copy do login/instalação | `Login.tsx`, `Install.tsx` e README ainda falam BoxLink | No Individual, todas as superfícies públicas usam o nome, descrição e CTA corretos; no Box, a experiência permanece inalterada. |
| **P1** | Criar gate de lint e ampliar testes de jornada | `npm run lint` falha por falta de configuração | Lint reproduzível no CI e testes de autenticação/rotas/fluxo de entrada passam no pipeline. |
| **P1** | Reduzir ou dividir o bundle individual | Warning de chunk acima de 500 kB | Primeiro carregamento medido em dispositivo/rede móvel e chunks de telas pesadas carregados sob demanda. |
| **P1** | Definir atualização de sessão após aprovação | Hoje o aluno precisa descobrir que deve sair e entrar | Mensagem contém ação clara para abrir o BoxLink; sessão, notificações e estado de conta são atualizados sem ambiguidade. |
| **P2** | Revisar onboarding e checklist | O onboarding promete recursos e não explica privacidade/FC | Cada CTA leva a uma tela existente e o aluno entende o que é treino, check-in, dado de saúde e compartilhamento. |
| **P2** | Documentar dois canais de release | README só descreve o build padrão | Guia separado para `build:solo`, variáveis, Capacitor, domínios, PWA, migrações e rollback. |
| **P2** | Testar cache PWA entre produtos | Service worker é gerado pelo mesmo projeto | Atualização de um produto não serve assets do outro; instalação, atualização e logout são validados em Android/iOS/desktop. |

## Condições mínimas para liberar publicação

A publicação deve ser liberada somente depois de concluir os três itens P0, executar uma validação real das migrações no Supabase de produção e realizar uma rodada manual em Android/iOS ou PWA cobrindo: cadastro individual, confirmação de e-mail quando habilitada, login, reset de senha, onboarding, registro do primeiro treino, readiness, conexão/ausência de FC, duelos, Liga, logout, reinstalação e pedido de entrada no Box.

A recomendação é **continuar o desenvolvimento incremental sem publicar ainda**. O núcleo do produto Individual está estruturado e os builds estão saudáveis; portanto, não há necessidade de recomeçar nem criar outro aplicativo. O caminho seguro é fechar privacidade e identidade de publicação primeiro, depois validar o ciclo de entrada no Box e somente então avançar para otimizações de performance e refinamentos de engajamento.

## Referências internas da auditoria

- `src/App.tsx`: isolamento de rotas e guardas de conta.
- `src/pages/Signup.tsx`: cadastro e seleção de tipo de conta.
- `src/pages/Login.tsx`: primeira tela pública e marca hardcoded.
- `src/pages/Diario.tsx`: pedido de entrada no Box e estados da solicitação.
- `src/pages/Admin.tsx`: aprovação/rejeição administrativa.
- `src/context/AuthContext.tsx`: sessão, perfil e persistência do onboarding.
- `src/components/Onboarding.tsx`: onboarding específico do Individual.
- `src/lib/appMode.ts`: seleção de modo e nome lógico do app.
- `vite.config.ts`: build, PWA e nome lógico por modo.
- `capacitor.config.ts`: identidade nativa atual.
- `supabase/migrations/20260722_boxlink_individual.sql`: contas individuais, diário e pedidos de entrada.
- `supabase/migrations/20260729_multi_box.sql`: `box_id` em pedidos e perfis.
- `supabase/migrations/20260805_security_advisor_fixes.sql`: endurecimento parcial de RLS.
- `supabase_schema.sql`: políticas-base e exposição de perfis.
- `package.json`: scripts de teste, build, build individual e lint.
