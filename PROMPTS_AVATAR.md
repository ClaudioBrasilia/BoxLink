# Prompts de Geração — Avatar BoxLink

<!-- versão: 2026-05-10 -->

# Sistema Oficial de Geração — BoxLink Avatar Assets

Este arquivo contém os prompts oficiais de geração de roupas e acessórios do sistema de avatar BoxLink.

Todos os assets devem ser produzidos seguindo EXATAMENTE estas regras.

---

# REGRA MAIS IMPORTANTE DO SISTEMA

O avatar base NÃO MUDA.

As roupas e acessórios são layers PNG sobrepostas ao avatar.

Portanto:

* o canvas deve permanecer idêntico;
* a posição deve permanecer idêntica;
* a escala deve permanecer idêntica;
* o alinhamento deve permanecer idêntico.

As peças NÃO podem ser centralizadas novamente.

As peças NÃO podem ser renderizadas isoladas em outra posição.

---

# CANVAS OFICIAL

Canvas obrigatório para TODOS os assets:

1024x1536

Nunca:

* cortar;
* redimensionar;
* rotacionar;
* mover.

---

# POSICIONAMENTO FIXO

Toda peça deve ser criada:

* exatamente na posição do avatar;
* usando o avatar como molde anatômico;
* respeitando perspectiva frontal fixa.

O ponto x=0 y=0 precisa permanecer alinhado com o avatar original.

---

# TRANSPARÊNCIA REAL (ALPHA)

Todas as peças precisam usar:

* PNG alpha verdadeiro;
* transparência real;
* sem fundo branco;
* sem fundo preto;
* sem sombra de fundo;
* sem glow externo.

---

# ABERTURAS VAZADAS (ALPHA = 0)

Toda abertura da peça precisa ser um BURACO REAL NO PNG.

Isso inclui:

* gola;
* cavas;
* mangas;
* cintura;
* punhos;
* barras;
* abertura de tênis;
* abertura de boné;
* interior de luvas;
* interior de joelheiras;
* interior de munhequeiras.

O avatar deve aparecer por trás dessas áreas.

NUNCA:

* preencher com tecido;
* preencher com gradiente;
* preencher com sombra;
* preencher com cor sólida;
* desenhar interior da peça.

---

# NÃO DESENHAR O CORPO

A imagem final deve conter SOMENTE:

* roupa;
  ou
* acessório.

NÃO mostrar:

* pele;
* cabeça;
* cabelo;
* braços;
* pernas;
* pés;
* pescoço;
* torso.

---

# EXPORTAÇÃO

Formato obrigatório:

* PNG transparente.

Resultado:

* pronto para upload;
* pronto para React Native;
* pronto para Expo;
* pronto para Supabase;
* pronto para overlay automático.

---

# TESTE DE VALIDAÇÃO

O asset será considerado correto somente se:

1. for colocado exatamente em x=0 y=0;
2. sem redimensionamento;
3. sem calibração;
4. encaixar perfeitamente no avatar base.

Se precisar mover:
❌ asset inválido.

---

# ESTILO OFICIAL

Todos os itens devem seguir:

* cartoon 3D;
* Disney/Pixar;
* mobile game premium;
* iluminação suave;
* sombreamento leve;
* render limpo;
* bordas suaves;
* aparência fitness/crossfit.

Referência visual:

* Fortnite Locker
* Roblox Avatar Shop
* Zepeto
* NBA 2K MyPlayer
* The Sims

Adaptado para universo fitness/crossfit.

---

# REGRAS GLOBAIS OBRIGATÓRIAS

Adicionar implicitamente em TODAS as peças:

* NÃO gerar mockup;
* NÃO gerar personagem vestido;
* NÃO gerar manequim;
* NÃO gerar preview de loja;
* NÃO gerar fundo cinza;
* NÃO gerar fundo branco;
* NÃO gerar composição promocional;
* NÃO gerar render com corpo humano.

Gerar SOMENTE a peça isolada em PNG transparente.

---

# QUALIDADE DAS BORDAS

Toda peça deve possuir:

* bordas externas totalmente fechadas;
* recorte limpo;
* alpha sem serrilhado;
* transparência suave;
* contorno consistente.

Evitar:

* pixels fantasmas;
* sombras transparentes excessivas;
* vazamento de cor;
* blur nas bordas.

