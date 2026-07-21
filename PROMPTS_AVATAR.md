# PROMPTS_AVATAR — Geração de Peças de Vestuário para Avatar Fitness

> **Versão:** 2.0 — coordenadas CALIBRADAS com as imagens reais das bases
> **Canvas:** 1024×1536 px
> **Bases oficiais:** `public/avatar-bases/base masculina.png` · `public/avatar-bases/base feminina.png`
> **Estilo:** Cartoon 3D Disney/Pixar — jogo fitness mobile premium

---

## Como funciona o encaixe (leia antes de gerar)

O app aplica **encaixe automático** (upload e renderização): ele detecta o
desenho da peça no PNG e o reposiciona/escala para a caixa exata. Por isso,
a posição absoluta no canvas não precisa ser perfeita — o que **precisa**
estar certo na arte é:

1. **Proporção da peça** ≈ proporção da caixa (largura × altura indicadas).
   O encaixe preserva a proporção da arte; se ela for muito diferente da
   caixa, a peça fica menor num dos eixos.
1b. **Formato "vestido", não foto de produto.** A peça deve ser desenhada
   CHAPADA (flat, vista frontal), com a MESMA silhueta que teria vestida na
   base anexada — alças subindo até a linha dos ombros, barra na altura
   certa. Foto de produto em perspectiva 3D (manequim invisível) faz as
   alças "darem a volta por trás" e terminarem soltas no meio do peito
   quando aplicada no avatar.
2. **Peças em par** (munhequeira, luvas, joelheira, tênis): desenhar as
   DUAS unidades no mesmo PNG, com o espaçamento indicado — o encaixe trata
   o conjunto como um bloco único, então a distância entre as duas unidades
   deve corresponder à distância entre os dois pulsos/joelhos/pés da base.
3. **Aberturas vazadas** com alpha=0 de verdade (gola, cavas, punhos etc.).
4. **Somente a peça** — sem corpo, sem fundo, sem sombra projetada.
4b. **Fundo: transparente OU branco liso — NUNCA da cor da peça.** O app
   remove o fundo automaticamente no upload, mas se o gerador entregar a
   peça sobre um fundo **da mesma cor dela** (ex.: short PRETO sobre fundo
   PRETO), as sombras da peça se confundem com o fundo e são apagadas junto
   — sobra só o contorno claro. Regra prática por cor da peça:
   - Peça **escura** (preta/marinho/cinza-escuro) → peça o fundo **BRANCO**.
   - Peça **clara** (branca/bege/cinza-claro) → peça o fundo **PRETO** (ou
     um cinza médio).
   - Fundo xadrez de "transparência" também funciona (o app reconhece).
5. Ao cadastrar o item no Admin, selecione o **Tipo de peça** correspondente
   (M-01..M-10 / F-01..F-10).

---

## Mapa de Coordenadas — BASE MASCULINA (medido na arte real)

```
Canvas 1024 x 1536 — corpo em y 60 → 1530, centralizado em x 512

CABEÇA        y   60 →  310    x 405 → 620 (cabelo/orelhas: 392 → 631)
PESCOÇO       y  310 →  400    x 456 → 567
OMBROS        y  400 →  480    ombro-a-ombro: x 293 → 731
TRONCO        y  400 →  780    (peito/abdômen; braços separam do corpo em y 600)
CÓS DO SHORT  y ≈ 775
QUADRIL/SHORT y  780 → 1015    x 367 → 656
PULSOS        y  810 →  900    esquerdo x 238 → 315 · direito x 706 → 786
MÃOS (punhos) y  860 → 1005
COXA          y  910 → 1120
JOELHOS       y 1070 → 1180    esquerdo x 378 → 485 · direito x 538 → 645
PANTURRILHA   y 1180 → 1400
TORNOZELOS    y 1400 → 1440    esquerdo x 399 → 453 · direito x 571 → 625
PÉS           y 1400 → 1532    esquerdo x 337 → 460 · direito x 565 → 685
```

## Mapa de Coordenadas — BASE FEMININA (medido na arte real)

