// src/hooks/usePushNotifications.ts
// Configura notificações push nativas (Firebase / APNs)
// Registra o token no Supabase para envio posterior

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';

export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return;

    const setup = async () => {
      // Solicita permissão
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;

      // Registra no sistema operacional
      await PushNotifications.register();

      // Recebe o token e salva no Supabase
      PushNotifications.addListener('registration', async (token) => {
        const platform = Capacitor.getPlatform();
        await supabase.from('push_tokens').upsert(
          { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      });

      // Notificação recebida com app aberto
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Recebida:', notification.title);
      });

      // Usuário tocou na notificação
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Ação:', action.notification.data);
        // Aqui você pode navegar para a tela certa com base em action.notification.data.route
      });
    };

    setup();

    return () => { PushNotifications.removeAllListeners(); };
  }, [userId]);
}
