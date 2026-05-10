# Prompts de Geração — Avatar Feminino BoxLink

<!-- versão: 2026-05-10 -->

# BASE_FEMININA_OFICIAL

* Canvas obrigatório: 1024x1536
* Fundo totalmente transparente
* Corpo inteiro visível da cabeça aos pés
* Avatar centralizado
* Estilo cartoon 3D Disney/Pixar
* Anatomia atlética feminina
* Pose frontal neutra
* Braços levemente afastados do corpo
* Sem perspectiva lateral
* Sem cortes
* Sem acessórios na base
* Sem roupas além das peças padrão da base
* Compatível com overlay PNG para React Native/Expo
* Todas as roupas devem encaixar exatamente nesta anatomia

---

# REGRAS GLOBAIS

## Transparência obrigatória

Toda peça deve ser exportada como PNG transparente.

Nunca gerar:

* fundo branco
* fundo cinza
* sombra externa
* glow externo
* corpo junto da peça
* pele
* cabelo
* olhos
* rosto
* avatar completo

A imagem final deve conter SOMENTE a peça.

---

# REGRA CRÍTICA — ABERTURAS VAZADAS

Todas as aberturas precisam ser vazadas reais (alpha = 0).

Isso inclui:

* gola
* cavas
* mangas
* cintura
* barras
* punhos
* cano do tênis
* abertura do boné
* lentes dos óculos
* espaços internos das alças

O corpo do avatar precisa aparecer por trás.

NÃO incluir:

* forro interno
* tecido interno
* sombra preenchendo buracos
* gradiente cobrindo transparência
* cor sólida dentro das aberturas
* blur preenchendo buracos

---

# ORDEM DE SOBREPOSIÇÃO

1. Corpo base
2. Calçados
3. Calças/shorts
4. Tops/camisetas
5. Jaquetas
6. Mochilas
7. Luvas/munhequeiras
8. Óculos
9. Bonés/acessórios cabeça

---

# TOP_FEMININO

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na anatomia da base feminina oficial BoxLink.

ABERTURAS VAZADAS (alpha = 0): gola, cavas e barra inferior devem ser TOTALMENTE TRANSPARENTES. Pescoço, braços e abdômen do avatar precisam aparecer por trás.

NÃO incluir: forro interno, sombra preenchendo aberturas, tecido tampando gola.

Criar SOMENTE: top fitness feminino [COR/ESTILO].

ÁREA OFICIAL:
x: 270 → 760
y: 210 → 620

Top esportivo premium estilo crossfit/cartoon mobile game.
```

---

# CAMISETA_FEMININA

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça.

ABERTURAS VAZADAS (alpha = 0): gola, mangas e barra devem ser totalmente transparentes.

Criar SOMENTE: camiseta fitness feminina [COR/ESTILO].

ÁREA OFICIAL:
x: 240 → 785
y: 210 → 760

Modelagem atlética feminina premium.
```

---

# CROPPED_FEMININO

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): gola, mangas e barra devem ser totalmente transparentes.

Criar SOMENTE: cropped fitness feminino [COR/ESTILO].

ÁREA OFICIAL:
x: 250 → 775
y: 220 → 690

Cropped atlético premium ajustado ao busto.
```

---

# SHORT_FEMININO

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): cintura e pernas devem ser totalmente transparentes.

Criar SOMENTE: short fitness feminino [COR/ESTILO].

ÁREA OFICIAL:
x: 290 → 740
y: 560 → 910

Short fitness premium feminino.
```

---

# CALCA_FEMININA

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): cintura e barras inferiores totalmente transparentes.

Criar SOMENTE: legging fitness feminina [COR/ESTILO].

ÁREA OFICIAL:
x: 260 → 760
y: 540 → 1400

Legging anatômica premium.
```

---

# JAQUETA_FEMININA

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): gola, mangas e barra transparentes.

Criar SOMENTE: jaqueta fitness feminina [COR/ESTILO].

ÁREA OFICIAL:
x: 220 → 810
y: 180 → 860

Jaqueta esportiva premium.
```

---

# BONE_FEMININO

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): abertura inferior e traseira do rabo de cavalo devem ser transparentes.

Criar SOMENTE: boné fitness feminino [COR/ESTILO].

ÁREA OFICIAL:
x: 290 → 730
y: 20 → 300
```

---

# OCULOS_FEMININO

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): lentes totalmente transparentes.

Criar SOMENTE: óculos esportivos femininos [COR/ESTILO].

ÁREA OFICIAL:
x: 340 → 690
y: 130 → 310
```

---

# MOCHILA_FEMININA

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): espaço entre alças totalmente transparente.

Criar SOMENTE: mochila fitness feminina [COR/ESTILO].

ÁREA OFICIAL:
x: 210 → 810
y: 260 → 980
```

---

# MUNHEQUEIRA_FEMININA

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

Interior da munhequeira totalmente transparente.

Criar SOMENTE: munhequeiras fitness femininas [COR/ESTILO].

ÁREA OFICIAL:
x: 190 → 850
y: 520 → 760
```

---

# JOELHEIRA_FEMININA

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

Interior da joelheira totalmente transparente.

Criar SOMENTE: joelheiras fitness femininas [COR/ESTILO].

ÁREA OFICIAL:
x: 300 → 730
y: 920 → 1140
```

---

# TENIS_FEMININO

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

ABERTURAS VAZADAS (alpha = 0): cano superior transparente.

Criar SOMENTE: tênis fitness feminino [COR/ESTILO].

ÁREA OFICIAL:
x: 260 → 770
y: 1260 → 1510
```

---

# LUVAS_FEMININAS

```txt
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente.

Punhos internos transparentes.

Criar SOMENTE: luvas fitness femininas [COR/ESTILO].

ÁREA OFICIAL:
x: 190 → 850
y: 520 → 830
```

---

# TABELA OFICIAL DE ZONAS

| Peça                 | X início | X fim | Y início | Y fim |
| -------------------- | -------- | ----- | -------- | ----- |
| Top Feminino         | 270      | 760   | 210      | 620   |
| Camiseta Feminina    | 240      | 785   | 210      | 760   |
| Cropped Feminino     | 250      | 775   | 220      | 690   |
| Short Feminino       | 290      | 740   | 560      | 910   |
| Calça Feminina       | 260      | 760   | 540      | 1400  |
| Boné Feminino        | 290      | 730   | 20       | 300   |
| Óculos Feminino      | 340      | 690   | 130      | 310   |
| Mochila Feminina     | 210      | 810   | 260      | 980   |
| Munhequeira Feminina | 190      | 850   | 520      | 760   |
| Joelheira Feminina   | 300      | 730   | 920      | 1140  |
| Tênis Feminino       | 260      | 770   | 1260     | 1510  |
| Luvas Femininas      | 190      | 850   | 520      | 830   |
| Jaqueta Feminina     | 220      | 810   | 180      | 860   |

---

# PIPELINE RECOMENDADO

1. Gerar peça
2. Exportar PNG transparente
3. Verificar alpha nas aberturas
4. Testar overlay na base oficial
5. Ajustar alinhamento se necessário
6. Fazer upload via sistema BoxLink
7. Publicar item na loja

---

# COMO USAR

1. Escolha a peça
2. Copie o bloco completo
3. Substitua [COR/ESTILO]
4. Gere a imagem
5. Faça upload no app
