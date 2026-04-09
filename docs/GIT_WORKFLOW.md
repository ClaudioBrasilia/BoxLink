# 🛠️ Procedimentos Git - BoxLink (CrossCity Hub)

Este guia descreve o fluxo de trabalho colaborativo para manter o projeto organizado e sincronizado.

## 1. Configurando o Repositório Original (Upstream)
Ao trabalhar com um fork, você deve configurar o repositório principal para receber atualizações.

```powershell
# Adiciona o original como 'upstream'
git remote add upstream https://github.com/ClaudioBrasilia/BoxLink.git

# Verifica os remotes configurados
git remote -v
```

## 2. Sincronizando seu Fork
Sempre sincronize sua base local antes de iniciar uma nova tarefa.

```powershell
# Atualiza os dados do upstream
git fetch upstream

# Vai para o branch principal e mescla as mudanças
git checkout main
git merge upstream/main

# Atualiza seu GitHub remoto
git push origin main
```

## 3. Fluxo de Desenvolvimento (Feature Branches)
Nunca trabalhe diretamente no `main`. Crie branches específicos para cada tarefa.

```powershell
# Cria e muda para um novo branch
git checkout -b feature/nome-da-tarefa

# Após realizar as alterações
git add .
git commit -m "feat: descrição clara da mudança"
git push origin feature/nome-da-tarefa
```

## 4. Enviando Modificações (Pull Requests)
1. Vá até o seu repositório no GitHub (`https://github.com/rossisneto/BoxLink`).
2. Você verá um banner "Compare & pull request" para o branch que acabou de enviar.
3. Clique e descreva o que foi feito.
4. O dono do projeto original (`ClaudioBrasilia`) poderá revisar e aceitar suas mudanças.

## 5. Boas Práticas de Commit
Seguimos o padrão **Conventional Commits**:
- `feat:` Novas funcionalidades.
- `fix:` Correções de bugs.
- `docs:` Alterações em documentação.
- `style:` Formatação e estilo (sem mudança de lógica).
- `refactor:` Mudança no código que não altera comportamento.
