// Reader block edits: overrides stored in doc_edit and applied on read, so the
// ingested corpus stays untouched and every client sees edits on next fetch.
import { query } from "@/lib/db";
import { editorName } from "@/lib/auth";

/** Latest edit per reader block, keyed "source_file:ord". */
export async function latestEdits(): Promise<Map<string, string>> {
  const rows = await query<{ source_file: string; ord: number; new_text: string }>(
    `SELECT DISTINCT ON (source_file, ord) source_file, ord, new_text
     FROM doc_edit ORDER BY source_file, ord, edited_at DESC`,
  );
  return new Map(rows.map((r) => [`${r.source_file}:${r.ord}`, r.new_text]));
}

/** Audit one edit (who/when/before/after). A no-op when nothing changed. */
export async function recordEdit(
  sourceFile: string,
  ord: number,
  before: string,
  after: string,
): Promise<void> {
  if (before === after) return;
  await query(
    `INSERT INTO doc_edit (source_file, ord, old_text, new_text, editor)
     VALUES ($1, $2, $3, $4, $5)`,
    [sourceFile, ord, before, after, editorName()],
  );
}
