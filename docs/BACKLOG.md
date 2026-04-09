# Backlog do MVP (Mínimo Produto Viável)

Este documento acompanha as tarefas de engenharia e os "Épicos" necessários para construir ou estabilizar a primeira versão comercial (MVP) do **CrossCity Hub (BoxLink)**. Tira a subjetividade do projeto e foca em engenharia.

---

### Epic 1: Fundação do App e Onboarding
- [ ] Concluir o Fluxo de *Sign in / Sign up* com Supabase.
- [ ] Garantir que novos usuários entrem na plataforma apenas com status 'Pendente', aguardando a liberação global de um Admin.
- [ ] Mapear o contexto global (`AuthContext`) da aplicação segurando em memória o Perfil com seus atributos sensíveis e sua restrição de tela (via `role`).
- [ ] Validar telas de Login / Splash (Design)

### Epic 2: Módulo Check-in & Autenticação Geográfica
- [ ] Implementar integração nativa/web com GPS utilizando *Capacitor Geolocation API*
- [ ] Implementar a fórmula de Háversine no frontend (ou como função DB RLS) para negar check-ins que fujam do raio (radius e lat/lng puxadas de `box_settings`) 
- [ ] Criar trigger via Função DB para adicionar a quantidade X de XP e Coins na hora que a linha for gerada na tabela de `checkins`.
- [ ] Alertar ao usuário sobre sucesso de *Weekly Bonus* (Sequência de check-in).

### Epic 3: WOD Player Dinâmico
- [ ] Criar tela Admin onde os Coaches dão inputs para criar a row da tabela `wods`.
- [ ] Construir os blocos visuais de "Warm Up, Skill, WOD" usando o Framer Motion. 
- [ ] Permitir a inserção na tabela `wod_results` vinculada ao usuário após o último passo do WOD. 

### Epic 4: O "Hub" (Gameficado, Duels e TV)
- [ ] Construir Tela Pública "Dashboard da TV". Uma visualização reativa auto-scroll baseada nas regras das views públicas (RLS Bypass).
- [ ] Desenhar lógica do fluxo de Duelos Onde um Atleta 'Desafia > Paga Antecipado' e outro 'Aceita > Luta'.
- [ ] Loja do Avatar: Mostrar grade de `items` dinamicamente conforme jsonb da base de `avatar_inventory`. Fazer compra debitar *BrazaCoins*.

---

## Para Desenvolvedores (Prioridade Diária)
Se estiver em dúvida em qual tarefa focar amanhã: 
1. Escolha **UMA** tarefa acima. 
2. Realize a modificação isolada relacionada a ela.
3. Suba um branch, crie o Commit com os testes passados.
