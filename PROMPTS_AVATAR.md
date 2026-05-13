# Plano — 1 prompt único por peça, com CAIXA EXATA NO CANVAS

Vou usar as 2 bases novas que você acabou de enviar como referência oficial. Cada prompt vai trazer a **caixa exata no canvas 1024×1536** (x_min, y_min → x_max, y_max), uma **âncora anatômica** ("ombros nos ombros da base, gola no pescoço") e um **tamanho relativo** travado — assim a IA não centraliza a peça no meio da imagem, ela cai no lugar certo do corpo.

## Bases oficiais (substituídas pelas novas)

- `public/avatar-bases/base-masculina.png` ← `base_masculina-3.png` (já copiada)
- `public/avatar-bases/base-feminina.png` ← `base_feminina-2.png` (já copiada)
- Espelho download: `/mnt/documents/avatar-bases/*.png`

Toda peça é gerada em canvas **1024×1536** alinhado a essas bases.

## Mapa de coordenadas das bases (medido nas imagens novas)

```
Canvas 1024 x 1536

         x:0 ────────────────────────── x:1024
y:0     ┌───────────────────────────────┐
        │           CABEÇA               │  y 60  → 310    (boné/cabelo)
y:310   │           PESCOÇO              │  y 290 → 360
        │  ┌─────────────────────────┐   │
        │  │       OMBROS            │   │  y 320 → 420
        │  │       TRONCO            │   │  y 360 → 720
        │  │  (camiseta/top/jaqueta) │   │
y:720   │  └─────────────────────────┘   │
        │      QUADRIL / SHORT           │  y 720 → 950
        │      ┌────────┐                │
y:950   │      │        │                │
        │      │ COXA   │                │  y 950 → 1230
        │      │        │                │
y:1230  │      │ JOELHO │                │  y 1180 → 1290 (joelheira)
        │      │ PANTUR.│                │  y 1230 → 1430
y:1430  │      └─PÉS────┘                │  y 1430 → 1530 (tênis)
y:1536  └───────────────────────────────┘

Pulsos (mãos baixas):     y 880 → 1000
Largura ombro-a-ombro M:  x 310 → 700  (≈ 390 px)
Largura ombro-a-ombro F:  x 360 → 660  (≈ 300 px)
Largura quadril M:        x 360 → 670
Largura quadril F:        x 370 → 660
```

Esses números entram literalmente em cada prompt.

## Template universal (usado em TODAS as 20 peças)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base-[masculina|feminina].png". Use APENAS para posicionar a peça
sobre o avatar. NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: [X1] → [X2]
- y: [Y1] → [Y2]
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
[ex.: gola alinhada ao pescoço da base; ombros da peça nos ombros da base;
barra na linha da cintura]

TAMANHO RELATIVO À BASE:
[ex.: largura = ombro-a-ombro da base; altura = pescoço até cintura]

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
[lista de aberturas]
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (única coisa que você edita por variação):
[COR / MATERIAL / ESTAMPA / DETALHES]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

## Caixas + âncoras + aberturas — 20 peças

### MASCULINO (base-masculina.png)

| Peça | Caixa x | Caixa y | Âncora | Tamanho | Aberturas |
|---|---|---|---|---|---|
| Camiseta | 280 → 740 | 320 → 720 | gola no pescoço, ombros nos ombros, barra na cintura | larg = ombro-a-ombro; alt = pescoço→cintura | gola redonda, 2 bocas de manga |
| Regata | 300 → 720 | 330 → 720 | gola no pescoço, cavas largas nos ombros | larg = peito; alt = pescoço→cintura | gola, 2 cavas (passagem dos braços) |
| Jaqueta | 240 → 780 | 310 → 760 | gola no pescoço, ombros nos ombros, barra abaixo da cintura | larg = ombro+5%; alt = pescoço→quadril alto | gola, 2 punhos, barra inferior |
| Short | 340 → 690 | 720 → 960 | cintura no quadril, barra meio da coxa | larg = quadril; alt = quadril→meio coxa | cintura, 2 barras de perna |
| Calça | 340 → 690 | 720 → 1430 | cintura no quadril, barra no tornozelo | larg = quadril; alt = quadril→tornozelo | cintura, 2 barras de perna |
| Boné | 340 → 680 | 60 → 280 | aba sobre testa, copa cobre topo da cabeça | larg = cabeça; alt = topo→testa | abertura inferior (encaixe da cabeça) |
| Munhequeira (par) | 220 → 820 | 880 → 1000 | uma em cada pulso da base | altura = 80 px cada | interior do anel de cada uma |
| Luvas (par) | 180 → 860 | 880 → 1040 | dedos para baixo, encaixe no pulso | dedo→punho da base | punho de cada luva |
| Joelheira (par) | 360 → 670 | 1180 → 1290 | centradas em cada joelho | altura = 110 px cada | interior do anel de cada uma |
| Tênis (par) | 340 → 690 | 1430 → 1530 | sob cada pé da base | larg = pé; alt = solado→cano | cano superior de cada tênis |

### FEMININO (base-feminina.png)

| Peça | Caixa x | Caixa y | Âncora | Tamanho | Aberturas |
|---|---|---|---|---|---|
| Camiseta | 310 → 720 | 320 → 720 | gola no pescoço, ombros nos ombros, barra na cintura | larg = ombro-a-ombro; alt = pescoço→cintura | gola, 2 bocas de manga |
| Top (sports bra) | 340 → 690 | 340 → 560 | alças nos ombros, barra acima do umbigo | larg = peito; alt = ombros→costelas baixas | decote, 2 cavas, barra inferior |
| Jaqueta | 270 → 760 | 310 → 760 | gola no pescoço, ombros nos ombros, barra no quadril alto | larg = ombro+5%; alt = pescoço→quadril | gola, 2 punhos, barra inferior |
| Short | 350 → 680 | 720 → 940 | cintura alta no quadril, barra meio da coxa | larg = quadril; alt = quadril→meio coxa | cintura, 2 barras de perna |
| Calça/Legging | 350 → 680 | 720 → 1430 | cintura alta, barra no tornozelo | larg = quadril; alt = quadril→tornozelo | cintura, 2 barras de perna |
| Boné | 360 → 660 | 60 → 280 | aba sobre testa, abertura traseira para rabo de cavalo | larg = cabeça; alt = topo→testa | abertura inferior + abertura traseira |
| Munhequeira (par) | 240 → 800 | 880 → 1000 | uma em cada pulso | altura = 80 px cada | interior do anel de cada uma |
| Luvas (par) | 200 → 840 | 880 → 1040 | dedos para baixo, encaixe no pulso | dedo→punho | punho de cada luva |
| Joelheira (par) | 370 → 660 | 1180 → 1290 | centradas em cada joelho | altura = 110 px cada | interior do anel de cada uma |
| Tênis (par) | 350 → 680 | 1430 → 1530 | sob cada pé da base | larg = pé; alt = solado→cano | cano superior de cada tênis |

## Entregáveis

| Arquivo | Conteúdo |
|---|---|
| `PROMPTS_AVATAR.md` | Reescrito: remove o pipeline de 2 etapas. Adiciona seção **"Prompt único com caixa exata"** contendo o template universal + 20 prompts já preenc
