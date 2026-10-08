import { NextResponse } from "next/server";
import { takeaways } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const view = await takeaways(Number(number));
  if (!view) return NextResponse.json({ error: "no takeaways found" }, { status: 404 });
  return NextResponse.json(view);
}
