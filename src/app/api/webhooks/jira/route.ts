import { NextResponse } from "next/server";
import { supabase } from "@src/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { issue_key, status } = body;

    if (!issue_key || !status) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos: issue_key o status" },
        { status: 400 }
      );
    }

    console.log(`[Jira Webhook] Petición recibida para ticket ${issue_key} con estado: ${status}`);

    // Solo procesamos si el estado indica resolución
    const isResolved =
      status.toLowerCase() === "done" ||
      status.toLowerCase() === "resolved" ||
      status.toLowerCase() === "resuelto";

    if (isResolved) {
      // Buscamos ítems activos que contengan [JIRA: issue_key] en sus notas
      const { data: matchedItems, error: fetchError } = await supabase
        .from("action_items")
        .select("id, title, status, notes")
        .like("notes", `%[JIRA: ${issue_key}]%`);

      if (fetchError) {
        console.error("[Jira Webhook] Error al buscar ítems en Supabase:", fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!matchedItems || matchedItems.length === 0) {
        console.log(`[Jira Webhook] No se encontraron tarjetas asociadas al ticket ${issue_key}`);
        return NextResponse.json({
          success: true,
          message: `No se encontraron tarjetas vinculadas a ${issue_key}`
        });
      }

      const idsToUpdate = matchedItems.map((item) => item.id);
      console.log(`[Jira Webhook] Actualizando tarjetas ${idsToUpdate.join(", ")} a estado 'resolved'`);

      const { error: updateError } = await supabase
        .from("action_items")
        .update({
          status: "resolved",
          updated_at: new Date().toISOString()
        })
        .in("id", idsToUpdate);

      if (updateError) {
        console.error("[Jira Webhook] Error al actualizar tarjetas en Supabase:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Tarjetas vinculadas a ${issue_key} actualizadas a 'Resuelto'.`,
        updated_count: idsToUpdate.length,
        updated_ids: idsToUpdate
      });
    }

    return NextResponse.json({
      success: true,
      message: `El estado es '${status}', no requiere actualización de lazo cerrado.`
    });
  } catch (err) {
    console.error(`[Jira Webhook] Error general procesando webhook:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
