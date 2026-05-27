import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@src/lib/supabaseClient";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status: string };

  const allowed = ["backlog", "in_progress", "done", "dismissed"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_stories")
    .update({ status })
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, status });
}
