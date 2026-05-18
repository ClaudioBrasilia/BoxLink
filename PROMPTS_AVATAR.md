# PROMPTS_AVATAR — Geração de Peças de Vestuário para Avatar Fitness

> **Versão:** Prompt único com caixa exata no canvas  
> **Canvas:** 1024×1536 px  
> **Bases oficiais:** `base-masculina.png` · `base-feminina.png`  
> **Estilo:** Cartoon 3D Disney/Pixar — jogo fitness mobile premium

---

## Mapa de Coordenadas das Bases

```
Canvas 1024 x 1536

         x:0 ────────────────────────── x:1024
y:0     ┌───────────────────────────────┐
        │           CABEÇA               │  y  60 →  310   (boné/cabelo)
y:310   │           PESCOÇO              │  y 290 →  360
        │  ┌─────────────────────────┐   │
        │  │       OMBROS            │   │  y 320 →  420
        │  │       TRONCO            │   │  y 360 →  720
        │  │  (camiseta/top/jaqueta) │   │
y:720   │  └─────────────────────────┘   │
        │      QUADRIL / SHORT           │  y 720 →  950
        │      ┌────────┐                │
y:950   │      │ COXA   │                │  y 950 → 1230
y:1180  │      │ JOELHO │                │  y 1180 → 1290 (joelheira)
y:1230  │      │ PANTUR.│                │  y 1230 → 1430
y:1430  │      └─PÉS────┘                │  y 1430 → 1530 (tênis)
y:1536  └───────────────────────────────┘

Pulsos (mãos baixas):     y  880 → 1000
Largura ombro-a-ombro M:  x  310 →  700  (≈ 390 px)
Largura ombro-a-ombro F:  x  360 →  660  (≈ 300 px)
Largura quadril M:        x  360 →  670
Largura quadril F:        x  370 →  660
```

---

## Template Universal

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

> Anexar sempre: `base-masculina.png`

---

### M-01 · Camiseta

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 280 → 740
- y: 320 → 720
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; ombros da peça nos ombros da base;
barra da camiseta na linha da cintura.

TAMANHO RELATIVO À BASE:
Largura = ombro-a-ombro da base (≈ 390 px);
Altura = pescoço até cintura.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola redonda (centro superior)
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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 300 → 720
- y: 330 → 720
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; cavas largas nos ombros;
barra da regata na linha da cintura.

TAMANHO RELATIVO À BASE:
Largura = largura do peito; Altura = pescoço até cintura.

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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 240 → 780
- y: 310 → 760
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; ombros da jaqueta nos ombros da base;
barra abaixo da cintura (nível quadril alto).

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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 690
- y: 720 → 960
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Cintura do short alinhada ao quadril da base;
barra das pernas no meio da coxa.

TAMANHO RELATIVO À BASE:
Largura = largura do quadril; Altura = quadril até meio da coxa.

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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 690
- y: 720 → 1430
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Cintura da calça alinhada ao quadril da base;
barra das pernas no tornozelo.

TAMANHO RELATIVO À BASE:
Largura = largura do quadril; Altura = quadril até tornozelo.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cintura (abertura superior)
- 2 barras de perna nos tornozelos (esquerda e direita)
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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 680
- y:  60 → 280
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Aba do boné sobre a testa do avatar; copa cobre o topo da cabeça.

TAMANHO RELATIVO À BASE:
Largura = largura da cabeça; Altura = topo da cabeça até a testa.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Abertura inferior circular (encaixe da cabeça)
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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 220 → 820
- y: 880 → 1000
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UMA munhequeira em cada pulso da base
  (pulso esquerdo ≈ x 220–370 / pulso direito ≈ x 670–820).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Uma munhequeira em cada pulso da base; altura = 80 px cada.

TAMANHO RELATIVO À BASE:
Cada munhequeira: largura = pulso da base; altura = 80 px.

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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 180 → 860
- y: 880 → 1040
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UMA luva em cada mão da base
  (mão esquerda ≈ x 180–390 / mão direita ≈ x 650–860).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Dedos apontados para baixo; encaixe do punho nos pulsos da base.

TAMANHO RELATIVO À BASE:
Cada luva: de dedos até punho da base.

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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 360 → 670
- y: 1180 → 1290
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UMA joelheira em cada joelho da base
  (joelho esquerdo ≈ x 360–510 / joelho direito ≈ x 520–670).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Centradas em cada joelho da base; altura = 110 px cada.

TAMANHO RELATIVO À BASE:
Cada joelheira: largura = joelho da base; altura = 110 px.

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
"base-masculina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 690
- y: 1430 → 1530
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UM tênis sob cada pé da base
  (pé esquerdo ≈ x 340–510 / pé direito ≈ x 520–690).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Solado sob cada pé da base; cano alinhado ao tornozelo.

TAMANHO RELATIVO À BASE:
Cada tênis: largura = largura do pé; altura = solado até cano.

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

> Anexar sempre: `base-feminina.png`

---

### F-01 · Camiseta

