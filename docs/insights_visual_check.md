## Verificação visual local — 25/08/2026

A prévia local subiu em `http://localhost:3000`. Ao acessar `/insights` sem sessão autenticada, o roteador redirecionou para `/login` e exibiu a tela de login do BoxLink. Não foi possível conferir os gráficos com dados reais sem autenticar uma conta; não foi solicitado nem utilizado dado pessoal ou credencial do usuário.

A compilação de produção e o typecheck foram usados como validação estrutural do componente. Para a conferência visual completa, autenticar uma conta de teste e abrir o menu **Insights**; os gráficos ficam na seção **Tendências de recuperação**.
