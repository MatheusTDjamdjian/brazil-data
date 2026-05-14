/**
 * Helpers compartilhados pelas funções `compactarParaLLM` de cada tool.
 *
 * Princípio: a versão enxuta enviada ao LLM deve ter só o essencial,
 * com strings em formato BR. Campos nulos/vazios são removidos. Arrays
 * longos são truncados com "(...e mais N)" para preservar tokens.
 */

export type CompactPrimitive = string | number | boolean | null;
export type CompactValue =
  | CompactPrimitive
  | CompactValue[]
  | { [key: string]: CompactValue | undefined };

/**
 * Trunca um array, mantendo até `max` itens. Itens além disso viram um
 * único string-marcador "(...e mais N)" no final.
 */
export function truncarLista<T, R>(items: T[], max: number, map: (item: T) => R): (R | string)[] {
  if (items.length <= max) return items.map(map);
  return [...items.slice(0, max).map(map), `(...e mais ${items.length - max})`];
}

/**
 * Remove propriedades undefined/null/'' (raso) de um objeto.
 * Útil para enxugar o output antes de mandar ao LLM.
 */
export function semVazios<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
