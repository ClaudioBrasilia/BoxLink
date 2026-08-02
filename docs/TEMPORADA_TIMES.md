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

A fonte é a `reward_history`: cada linha tem o XP ganho e o tipo do evento.

## O que pontua para o time

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

## Critérios

| Critério | Fórmula | Para que serve |
|---|---|---|
| ⚡ **XP Total** | soma do XP dos membros | Padrão. Simples e direto — times maiores levam vantagem. |
| ⚖️ **Média por Atleta** | XP do time ÷ nº de membros | Times de tamanhos diferentes competem de igual para igual. |
| 📅 **Frequência** | total de check-ins do time | Premia quem aparece no box, não quem soma mais pontos. |
| 🔥 **Engajamento** | média por atleta × % de membros que pontuaram | Evita o time carregado por um atleta só. |

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
  acompanham o que o box configurou.
- Banner da temporada e cabeçalho do ranking mostram o critério em vigor.
- O card de cada time mostra o valor do critério + as métricas secundárias.
- O modal de detalhes mostra XP total, média e check-ins lado a lado, com o
  critério em vigor destacado.
- O painel do admin mostra critério e desempate da temporada em andamento.

## Código

- `src/lib/clanRanking.ts` — critérios, desempates e ordenação (puro, testado
  em `src/lib/clanRanking.test.ts`).
- `src/pages/Clans.tsx` — coleta das métricas na janela da temporada e UI.