---

# Índice

## Base Masculina

* Camiseta
* Regata
* Cropped sem manga
* Short
* Calça
* Boné
* Óculos
* Mochila
* Munhequeira
* Joelheira
* Tênis
* Luvas
* Jaqueta

## Base Feminina

* Top
* Camiseta
* Cropped
* Short
* Calça
* Boné
* Óculos
* Mochila
* Munhequeira
* Joelheira
* Tênis
* Luvas
* Jaqueta

---

# BASES OFICIAIS

## BASE_MASCULINA_OFICIAL

* Canvas: 1024x1536
* Corpo inteiro visível
* Estilo cartoon 3D Disney/Pixar
* Personagem centralizado
* Posição frontal neutra
* Braços levemente afastados do corpo
* Sem perspectiva lateral
* Sem cortes
* Fundo transparente
* Base utilizada para todas as peças masculinas
* Todas as roupas devem respeitar exatamente esta anatomia
* Compatível com overlay PNG em React Native/Expo

## BASE_FEMININA_OFICIAL

* Canvas: 1024x1536
* Corpo inteiro visível
* Estilo cartoon 3D Disney/Pixar
* Personagem centralizado
* Posição frontal neutra
* Braços levemente afastados do corpo
* Sem perspectiva lateral
* Sem cortes
* Fundo transparente
* Base utilizada para todas as peças femininas
* Todas as roupas devem respeitar exatamente esta anatomia
* Compatível com overlay PNG em React Native/Expo

---

# BASE MASCULINA

## CAMISETA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, bocas das mangas e barra inferior devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem forro, sem sombra preenchendo, sem gradiente, sem cor de fundo dentro do buraco. Pescoço, braços e cintura do avatar precisam aparecer por trás. NÃO desenhar o interior da peça.

NÃO incluir: forro interno, tecido fechando a gola, sombra preenchendo aberturas, gradiente cobrindo o buraco da peça, fundo de qualquer cor dentro das aberturas.

A peça deve possuir:
- bordas externas totalmente fechadas;
- recorte limpo;
- alpha sem serrilhado;
- transparência suave;
- contorno consistente.

NÃO gerar:
- mockup;
- personagem vestido;
- manequim;
- fundo cinza;
- fundo branco;
- preview de loja.

Criar SOMENTE: camiseta fitness masculina [COR/ESTILO]. Área obrigatória: x: 220 → 800, y: 210 → 820. Camiseta atlética ajustada ao corpo, mangas curtas proporcionais, tecido esportivo premium, caimento natural sobre peitoral e abdômen.
```

---

## REGATA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, cavas e barra inferior devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem sombra preenchendo, sem gradiente, sem cor dentro das aberturas. Pescoço, braços e abdômen do avatar precisam aparecer por trás.

NÃO incluir: preenchimento nas cavas, tecido tampando a gola, sombras internas cobrindo corpo.

Criar SOMENTE: regata fitness masculina [COR/ESTILO]. Área obrigatória: x: 250 → 780, y: 210 → 760. Regata atlética premium estilo treino funcional/cartoon mobile game.
```

---

## CROPPED_SEM_MANGA_MASCULINO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, cavas e barra inferior devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem sombra preenchendo, sem gradiente, sem cor de fundo dentro do buraco. Pescoço, braços e abdômen do avatar precisam aparecer por trás.

NÃO incluir: tecido tampando gola, preenchimento interno nas cavas, sombras internas cobrindo corpo.

Criar SOMENTE: cropped sem manga masculino fitness [COR/ESTILO]. Área obrigatória: x: 260 → 770, y: 210 → 690. Peça atlética moderna estilo treino funcional/cartoon premium.
```

---

## SHORT_MASCULINO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): cintura e barras das pernas devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem sombra preenchendo, sem gradiente, sem cor dentro das aberturas. Abdômen e pernas do avatar precisam aparecer por trás.

NÃO incluir: preenchimento interno, sombra cobrindo pernas, tecido tampando cintura.

Criar SOMENTE: short fitness masculino [COR/ESTILO]. Área obrigatória: x: 270 → 760, y: 600 → 980. Short esportivo premium estilo cross training/mobile game.
```

---

## CALCA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): cintura e barras inferiores das pernas devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem sombra preenchendo, sem gradiente, sem cor dentro das aberturas. Abdômen e pés do avatar precisam aparecer por trás.

