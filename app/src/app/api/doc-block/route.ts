import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { EDITOR_HEADER, isEditor } from "@/lib/editor";

export const dynamic = "force-dynamic";

/**
 * Authenticated update of one doc_block's text. Every edit is audited
 * (who/when/before/after) and written to doc_block itself, so every client's
 * next fetch of the document shows the new text.
 */
export async function PUT(req: Request) {
  if (!isEditor(req.headers.get(EDITOR_HEADER))) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { sourceFile, kind, text, after, editor } = (await req.json()) as {
    sourceFile?: string;
    kind?: string;
    text?: string;
    after?: string;
    editor?: string;
  };
  if (!sourceFile || !kind || !text?.trim() || !after?.trim() || !editor?.trim()) {
    return NextResponse.json(
      { error: "sourceFile, kind, text, after and editor required" },
      { status: 400 },
    );
  }

  // The reader's blocks are derived, so the edit targets the doc_block whose
  // text matches what the reader showed: exact kind first, then any kind.
  const cols = "id, text" as const;
  let rows = await query<{ id: number; text: string }>(
    `SELECT ${cols} FROM doc_block
     WHERE source_file = $1 AND kind = $2 AND text = $3 ORDER BY ord LIMIT 1`,
    [sourceFile, kind, text],
  );
  if (!rows.length) {
    rows = await query<{ id: number; text: string }>(
      `SELECT ${cols} FROM doc_block
       WHERE source_file = $1 AND text = $2 ORDER BY ord LIMIT 1`,
      [sourceFile, text],
    );
  }
  if (!rows.length) {
    return NextResponse.json({ error: "block not found" }, { status: 404 });
  }

  const { id, text: before } = rows[0];
  const updated = after.trim();
  if (before === updated) return NextResponse.json({ ok: true });

  await query("UPDATE doc_block SET text = $1 WHERE id = $2", [updated, id]);
  await query(
    `INSERT INTO doc_block_edit (block_id, editor, text_before, text_after)
     VALUES ($1, $2, $3, $4)`,
    [id, editor.trim(), before, updated],
  );
  return NextResponse.json({ ok: true });
}
