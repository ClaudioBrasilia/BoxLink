/**
 * src/lib/avatarFit.ts
 * Encaixe automático de roupas/acessórios em TEMPO DE RENDERIZAÇÃO.
 *
 * O sistema de encaixe (src/lib/fitting) originalmente rodava apenas no
 * upload pelo Admin — assets antigos do bucket (enviados antes do sistema,
 * ou sem "Tipo de peça" definido) ficavam apenas centralizados no canvas e
 * apareciam fora de posição no avatar.
 *
 * Este módulo aplica o mesmo encaixe quando o avatar é exibido:
 * cada camada é carregada, o conteúdo opaco é detectado e reposicionado na
 * CAIXA EXATA da especificação (piece_spec_id do item, ou fallback por slot).
 * O resultado é cacheado por URL — o custo é pago uma vez por item, não por
 * avatar exibido.
 */

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { AvatarSlot } from '../types';
import {
  buildAvatarLayers,
  ResolvedLayer,
  LayerAdjustment,
  AvatarSlotKey,
} from './avatarLayers';
import { CANVAS, getPieceSpec, AvatarBaseId } from './fitting/pieceSpecs';
import { validateFit, chooseFitMode, STRETCH_MAX_DISTORTION, STRETCH_MAX_DISTORTION_BODY } from './fitting/geometry';
import { loadImage, fitPieceToCanvas, detectImageContentBox, ensureTransparentBackground } from './fitting/canvasFit';
import { resolveRenderSpecId } from './fitting/slotFallback';

/** Mesmo formato padronizado do upload (512×768, proporção 2:3) */
const OUTPUT = { w: 512, h: 768 } as const;

export interface ItemFitInfo {
  piece_spec_id: string | null;
  layer_adjustment: Partial<LayerAdjustment> | null;
}

let catalogPromise: Promise<Map<string, ItemFitInfo>> | null = null;

/**
 * Catálogo de itens (id → piece_spec_id + layer_adjustment), buscado uma
 * única vez por sessão. Com ele, TODOS os usos de AvatarPreview (Feed, TV,
 * Dashboard, Duels...) passam a respeitar spec e ajustes manuais do banco,
 * sem que cada página precise buscar/repassar nada.
 */
export function getItemFitCatalog(): Promise<Map<string, ItemFitInfo>> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      let { data, error } = await supabase
        .from('items')
        .select('id, piece_spec_id, layer_adjustment');
      if (error) {
        // Banco ainda sem a coluna piece_spec_id: busca só os ajustes.
        ({ data, error } = await supabase.from('items').select('id, layer_adjustment'));
        if (error) throw error;
      }
      const map = new Map<string, ItemFitInfo>();
      for (const row of (data || []) as Array<Record<string, unknown>>) {
        map.set(String(row.id), {
          piece_spec_id: (row.piece_spec_id as string | null) ?? null,
          layer_adjustment: (row.layer_adjustment as Partial<LayerAdjustment> | null) ?? null,
        });
      }
      return map;
    })().catch((err) => {
      catalogPromise = null; // permite nova tentativa na próxima renderização
      throw err;
    });
  }
  return catalogPromise;
}

const fittedUrlCache = new Map<string, Promise<string | null>>();

/**
 * Devolve a URL (data URL) da camada já encaixada na caixa exata da spec,
 * ou null quando não há o que corrigir (sem spec aplicável, imagem já bem
 * posicionada, ou falha de carregamento/CORS — nestes casos o chamador usa
 * a URL original).
 */
export function getFittedLayerUrl(
  url: string,
  slot: AvatarSlotKey,
  avatarBase: AvatarBaseId,
  explicitSpecId?: string | null
): Promise<string | null> {
  const key = `${url}|${slot}|${avatarBase}|${explicitSpecId ?? ''}`;
  let promise = fittedUrlCache.get(key);
  if (!promise) {
    promise = computeFittedLayerUrl(url, slot, avatarBase, explicitSpecId).catch(() => null);
    fittedUrlCache.set(key, promise);
  }
  return promise;
}