Criar SOMENTE: calça esportiva masculina [COR/ESTILO]. Área obrigatória: x: 250 → 770, y: 580 → 1440. Modelagem slim esportiva, tecido fitness premium, ajuste anatômico nas pernas.
```

---

## BONE_MASCULINO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): abertura inferior do boné deve ser TOTALMENTE TRANSPARENTE — buraco real no PNG, sem sombra interna, sem preenchimento. Cabeça e cabelo do avatar precisam aparecer por trás.

Respeitar espaço do cabelo da base oficial.

Criar SOMENTE: boné esportivo masculino [COR/ESTILO]. Área obrigatória: x: 280 → 740, y: 10 → 280. Boné fitness premium estilo crossfit/mobile game.
```

---

## OCULOS_MASCULINO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): lentes internas e área dos olhos devem ser TOTALMENTE TRANSPARENTES. Olhos e rosto do avatar precisam aparecer por trás.

As lentes devem possuir transparência parcial controlada OU transparência total.

Nunca bloquear:
- olhos;
- sobrancelhas;
- rosto do avatar.

Criar SOMENTE: óculos esportivos masculinos [COR/ESTILO]. Área obrigatória: x: 330 → 700, y: 120 → 300. Óculos premium estilo corrida/crossfit/mobile game.
```

---

## MOCHILA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): área interna entre alças deve ser TOTALMENTE TRANSPARENTE. Tronco e braços do avatar precisam aparecer por trás.

Criar SOMENTE: mochila fitness masculina [COR/ESTILO]. Área obrigatória: x: 200 → 820, y: 250 → 1000. Mochila premium estilo treino funcional/cartoon mobile game.
```

---

## MUNHEQUEIRA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): interior do anel da munhequeira deve ser TOTALMENTE TRANSPARENTE. Braços do avatar precisam aparecer por trás.

Criar SOMENTE: munhequeiras esportivas masculinas [COR/ESTILO]. Área obrigatória: x: 170 → 860, y: 500 → 760. Munhequeiras fitness acolchoadas estilo treino funcional.
```

---

## JOELHEIRA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): interior da joelheira deve ser TOTALMENTE TRANSPARENTE. Joelhos e pernas do avatar precisam aparecer por trás.

Criar SOMENTE: joelheiras fitness masculinas [COR/ESTILO]. Área obrigatória: x: 300 → 730, y: 930 → 1150. Joelheiras premium estilo cross training.
```

---

## TENIS_MASCULINO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): cano superior do tênis deve ser TOTALMENTE TRANSPARENTE. Tornozelos e pés do avatar precisam aparecer por trás.

Os dois tênis devem ser separados corretamente:
- pé esquerdo alinhado ao pé esquerdo do avatar;
- pé direito alinhado ao pé direito do avatar.

NÃO gerar:
- tênis unidos;
- base única;
- sombra conectando os pés.

Criar SOMENTE: tênis esportivo masculino [COR/ESTILO]. Área obrigatória: x: 250 → 770, y: 1260 → 1510. Tênis atlético moderno estilo crossfit premium.
```

---

## LUVAS_MASCULINAS

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): punhos internos das luvas devem ser TOTALMENTE TRANSPARENTES. Mãos e braços do avatar precisam aparecer por trás.

Criar SOMENTE: luvas fitness masculinas [COR/ESTILO]. Área obrigatória: x: 170 → 860, y: 520 → 830. Luvas de treino funcional premium.
```

---

## JAQUETA_MASCULINA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base masculina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, bocas das mangas e barra devem ser TOTALMENTE TRANSPARENTES. Pescoço, braços e cintura do avatar precisam aparecer por trás.

A abertura frontal da jaqueta deve ser transparente internamente quando estiver aberta.

Não preencher o espaço interno com sombra sólida.

Criar SOMENTE: jaqueta esportiva masculina [COR/ESTILO]. Área obrigatória: x: 210 → 810, y: 180 → 860. Jaqueta fitness premium com modelagem esportiva moderna.
```

---

# BASE FEMININA

## TOP_FEMININO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, cavas e barra inferior devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem sombra preenchendo, sem gradiente, sem cor dentro das aberturas. Pescoço, braços e abdômen do avatar precisam aparecer por trás.

Criar SOMENTE: top fitness feminino [COR/ESTILO]. Área obrigatória: x: 270 → 760, y: 210 → 620. Top esportivo premium estilo crossfit/mobile game.
```

