# Regras de Gamificação e Economia Virtual

## 1. Moedas e Experiência
O sistema opera com duas métricas de progressão independentes:
- **XP (Experience Points):** Define o Nível do atleta. Não é consumível.
- **BrazaCoins (BC):** Moeda virtual de troca. Pode ser gasta na loja para comprar itens visuais para o Avatar.

## 2. Níveis (Level Up)
- A cada **100 XP** acumulados, o atleta sobe de nível.
- Toda vez que o atleta sobe de nível, ele recebe automaticamente um prêmio bônus em BrazaCoins (gerenciado via trigger/função no banco de dados).

## 3. Ações Recompensadas
A economia é balizada pelas seguintes ações:
- **Check-in na Aula:** Rende XP e BC (valores parametrizados via painel Admin).
- **Consistência Semanal:** O sistema bonifica atletas que treinam 3, 4, 5 ou mais dias consecutivos na semana (Weekly Bonus).
- **Conclusão de Desafios:** Tarefas esporádicas.
- **Vitória em Duelo:** O vencedor leva o pote das moedas apostadas no duelo.

## 4. Medidas Anti-Cheat
Para evitar que alunos forjem resultados:
- **Validação de Raio:** O check-in obriga a validação via API de Geolocalização do dispositivo nativo contra as coordenadas estáticas do Box.
- **Idempotência no Backend:** As funções de crédito de XP/BC (ex: `perform_daily_checkin`) conferem se a ação já foi registrada no dia corrente antes de creditar o saldo.
