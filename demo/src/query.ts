/** Initial demo state from the address (?example=&readAs=&fit=). Unknown values are ignored. */
export type InitialState = { exampleId: string; readAs: string | undefined; fit: string | undefined };

/**
 * Validate ?example= / ?readAs= / ?fit= against the allowed lists.
 * readAs stays undefined when absent or unknown, so the caller falls back to the example's model.
 */
export function initialFromSearch(
  search: string,
  allowed: { examples: readonly string[]; readAs: readonly string[]; fits: readonly string[] },
  defaultExample: string,
): InitialState {
  const q = new URLSearchParams(search);
  const pick = (key: string, list: readonly string[]) => {
    const v = q.get(key);
    return v !== null && list.includes(v) ? v : undefined;
  };
  return {
    exampleId: pick('example', allowed.examples) ?? defaultExample,
    readAs: pick('readAs', allowed.readAs),
    fit: pick('fit', allowed.fits),
  };
}