---

## CAMISETA_FEMININA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, bocas das mangas e barra inferior devem ser TOTALMENTE TRANSPARENTES. Pescoço, braços e cintura do avatar precisam aparecer por trás.

Criar SOMENTE: camiseta fitness feminina [COR/ESTILO]. Área obrigatória: x: 240 → 785, y: 210 → 760. Camiseta esportiva feminina premium com modelagem atlética.
```

---

## CROPPED_FEMININO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, bocas das mangas e barra inferior devem ser TOTALMENTE TRANSPARENTES — buraco real no PNG, sem tecido interno, sem forro, sem sombra preenchendo, sem gradiente, sem cor de fundo dentro do buraco. Pescoço, braços e abdômen do avatar precisam aparecer por trás.

Criar SOMENTE: cropped fitness feminino [COR/ESTILO]. Área obrigatória: x: 250 → 775, y: 220 → 690. Cropped atlético premium ajustado ao busto e cintura superior.
```

---

## SHORT_FEMININO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): cintura e barras das pernas devem ser TOTALMENTE TRANSPARENTES. Abdômen e pernas do avatar precisam aparecer por trás.

Criar SOMENTE: short fitness feminino [COR/ESTILO]. Área obrigatória: x: 290 → 740, y: 560 → 910. Short atlético feminino premium estilo crossfit.
```

---

## CALCA_FEMININA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): cintura e barras inferiores das pernas devem ser TOTALMENTE TRANSPARENTES. Abdômen e pés do avatar precisam aparecer por trás.

Criar SOMENTE: legging fitness feminina [COR/ESTILO]. Área obrigatória: x: 260 → 760, y: 540 → 1400. Legging esportiva premium anatômica.
```

---

## BONE_FEMININO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): abertura inferior e abertura traseira do rabo de cavalo devem ser TOTALMENTE TRANSPARENTES. Cabeça e cabelo do avatar precisam aparecer por trás.

Respeitar espaço do cabelo/rabo de cavalo da base oficial.

Nunca cortar o cabelo do avatar.

Criar SOMENTE: boné esportivo feminino [COR/ESTILO]. Área obrigatória: x: 290 → 730, y: 20 → 300. Boné fitness feminino premium.
```

---

## OCULOS_FEMININO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): lentes internas e área dos olhos devem ser TOTALMENTE TRANSPARENTES. Olhos e rosto do avatar precisam aparecer por trás.

As lentes devem possuir transparência parcial controlada OU transparência total.

Nunca bloquear:
- olhos;
- sobrancelhas;
- rosto do avatar.

Criar SOMENTE: óculos esportivos femininos [COR/ESTILO]. Área obrigatória: x: 340 → 690, y: 130 → 310. Óculos fitness premium estilo corrida/crossfit/cartoon mobile game.
```

---

## MOCHILA_FEMININA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): área interna entre alças deve ser TOTALMENTE TRANSPARENTE. Tronco e braços do avatar precisam aparecer por trás.

Criar SOMENTE: mochila fitness feminina [COR/ESTILO]. Área obrigatória: x: 210 → 810, y: 260 → 980. Mochila premium estilo treino funcional/mobile game com alças anatômicas.
```

---

## MUNHEQUEIRA_FEMININA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): interior do anel da munhequeira deve ser TOTALMENTE TRANSPARENTE. Braços do avatar precisam aparecer por trás.

Criar SOMENTE: munhequeiras fitness femininas [COR/ESTILO]. Área obrigatória: x: 190 → 850, y: 520 → 760. Munhequeiras esportivas premium.
```

---

## JOELHEIRA_FEMININA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): interior da joelheira deve ser TOTALMENTE TRANSPARENTE. Joelhos e pernas do avatar precisam aparecer por trás.

