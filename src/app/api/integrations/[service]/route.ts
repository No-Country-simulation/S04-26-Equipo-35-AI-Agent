import { NextResponse } from "next/server";
import { McpClientManager } from "@src/lib/mcp-client";
import { supabase } from "@src/lib/supabaseClient";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;
    const body = await request.json();

    const mcpManager = McpClientManager.getInstance();
    await mcpManager.connectAll();

    let toolName = "";
    let args: any = {};

    if (service === "jira") {
      toolName = "jira_create_issue";
      args = {
        title: body.title,
        description: body.description || "",
        severity: body.severity || "medium",
        assignee: body.assignee || null
      };
    } else if (service === "slack") {
      toolName = "slack_send_message";
      args = {
        channel: body.channel || "#cx-alerts-producto",
        message: body.message
      };
    } else if (service === "trello") {
      toolName = "trello_create_card";
      args = {
        name: body.name || body.title,
        desc: body.desc || body.description || "",
        listName: body.listName || "Backlog"
      };
    } else {
      return NextResponse.json({ error: `Service ${service} not supported.` }, { status: 400 });
    }

    console.log(`[Integrations Route] Triggering tool ${toolName} with args:`, args);
    const result = await mcpManager.callTool(toolName, args);

    if (result && result.content && result.content[0] && result.content[0].type === "text") {
      try {
        const parsed = JSON.parse(result.content[0].text);

        // Link Jira Issue to the local Kanban card
        if (service === "jira" && body.actionItemId && parsed.success && parsed.ticket_id) {
          const { data: item } = await supabase
            .from("action_items")
            .select("notes")
            .eq("id", body.actionItemId)
            .single();

          const currentNotes = item?.notes || "";
          if (!currentNotes.includes(`[JIRA: ${parsed.ticket_id}]`)) {
            const updatedNotes = `[JIRA: ${parsed.ticket_id}] ${currentNotes}`.trim();
            await supabase
              .from("action_items")
              .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
              .eq("id", body.actionItemId);
          }
        }

        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ raw: result.content[0].text });
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error(`[Integrations Route] Error executing MCP tool:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