```
Cartoon 3D Disney/Pixar style, peça de jogo fitness mobile premium.
Canvas 1024x1536. PNG transparente. Somente a peça. SEM corpo. SEM fundo.
SEM sombra projetada externa.

REFERÊNCIA DE ENCAIXE (obrigatória — anexar imagem):
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 310 → 720
- y: 320 → 720
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; ombros da peça nos ombros da base;
barra da camiseta na linha da cintura.

TAMANHO RELATIVO À BASE:
Largura = ombro-a-ombro da base (≈ 300 px);
Altura = pescoço até cintura.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Gola (centro superior)
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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 340 → 690
- y: 340 → 560
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Alças nos ombros da base; barra acima do umbigo
(nível das costelas baixas).

TAMANHO RELATIVO À BASE:
Largura = largura do peito; Altura = ombros até costelas baixas.

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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 270 → 760
- y: 310 → 760
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Gola alinhada ao pescoço da base; ombros nos ombros da base;
barra no quadril alto.

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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 350 → 680
- y: 720 → 940
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Cintura alta alinhada ao quadril da base;
barra das pernas no meio da coxa.

TAMANHO RELATIVO À BASE:
Largura = largura do quadril; Altura = quadril até meio da coxa.

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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 350 → 680
- y: 720 → 1430
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Cintura alta alinhada ao quadril da base;
barra das pernas no tornozelo.

TAMANHO RELATIVO À BASE:
Largura = largura do quadril; Altura = quadril até tornozelo.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Cintura (abertura superior)
- 2 barras de perna nos tornozelos (esquerda e direita)
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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 360 → 660
- y:  60 → 280
- A peça DEVE ocupar exatamente esta caixa.
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Aba do boné sobre a testa do avatar;
abertura traseira para passar o rabo de cavalo.

TAMANHO RELATIVO À BASE:
Largura = largura da cabeça; Altura = topo da cabeça até a testa.

ABERTURAS VAZADAS (alpha=0, buraco real no PNG):
- Abertura inferior circular (encaixe da cabeça)
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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 240 → 800
- y: 880 → 1000
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UMA munhequeira em cada pulso da base
  (pulso esquerdo ≈ x 240–380 / pulso direito ≈ x 660–800).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Uma munhequeira em cada pulso da base; altura = 80 px cada.

TAMANHO RELATIVO À BASE:
Cada munhequeira: largura = pulso da base; altura = 80 px.

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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 200 → 840
- y: 880 → 1040
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UMA luva em cada mão da base
  (mão esquerda ≈ x 200–390 / mão direita ≈ x 650–840).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Dedos apontados para baixo; encaixe do punho nos pulsos da base.

TAMANHO RELATIVO À BASE:
Cada luva: de dedos até punho da base.

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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 370 → 660
- y: 1180 → 1290
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UMA joelheira em cada joelho da base
  (joelho esquerdo ≈ x 370–510 / joelho direito ≈ x 520–660).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Centradas em cada joelho da base; altura = 110 px cada.

TAMANHO RELATIVO À BASE:
Cada joelheira: largura = joelho da base; altura = 110 px.

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
"base-feminina.png". Use APENAS para posicionar a peça sobre o avatar.
NÃO desenhar o corpo no resultado.

CAIXA EXATA NO CANVAS (crítico — não centralizar):
- x: 350 → 680
- y: 1430 → 1530
- A peça DEVE ocupar exatamente esta caixa.
- Posicionar UM tênis sob cada pé da base
  (pé esquerdo ≈ x 350–510 / pé direito ≈ x 520–680).
- PROIBIDO centralizar no meio do canvas (1024x1536).
- PROIBIDO escalar para preencher a imagem inteira.
- PROIBIDO mover para cima/baixo/lados fora da caixa.

ÂNCORA ANATÔMICA:
Solado sob cada pé da base; cano alinhado ao tornozelo.

TAMANHO RELATIVO À BASE:
Cada tênis: largura = largura do pé; altura = solado até cano.

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
| M-01 | Camiseta | 280 | 740 | 320 | 720 | masculina |
| M-02 | Regata | 300 | 720 | 330 | 720 | masculina |
| M-03 | Jaqueta | 240 | 780 | 310 | 760 | masculina |
| M-04 | Short | 340 | 690 | 720 | 960 | masculina |
| M-05 | Calça | 340 | 690 | 720 | 1430 | masculina |
| M-06 | Boné | 340 | 680 | 60 | 280 | masculina |
| M-07 | Munhequeira | 220 | 820 | 880 | 1000 | masculina |
| M-08 | Luvas | 180 | 860 | 880 | 1040 | masculina |
| M-09 | Joelheira | 360 | 670 | 1180 | 1290 | masculina |
| M-10 | Tênis | 340 | 690 | 1430 | 1530 | masculina |
| F-01 | Camiseta | 310 | 720 | 320 | 720 | feminina |
| F-02 | Top | 340 | 690 | 340 | 560 | feminina |
| F-03 | Jaqueta | 270 | 760 | 310 | 760 | feminina |
| F-04 | Short | 350 | 680 | 720 | 940 | feminina |
| F-05 | Legging | 350 | 680 | 720 | 1430 | feminina |
| F-06 | Boné | 360 | 660 | 60 | 280 | feminina |
| F-07 | Munhequeira | 240 | 800 | 880 | 1000 | feminina |
| F-08 | Luvas | 200 | 840 | 880 | 1040 | feminina |
| F-09 | Joelheira | 370 | 660 | 1180 | 1290 | feminina |
| F-10 | Tênis | 350 | 680 | 1430 | 1530 | feminina |

---

*Para gerar uma variação de cor/estilo: copie o prompt da peça desejada, substitua apenas o bloco **ESTILO VISUAL** e envie junto com a imagem base correspondente.*
