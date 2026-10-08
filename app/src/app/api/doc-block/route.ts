import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { EDITOR_HEADER, isEditor } from "@/lib/editor";

export const dynamic = "force-dynamic";

/**
 * Authenticated update of one reader block's text. The blocks are derived, so
 * an edit is recorded in the audit trail (who/when/before/after) keyed by the
 * text as shown; surahView applies the audit rows over the derived view, so
 * every client's next fetch of the document shows the new text.
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

  const updated = after.trim();
  if (text === updated) return NextResponse.json({ ok: true });

  await query(
    `INSERT INTO doc_block_edit (source_file, kind, text_before, text_after, editor)
     VALUES ($1, $2, $3, $4, $5)`,
    [sourceFile, kind, text, updated, editor.trim()],
  );
  return NextResponse.json({ ok: true });
}
