# Implementação de HRV/VFC no BoxLink

## Resumo

A resposta é **sim**: a variação da frequência cardíaca pode melhorar os parâmetros de orientação do BoxLink, desde que seja usada com intervalos RR/IBI reais e comparada ao histórico individual do atleta. A implementação realizada adiciona captura de RR pelo Bluetooth padrão, leitura de HRV via Apple Health/Health Connect, cálculo de RMSSD/SDNN, persistência e integração ao motor de prontidão.

A HRV não é inferida a partir das amostras de BPM de dois segundos. Essa escolha evita transformar uma série temporal de BPM em uma falsa medição de variabilidade. No BLE padrão, o campo RR é opcional e é indicado pela flag correspondente da característica Heart Rate Measurement; o Bluetooth SIG define o RR como o intervalo entre ondas R consecutivas e especifica a unidade de 1/1024 segundo [1].

## O que foi implementado

| Camada | Alteração | Resultado |
|---|---|---|
| BLE | Parser de `0x2A37` com leitura de BPM, Energy Expended e múltiplos RR | Cintas e relógios compatíveis passam a fornecer RR ao resumo da sessão. |
| Métricas | Novo `src/lib/hrv.ts` | Calcula RMSSD e SDNN em milissegundos, filtra intervalos implausíveis e recusa janelas insuficientes. |
| Sessão | `useHeartRateSession` e `useBluetooth` | Acumulam RR durante a conexão sem remover o fallback atual de BPM. |
| App de saúde | `useNativeHealth` | Solicita e lê `heartRateVariability` pela API unificada já instalada. No iOS, a biblioteca usa SDNN; no Android, RMSSD. |
| Resumo | `HeartRateSummary` | Exibe HRV, informa a métrica e a quantidade de RR e salva os dados junto da sessão. |
| Histórico | `HeartRateHistory` | Reabre HRV/RR persistida sem recalcular indevidamente sessões antigas. |
| Prontidão | `readiness.ts`, Dashboard e Diário | Compara HRV do app de saúde com três medições anteriores da mesma métrica e aplica orientação conservadora. |
| Banco | `20260825_add_hrv_to_heart_rate_sessions.sql` | Adiciona colunas idempotentes para RR, RMSSD, SDNN, métrica e instante da leitura. |
| Nativo | Android Manifest e iOS Info.plist | Declara a permissão Android de leitura de HRV e atualiza o consentimento do HealthKit. |
| Privacidade | `public/privacy.html` e guia operacional | Declara HRV/VFC como dado de saúde usado para fitness e orientação, sem diagnóstico. |

## Como a prontidão usa HRV

O baseline não mistura RMSSD e SDNN. Também não usa HRV capturada durante um WOD como se fosse HRV de repouso: sessões originadas do Health Connect/Apple Health são usadas para o baseline de prontidão; sessões BLE do treino ficam disponíveis no resumo e no histórico.

| Situação | Regra aplicada | Orientação |
|---|---|---|
| Menos de três medições anteriores da mesma métrica | HRV não entra como sinal confiável | Mantém a lógica existente de RPE, sono, sensação e carga. |
| HRV pelo menos 15% abaixo do baseline individual | Sinal moderado | Estado `control`, recomendando reduzir o ritmo e observar a resposta do corpo. |
| HRV pelo menos 30% abaixo do baseline e há cansaço, sono abaixo de 7h ou RPE igual/maior que 7 | Sinal crítico combinado | Estado `recovery`, priorizando recuperação. |
| HRV acima do padrão | Não libera intensidade automaticamente | Um valor alto isolado não substitui o contexto do treino. |

Esses limiares são parâmetros iniciais de produto, não critérios médicos. Eles devem ser calibrados com dados reais do uso, por coorte e por dispositivo, sempre preservando a explicabilidade e sem criar ranking público de recuperação.

## Fontes nativas

O plugin `@capgo/capacitor-health` já travado no projeto, versão 8.6.0, declara `heartRateVariability` como tipo unificado e unidade em milissegundos. No código nativo, essa versão mapeia o tipo para `heartRateVariabilitySDNN` no HealthKit e para `HeartRateVariabilityRmssdRecord` no Health Connect. A Apple documenta que o HealthKit calcula SDNN a partir de intervalos RR entre batimentos normais [2]. O Android documenta o registro instantâneo RMSSD e o valor em milissegundos, introduzido na API 34 [3].

A leitura de HRV no modo Saúde usa uma janela de até 24 horas porque relógios frequentemente sincronizam a medição de repouso fora do instante do treino. A leitura continua opcional: se a permissão for negada ou o dispositivo não sincronizar HRV, a sessão segue funcionando com BPM, zonas, carga, RPE e sono.

## Migração e publicação

Aplicar a migração `supabase/migrations/20260825_add_hrv_to_heart_rate_sessions.sql` no projeto Supabase antes de publicar o build. A migração é segura para execução repetida e não altera as linhas antigas. Depois de alterar o código nativo, executar `npx cap sync android` e/ou `npx cap sync ios`.

