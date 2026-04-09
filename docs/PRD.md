# Product Requirements Document (PRD) - CrossCity Hub (BoxLink)

## 1. Visão Geral
O **CrossCity Hub** é um ecossistema digital de alta performance focado na retenção e engajamento de alunos em boxes de CrossFit. O sistema utiliza gamificação e economia virtual para incentivar a frequência e o desempenho dos atletas.

## 2. Público-Alvo
- **Atletas (Alunos):** Frequentadores do box que desejam acompanhar sua evolução, registrar WODs e interagir com a comunidade através de rankings e duelos.
- **Coaches (Treinadores):** Profissionais responsáveis por gerenciar os treinos do dia, registrar WODs e acompanhar as presenças (check-ins).
- **Administradores (Donos do Box):** Gestores que precisam aprovar novos usuários, gerenciar a loja virtual (Avatares), configurar as coordenadas de GPS do box e monitorar os alunos.

## 3. Interfaces
1. **Aplicativo Móvel Gamificado:** Construído em web e compilado via Capacitor para Android e iOS. Funciona como o portal pessoal do atleta.
2. **Dashboard para TV:** Uma visão otimizada para ser exibida nos monitores do box, apresentando de forma automática o WOD, cronômetro, quem fez check-in e líderes do ranking diário.

## 4. Funcionalidades Core (MVP)
- **Check-in Geolocalizado:** Validação da presença do aluno apenas se ele estiver dentro do raio geográfico do box.
- **WOD Player e Histórico:** Visualização das etapas do treino (Warm Up, Skill, WOD) e registro de resultados (RX ou Scaled).
- **Leaderboard Global e Diário:** Ranking dinâmico baseado no XP, quantidade de check-ins e performance no WOD.
- **Sistema de Duelos:** Atletas podem desafiar uns aos outros para bater metas (ex: 500m de remo).
- **Desafios e Conquistas:** Tarefas pontuais criadas pela administração que rendem bônus.
- **Avatar e Loja:** Customização de perfil utilizando a moeda virtual do jogo (BrazaCoins).

## 5. Casos de Uso
- **Cenário 1:** O aluno chega ao box, abre o app, o sistema valida seu GPS e libera o check-in. O aluno ganha +10 XP e +5 BrazaCoins.
- **Cenário 2:** O coach lança o WOD do dia na plataforma. Ele aparece instantaneamente no app dos alunos e no Dashboard da TV.
