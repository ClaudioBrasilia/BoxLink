# Arquitetura e Estrutura Técnica

## 1. Stack Tecnológica
- **Frontend / UI:** React 19, Vite, Tailwind CSS 4.0, Framer Motion.
- **Mobile Native:** Capacitor 8.2 (compilação para Android/iOS) e Vite PWA Plugin.
- **Backend / BaaS:** Supabase (PostgreSQL, Auth, Realtime, Storage).
- **Gráficos:** Recharts.
- **Gestão de Rotas:** React Router.

## 2. Padrões de Projeto e Estrutura de Pastas
O projeto segue a estrutura padrão de uma aplicação React com Vite:
- `/src/pages`: Contém as telas principais (Dashboard, Wod, TV, Admin, etc.).
- `/src/components`: Componentes reutilizáveis (Layout, AvatarPreview, etc.).
- `/src/lib`: Bibliotecas de configuração e utilitários (Supabase client).
- `/src/context`: Gerenciadores de estado global (ex: AuthContext).
- `/supabase/migrations`: Scripts SQL para versionamento e construção do banco de dados.

## 3. Segurança e Banco de Dados (Supabase)
O banco de dados é estritamente protegido utilizando o recurso de **Row Level Security (RLS)** nativo do PostgreSQL.
- **Acesso de Usuário:** Os usuários logados apenas têm acesso de leitura/escrita aos seus próprios dados de perfil, ou aos dados públicos permitidos pelas políticas (ex: Leaderboard).
- **Operações Críticas:** Ações que afetam a economia do jogo (distribuição de XP e Moedas, aprovação de duelos e check-ins) são realizadas exclusivamente via funções RPC (Remote Procedure Calls) seguras (`SECURITY DEFINER`), garantindo a **idempotência** (evita duplicidade em caso de erro de rede) e evitando injeções de saldo pelo lado do cliente.
- **Visão de TV:** Foi criada uma *view* isolada (`tv_public_feed`) para evitar o vazamento de dados sensíveis na interface pública da televisão do Box.