Criar SOMENTE: joelheiras fitness femininas [COR/ESTILO]. Área obrigatória: x: 300 → 730, y: 920 → 1140. Joelheiras premium estilo treino funcional.
```

---

## TENIS_FEMININO

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): cano superior do tênis deve ser TOTALMENTE TRANSPARENTE. Tornozelos e pés do avatar precisam aparecer por trás.

Os dois tênis devem ser separados corretamente:
- pé esquerdo alinhado ao pé esquerdo do avatar;
- pé direito alinhado ao pé direito do avatar.

NÃO gerar:
- tênis unidos;
- base única;
- sombra conectando os pés.

Criar SOMENTE: tênis esportivo feminino [COR/ESTILO]. Área obrigatória: x: 260 → 770, y: 1260 → 1510. Tênis fitness feminino premium.
```

---

## LUVAS_FEMININAS

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): punhos internos das luvas devem ser TOTALMENTE TRANSPARENTES. Mãos e braços do avatar precisam aparecer por trás.

Criar SOMENTE: luvas fitness femininas [COR/ESTILO]. Área obrigatória: x: 190 → 850, y: 520 → 830. Luvas esportivas premium.
```

---

## JAQUETA_FEMININA

```text
Cartoon 3D Disney/Pixar style, premium mobile fitness game item. Canvas 1024x1536. PNG transparente, somente a peça, sem corpo, sem fundo, sem sombras externas. Encaixe perfeito na zona indicada, respeitando perspectiva e anatomia da base feminina oficial. Pronto para sistema de avatar React Native/Expo, sem necessidade de calibração.

ABERTURAS VAZADAS (alpha = 0): gola, bocas das mangas e barra devem ser TOTALMENTE TRANSPARENTES. Pescoço, braços e cintura do avatar precisam aparecer por trás.

A abertura frontal da jaqueta deve ser transparente internamente quando estiver aberta.

Não preencher o espaço interno com sombra sólida.

Criar SOMENTE: jaqueta esportiva feminina [COR/ESTILO]. Área obrigatória: x: 220 → 810, y: 180 → 860. Jaqueta fitness feminina premium com modelagem atlética moderna.
```

---

# Tabela de Zonas (referência rápida)

| Peça                        | X início | X fim | Y início | Y fim |
| --------------------------- | -------- | ----- | -------- | ----- |
| Camiseta Masculina          | 220      | 800   | 210      | 820   |
| Regata Masculina            | 250      | 780   | 210      | 760   |
| Cropped sem manga Masculino | 260      | 770   | 210      | 690   |
| Short Masculino             | 270      | 760   | 600      | 980   |
| Calça Masculina             | 250      | 770   | 580      | 1440  |
| Boné Masculino              | 280      | 740   | 10       | 280   |
| Óculos Masculino            | 330      | 700   | 120      | 300   |
| Mochila Masculina           | 200      | 820   | 250      | 1000  |
| Munhequeira Masculina       | 170      | 860   | 500      | 760   |
| Joelheira Masculina         | 300      | 730   | 930      | 1150  |
| Tênis Masculino             | 250      | 770   | 1260     | 1510  |
| Luvas Masculinas            | 170      | 860   | 520      | 830   |
| Jaqueta Masculina           | 210      | 810   | 180      | 860   |
| Top Feminino                | 270      | 760   | 210      | 620   |
| Camiseta Feminina           | 240      | 785   | 210      | 760   |
| Cropped Feminino            | 250      | 775   | 220      | 690   |
| Short Feminino              | 290      | 740   | 560      | 910   |
| Calça Feminina              | 260      | 760   | 540      | 1400  |
| Boné Feminino               | 290      | 730   | 20       | 300   |
| Óculos Feminino             | 340      | 690   | 130      | 310   |
| Mochila Feminina            | 210      | 810   | 260      | 980   |
| Munhequeira Feminina        | 190      | 850   | 520      | 760   |
| Joelheira Feminina          | 300      | 730   | 920      | 1140  |
| Tênis Feminino              | 260      | 770   | 1260     | 1510  |
| Luvas Femininas             | 190      | 850   | 520      | 830   |
| Jaqueta Feminina            | 220      | 810   | 180      | 860   |

---

# Como usar

1. Escolha a peça.
2. Copie o bloco completo.
3. Substitua [COR/ESTILO].
4. Cole no gerador de imagem.
5. Gere o PNG.
6. Faça upload via uploadAvatarItem.
7. Sobreponha no avatar em x=0 y=0 sem redimensionar.

---

# Pipeline Oficial BoxLink

Avatar Base
+
Peça PNG Transparente
+
Overlay React Native
+
Supabase Item System
====================

Sistema Profissional de Avatar Fitness/Crossfit
