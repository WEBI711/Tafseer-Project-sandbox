import { NextResponse } from "next/server";
import { isEditor } from "@/lib/auth";
import { recordEdit } from "@/lib/edits";
import { surahView } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Authenticated text edit for one reader block of a surah. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  if (!isEditor(req)) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { number } = await params;
  const body = await req.json().catch(() => null);
  const sourceFile = typeof body?.source_file === "string" ? body.source_file : null;
  const ord = Number(body?.ord);
  const text = typeof body?.text === "string" ? body.text : null;
  if (!sourceFile || !Number.isInteger(ord) || text === null) {
    return NextResponse.json({ error: "source_file, ord and text are required" }, { status: 400 });
  }

  // Recompute the view to find the block as readers currently see it; the
  // shown text becomes the audit row's "before".
  const view = await surahView(Number(number));
  const block = view?.documents
    .find((d) => d.source_file === sourceFile)
    ?.blocks.find((b) => b.ord === ord);
  if (!block) return NextResponse.json({ error: "block not found" }, { status: 404 });

  await recordEdit(sourceFile, ord, block.text, text);
  return NextResponse.json({ ok: true, text });
}
