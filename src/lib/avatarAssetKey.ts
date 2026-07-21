/**
 * src/lib/avatarAssetKey.ts
 * Chave de storage derivada do ID do item da loja.
 *
 * O Supabase Storage só aceita chaves com caracteres S3-safe e rejeita o
 * upload com "Invalid key" quando o ID tem letras acentuadas ("Tênis") ou
 * outros símbolos fora do conjunto permitido. O ID do item continua texto
 * livre — esta função converte o ID na chave usada no bucket, e por isso
 * PRECISA ser aplicada tanto no upload quanto na montagem da URL pública,
 * para os dois lados apontarem para o mesmo arquivo.
 */
export function avatarAssetKey(itemId: string): string {
  return itemId
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos: "Tênis" → "Tenis"
    .replace(/[^\w !\-.*'()&$@=;:+,?]/g, '_'); // demais caracteres que o Storage rejeita (inclui "/")
}
