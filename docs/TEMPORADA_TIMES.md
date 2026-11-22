# Temporada de Times — critérios de ranking

Ao abrir uma temporada (Times → Admin → Nova Temporada), além de **nome**,
**início** e **fim**, o admin escolhe **como o ranking é decidido**. A escolha
fica gravada em `box_settings.current_season` e vale para toda a temporada.

Temporadas antigas (sem esses campos) continuam usando o critério histórico:
**XP Total**.

## Janela de tempo

Todas as métricas contam apenas o que aconteceu entre o **início** e o **fim**
da temporada, e apenas de **membros aprovados** do time. Sem temporada aberta,
o fallback é o mês corrente.

## Critérios

São três na tela. Os três primeiros substituíram os antigos (média por atleta,
frequência e engajamento), que eram o mesmo dado visto de ângulos diferentes.

| Critério | Fórmula | Para que serve |
|---|---|---|
| ⚡ **XP Total** | soma do XP dos membros | Padrão. Simples e direto — mas times maiores levam vantagem. |
| 🎯 **XP dos Melhores** | soma do XP dos **N** melhores atletas | Mantém a lógica de soma e tira a vantagem de ter mais gente. |
| 🏁 **Resultado de WOD** | pontos por colocação nos WODs · **menor soma vence** | Ranking de competição, como em um campeonato. |

O **N** dos critérios de "melhores" é escolhido na mesma tela (padrão **6**,
faixa 1–50) e fica gravado em `current_season.top_n`.

### Critérios antigos (legado)

`avg_xp` (Média por Atleta), `checkins` (Frequência) e `engagement`
(Engajamento) **continuam válidos no código** e continuam sendo lidos do banco:
uma temporada já aberta com um deles segue sendo calculada e exibida do mesmo
jeito. Eles só não aparecem mais no seletor (`deprecated: true` em
`CRITERIA_OPTIONS`, filtrados por `SELECTABLE_CRITERIA`). Apagar as opções
faria `normalizeRankingConfig()` cair no fallback `total_xp` e mudaria
silenciosamente o resultado de temporadas antigas.

## O que pontua no XP do time

Só entram as fontes que têm **trava de repetição** — o que pode ser registrado
várias vezes no mesmo dia fica de fora, senão dá para inflar o time sem treinar.

| Conta | Trava |
|---|---|
| `checkin` — check-in na aula ou solo | 1x por dia |
| `wod` — resultado no placar do dia | 1x por dia |
| `wod_complete` — WOD do box | 1x por WOD publicado |
| `challenge` — desafio do box | 1x por desafio |
| `weekly_bonus` — bônus semanal de frequência | 1x por semana/faixa |

| Não conta | Por quê |
|---|---|
| `duel` — vitória em duelo | 40 XP por vitória, sem teto; dois colegas do mesmo time podem duelar em série com WOD personalizado e resultado digitado à mão |
| `pr` — novo PR no Diário | 30 XP a cada carga que supere a anterior, sem incremento mínimo (100 → 100,5 → 101kg) |
| `level_up` | sempre 0 XP — é bônus só em moedas |

Duelo e PR **continuam dando XP, moedas e nível ao atleta** e contam na Liga
individual. A restrição vale só para a pontuação da temporada de times.

A lista fica em `SEASON_XP_TYPES` (`src/lib/clanRanking.ts`) e é aplicada em
dois lugares: no `.in('type', …)` da consulta e de novo no agregador, via
`countsForSeason()`.

## Resultado de WOD (modo competição)

Regra padrão de competição de CrossFit: em cada WOD o **1º lugar ganha 1
ponto**, o 2º ganha 2, o 3º ganha 3 — e **quem somar menos vence**.

- **Fonte:** `wods` + `wod_results` (o WOD do box, publicado pelo coach). É o
  único lugar onde todo mundo fez o **mesmo** treino, que é o que uma
  comparação precisa. O placar do dia (`daily_wod_results`) fica de fora de
  propósito: ali cada atleta posta o WOD que quiser, então dois atletas do
  mesmo dia podem ter feito treinos diferentes.
- **Quem conta:** os **N melhores** atletas do time (o mesmo N do seletor). O
  time soma os pontos deles.
- **Quem não fez o WOD:** não entra na soma. Zero ponto de quem não jogou seria
  o **melhor** resultado possível e colocaria time vazio em 1º lugar.
- **Time sem nenhum WOD:** aparece no fim do ranking com `—` no lugar dos
  pontos (`score = Infinity`).
- **Empate no WOD:** mesma colocação (1, 1, 3) — o próximo herda a posição
  seguinte, como em planilha de competição.
- **Resultado ilegível:** entra em último naquele WOD (`dnf`), sem quebrar a
  conta.
- **Duas linhas no mesmo WOD** (o banco não trava isso): vale a melhor marca,
  menor tempo ou mais reps.
- **Conversão do resultado:** a mesma do placar do dia (`parseWodResult`).
  `"12:45"` → segundos; `"5+12"` (AMRAP) → rounds × 1000 + reps; o resto vira
  número puro. O tipo do WOD (`isTimeBasedType`) decide a direção.
- **Divisões:** RX e Scaled são ranqueados **juntos**, igual ao placar do dia
  (`WodPlacarRanking`), que já permite filtrar por divisão na visualização.
  Separar as divisões no cálculo é uma decisão futura — precisa decidir antes o
  que fazer com divisão que tem um atleta só (levaria 1 ponto de graça).

## Desempate

Se dois times empatarem no critério, o admin escolhe o desempate:

- **Mais check-ins** (padrão)
- **Maior média** por atleta
- **Time menor** — fez o mesmo com menos gente
- **Criado primeiro**

Persistindo o empate, vence o time **criado primeiro** (e, em último caso, o
id) — a ordem nunca fica aleatória.

## Onde aparece

- **Card "Como o Ranking Funciona"** (na página Times, aberto a todos os
  atletas): explica o critério em vigor, o desempate, o período que conta e
  quanto XP cada atividade dá — os valores saem de `box_settings.rewards`, então
  acompanham o que o box configurou. No modo competição, o bloco 4 troca a
  tabela de XP pela tabela de pontos por colocação.
- Banner da temporada e cabeçalho do ranking mostram o critério em vigor.
- O card de cada time mostra o valor do critério + as métricas secundárias
  (no modo competição: quantos WODs o time fez e quantos atletas entraram na
  conta). A barra de progresso é **invertida** nesse modo: a barra cheia é do
  menor número.
- O modal de detalhes mostra os pontos de WOD, os WODs feitos e o XP total,
  com o critério em vigor destacado, e a contribuição de cada atleta
  (`X pts · Y WODs`, menor pontuação primeiro).
- O painel do admin mostra critério e desempate da temporada em andamento.

## Código

- `src/lib/clanRanking.ts` — critérios, desempates, ordenação e formatação
  (puro, testado em `src/lib/clanRanking.test.ts`).
- `src/lib/wodCompetition.ts` — ranking de cada WOD, pontos por colocação e
  agregação por atleta (puro, testado em `src/lib/wodCompetition.test.ts`).
- `src/pages/Clans.tsx` — coleta das métricas na janela da temporada e UI.
