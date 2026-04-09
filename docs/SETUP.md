# Guia de Instalação e Ambiente de Desenvolvimento

## 1. Pré-requisitos
- Node.js (v18 ou superior)
- NPM, Yarn ou PNPM
- Android Studio (para builds Android)
- Xcode (apenas em macOS, para builds iOS)
- Projeto criado no [Supabase](https://supabase.com)

## 2. Instalação e Execução Local
1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```

2. Crie um arquivo `.env.local` na raiz do projeto contendo as chaves do seu projeto Supabase:
   ```env
   VITE_SUPABASE_URL=sua_url_do_projeto
   VITE_SUPABASE_ANON_KEY=sua_chave_publica_anonima
   ```

3. Execute o servidor de desenvolvimento web:
   ```bash
   npm run dev
   ```

## 3. Configuração do Supabase
Para replicar a estrutura de banco de dados do projeto:

1. Navegue até a pasta `supabase/migrations`.
2. Execute os scripts SQL no seu banco do Supabase, seguindo rigorosamente a ordem sequencial dos arquivos (de 0001 em diante).
3. Isso configurará automaticamente as tabelas, RLS e funções de segurança.

## 4. Gerando Aplicativo Mobile Nativo
O projeto utiliza o Capacitor para compilar o React em um app nativo.

1. Gere o build otimizado da aplicação web:
   ```bash
   npm run build
   ```

2. Sincronize os arquivos web com os projetos nativos:
   ```bash
   npx cap sync
   ```

3. Abra a IDE nativa para emular ou compilar:
   ```bash
   npx cap open android
   # ou
   npx cap open ios
   ```
