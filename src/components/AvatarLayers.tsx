## Objetivo

Fazer as roupas/acessórios encaixarem perfeitamente no avatar **e** mostrar o avatar **sempre de corpo inteiro** (dos pés à cabeça), para que tênis, calça e acessórios apareçam corretamente em qualquer tela.

## O que está errado hoje

1. O artista/IA cria a peça num canvas **1024×1536 (proporção 2:3)** e o `uploadAvatarItem` salva em **512×768 (mesma 2:3)** — isso está correto.
2. Mas o `AvatarPreview` exibe num **quadrado** (`w-28 h-28`, `w-40 h-40` etc.) → arte 2:3 fica espremida ou cortada.
3. A camada base usa `objectFit: 'cover'` (amplia/corta os pés!) e as roupas usam `objectFit: 'contain'` → cada camada vive num sistema de coordenadas diferente.
4. Existem **dois arquivos** `avatarLayers` divergentes (`lib/` com `contain`, `components/` com `fill`) — risco de drift.

## Correções

### 1. `src/components/AvatarPreview.tsx` — sempre corpo inteiro 2:3

Remover a opção `fullBody` e a tabela de tamanhos quadrados. Usar uma única tabela na proporção **2:3** (mesma do mapa 1024×1536 e do upload 512×768):

```tsx
// Antes: SIZE_CLASSES + FULL_BODY_SIZE_CLASSES + prop fullBody
// Depois: uma única tabela 2:3
const SIZE_CLASSES = {
  sm: 'w-16 aspect-[2/3]',   // ~16x24
  md: 'w-28 aspect-[2/3]',   // ~28x42
  lg: 'w-40 aspect-[2/3]',   // ~40x60
  xl: 'w-56 aspect-[2/3]',   // ~56x84
};

const shapeClass = 'rounded-2xl'; // não usar mais círculo direto na arte
```

Se em algum lugar (ex.: header, lista de ranking) você precisa de um **avatar redondo só do rosto**, envolva o `AvatarPreview` num wrapper externo:

```tsx
<div className="w-12 h-12 rounded-full overflow-hidden">
  <AvatarPreview equipped={...} size="sm" showBorder={false} />
</div>
```

Isso recorta visualmente sem deformar a arte.

### 2. `src/lib/avatarLayers.ts` — base com o mesmo `objectFit` das roupas

Trocar a camada base para usar `contain` + `center center`, idêntico ao default das roupas:

```ts
layers.push({
  url: getUrl(isFemale ? 'base feminina' : 'base masculina'),
  alt: 'Base', slot: 'base',
  adjustment: {
    scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0,
    transformOrigin: 'center center',
    zIndex: 0,
    objectFit: 'contain',           // <- antes era 'cover'
    objectPosition: 'center center' // <- antes era 'top center'
  },
});
```

Com isso, as **mesmas coordenadas** do mapa 1024×1536 valem para a base e para qualquer peça — a SHIRT_ZONE, SHOES_ZONE etc. vão cair exatamente no lugar.

### 3. Apagar o duplicado

Deletar `src/components/AvatarLayers.tsx` (ou trocar todo o conteúdo por `export * from '../lib/avatarLayers';`). Assim só existe uma fonte da verdade para `SLOT_DEFAULTS`.

### 4. Padronizar as bases no mesmo canvas das roupas (recomendado)

Reupar `base masculina.png` e `base feminina.png` passando pelo `uploadAvatarItem` (ou gerá-las já em 1024×1536 / 512×768 transparente, com o personagem ocupando exatamente as mesmas zonas que você manda no prompt):

- Cabeça/rosto: y ≈ 60–280
- Tronco / SHIRT_ZONE: x 220–800, y 210–820
- Quadril/calça: y ≈ 820–1100
- Pés / SHOES_ZONE: y ≈ 1380–1530

Quando as bases estiverem nesse mesmo grid, qualquer peça criada com seu prompt atual vai encaixar **sem precisar de calibrador**.

## Atualize o seu prompt das roupas

Pra garantir, no prompt da IA já deixe explícitas as zonas dos outros slots (que hoje só tem a SHIRT_ZONE_MALE):

```
SHIRT_ZONE_MALE:    x 220 → 800,  y 210  → 820
PANTS_ZONE_MALE:    x 260 → 760,  y 780  → 1180
SHOES_ZONE_MALE:    x 270 → 760,  y 1380 → 1530
HEAD_ZONE_MALE:     x 320 → 700,  y 60   → 320
WRIST_ZONE_MALE:    x 180 → 320 e x 700 → 840, y 780 → 900
```

(Ajuste os números olhando seu PNG da base de mapeamento — o importante é que esse mapa seja o **mesmo** usado para gerar a base e cada peça.)

## Resultado esperado

- Avatar sempre exibido **dos pés à cabeça** em qualquer card.
- Tênis, calça, camiseta e acessórios caem exatamente no lugar do mapa, sem calibrar item por item.
- Uma única definição de camadas (`src/lib/avatarLayers.ts`).
- Possibilidade de mostrar avatar redondo (header, ranking) usando wrapper, sem deformar a arte.

## Arquivos afetados

- `src/components/AvatarPreview.tsx` (proporção e remoção do `fullBody`).
- `src/lib/avatarLayers.ts` (base com `contain` + `center center`).
- `src/components/AvatarLayers.tsx` (deletar / re-exportar).
- Locais que passam `fullBody` para `AvatarPreview` (remover a prop).
- Bucket `avatar-assets`: reupload das duas bases padronizadas (opcional, mas garante encaixe perfeito).
