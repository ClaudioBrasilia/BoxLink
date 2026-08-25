# Notas de pesquisa — HRV/VFC no BoxLink

## Estado atual do repositório

O BoxLink já coleta FC em tempo real por Bluetooth LE e por Apple Health/Health Connect. O hook `useHeartRateSession` transforma a última leitura de BPM em uma amostra uniforme a cada 2 segundos, com o formato `{ t, bpm }`. O `useBluetooth` usa o serviço padrão Heart Rate Service (`0x180D`) e a característica Heart Rate Measurement (`0x2A37`), mas atualmente extrai apenas o BPM. A tabela `heart_rate_sessions` persiste `samples`, `avg_bpm`, `max_bpm`, `min_bpm`, `zone_secs`, esforço e origem, porém não possui intervalos RR/IBI nem métricas de HRV.

O motor `src/lib/readiness.ts` já combina sensação, RPE, sono, dias consecutivos e variação de carga cardiovascular. Há regras conservadoras para `ready`, `control` e `recovery`, com baseline individual quando há histórico suficiente. O melhor ponto de integração é adicionar um sinal opcional de HRV/resting HR ao motor, preservando a lógica existente quando não houver dados confiáveis.

## Evidência do protocolo Bluetooth

A especificação oficial do Bluetooth Heart Rate Service descreve que a característica Heart Rate Measurement pode conter, além do BPM, um campo variável de RR-Interval. A presença é indicada pelo bit 4 da primeira flag; cada intervalo é um valor de 16 bits em unidades de 1/1024 segundo. O campo pode conter vários intervalos por notificação. O RR-Interval representa o tempo entre duas ondas R consecutivas no ECG.

Fonte: [Bluetooth SIG — Heart Rate Service](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/HRS_v1.0/out/en/index-en.html)

## Evidência das plataformas de saúde

A Apple documenta o identificador `heartRateVariabilitySDNN`; o HealthKit usa SDNN calculado a partir dos intervalos interbatimentos normais. O Android Health Connect documenta `HeartRateVariabilityRmssdRecord`, isto é, uma métrica HRV baseada em RMSSD. O hook atual do BoxLink limita o contrato de dados a `heartRate`, `calories` e `steps`, portanto ainda não lê HRV nem sono/resting HR.

Fontes:
- [Apple Developer — heartRateVariabilitySDNN](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn)
- [Android Developers — HeartRateVariabilityRmssdRecord](https://developer.android.com/reference/android/health/connect/datatypes/HeartRateVariabilityRmssdRecord)

## Decisão técnica preliminar

Não é apropriado calcular HRV a partir das amostras de BPM de 2 segundos: HRV exige intervalos batimento a batimento. A primeira versão deve capturar RR no canal padrão BLE quando a flag existir, validar e armazenar os intervalos; para dispositivos que só fornecem BPM, o app deve continuar usando FC/carga/RPE e mostrar que HRV não está disponível, sem inventar uma estimativa.

Para readiness, a opção mais explicável é comparar uma métrica diária de HRV com o baseline individual recente, usando desvio relativo. O sinal deve ser opcional, exigir histórico mínimo e nunca substituir dor, cansaço, sono ou RPE. Um HRV substancialmente abaixo do padrão pode reduzir a recomendação para `control` ou `recovery`; um valor isoladamente alto não deve liberar intensidade por si só.

## Complemento das fontes oficiais

A documentação da Apple define `heartRateVariabilitySDNN` como uma amostra de quantidade que mede o desvio padrão dos intervalos entre batimentos e informa que os valores usam unidades de tempo, normalmente milissegundos. O HealthKit calcula SDNN usando intervalos RR entre batimentos normais e registra amostras automaticamente no Apple Watch.

A documentação do Android define `HeartRateVariabilityRmssdRecord` como uma medição instantânea de HRV RMSSD e disponibiliza o valor por `getHeartRateVariabilityMillis()`. A classe foi adicionada à API 34, logo o código nativo deve tratar compatibilidade e ausência de dados em versões/dispositivos sem suporte.

## Suporte do plugin usado pelo projeto

O README do `@capgo/capacitor-health` na versão pública atual lista `heartRateVariability` como `HealthDataType`, com unidade padrão `millisecond`, além de `restingHeartRate` e `sleep`. O README também informa que o plugin usa HealthKit no iOS e Health Connect no Android e declara permissões de HRV no manifesto do plugin. Isso permite uma API unificada no TypeScript, mas a implementação atual do BoxLink restringe deliberadamente o contrato local a três tipos e remove permissões nativas de HRV no Android; essas duas camadas precisarão ser atualizadas para o recurso funcionar em produção.

Fonte: [Cap-go — capacitor-health](https://github.com/Cap-go/capacitor-health)

Observação de compatibilidade: o plugin unificado usa o nome `heartRateVariability`, enquanto as APIs nativas distinguem SDNN (Apple) e RMSSD (Android). Portanto, o modelo persistido deve guardar também `metric`/`source`, evitando comparar diretamente valores de algoritmos diferentes sem sinalização.

## Verificação da versão instalada

A versão travada `@capgo/capacitor-health@8.6.0` declara e implementa `heartRateVariability`: no adaptador iOS ela mapeia para `HKQuantityTypeIdentifier.heartRateVariabilitySDNN`; no Android ela mapeia para `HeartRateVariabilityRmssdRecord`. Assim, a distinção de métrica adicionada ao modelo do BoxLink é necessária e compatível com a dependência já instalada.
