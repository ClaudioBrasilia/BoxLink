import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Dois aplicativos saem deste mesmo código: o do box (padrão) e o do atleta
  // individual (VITE_APP_MODE=individual). Só muda a casca — backend é o
  // mesmo, que é o que permite o individual entrar num box sem perder nada.
  const isIndividualApp = env.VITE_APP_MODE === 'individual';
  const appName = isIndividualApp ? 'BoxLink League' : 'BoxLink';

  return {
    plugins: [
      react(),
      tailwindcss(),
      // index.html é estático e serve aos dois builds — o título vem daqui.
      {
        name: 'app-name-html',
        transformIndexHtml(html: string) {
          return html.replace(/<title>.*?<\/title>/, `<title>${appName}</title>`);
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'generateSW',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/],
        },
        manifest: {
          name: appName,
          // Curto de propósito: é o texto que aparece embaixo do ícone na tela
          // inicial do celular, e "BoxLink League" cortaria com reticências.
          short_name: isIndividualApp ? 'BoxLeague' : 'BoxLink',
          description: isIndividualApp
            ? 'BoxLink League — treine sozinho, dispute com amigos, suba na liga.'
            : 'BoxLink — treino, duelos e liga para atletas',
          theme_color: '#0e0e0e',
          background_color: '#0e0e0e',
          display: 'standalone',
          // Os dois apps usam a mesma arte por ora. Para dar identidade
          // própria ao Solo, basta trocar estes PNGs em public/ no deploy
          // dele — os nomes continuam os mesmos, então nada aqui muda.
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '~': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
