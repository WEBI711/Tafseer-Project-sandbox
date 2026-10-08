/** Client-safe editor identity types; no DB imports. */

/**
 * Who may edit the document text: one designated editor, authorized by a
 * shared key the operator sets via env (TAFSEER_EDITOR_KEY). Clients send the
 * key in EDITOR_HEADER; a request without the right key is rejected.
 */
export const EDITOR_HEADER = "x-editor-key";

export type Editor = { name: string; key: string };

export function isEditor(key: string | null): boolean {
  const expected = process.env.TAFSEER_EDITOR_KEY;
  return Boolean(expected && key && key === expected);
}
