# Retenção de dados no Perfil

O que o app apaga sozinho, o que só sai quando o atleta pede e por que a limpeza
do histórico de recompensas não pode ser um `delete` solto.

## Histórico de recompensas: automático e com trava

O `reward_history` é a fonte de várias telas, cada uma lendo uma janela
diferente:

| Tela | Janela que lê |
| --- | --- |
| Dashboard, Ranking, Diário, TV, Liga | desde o início do mês corrente |
| Times | desde o início da temporada aberta (XP do time) |
| Desafios | todas as linhas com `type = 'challenge'` |

Por isso a limpeza roda no banco, na função `prune_my_reward_history`, e não no
cliente: ela calcula um corte que é a **mais antiga** dessas janelas e só apaga
o que está antes dele. Na prática:

- nada do mês corrente é apagado;
- nada de dentro da temporada aberta do time é apagado (temporada longa segura
  o histórico por mais tempo, de propósito);
- linhas de desafio ficam para sempre, porque alimentam a tela Desafios.

O app chama a função **uma vez por dia**, quando o atleta abre o Perfil. A marca
do último dia fica no `localStorage`; se a chamada falhar (migration não
aplicada), a marca não é gravada e ele tenta de novo no próximo acesso.

No Perfil também dá para forçar a limpeza com "mais de 1 mês" ou "mais de 2
meses" — os mesmos limites de segurança valem, então o botão nunca come o mês
corrente nem a temporada.

## Check-ins: manual

"Limpar histórico antigo" no calendário apaga check-ins com mais de 6 ou 12
meses. Aqui é `delete` direto, porque nada soma XP a partir da tabela
`checkins` — ela alimenta frequência, calendário e conquistas de presença.
O XP desses treinos já está no perfil e nas linhas de `reward_history`.

## Histórico de FC: manual

A seção começa fechada (batimento, duração e calorias são dados de saúde) e tem
"Excluir histórico" para apagar todos os treinos de FC do atleta, além do
trash por treino. Apagar sessões de FC reduz o sinal de cardio usado na
prontidão — é o efeito esperado.

## Migration necessária

`supabase/migrations/20261122_reward_prune.sql` cria a função e libera execução
para `authenticated`. Sem ela, a limpeza automática não roda e os botões do
Perfil avisam que a função não está disponível.
