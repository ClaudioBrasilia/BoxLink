# Convites de Time — como funciona

Documento de apoio para capitães e para quem for mexer no código depois.

## O problema que existia

O fluxo antigo tinha três defeitos que se somavam:

1. **A busca era escondida.** O campo de busca ficava dentro de "Gerenciar Time",
   no fim do card do time, sem nenhum rótulo dizendo que servia para convidar.
2. **A busca era exigente.** `ilike` no Postgres não ignora acento, então digitar
   `joao` não encontrava `João`. O atleta simplesmente não aparecia na lista —
   e quem já estava em outro time também sumia, sem explicação.
3. **O convite não chegava em lugar nenhum.** Pior: não existiam políticas de RLS
   permitindo que o **próprio atleta** aceitasse ou recusasse o convite, nem que
   saísse do time. As ações falhavam em silêncio (o código antigo só verificava
   `if (!error)` e não mostrava nada), o que dava a impressão de que convidar
   "não funcionava".

## O fluxo novo

### Convidar por busca (capitão)

1. Aba **Times** → card **Seu Time** → botão **Convidar** (canto superior direito).
2. Digite **2 letras** do nome ou do e-mail. A busca ignora acento e maiúsculas.
3. Cada resultado mostra o motivo quando o atleta não pode receber o convite:
   "Já está no seu time", "Convite já enviado", "Pediu para entrar",
   "Já está em outro time".
4. Toque em **Convidar**. O atleta recebe o convite como `status = 'invited'`.

### Convidar por código/link (funciona sem procurar ninguém)

No mesmo modal, a seção **Código do time** mostra o código (ex.: `A1B2C3`):

- **Copiar código** — manda só o código.
- **Compartilhar** — usa o compartilhamento nativo do celular (WhatsApp etc.) com
  o texto do convite e o link `.../clans?convite=A1B2C3`.

Quem receber o link cai na tela de Times com o código já preenchido; quem receber
só o código digita no card **Tem um código de convite?**, que aparece para quem
ainda não tem time.

Ao entrar por código:

- se havia um convite pendente daquele time, ele vira **aprovado** na hora;
- se o box usa aprovação automática, entra direto;
- caso contrário, vira uma **solicitação** que o capitão aprova.

### Aceitar ou recusar (atleta)

- **Na tela inicial:** aparece um card "Convite de time" logo abaixo do cabeçalho,
  com os botões Aceitar e Recusar.
- **Na aba Times:** o bloco "Convite Recebido" continua existindo, com o banner
  do time.

## Banco de dados

A migration `supabase/migrations/20261122_clan_invites.sql` precisa ser aplicada.
Ela cria:

| Objeto | Para quê |
| --- | --- |
| `search_normalize(text)` | Remove acento e baixa a caixa, no banco. |
| `profiles.search_name` (coluna gerada) | Busca tolerante por nome, indexável. |
| `clans.invite_code` (único, com default) | Código curto de convite por time. |
| Política `Users can answer their own invite` | `update` na própria linha `invited`. |
| Política `Users can drop their own membership` | `delete` da própria linha (recusar convite, sair do time). |

Sem a migration o app continua funcionando, mas em modo degradado: a busca cai
para `ilike` por nome/e-mail (sem ignorar acento) e o código do time aparece
como "—", porque a coluna não existe.

## Arquivos envolvidos

- `src/lib/clanInvite.ts` — normalização da busca, código/link, estado do candidato.
- `src/lib/clanInvite.test.ts` — testes dessas funções puras.
- `src/components/ClanInviteBanner.tsx` — aviso de convite na tela inicial.
- `src/pages/Clans.tsx` — botão Convidar, modal, entrada por código.