```
Canvas 1024 x 1536 — corpo em y 60 → 1530, centralizado em x 512

CABEÇA        y   60 →  380    x 375 → 652 (rabo de cavalo à direita: x 594 → 669)
PESCOÇO       y  380 →  440    x 474 → 553
OMBROS        y  440 →  500    ombro-a-ombro: x 351 → 677
TRONCO        y  440 →  725    (top da base: y 495 → 635; braços separam em y 600)
CÓS DO SHORT  y ≈ 725
QUADRIL/SHORT y  725 →  915    x 350 → 674
PULSOS        y  785 →  875    esquerdo x 248 → 315 · direito x 708 → 775
MÃOS (punhos) y  840 →  935
COXA          y  875 → 1140
JOELHOS       y 1090 → 1190    esquerdo x 345 → 447 · direito x 578 → 680
PANTURRILHA   y 1190 → 1380
TORNOZELOS    y 1380 → 1420    esquerdo x 340 → 396 · direito x 628 → 685
PÉS           y 1380 → 1532    esquerdo x 303 → 390 · direito x 635 → 721
```

---

## Template Universal

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base [masculina|feminina].png". Use APENAS para posicionar a peça
sobre o avatar. NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: [X1] → [X2]
- y: [Y1] → [Y2]
- A peça DEVE ocupar exatamente esta caixa, com a MESMA PROPORÇÃO
  largura/altura da caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
[âncora específica da peça]

TAMANHO RELATIVO À BASE:
[tamanho relativo específico]

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
[lista de aberturas]
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (única coisa que você edita por variação):
[COR / MATERIAL / ESTAMPA / DETALHES]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

## MASCULINO — 10 Peças

> Anexar sempre: `base masculina.png` (a de `public/avatar-bases/`)

---

