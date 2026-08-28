# Foreground Service BLE do BoxLink e BoxLeague

## Estado da implementação

O Android agora possui um serviço nativo de primeiro plano para sessões de frequência cardíaca. O serviço é declarado como `connectedDevice`, assume a posse do `BluetoothGatt`, mantém a notificação persistente, grava amostras localmente e reconecta quando o sinal é perdido. O WebView não é mais o dono da conexão BLE no Android; ele apenas inicia a sessão, observa eventos e recupera as amostras persistidas quando retorna ao primeiro plano.

A implementação está em `android/app/src/main/java/com/crosscity/ble/HrBleForegroundService.java`, `HrSessionStore.java` e `BleForegroundPlugin.java`. O contrato TypeScript está em `src/lib/bleForeground.ts`. A integração do fluxo existente foi feita em `src/hooks/useBluetooth.ts`, `src/hooks/useHeartRateSession.ts`, `src/components/HeartRateWidget.tsx` e `src/components/WodTimer.tsx`.

## Fluxo em produção

Quando o usuário escolhe um monitor e inicia a conexão, `useBluetooth` cria um `sessionId` e chama o plugin `BleForeground`. O plugin solicita `BLUETOOTH_CONNECT` no Android 12 ou posterior e solicita `POST_NOTIFICATIONS` no Android 13 ou posterior. A sessão só é iniciada pela ação visível do usuário, o que evita a restrição de início de Foreground Service a partir de background em apps target Android 12+ [3].

O serviço é promovido imediatamente com `ServiceCompat.startForeground`, usando uma notificação de baixa prioridade e o tipo `connectedDevice`. Ele abre o GATT, descobre os serviços, escolhe o Heart Rate Measurement padrão ou uma característica proprietária conhecida, habilita notificações pelo CCCD e interpreta BPM e intervalos RR. Antes de emitir o evento ao JavaScript, grava a amostra em SQLite.

| Evento | Efeito nativo | Efeito no React |
|---|---|---|
| Conexão GATT concluída | Descoberta de serviços e assinatura da característica | Estado `connected` e exibição do BPM |
| Notificação de FC/RR | Parser, validação básica e persistência SQLite | Atualização de BPM, RR, qualidade e HRV |
| Silêncio superior a 10 segundos | Fecha GATT, informa reconexão e tenta reconectar com backoff | Estado `reconnecting`, sem encerrar a sessão visual |
| Minimização, câmera ou Activity recriada | Serviço continua ativo; o WebView deixa de ser requisito para a captura | Ao retornar, lista amostras desde o início e reconstrói o gráfico |
| Encerrar conexão ou treino | Para notificações, marca a sessão como encerrada, remove a notificação e chama `stopSelf` | Mostra o resumo existente e encerra a coleta |
| Encerrar pela notificação com o app fechado | Marca a sessão como encerrada mesmo sem estado em memória | Ao voltar, `hydrate` percebe a sessão inativa e reconcilia a UI para desconectado |
| Serviço morto por force-stop ou reboot | O registro fica `active=1` sem ninguém alimentando | A primeira hidratação detecta a sessão órfã, encerra no nativo e registra um diagnóstico |

## Reconciliação ao voltar para o app

O WebView não pode confiar apenas nos eventos: eles são emitidos sem retenção e se perdem enquanto o app está pausado. Por isso `hydrate` é a fonte da verdade ao retornar ao primeiro plano e trata três casos.

Quando o registro nativo já não está ativo — o usuário encerrou pela notificação — o hook desfaz o estado de sessão em vez de continuar exibindo "conectado". Quando o registro está ativo mas sem leituras há mais de dois minutos, ele é tratado como órfão de um serviço que já morreu: o app chama `stopSession` para fechar a linha no banco e informa o usuário por diagnóstico. Nos demais casos, a hidratação segue adiante.

A recuperação de amostras é incremental. O hook guarda o `capturedAtMs` da última amostra já aplicada e passa esse valor como `afterMs` para `listSamples`, tanto na hidratação quanto nos eventos ao vivo. Pedir a sessão inteira a cada retorno reanexaria os mesmos intervalos RR e distorceria o RMSSD do resumo. As regras puras dessa reconciliação ficam em `src/lib/bleSession.ts`, com testes em `src/lib/bleSession.test.ts`.

## Persistência e HRV

A tabela `hr_sessions` mantém o dispositivo, horário, estado ativo, último BPM e quantidade de amostras. A tabela `hr_samples` mantém timestamp, BPM, intervalos RR e metadados de qualidade: total anunciado, intervalos inválidos, presença de RR e payload truncado. Isso permite recuperar os dados que chegaram enquanto os timers JavaScript estavam pausados.

A sessão React recebe `sessionSamples` do serviço e filtra os registros pelo instante de início do componente. O resumo existente continua responsável por calcular métricas de HRV, aplicar `hrvValidation` e persistir o resultado no Supabase; o serviço não duplica as regras de negócio do backend. O caminho Web Bluetooth e Bluefy permanece inalterado para navegador e iOS Web, e o plugin BLE antigo permanece disponível para o fluxo nativo não Android.

