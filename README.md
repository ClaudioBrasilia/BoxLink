# CrossCity Hub - Mobile App & Dashboard 🏋️‍♂️🔥

Este é um ecossistema de alta performance para boxes de CrossFit, composto por um **Dashboard para TV** e um **Aplicativo Móvel Gamificado**.

## 🚀 Funcionalidades do Aplicativo Móvel

- **Interface Neon High-Performance:** Design otimizado para dispositivos móveis com alto contraste e foco em usabilidade.
- **WOD Player:** Acompanhamento detalhado do treino do dia com cronômetro integrado.
- **Real-Time HR Monitoring:** Integração com dispositivos vestíveis para monitoramento de BPM em tempo real.
- **Leaderboard Global:** Ranking do box atualizado instantaneamente.
- **Perfil do Atleta:** Gestão de PRs (Personal Records), benchmarks e conquistas (badges).
- **Check-in Gealocalizado:** Confirmação de presença baseada na localização do box.

## 🛠️ Tecnologias Utilizadas

- **React 19** + **Vite**
- **Capacitor 8.2:** Para build nativo Android e iOS.
- **Tailwind CSS 4.0:** Estilização moderna e responsiva.
- **Framer Motion:** Animações de interface fluidas.
- **Supabase:** Backend real-time para dados e autenticação.

## 📦 Como Gerar o App Nativo

1. **Build do projeto web:**
   ```bash
   npm run build
   ```

2. **Sincronizar com o Capacitor:**
   ```bash
   npx cap sync
   ```

3. **Abrir no Android Studio / Xcode:**
   ```bash
   npx cap open android
   # ou
   npx cap open ios
   ```

## 🔌 Configuração do Backend (Supabase)

Crie um arquivo `.env.local` na raiz do projeto:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```

---
Desenvolvido para **CrossCity Hub - CrossFit Elite**. 
*Pronto para escalar e vender.*          Teste de build APK main
