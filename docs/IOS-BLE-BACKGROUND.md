# BLE em segundo plano no iOS

## Implementação

O BoxLink e o BoxLeague agora usam o plugin Capacitor `BleForeground` também no iOS. Como o iOS não possui Android Foreground Service, a implementação usa `CBCentralManager` com `CBCentralManagerOptionRestoreIdentifierKey`, `CBPeripheralDelegate`, modo `bluetooth-central` no `Info.plist` e persistência local em JSON dentro de Application Support.

O código nativo está em `ios/App/App/BleForegroundPlugin.swift`. O registro é feito por `MainViewController.swift`, uma subclasse de `CAPBridgeViewController` ligada à cena principal do storyboard. O mesmo contrato TypeScript usado pelo Android continua em `src/lib/bleForeground.ts`, e `useBluetooth` seleciona o backend nativo para Android e iOS, mantendo Web Bluetooth/Bluefy separado.

| Camada | Responsabilidade |
|---|---|
| `IosBleSessionCoordinator` | Criar o central manager, conectar, descobrir serviços, assinar notificações e reconectar |
| `BleSessionStore` | Persistir uma sessão ativa e amostras de BPM, RR e qualidade |
| `BleForeground` | Expor `startSession`, `stopSession`, `getActiveSession`, `getSnapshot` e `listSamples` ao React |
| `MainViewController` | Registrar o plugin no bridge Capacitor |
| `useBluetooth` | Espelhar eventos, hidratar a sessão ao retornar ao app e entregar amostras ao fluxo de HRV |

## Continuidade e restauração

A sessão é iniciada por ação do usuário enquanto o app está visível. O coordenador guarda o UUID do periférico, configura o delegate e tenta primeiro `retrievePeripherals(withIdentifiers:)`; se o iOS não devolver um periférico conhecido, faz uma busca curta para reencontrá-lo. Em desconexão ou falha de descoberta, aplica backoff de 1, 2 e 4 segundos.

O `willRestoreState` usa o identificador persistente do central manager para recuperar periféricos que o iOS mantinha associados a solicitações BLE pendentes. Ao receber uma notificação, o coordenador salva a amostra antes de emitir o evento ao WebView. Quando o app volta ao foreground, `useBluetooth` chama `getActiveSession` e `listSamples`, reconstrói BPM/RR e deixa o resumo existente calcular HRV e validação.

O `Info.plist` já contém `bluetooth-central` e `NSBluetoothAlwaysUsageDescription`. O modo `bluetooth-peripheral` existente foi preservado porque pertence à configuração anterior do projeto; ele não é necessário para a captura do monitor cardíaco e pode ser removido em uma revisão posterior se nenhum recurso do app atuar como periférico.

## Limites do iOS

O iOS pode acordar o aplicativo para eventos Core Bluetooth e restaurar estado, mas não garante a execução contínua de timers JavaScript nem a execução indefinida do processo. O serviço nativo precisa receber e armazenar as notificações BLE; depender de polling no WebView não é suficiente. O sistema ou o usuário ainda podem interromper a sessão ao fazer force-stop, desligar Bluetooth, remover permissões ou encerrar o app de forma explícita.

A Apple documenta que state preservation/restoration é opt-in e que o app deve recriar o central manager com o mesmo identificador de restauração [1] [2]. A implementação segue esse desenho. A validação final de background ainda exige um iPhone físico, pois o ambiente atual não possui Xcode, xcodebuild, CocoaPods nem um periférico BLE real.

## Teste no iPhone

Instale uma build de desenvolvimento em um iPhone real, autorize Bluetooth, conecte o monitor pela opção de conexão direta e confirme a notificação de FC. Inicie o treino, bloqueie a tela, abra a câmera ou outro app por cinco a dez minutos, retorne ao BoxLink e confirme se o contador de amostras e os intervalos RR recuperados aparecem no resumo. Repita o teste após encerrar e relançar o app para verificar o caminho de state restoration.

## Referências

[1]: https://developer.apple.com/documentation/technotes/tn3115-bluetooth-state-restoration-app-relaunch-rules "Apple — Bluetooth State Restoration app relaunch rules"

[2]: https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html "Apple — Core Bluetooth Background Processing for iOS Apps"

[3]: https://capacitorjs.com/docs/ios/custom-code "Capacitor v8 — Custom Native iOS Code"
