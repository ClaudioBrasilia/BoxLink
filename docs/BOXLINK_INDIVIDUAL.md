# BoxLink Individual — O Atleta Dono do Próprio Treino

> **Correção de rota:** o BoxLink **não é** um app de leitura de frequência cardíaca.
> A FC é apenas um dos sensores do ecossistema. O BoxLink é uma plataforma de
> **gamificação de treino** — check-in, WOD, duelos, desafios, pontos, loja de
> avatar, clãs e TV do box. O **BoxLink Individual** estende tudo isso para o
> atleta que treina **sem box**: em casa, na garagem, viajando ou em qualquer
> academia.

---

## 1. A ideia em uma frase

O atleta baixa o app, **anota seus próprios treinos** (WOD, desafios, cargas
máximas e observações), **faz seu próprio check-in**, registra seus tempos,
**ganha pontos** — e usa esses pontos **na loja ou em duelos** contra colegas
que também têm o app, convidados por um **código de amigo**.

## 2. Por que é diferente do que existe no mercado

| App do mercado | O que faz | O que falta |
| :--- | :--- | :--- |
| SugarWOD / BTWB | Log de WOD e PRs | Sem economia de pontos, sem duelo, preso ao box |
| Strava | Competição social | Não entende treino funcional/CrossFit (WOD, carga, EMOM) |
| Apps de academia | Check-in e agenda | Nada de gamificação real, zero motivação |

O BoxLink Individual junta os três em um só, com quatro inovações que nenhum concorrente tem juntas:

1. **Check-in solo com economia real** — o primeiro treino registrado no dia
   vale o check-in, que paga XP + coins pela mesma economia do box (bônus
   semanal de 3/4/5/6 treinos incluído). Consistência vira moeda.
2. **PR automático** — ao anotar um treino de força, se a carga superar o
   recorde anterior daquele exercício, o app registra o novo PR sozinho e paga
   bônus. Sem burocracia: anotar o treino já atualiza o histórico de recordes.
3. **Duelo por código de amigo** — cada atleta tem um código único
   (ex.: `KX3M-9RUV`). Basta compartilhar por WhatsApp e qualquer pessoa com o
   app pode ser desafiada, **sem estar no mesmo box e sem treinar no mesmo
   horário** (duelo assíncrono: cada um registra seu resultado quando treinar).