No Android, revisar a declaração de dados de saúde no Play Console, pois o app passou a solicitar `android.permission.health.READ_HEART_RATE_VARIABILITY`. A política publicada em `/privacy.html` foi atualizada para mencionar HRV/VFC, seu uso na orientação de treino e a ausência de finalidade diagnóstica.

## Validação executada

A suíte existente e os novos testes passaram: **16 arquivos de teste, 175 testes aprovados**. Também passaram `npx tsc --noEmit`, `npm run build` e `git diff --check`. O build exibiu apenas o aviso já conhecido de chunk JavaScript acima de 500 kB; não houve erro de compilação.

Os novos testes cobrem o formato uint8 e uint16 do BPM, Energy Expended, múltiplos RR, ausência da flag RR, contagem de RR inválidos, payload truncado, filtragem fisiológica, insuficiência de intervalos, RMSSD/SDNN, separação entre RMSSD e SDNN, baseline individual, estados nativos por plataforma, frescor, agrupamento por fuso horário e lacunas na série histórica.

## Gráficos de tendência na tela Insights

A tela `/insights` agora inclui a seção **Tendências de recuperação** com dois gráficos responsivos para os últimos 28 dias. A verificação local confirmou que a rota redireciona corretamente para `/login` quando não há sessão; a conferência visual dos gráficos com dados reais requer uma conta de teste e as variáveis do Supabase configuradas. O gráfico **HRV/VFC** exibe RMSSD ou SDNN em milissegundos e uma linha pontilhada com o baseline individual. O gráfico **Prontidão diária** exibe a evolução categórica entre “Pronto”, “Controle” e “Recuperação”; ele não apresenta um score médico ou uma pontuação clínica. Os tooltips mostram data, métrica, baseline, variação percentual, confiança e os dados de RPE/sono disponíveis naquele dia.

Dias sem medição real permanecem como lacunas. Se o banco ainda não tiver as colunas da migração, a tela faz fallback para a consulta antiga de sessões de FC e continua funcionando; depois da migração, os gráficos passam a usar os campos de HRV automaticamente. O acesso normal é pelo menu **Insights** ou diretamente por `/insights`.

## Fases 1 e 2 — validação de entrada e qualidade por fonte

Foi adicionada a camada `src/lib/hrvValidation.ts`, que normaliza a qualidade de HRV em estados `valid`, `insufficient`, `invalid`, `stale`, `unsupported`, `permission_denied` e `no_data`. O parser BLE agora preserva a presença da flag RR, o total de intervalos observados, a quantidade rejeitada e payloads truncados. O hook BLE acumula esses dados por conexão e mantém o timestamp do último pacote, o identificador e o nome do dispositivo.

O hook nativo agora mantém a distinção entre Apple Health e Health Connect: Apple Health é armazenado como SDNN e Health Connect como RMSSD. A camada nativa diferencia indisponibilidade da plataforma, permissão específica de HRV, falha de leitura, ausência de amostra, valor inválido e amostra antiga, sem interromper a leitura de BPM quando a HRV não estiver disponível.

A persistência recebeu metadados opcionais para status, motivo, quantidade e proporção de RR válidos, idade, plataforma, fonte e dispositivo. Se a migração nova ainda não estiver aplicada, `saveHeartRateSession` repete a gravação removendo somente os campos novos, preservando o fallback para o schema antigo. O baseline e os gráficos de tendência ignoram sessões nativas cujo status persistido não seja `valid`; sessões legadas sem status continuam compatíveis.

A cobertura automatizada passou a **16 arquivos de teste e 175 testes aprovados** após incluir casos de RR inválido, payload truncado, frescor, métrica por plataforma, permissão/suporte e filtragem do baseline. Também passaram `npx tsc --noEmit`, `npm run build` e `git diff --check`.

## Limitações e próximo passo recomendado

A captura de RR depende do dispositivo transmitir a característica padrão com a flag RR ativa. Dispositivos que fornecem somente BPM não permitem HRV confiável por este canal, e o BoxLink deliberadamente não estima HRV a partir do BPM amostrado.

A validação final precisa ser feita em aparelho físico com uma cinta ou relógio que transmita RR, além de um Android com Health Connect e um iPhone com Apple Health. O próximo passo recomendado é observar quatro semanas de dados reais, verificar a qualidade por dispositivo e recalibrar os limiares sem remover as salvaguardas de dor, fadiga, sono e RPE.

## Referências

[1]: https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/HRS_v1.0/out/en/index-en.html — Bluetooth SIG, “Heart Rate Service”.

[2]: https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn — Apple Developer, “heartRateVariabilitySDNN”.

[3]: https://developer.android.com/reference/android/health/connect/datatypes/HeartRateVariabilityRmssdRecord — Android Developers, “HeartRateVariabilityRmssdRecord”.

[4]: https://github.com/Cap-go/capacitor-health — Cap-go, “capacitor-health”.
