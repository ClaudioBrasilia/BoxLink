# ADR 0003: Simplificação do Gerenciamento de Estado Global

## Contexto
Sempre ao lidar com reatividade cruzada (exemplo: quando o usuário termina um WOD, o salto na carteira de BrazaCoins do header precisa atualizar imediatamente), o React tem várias bibliotecas como Redux, Zustand ou Jotai para evitar "prop drilling" excessivo.

## Decisão
Para manter o princípio "Start Simple", **não adotaremos** gerenciadores complexos ou focados em requests externos (como React Query) **na fase MVP**. 

Vamos utilizar a nativa **React Context API** (`src/context/AuthContext` ou novos contextos) exclusivamente para os casos nos quais os dados sejam 100% transversais:
1. Perfil completo do usuário (Status logado).
2. Preferência de Tema (Modo Escuro / Claro).

Para listagens massivas ou atualizações constantes em tempo-real (como o Dashboard da TV), usaremos os **Supabase Realtime Subscriptions** gerenciados por *local state* ou *custom hooks* básicos ligados a cada componente.

## Consequências
- Pode levar a pequenos sobre-renders na árvore de componentes se os contextos não forem finamente separados.
- Fica estritamente proibido criar um "GlobalContext" com dezenas de variáveis de objetos desvinculados, para não ferir o lifecycle da raiz (`App.tsx`).
