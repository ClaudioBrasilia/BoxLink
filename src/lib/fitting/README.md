# Sistema de Encaixe de Roupas e Acessórios (`src/lib/fitting`)

Módulo que automatiza o encaixe programático de peças de vestuário/acessórios
sobre as bases de avatar do BoxLink (`base-masculina.png` / `base-feminina.png`),
usando as especificações de `PROMPTS_AVATAR.md` (caixa exata, âncora anatômica,
tamanho relativo e aberturas vazadas) como fonte única de verdade.

Funciona inteiramente no browser (Canvas 2D API) — mesma abordagem já usada em
`src/utils/avatarUpload.ts` e `src/utils/rankingImage.ts` — sem dependências
nativas, compatível com Web e com o WebView do Capacitor.

## Por que isso existe

A geração de peças via IA já recebe instruções para posicionar cada peça
dentro de uma caixa exata do canvas 1024×1536. Na prática, geração de imagem
por IA nem sempre acerta o pixel exato. Este módulo funciona como uma camada
de garantia determinística: detecta onde o conteúdo opaco da peça realmente
está (via varredura do canal alpha) e aplica a transformação (escala +
translação) necessária para que ele ocupe **exatamente** a caixa da
especificação — nunca centraliza automaticamente, nunca escala para preencher
o canvas inteiro, nunca move a peça para fora da caixa. Como a imagem de
origem inteira é redesenhada com essa transformação, as aberturas vazadas
(alpha=0 — gola, cavas, punhos etc.) são preservadas automaticamente.

## Estrutura

- `pieceSpecs.ts` — dados puros (sem DOM): `PieceSpec` para as 20 peças
  (M-01..M-10, F-01..F-10), mapa de zonas anatômicas e larguras de base.
- `geometry.ts` — matemática pura e testável: cálculo de transformação de
  encaixe, detecção de bounding box a partir de um buffer RGBA, validação de
  desvio.
- `slotFallback.ts` — dados puros: resolve qual spec usar na renderização
  (spec explícita do item, ou fallback genérico por slot para itens antigos
  sem `piece_spec_id`).
- `canvasFit.ts` — camada dependente de Canvas/DOM: carregamento de imagem,
  detecção de bounding box de uma `HTMLImageElement`, encaixe de uma peça em
  um canvas 1024×1536, composição de várias peças sobre a base.
- `index.ts` — API pública (`fitClothingPiece`, `fitOutfit`) e re-exports.
- `geometry.test.ts` / `slotFallback.test.ts` — testes unitários (`npm test`)
  dos módulos puros.

## Onde o encaixe é aplicado

1. **No upload (Admin)** — `src/utils/avatarUpload.ts`: quando o admin define
   o "Tipo de peça" (`piece_spec_id`) do item, a imagem é reencaixada na caixa
   exata antes de ser salva no bucket (512×768).
2. **Na renderização (todos os avatares)** — `src/lib/avatarFit.ts`
   (`useFittedAvatarLayers`, usado pelo `AvatarPreview`): cada camada exibida
   passa pelo mesmo encaixe em tempo de exibição, com cache por URL. Isso
   corrige também os assets antigos do bucket (enviados antes do sistema de
   encaixe ou sem tipo de peça definido) sem precisar reenviar nada. Itens sem
   `piece_spec_id` usam o fallback por slot de `slotFallback.ts`; slots
   ambíguos (`accessory`, `special`) mantêm o comportamento anterior.

## Uso

### Encaixar uma única peça sobre a base

```ts
import { fitClothingPiece } from '@/lib/fitting';

const result = await fitClothingPiece({
  avatarBase: 'masculina',
  pecaId: 'M-01',
  pieceImageUrl: 'https://.../avatar-assets/M-01.png',
  baseImageUrl: 'https://.../avatar-assets/base%20masculina.png',
  estiloVisual: { cor: 'azul royal', material: 'dri-fit', logo: 'peito esquerdo' },
});

document.querySelector('img#avatar')!.src = result.dataUrl;

if (!result.wasAlreadyWellPositioned) {
  console.warn(`Peça ${result.spec.id} precisou de correção:`, result.transform, result.warnings);
}
```

### Encaixar um "look" completo (várias peças)

```ts
import { fitOutfit } from '@/lib/fitting';

const outfit = await fitOutfit({
  avatarBase: 'feminina',
  baseImageUrl: 'https://.../avatar-assets/base%20feminina.png',
  pieces: [
    { pecaId: 'F-05', pieceImageUrl: '.../F-05.png' }, // legging (mais embaixo)
    { pecaId: 'F-10', pieceImageUrl: '.../F-10.png' }, // tênis
    { pecaId: 'F-01', pieceImageUrl: '.../F-01.png' }, // camiseta (mais em cima)
  ],
});

document.querySelector('img#avatar')!.src = outfit.dataUrl;
```

### Só validar (sem gerar imagem) — útil para QA de peças recém-geradas

```ts
import { getPieceSpec, loadImage, detectImageContentBox, validateFit } from '@/lib/fitting';

const spec = getPieceSpec('M-06');
const img = await loadImage(pieceImageUrl);
const contentBox = detectImageContentBox(img);
if (contentBox) {
  const check = validateFit(contentBox, spec.box, /* tolerancePx */ 12);
  if (!check.withinTolerance) {
    console.warn(`Peça ${spec.id} fora da caixa esperada em até ${check.maxDelta}px`, check);
  }
}
```

## Modos de encaixe

- `mode: 'contain'` (padrão) — preserva a proporção original do conteúdo
  detectado, centralizando dentro da caixa (letterbox). Nunca distorce a
  arte original; se a proporção da peça não bater exatamente com a da caixa,
  ela fica levemente mais folgada num dos eixos em vez de esticar/espremer.
- `mode: 'stretch'` — a peça ocupa exatamente a caixa da especificação,
  permitindo escalas X/Y diferentes ("a peça DEVE ocupar exatamente esta
  caixa", por PROMPTS_AVATAR.md). Garante ocupação total da caixa, mas pode
  distorcer a peça se a proporção original for diferente da proporção da
  caixa.

## Adicionando novas peças ou bases

1. Adicione a especificação em `pieceSpecs.ts` (`MASCULINO`/`FEMININO`, ou um
   novo array para uma nova base) seguindo o mesmo formato de
   `PROMPTS_AVATAR.md`.
2. Nenhuma outra mudança de código é necessária — `fitClothingPiece` e
   `fitOutfit` resolvem a especificação pelo `pecaId` automaticamente.
3. Rode `npm test` para validar que a nova especificação tem caixa não
   degenerada e id/base consistentes (coberto por `geometry.test.ts`).

## Testes

```bash
npm test
```

Os testes cobrem apenas os módulos puros (`geometry.ts`, `pieceSpecs.ts`), que
não dependem de DOM/Canvas — por isso rodam em Node sem precisar de jsdom ou
de um polyfill de `<canvas>`. A camada `canvasFit.ts` (Canvas API real) é
exercida manualmente em browser/Capacitor, da mesma forma que os utilitários
similares já existentes no projeto (`avatarUpload.ts`, `rankingImage.ts`).