async function computeFittedLayerUrl(
  url: string,
  slot: AvatarSlotKey,
  avatarBase: AvatarBaseId,
  explicitSpecId?: string | null
): Promise<string | null> {
  // Remove fundo sólido de assets antigos que subiram sem transparência
  // (ex.: imagem gerada por IA com fundo branco).
  const img = ensureTransparentBackground(await loadImage(url));
  const contentBox = detectImageContentBox(img);
  if (!contentBox) return null;

  const contentAspect = (contentBox.y2 - contentBox.y1) / (contentBox.x2 - contentBox.x1);
  const specId = resolveRenderSpecId(slot, avatarBase, explicitSpecId, contentAspect);
  if (!specId) return null;
  const spec = getPieceSpec(specId);

  // Se a imagem tem a proporção do canvas e o conteúdo já está na caixa
  // exata (caso dos uploads novos, já encaixados), evita gerar data URL.
  const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const sx = CANVAS.width / iw;
  const sy = CANVAS.height / ih;
  if (Math.abs(sx - sy) < 0.01) {
    const normalized = {
      x1: contentBox.x1 * sx,
      y1: contentBox.y1 * sy,
      x2: contentBox.x2 * sx,
      y2: contentBox.y2 * sy,
    };
    if (validateFit(normalized, spec.box).withinTolerance) return null;
  }

  // 'stretch' preenche a caixa exata (roupa casa com a largura do corpo);
  // se a proporção da arte destoar muito da caixa, usa 'contain'. Peças que
  // vestem o corpo (top/bottom) toleram deformação maior.
  const boxAspect = (spec.box.y2 - spec.box.y1) / (spec.box.x2 - spec.box.x1);
  const maxDistortion =
    slot === 'top' || slot === 'bottom' ? STRETCH_MAX_DISTORTION_BODY : STRETCH_MAX_DISTORTION;
  const fitted = fitPieceToCanvas(img, spec, chooseFitMode(contentAspect, boxAspect, maxDistortion));

  const out = document.createElement('canvas');
  out.width = OUTPUT.w;
  out.height = OUTPUT.h;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fitted.canvas, 0, 0, OUTPUT.w, OUTPUT.h);
  return out.toDataURL('image/png');
}

/**
 * Hook usado pelo AvatarPreview: monta as camadas do avatar e as troca
 * pelas versões encaixadas assim que ficam prontas (progressivo — enquanto
 * o encaixe roda, a imagem original é exibida).
 *
 * `itemAdjustments` (prop) tem precedência sobre os `layer_adjustment`
 * vindos do catálogo.
 */
export function useFittedAvatarLayers(
  equipped: AvatarSlot,
  getUrl: (filename: string) => string,
  itemAdjustments?: Record<string, Partial<LayerAdjustment>>
): ResolvedLayer[] {
  const equippedKey = JSON.stringify(equipped ?? null);
  const adjustmentsKey = JSON.stringify(itemAdjustments ?? null);

  const [layers, setLayers] = useState<ResolvedLayer[]>(() =>
    buildAvatarLayers(equipped, getUrl, itemAdjustments)
  );

  useEffect(() => {
    let alive = true;
    setLayers(buildAvatarLayers(equipped, getUrl, itemAdjustments));

    (async () => {
      const catalog = await getItemFitCatalog().catch(() => new Map<string, ItemFitInfo>());

      const mergedAdjustments: Record<string, Partial<LayerAdjustment>> = {};
      for (const [id, info] of catalog) {
        if (info.layer_adjustment) mergedAdjustments[id] = info.layer_adjustment;
      }
      Object.assign(mergedAdjustments, itemAdjustments || {});

      const built = buildAvatarLayers(equipped, getUrl, mergedAdjustments);
      if (!alive) return;
      setLayers(built);

      const avatarBase: AvatarBaseId =
        equipped?.base_outfit === 'base_feminina' ? 'feminina' : 'masculina';

      const fitted = await Promise.all(
        built.map(async (layer) => {
          if (layer.slot === 'base' || !layer.itemId) return layer;
          const specId = catalog.get(layer.itemId)?.piece_spec_id ?? null;
          const fittedUrl = await getFittedLayerUrl(layer.url, layer.slot, avatarBase, specId);
          return fittedUrl ? { ...layer, url: fittedUrl } : layer;
        })
      );
      if (alive) setLayers(fitted);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equippedKey, adjustmentsKey]);

  return layers;
}
