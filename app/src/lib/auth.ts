/** The designated editor is authorized by a shared secret (EDITOR_TOKEN); an
 * optional EDITOR_NAME records who made each edit. No token configured means
 * editing is off. */
export function isEditor(req: Request): boolean {
  const token = process.env.EDITOR_TOKEN;
  return Boolean(token) && req.headers.get("authorization") === `Bearer ${token}`;
}

export function editorName(): string {
  return process.env.EDITOR_NAME ?? "editor";
}
