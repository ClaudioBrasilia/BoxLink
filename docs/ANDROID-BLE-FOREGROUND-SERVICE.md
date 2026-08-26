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

## Limitações importantes

O Foreground Service melhora substancialmente a continuidade, mas não cria uma garantia absoluta. O Android pode interromper a sessão em caso de force-stop, desativação do Bluetooth, bateria esgotada, falha do sensor ou políticas agressivas do fabricante. Remover o app da tela de recentes não deve encerrar o serviço, porque o manifesto usa `android:stopWithTask="false"`; entretanto, alguns fabricantes encerram processos independentemente dessa configuração.

O serviço precisa continuar sendo iniciado enquanto o aplicativo está visível, por exemplo quando o usuário toca em “Conectar”. Não se deve tentar iniciar uma nova sessão automaticamente de um timer JavaScript quando o app já está em background. Para distribuição na Play Store, a declaração do tipo `connectedDevice`, a justificativa de uso e a política de dados precisam ser revisadas junto às regras vigentes da Play Console [1] [2].

## Validação realizada

A compilação das classes Java e o `assembleDebug` foram executados com sucesso para BoxLink e BoxLeague. O APK BoxLeague foi inspecionado e confirmou `com.crosscity.boxleague`, target SDK 36, as permissões de Foreground Service e o serviço `com.crosscity.ble.HrBleForegroundService` com tipo `connectedDevice`. Também passaram `npx tsc --noEmit`, 175 testes unitários, `npm run build`, `npm run build:solo` e `npm run test:separation`.

A validação de continuidade BLE ainda precisa ser feita em aparelhos reais, pois o ambiente de desenvolvimento não possui um sensor cardíaco físico. O teste mínimo deve conectar um cinto ou relógio, iniciar a sessão, abrir a câmera, minimizar o app por cinco a dez minutos, bloquear e desbloquear a tela, retornar ao BoxLink e comparar o número de amostras e os intervalos RR no resumo.

## Referências

[1]: https://developer.android.com/develop/background-work/services/fgs/service-types "Android Developers — Foreground service types"

[2]: https://developer.android.com/develop/background-work/services/fgs/launch "Android Developers — Launch a foreground service"

[3]: https://developer.android.com/develop/connectivity/bluetooth/ble/background "Android Developers — Communicate in the background"

[4]: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start "Android Developers — Restrictions on starting a foreground service from the background"