## Manifesto e variantes

O manifesto declara `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `POST_NOTIFICATIONS` e o serviço com `android:foregroundServiceType="connectedDevice"`. A mesma implementação Java é empacotada nas duas variantes. O `MainActivity` de BoxLink e BoxLeague registra o plugin, enquanto `scripts/sync-native.mjs` troca apenas o pacote da Activity e a identidade nativa do modo selecionado.

| Variante | Application ID | Nome da notificação |
|---|---|---|
| BoxLink | `com.crosscity.hub` | BoxLink — treino ativo |
| BoxLeague | `com.crosscity.boxleague` | BoxLeague — treino ativo |

A permissão de notificação é solicitada para transparência, mas uma recusa isolada não impede a sessão iniciada pelo usuário. Já a permissão de Bluetooth é obrigatória no Android 12+ para acessar o dispositivo e, se recusada, o serviço informa o erro sem abrir o GATT.

O `startForeground` pode ser recusado pelo sistema por mais de um motivo: falta de permissão (`SecurityException`) ou bloqueio de início em segundo plano (`ForegroundServiceStartNotAllowedException` no Android 12+ e as exceções de tipo inválido no Android 14+, todas descendentes de `IllegalStateException`). O serviço trata as duas famílias, encerra a sessão de forma limpa e emite `disconnected`; sem isso, o reinício via `START_STICKY` com o app em segundo plano derrubaria o processo.

## Wake lock

Um Foreground Service mantém o processo vivo, mas não impede o aparelho de suspender a CPU — o Spotify só fica imune a isso porque o subsistema de áudio segura o processador enquanto toca. Sem um wake lock parcial, com a tela apagada e o celular parado, os `Handler.postDelayed` do watchdog de silêncio e do backoff de reconexão deixam de contar. As notificações BLE ainda acordam o rádio e são gravadas, mas a recuperação de uma queda de sinal fica lenta.

O serviço adquire um `PARTIAL_WAKE_LOCK` assim que vira foreground e o libera em `stopSession` e em `onDestroy`. O lock é criado sem contagem de referências, então adquirir de novo apenas renova o prazo e uma única liberação basta — não há como ficar desbalanceado.

O prazo é de trinta minutos e é renovado, no máximo a cada cinco, sempre que uma leitura válida chega. Assim uma sessão ativa mantém a CPU acordada indefinidamente, enquanto uma sessão que parou de produzir dados devolve o processador sozinha em meia hora, mesmo que o serviço continue tentando reconectar e mesmo que o usuário esqueça de encerrar o treino. A permissão `WAKE_LOCK` é normal e não gera diálogo.

## Limitações importantes

O Foreground Service melhora substancialmente a continuidade, mas não cria uma garantia absoluta. A publicação da FC para a TV do box continua sendo feita em JavaScript, pelo WebView: ela sobrevive a outro app por cima, mas para quando o usuário remove o BoxLink da lista de recentes, porque a Activity é destruída. A gravação local segue normalmente nesse caso. O Android pode interromper a sessão em caso de force-stop, desativação do Bluetooth, bateria esgotada, falha do sensor ou políticas agressivas do fabricante. Remover o app da tela de recentes não deve encerrar o serviço, porque o manifesto usa `android:stopWithTask="false"`; entretanto, alguns fabricantes encerram processos independentemente dessa configuração.

O serviço precisa continuar sendo iniciado enquanto o aplicativo está visível, por exemplo quando o usuário toca em “Conectar”. Não se deve tentar iniciar uma nova sessão automaticamente de um timer JavaScript quando o app já está em background. Para distribuição na Play Store, a declaração do tipo `connectedDevice`, a justificativa de uso e a política de dados precisam ser revisadas junto às regras vigentes da Play Console [1] [2].

## Validação realizada

A compilação das classes Java e o `assembleDebug` foram executados com sucesso para BoxLink e BoxLeague. O APK BoxLeague foi inspecionado e confirmou `com.crosscity.boxleague`, target SDK 36, as permissões de Foreground Service e o serviço `com.crosscity.ble.HrBleForegroundService` com tipo `connectedDevice`. Também passaram `npx tsc --noEmit`, 175 testes unitários, `npm run build`, `npm run build:solo` e `npm run test:separation`.

A validação de continuidade BLE ainda precisa ser feita em aparelhos reais, pois o ambiente de desenvolvimento não possui um sensor cardíaco físico. O teste mínimo deve conectar um cinto ou relógio, iniciar a sessão, abrir a câmera, minimizar o app por cinco a dez minutos, bloquear e desbloquear a tela, retornar ao BoxLink e comparar o número de amostras e os intervalos RR no resumo.

## Referências

[1]: https://developer.android.com/develop/background-work/services/fgs/service-types "Android Developers — Foreground service types"

[2]: https://developer.android.com/develop/background-work/services/fgs/launch "Android Developers — Launch a foreground service"

[3]: https://developer.android.com/develop/connectivity/bluetooth/ble/background "Android Developers — Communicate in the background"

[4]: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start "Android Developers — Restrictions on starting a foreground service from the background"
