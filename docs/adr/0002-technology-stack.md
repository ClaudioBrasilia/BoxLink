# ADR 0002: Adoção da Stack Tecnológica (React 19, Supabase, Tailwind)

## Contexto
Precisamos de um ecossistema que funcione perfeitamente com alta reatividade no frontend e forte consistência no back-end para um modelo de gamificação. É necessário escalar de web app para mobile app rapidamente.

## Decisão
Foi escolhido utilizar:
1. **React 19 + Vite**: Melhor velocidade de re-renderização nativa com os novos hooks e o compilador muito veloz.
2. **Capacitor 8**: Permite programar nativamente em React e portar diretamente para a App Store e Google Play como WebViews dinâmicas (economizando drástico tempo de reescrita versus React Native).
3. **Supabase (PostgreSQL + RLS)**: Atua como BaaS. Ao usar suas Row Level Security functions (RPCs), evitamos ter um servidor Node.js intermediário apenas para checar saldos das moedas, reduzindo pontos de falha no MVP.
4. **Tailwind CSS v4 + Framer Motion**: Padronização global de tokens flexíveis, permitindo as micro-interações de gamificação de forma barata em processamento.

## Consequências
- Toda a segurança do projeto cai no colo do **PostgreSQL (Supabase)**. Ninguém está autorizado a dar 'Bypass' via Service Keys em rotinas de pontuação de usuários.
- A compilação é única, o que exige testes responsivos (Testar no celular será mandatório em cada design).
