# BLE em segundo plano no iOS

## Implementação

O BoxLink e o BoxLeague agora usam o plugin Capacitor `BleForeground` também no iOS. Como o iOS não possui Android Foreground Service, a implementação usa `CBCentralManager` com `CBCentralManagerOptionRestoreIdentifierKey`, `CBPeripheralDelegate`, modo `bluetooth-central` no `Info.plist` e persistência local em JSON dentro de Application Support.

O código nativo está em `ios/App/App/BleForegroundPlugin.swift`. O registro do plugin é feito por `MainViewController.swift`, uma subclasse de `CAPBridgeViewController` ligada à cena principal do storyboard. O mesmo contrato TypeScript usado pelo Android continua em `src/lib/bleForeground.ts`, e `useBluetooth` seleciona o backend nativo para Android e iOS, mantendo Web Bluetooth/Bluefy separado.

O coordenador é um singleton criado pelo `AppDelegate` dentro de `didFinishLaunchingWithOptions`, e não pelo plugin. A Apple exige que o `CBCentralManager` com `restoreIdentifier` exista antes daquela função retornar [1]; se ele nascesse junto com o plugin, no ciclo de vida da view, o iOS não entregaria `willRestoreState` ao relançar o app em segundo plano por um evento Core Bluetooth — e a restauração de estado, que é o que sustenta a sessão no iPhone, nunca aconteceria. O plugin apenas se registra como ouvinte fraco do coordenador, então o WebView pode nascer e morrer sem afetar a captura.

| Camada | Responsabilidade |
|---|---|
| `IosBleSessionCoordinator` | Criar o central manager, conectar, descobrir serviços, assinar notificações e reconectar |
| `BleSessionStore` | Persistir os metadados da sessão e anexar amostras de BPM, RR e qualidade |
| `BleForeground` | Expor `startSession`, `stopSession`, `getActiveSession`, `getSnapshot` e `listSamples` ao React |
| `MainViewController` | Registrar o plugin no bridge Capacitor |
| `AppDelegate` | Criar o coordenador no lançamento, antes de `didFinishLaunchingWithOptions` retornar |
| `useBluetooth` | Espelhar eventos, hidratar a sessão ao retornar ao app e entregar amostras ao fluxo de HRV |

## Descoberta de serviços

A escolha do canal de FC varre todos os serviços candidatos, como no Android, em vez de apostar no primeiro serviço que casa com a heurística. Os serviços são ordenados por preferência — 180D padrão, depois os proprietários conhecidos, depois o resto — e as características notificáveis de todos eles são reunidas antes da escolha, que prefere a `2A37` padrão. Assim um serviço proprietário que apareça antes do 180D e não tenha canal notificável deixa de impedir a conexão.

## Persistência

Os metadados da sessão ficam em `ble-session-v2.json`, um arquivo pequeno reescrito só em mudanças de estado e, durante a captura, no máximo a cada cinco segundos. As amostras vão para `ble-samples.ndjson`, uma linha por batimento, anexadas por um `FileHandle` mantido aberto.

O formato anterior guardava sessão e amostras no mesmo JSON e o reescrevia inteiro a cada notificação BLE: numa hora de treino a um hertz, as últimas gravações reescreviam centenas de kilobytes por batimento, um custo quadrático em bateria e CPU justamente com o app em segundo plano. O arquivo antigo é removido na primeira execução; uma sessão interrompida por atualização do app já terminou e não há o que migrar.

Como os metadados são gravados com folga, `sampleCount` e `lastBpm` podem ficar até cinco segundos atrás do arquivo de amostras se o app for encerrado pelo sistema. O `listSamples` sempre lê o NDJSON completo, então nenhuma amostra se perde, e a hidratação no React prefere o BPM da última amostra recuperada ao valor dos metadados.

## Continuidade e restauração

A sessão é iniciada por ação do usuário enquanto o app está visível. O coordenador guarda o UUID do periférico, configura o delegate e tenta primeiro `retrievePeripherals(withIdentifiers:)`; se o iOS não devolver um periférico conhecido, faz uma busca curta para reencontrá-lo. Em desconexão ou falha de descoberta, aplica backoff de 1, 2 e 4 segundos.

O `willRestoreState` usa o identificador persistente do central manager para recuperar periféricos que o iOS mantinha associados a solicitações BLE pendentes. Ao receber uma notificação, o coordenador salva a amostra antes de emitir o evento ao WebView. Quando o app volta ao foreground, `useBluetooth` chama `getActiveSession` e `listSamples`, reconstrói BPM/RR e deixa o resumo existente calcular HRV e validação.

A reconciliação é a mesma do Android e está descrita em `docs/ANDROID-BLE-FOREGROUND-SERVICE.md`: sessão inativa volta a UI para desconectado, sessão ativa sem leituras há mais de dois minutos é encerrada como órfã, e `listSamples` recebe sempre o `afterMs` da última amostra já aplicada para não reanexar intervalos RR.

O `Info.plist` já contém `bluetooth-central` e `NSBluetoothAlwaysUsageDescription`. O modo `bluetooth-peripheral` existente foi preservado porque pertence à configuração anterior do projeto; ele não é necessário para a captura do monitor cardíaco e pode ser removido em uma revisão posterior se nenhum recurso do app atuar como periférico.

## Limites do iOS

O iOS pode acordar o aplicativo para eventos Core Bluetooth e restaurar estado, mas não garante a execução contínua de timers JavaScript nem a execução indefinida do processo. O serviço nativo precisa receber e armazenar as notificações BLE; depender de polling no WebView não é suficiente. O sistema ou o usuário ainda podem interromper a sessão ao fazer force-stop, desligar Bluetooth, remover permissões ou encerrar o app de forma explícita.

A Apple documenta que state preservation/restoration é opt-in, que o app deve recriar o central manager com o mesmo identificador de restauração e que essa recriação precisa acontecer durante o lançamento [1] [2]. A implementação segue esse desenho.

Duas limitações conhecidas seguem em aberto. Não há detecção de silêncio equivalente à do Android: um sensor que permanece conectado mas para de notificar não dispara reconexão no iPhone, só a desconexão explícita dispara. E a busca de reconexão usa `scanForPeripherals(withServices: nil)`, que o iOS ignora em segundo plano; o caminho principal, `retrievePeripherals(withIdentifiers:)`, cobre o monitor já pareado, mas o fallback de varredura não funciona com o app minimizado. A validação final de background ainda exige um iPhone físico, pois o ambiente atual não possui Xcode, xcodebuild, CocoaPods nem um periférico BLE real.

## Teste no iPhone

Instale uma build de desenvolvimento em um iPhone real, autorize Bluetooth, conecte o monitor pela opção de conexão direta e confirme a notificação de FC. Inicie o treino, bloqueie a tela, abra a câmera ou outro app por cinco a dez minutos, retorne ao BoxLink e confirme se o contador de amostras e os intervalos RR recuperados aparecem no resumo. Repita o teste após encerrar e relançar o app para verificar o caminho de state restoration.

## Referências

[1]: https://developer.apple.com/documentation/technotes/tn3115-bluetooth-state-restoration-app-relaunch-rules "Apple — Bluetooth State Restoration app relaunch rules"

[2]: https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html "Apple — Core Bluetooth Background Processing for iOS Apps"

[3]: https://capacitorjs.com/docs/ios/custom-code "Capacitor v8 — Custom Native iOS Code"