4. **Diário subjetivo cruzado** — cada registro aceita RPE (esforço percebido
   1–10), estado (🔥 ótimo → 🤕 dor) e anotações livres (sono, dieta, dores).
   É a matéria-prima para os insights da Fase 2 ("você rende 15% menos quando
   dorme mal") e, opcionalmente, para a **validação fisiológica por FC** — o
   diferencial descrito no conceito de "Duelo de Intensidade".

## 3. O que já está implementado (esta entrega)

### Banco (migração `20260722_boxlink_individual.sql`)
- `profiles.account_type` — `'box'` ou `'individual'`; conta individual é
  **auto-aprovada** no cadastro (não depende de admin de box).
- `profiles.friend_code` — código único `XXXX-XXXX` gerado por trigger para
  todos os perfis (novos e existentes).
- `training_logs` — o diário: categoria (`wod`, `forca`, `desafio`, `nota`),
  tipo de WOD, descrição, resultado, exercício + carga, RPE, sensação e
  anotações. RLS: cada atleta só vê e edita o próprio diário.

### App
- **Cadastro** com escolha "Sou de um Box" × "Atleta Individual".
- **Página Diário** (`/diario`) — para contas individuais ela assume o lugar
  de destaque na navegação:
  - registro rápido por categoria (WOD / Força / Desafio / Nota);
  - **check-in solo automático** no primeiro treino do dia (+XP/+coins,
    bônus semanal, confete 🎉);
  - **detecção automática de PR** na categoria Força, integrada à tabela
    `personal_records` já usada pelos Benchmarks;
  - **streak** de dias consecutivos de treino;
  - histórico agrupado por dia, com RPE e sensação.
- **Duelo com amigos**: exibição/cópia/compartilhamento do meu código, busca
  de atleta por código e criação de duelo personalizado — usando a mesma
  infraestrutura de duelos, apostas e notificações que já existe. O duelo
  criado aparece na aba Duelos dos dois atletas.

Tudo reutiliza a economia existente (`addReward`, bônus semanal, loja,
avatar): **os pontos do atleta solo compram os mesmos itens e valem nas mesmas
apostas de duelo**.

### Pedir para entrar no Box
O atleta individual escolhe: **segue sozinho ou pede para entrar no box**.
- No Diário, o card "Entrar no Box" envia o pedido (tabela `box_join_requests`).
- No Admin, a seção "Querem entrar no Box" lista os pedidos com nível e XP do
  atleta; aprovar transforma a conta em `box` **mantendo todo o histórico,
  pontos, PRs e diário**; recusar mantém o atleta como individual (que pode
  pedir de novo).
- O atleta é notificado do resultado dentro do app.

## 3.1 Base de planos (premium) — já preparada

O código de atleta é **fixo e permanente** (gerado uma vez, nunca muda), ideal
para compartilhar. A fundação de monetização já está no código, pronta para
"ligar" quando você definir preços:

- Coluna `profiles.plan` (`free` | `premium`) + `plan_expires_at` (validade).
- `src/lib/plan.ts` centraliza **todos** os limites por plano
  (`PLAN_LIMITS`) e os helpers `isPremium(user)` / `planLimits(user)`.
- Recursos já mapeados como premium: **duelo com vários amigos**
  (`maxDuelFriends`), **liga/ranking individual** (`leagueRanking`),
  **histórico ilimitado** (`diaryHistoryDays`), **código personalizado**
  (`customFriendCode`), **duelos ativos simultâneos** (`maxActiveDuels`) e
  **insights avançados** (`advancedInsights`).
- O Diário já exibe um selo premium para o usuário grátis, lido dessa config.

Para lançar um recurso pago, basta ajustar `PLAN_LIMITS` e checar o helper na
tela — nenhuma regra de plano fica espalhada pelo app.

## 4. Planos sugeridos (monetização)

| | **Free** | **Basic (R$ 9,90/mês)** | **Pro (R$ 19,90/mês)** |
| :--- | :--- | :--- | :--- |
| Diário (WOD, PR, notas) | ✅ (30 dias de histórico) | ✅ ilimitado | ✅ ilimitado |
| Check-in solo + pontos | ✅ | ✅ | ✅ |
| Duelos por código | 1 ativo por vez | ✅ ilimitado | ✅ ilimitado + apostas |
| Loja de avatar | itens comuns | ✅ tudo | ✅ tudo + itens exclusivos |
| FC em tempo real / zonas | — | — | ✅ (Duelo de Intensidade) |
| Insights (sono × desempenho) | — | — | ✅ |

## 5. Roadmap

- **Fase 1 (feita):** diário + check-in solo + PR automático + duelo por código.
- **Fase 2:** insights cruzando RPE/sensação/sono com resultados; gráficos de
  evolução de carga por exercício na página Evolução; ligas mensais de atletas
  individuais (ranking global por pontos).
- **Fase 3:** **Duelo de Intensidade** — duelo validado por frequência
  cardíaca (% da FC máxima), em que vence quem se mantém mais tempo na zona
  alvo. Democratiza o duelo: o iniciante pode vencer o atleta de elite, porque
  a régua é o esforço relativo, não o tempo absoluto. A infraestrutura de FC
  (BLE, sessões, FCM por idade) **já existe** no app.
- **Fase 4:** marketplace de recompensas com parceiros (suplementos, acessórios)
  e "temporadas" com passe de batalha.

## 6. Ponte Box × Individual

O mesmo app atende os dois mundos — e é isso que cria o efeito de rede:

- O atleta de box que viaja usa o Diário e não perde streak nem pontos.
- O atleta individual pode ser convidado por um amigo de box para um duelo.
- Quando um box assina o BoxLink, seus alunos individuais migram com todo o
  histórico (mesma conta, `account_type` muda de `individual` para `box`).
