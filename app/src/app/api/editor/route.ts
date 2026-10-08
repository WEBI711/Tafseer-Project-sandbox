import { NextResponse } from "next/server";
import { EDITOR_HEADER, isEditor } from "@/lib/editor";

export const dynamic = "force-dynamic";

/** Whether the caller holds the designated editor's key. */
export async function GET(req: Request) {
  return NextResponse.json({ authorized: isEditor(req.headers.get(EDITOR_HEADER)) });
}