### M-01 · Camiseta

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: ombros e mangas acompanhando os ombros
da base, gola no pescoço, laterais acompanhando o tronco. Pense em
"adesivo da peça vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 270 → 755   (largura 485 px)
- y: 330 → 800   (altura 470 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base (y 330); ombros da peça nos ombros da
base (y 400–480); mangas curtas cobrindo o topo dos braços; barra reta
na altura do cós do short da base (y ≈ 780–800).

TAMANHO RELATIVO À BASE:
Largura = ombro-a-ombro + mangas (≈ 485 px); Altura = pescoço até o cós.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola redonda (centro superior, x ≈ 456–567)
- 2 bocas de manga (esquerda e direita)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: azul royal, tecido dri-fit, logo esportivo no peito esquerdo,
listras laterais brancas]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-02 · Regata

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: ombros e mangas acompanhando os ombros
da base, gola no pescoço, laterais acompanhando o tronco. Pense em
"adesivo da peça vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 300 → 725   (largura 425 px)
- y: 340 → 800   (altura 460 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; cavas largas nos ombros (sem manga);
barra reta na altura do cós do short da base (y ≈ 780–800).

TAMANHO RELATIVO À BASE:
Largura = largura do peito (≈ 425 px); Altura = pescoço até o cós.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola (centro superior)
- 2 cavas laterais (passagem dos braços, esquerda e direita)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: preto, tecido malhado, cavas bem abertas, logo minimalista]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-03 · Jaqueta

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: ombros e mangas acompanhando os ombros
da base, gola no pescoço, laterais acompanhando o tronco. Pense em
"adesivo da peça vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 250 → 775   (largura 525 px)
- y: 320 → 860   (altura 540 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; ombros da jaqueta nos ombros da base
(y 400–480); mangas compridas acompanhando os braços; barra abaixo do
cós, no quadril alto (y ≈ 860).

TAMANHO RELATIVO À BASE:
Largura = ombro-a-ombro + 5% cada lado; Altura = pescoço até quadril alto.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola (centro superior)
- 2 punhos de manga (extremidades das mangas)
- Barra inferior aberta
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: cinza escuro, bomber com zíper central, detalhes em laranja neon,
bolsos laterais com zíper]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-04 · Short

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: cós reto na altura do cós da base e
pernas acompanhando as pernas da base. Pense em "adesivo da peça
vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 355 → 670   (largura 315 px)
- y: 770 → 1020  (altura 250 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Cós alinhado ao cós do short da própria base (y ≈ 775);
barra das pernas no meio da coxa (y ≈ 1015).

TAMANHO RELATIVO À BASE:
Largura = largura do quadril (x 367–656); Altura = cós até meio da coxa.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cintura (abertura superior)
- 2 barras de perna (saídas inferiores, esquerda e direita)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: azul marinho, tecido leve, listras laterais brancas,
elástico na cintura com cordão]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-05 · Calça

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: cós reto na altura do cós da base e
pernas acompanhando as pernas da base. Pense em "adesivo da peça
vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 355 → 670   (largura 315 px)
- y: 770 → 1440  (altura 670 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Cós alinhado ao cós do short da base (y ≈ 775); duas pernas separadas
acompanhando as pernas da base (vão entre as pernas com alpha=0);
barra das pernas nos tornozelos (y ≈ 1420).

TAMANHO RELATIVO À BASE:
Largura = largura do quadril; Altura = cós até tornozelo.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cintura (abertura superior)
- 2 barras de perna nos tornozelos (esquerda e direita)
- Vão entre as duas pernas (do gancho y ≈ 910 para baixo)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: preto, jogger com punho na barra, bolsos laterais,
faixa lateral em cinza refletivo]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-06 · Boné

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — o boné como aparece
vestido na cabeça da base anexada (copa + aba frontal), NÃO foto de
produto em ângulo 3/4.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 390 → 630   (largura 240 px)
- y:  60 → 210   (altura 150 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Copa cobre o topo da cabeça (y 60); aba frontal termina na testa,
ACIMA das sobrancelhas (y ≈ 210) — não pode cobrir os olhos.
Cabeça da base: x ≈ 405–620.

TAMANHO RELATIVO À BASE:
Largura = largura da cabeça (≈ 240 px); Altura = topo da cabeça até a testa.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Abertura inferior (encaixe da cabeça)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: vermelho, aba curva reta, bordado de raio no painel frontal,
fechamento traseiro em velcro]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-07 · Munhequeira (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 238 → 786
- y: 805 → 905   (altura 100 px)
- Posicionar UMA munhequeira em cada pulso da base:
  pulso esquerdo x 238 → 315 · pulso direito x 706 → 786.
- O ESPAÇAMENTO entre as duas munhequeiras deve ser exatamente este
  (elas são tratadas como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Uma munhequeira em cada pulso da base (braços caídos ao lado do corpo,
pulsos na altura y 810–900).

TAMANHO RELATIVO À BASE:
Cada munhequeira: largura = pulso da base (≈ 78 px); altura ≈ 100 px.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Interior do anel de cada munhequeira (buraco central de cada uma)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: branco, tecido atoalhado, borda em azul, logo bordado]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-08 · Luvas (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 225 → 792
- y: 820 → 1015  (altura 195 px)
- Posicionar UMA luva em cada mão da base:
  mão esquerda x 225 → 330 · mão direita x 690 → 792.
- O ESPAÇAMENTO entre as duas luvas deve ser exatamente este
  (elas são tratadas como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Dedos apontados para baixo (mãos fechadas da base); punho da luva no
pulso da base (y ≈ 820); ponta dos dedos em y ≈ 1005.

TAMANHO RELATIVO À BASE:
Cada luva: do punho até a ponta dos dedos da base (≈ 105 px de largura).

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Punho de cada luva (abertura de encaixe no pulso)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: preto com palma em couro sintético vermelho, costuras amarelas,
tiras de velcro no pulso]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-09 · Joelheira (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 378 → 645
- y: 1070 → 1180  (altura 110 px)
- Posicionar UMA joelheira em cada joelho da base:
  joelho esquerdo x 378 → 485 · joelho direito x 538 → 645.
- O ESPAÇAMENTO entre as duas joelheiras deve ser exatamente este
  (elas são tratadas como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Centradas em cada joelho da base (joelhos na altura y 1070–1180).

TAMANHO RELATIVO À BASE:
Cada joelheira: largura = joelho da base (≈ 105 px); altura ≈ 110 px.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Interior do anel de cada joelheira (buraco central de cada uma)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: cinza, neoprene compressivo, reforço frontal em silicone preto,
bordas em amarelo neon]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### M-10 · Tênis (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 330 → 692
- y: 1400 → 1532  (altura 132 px)
- Posicionar UM tênis sob cada pé da base:
  pé esquerdo x 337 → 460 · pé direito x 565 → 685.
- O ESPAÇAMENTO entre os dois tênis deve ser exatamente este
  (eles são tratados como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Solado apoiado na linha do chão (y ≈ 1530); cano na altura do
tornozelo da base (y ≈ 1400); pés da base levemente virados para fora.

TAMANHO RELATIVO À BASE:
Cada tênis: largura = pé da base (≈ 125 px); altura = solado até o cano.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cano superior de cada tênis (abertura de encaixe do pé)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: branco com detalhes em verde limão, solado chunky, cadarço branco,
logo lateral em relevo]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

## FEMININO — 10 Peças

> Anexar sempre: `base feminina.png` (a de `public/avatar-bases/`)

---

### F-01 · Camiseta

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: ombros e mangas acompanhando os ombros
da base, gola no pescoço, laterais acompanhando o tronco. Pense em
"adesivo da peça vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 330 → 700   (largura 370 px)
- y: 400 → 780   (altura 380 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base (y ≈ 410); ombros da peça nos ombros
da base (y 440–500); barra na altura do cós do short da base (y ≈ 725–780).

TAMANHO RELATIVO À BASE:
Largura = ombro-a-ombro + mangas (≈ 370 px); Altura = pescoço até o cós.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola (centro superior, x ≈ 474–553)
- 2 bocas de manga (esquerda e direita)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: rosa chiclete, corte cropped, manga curta bufante,
estampa floral minimalista]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-02 · Top (Sports Bra)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 685   (largura 345 px)
- y: 450 → 640   (altura 190 px)
- A peça DEVE ocupar exatamente esta caixa
  (mesma posição do top que a base já veste).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Alças nos ombros da base (y ≈ 450); barra acima do umbigo (y ≈ 635) —
exatamente sobre o top que a base já veste.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. A silhueta deve ser IGUAL à do
top que a base já veste na imagem anexada: alças que sobem até a linha dos
ombros e terminam no contorno do ombro; decote alto tipo nadador; laterais
acompanhando o tronco. Pense em "adesivo do top vestido", recortado.

TAMANHO RELATIVO À BASE:
Largura = largura do peito (x 351–677); Altura = ombros até costelas baixas.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Decote (abertura superior)
- 2 cavas laterais (esquerda e direita)
- Barra inferior aberta
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: lilás, alças cruzadas nas costas, faixa inferior dupla,
textura canelada]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-03 · Jaqueta

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: ombros e mangas acompanhando os ombros
da base, gola no pescoço, laterais acompanhando o tronco. Pense em
"adesivo da peça vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 310 → 720   (largura 410 px)
- y: 390 → 840   (altura 450 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; ombros nos ombros da base (y 440–500);
mangas compridas acompanhando os braços; barra no quadril alto (y ≈ 840).

TAMANHO RELATIVO À BASE:
Largura = ombro-a-ombro + 5% cada lado; Altura = pescoço até quadril.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola (centro superior)
- 2 punhos de manga (extremidades das mangas)
- Barra inferior aberta
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: branco, corte slim, detalhes em dourado, capuz com zíper lateral]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-04 · Short

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: cós reto na altura do cós da base e
pernas acompanhando as pernas da base. Pense em "adesivo da peça
vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 685   (largura 345 px)
- y: 715 → 1000  (altura 285 px)
- A peça DEVE ocupar exatamente esta caixa
  (mesma posição do short que a base já veste, descendo até meio da coxa).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Cós de cintura alta alinhado ao cós do short da base (y ≈ 725);
barra das pernas no meio da coxa (y ≈ 1000).

TAMANHO RELATIVO À BASE:
Largura = largura do quadril (x 350–674); Altura = cós até meio da coxa.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cintura (abertura superior)
- 2 barras de perna (esquerda e direita)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: coral, cintura alta com amarração, textura suede,
bolso lateral minimalista]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-05 · Calça / Legging

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal plana — NÃO foto de produto
em perspectiva 3D, NÃO manequim invisível. Silhueta IGUAL à da peça
vestida no corpo da base anexada: cós reto na altura do cós da base e
pernas acompanhando as pernas da base. Pense em "adesivo da peça
vestida", recortado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 335 → 690   (largura 355 px)
- y: 715 → 1430  (altura 715 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Cós de cintura alta alinhado ao cós do short da base (y ≈ 725);
duas pernas separadas acompanhando as pernas da base (vão entre as
pernas com alpha=0); barra das pernas nos tornozelos (y ≈ 1400).

TAMANHO RELATIVO À BASE:
Largura = largura do quadril; Altura = cós até tornozelo.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cintura (abertura superior)
- 2 barras de perna nos tornozelos (esquerda e direita)
- Vão entre as duas pernas (do gancho y ≈ 875 para baixo)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: preto, legging compressivo com faixa lateral colorida,
costura flatlock, cintura larga estruturada]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-06 · Boné

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — o boné como aparece
vestido na cabeça da base anexada (copa + aba frontal), NÃO foto de
produto em ângulo 3/4.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 370 → 655   (largura 285 px)
- y:  60 → 225   (altura 165 px)
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Copa cobre o topo da cabeça (y 60); aba frontal termina na testa,
ACIMA das sobrancelhas (y ≈ 225) — não pode cobrir os olhos.
Abertura traseira para o rabo de cavalo (lado direito da imagem,
x ≈ 594–669).

TAMANHO RELATIVO À BASE:
Largura = largura da cabeça (≈ 285 px); Altura = topo da cabeça até a testa.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Abertura inferior (encaixe da cabeça)
- Abertura traseira oval (passagem do rabo de cavalo)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: rosa pastel, aba curva, ajuste traseiro com fecho plástico,
bordado de estrela no painel frontal]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-07 · Munhequeira (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 248 → 775
- y: 785 → 875   (altura 90 px)
- Posicionar UMA munhequeira em cada pulso da base:
  pulso esquerdo x 248 → 315 · pulso direito x 708 → 775.
- O ESPAÇAMENTO entre as duas munhequeiras deve ser exatamente este
  (elas são tratadas como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Uma munhequeira em cada pulso da base (braços caídos ao lado do corpo,
pulsos na altura y 785–875, logo acima das mãos fechadas).

TAMANHO RELATIVO À BASE:
Cada munhequeira: largura = pulso da base (≈ 67 px); altura ≈ 90 px.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Interior do anel de cada munhequeira (buraco central de cada uma)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: lilás com detalhes em prata, tecido atoalhado, borda dupla]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-08 · Luvas (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 218 → 805
- y: 800 → 945   (altura 145 px)
- Posicionar UMA luva em cada mão da base:
  mão esquerda x 218 → 310 · mão direita x 715 → 805.
- O ESPAÇAMENTO entre as duas luvas deve ser exatamente este
  (elas são tratadas como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Mãos fechadas (punhos cerrados, como a base); punho da luva no pulso
da base (y ≈ 800); parte inferior da luva em y ≈ 935.

TAMANHO RELATIVO À BASE:
Cada luva: do punho até cobrir a mão fechada da base (≈ 92 px de largura).

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Punho de cada luva (abertura de encaixe no pulso)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: branco com detalhes em rosa gold, palma texturizada,
tiras de velcro finas no pulso]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-09 · Joelheira (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 345 → 680
- y: 1090 → 1190  (altura 100 px)
- Posicionar UMA joelheira em cada joelho da base:
  joelho esquerdo x 345 → 447 · joelho direito x 578 → 680.
- O ESPAÇAMENTO entre as duas joelheiras deve ser exatamente este
  (elas são tratadas como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Centradas em cada joelho da base (joelhos na altura y 1090–1190).

TAMANHO RELATIVO À BASE:
Cada joelheira: largura = joelho da base (≈ 100 px); altura ≈ 100 px.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Interior do anel de cada joelheira (buraco central de cada uma)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: nude rosado, compressão suave, borda em renda sintética,
reforço frontal em gel transparente]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

### F-10 · Tênis (par)

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

FORMATO DA ARTE (crítico):
Desenho CHAPADO estilo cartoon, vista frontal — as DUAS unidades como
aparecem vestidas na base anexada (mesma orientação e mesmo espaçamento
entre elas), NÃO foto de produto em ângulo.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 295 → 725
- y: 1375 → 1532  (altura 157 px)
- Posicionar UM tênis sob cada pé da base:
  pé esquerdo x 303 → 390 · pé direito x 635 → 721.
- O ESPAÇAMENTO entre os dois tênis deve ser exatamente este
  (eles são tratados como um bloco único no encaixe).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.

ÂNCORA ANATÔMICA:
Solado apoiado na linha do chão (y ≈ 1530); cano na altura do
tornozelo da base (y ≈ 1380).

TAMANHO RELATIVO À BASE:
Cada tênis: largura = pé da base (≈ 90 px); altura = solado até o cano.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cano superior de cada tênis (abertura de encaixe do pé)
Sem forro, sem sombra interna, sem cor de fundo nessas áreas.

ESTILO VISUAL (edite aqui):
[ex.: branco com detalhes em lilás e prata, solado plataforma,
cadarço colorido, logo lateral em relevo perolado]

Saída: PNG 1024x1536 transparente, peça posicionada DENTRO da caixa acima.
```

---

## Resumo das Caixas — Referência Rápida

| ID | Peça | x_min | x_max | y_min | y_max | Base |
|----|------|-------|-------|-------|-------|------|
| M-01 | Camiseta | 270 | 755 | 330 | 800 | masculina |
| M-02 | Regata | 300 | 725 | 340 | 800 | masculina |
| M-03 | Jaqueta | 250 | 775 | 320 | 860 | masculina |
| M-04 | Short | 355 | 670 | 770 | 1020 | masculina |
| M-05 | Calça | 355 | 670 | 770 | 1440 | masculina |
| M-06 | Boné | 390 | 630 | 60 | 210 | masculina |
| M-07 | Munhequeira | 238 | 786 | 805 | 905 | masculina |
| M-08 | Luvas | 225 | 792 | 820 | 1015 | masculina |
| M-09 | Joelheira | 378 | 645 | 1070 | 1180 | masculina |
| M-10 | Tênis | 330 | 692 | 1400 | 1532 | masculina |
| F-01 | Camiseta | 330 | 700 | 400 | 780 | feminina |
| F-02 | Top | 340 | 685 | 450 | 640 | feminina |
| F-03 | Jaqueta | 310 | 720 | 390 | 840 | feminina |
| F-04 | Short | 340 | 685 | 715 | 1000 | feminina |
| F-05 | Legging | 335 | 690 | 715 | 1430 | feminina |
| F-06 | Boné | 370 | 655 | 60 | 225 | feminina |
| F-07 | Munhequeira | 248 | 775 | 785 | 875 | feminina |
| F-08 | Luvas | 218 | 805 | 800 | 945 | feminina |
| F-09 | Joelheira | 345 | 680 | 1090 | 1190 | feminina |
| F-10 | Tênis | 295 | 725 | 1375 | 1532 | feminina |

> Estas caixas são as mesmas de `src/lib/fitting/pieceSpecs.ts` — se uma
> mudar, a outra deve mudar junto.

---

## Fluxo completo para publicar uma peça

1. Copie o prompt da peça, edite só o bloco **ESTILO VISUAL** e envie ao
   gerador de imagem junto com a base correspondente
   (`public/avatar-bases/base masculina.png` ou `base feminina.png`).
2. Confira o PNG: transparente, sem corpo, aberturas vazadas, e no caso de
   pares as duas unidades com o espaçamento indicado.
3. No **Admin → Itens**, preencha o ID/nome, escolha o slot, selecione o
   **Tipo de peça** (M-XX/F-XX) e faça o upload — o encaixe automático
   posiciona a arte na caixa exata antes de salvar.
4. Equipe o item num avatar de teste e confira no Perfil.
