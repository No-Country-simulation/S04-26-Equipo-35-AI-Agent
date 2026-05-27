import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, stepCountIs, tool } from "ai";
import { copilotTools } from "@src/lib/copilot-tools";
import { McpClientManager } from "@src/lib/mcp-client";
import { z } from "zod";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "",
});

const SYSTEM_PROMPT = `Sos el **Copiloto Analítico de ConversaAI**, asistente estratégico del equipo de producto.
Tu objetivo: ayudar a los PMs a tomar decisiones basadas en el comportamiento real de los clientes.

## CUÁNDO USAR CADA HERRAMIENTA (elegí la más específica)

- **get_global_kpis** → preguntas sobre números generales: churn, tasa de resolución global, abandono, frustración promedio.
- **get_intent_impact_matrix** → preguntas sobre qué tipos de solicitudes tienen más fricción, peor resolución o mayor impacto en el negocio.
- **get_frustrated_sessions** → preguntas sobre clientes específicos, casos concretos o sesiones con alto malestar.
- **search_conversations** → preguntas que piden ejemplos, frases reales de clientes, o evidencia concreta de un problema. SIEMPRE usarla cuando el usuario dice "ejemplos", "qué dice la gente", "conversaciones", "casos reales".
- **get_priority_user_stories** → preguntas sobre backlog, qué tiene el equipo priorizado, o historias de usuario existentes.
- **create_kanban_action** → el PM pide crear, registrar, planificar o derivar una acción o tarea local en el tablero.
- **jira_create_issue** → el PM pide exportar, transferir, o crear un ticket en Jira.
- **slack_send_message** → el PM pide enviar un mensaje, notificar o alertar por Slack.
- **trello_create_card** → el PM pide crear una tarjeta en Trello.

## REGLAS CRÍTICAS

- Usá cada herramienta **MÁXIMO UNA VEZ** por respuesta.
- Después de recibir el resultado de una herramienta, respondé **INMEDIATAMENTE** con texto. NO repitas la misma herramienta ni llames otra innecesariamente.
- Si ya tenés los datos, NO uses más herramientas.
- Respondé **SIEMPRE en español**.
- NO inventes métricas ni citas. Solo datos reales de las herramientas.
- Cuando crees una acción con \`create_kanban_action\`, confirmá al usuario incluyendo el título y a quién fue asignada, y sugerí visitar /acciones para verla en el tablero.
- Cuando crees un ticket o envíes un mensaje externo vía MCP (Jira, Slack, Trello), confirmale al usuario el ID generado y el enlace que devuelva la herramienta.

## FORMATO DE RESPUESTA

Para diagnósticos y análisis, estructurá así:

**Diagnóstico** — qué está pasando con la métrica o el flujo
**Evidencia** — datos concretos, sesiones o citas que lo confirman
**Próximo paso recomendado** — qué debería hacer el equipo de producto

Si la pregunta es simple (un número, una aclaración puntual), respondé directamente sin esa estructura.

## ESTILO

- Markdown: tablas para comparaciones, listas para múltiples items, **negritas** para números clave.
- Al citar sesiones usá backticks: Sesión \`abc-123\`.
- Lenguaje PM: "solicitudes" (no intents), "tasa de resolución" (no IRR), "fricción" (no loop), "malestar" (no frustration score).
- Conciso y accionable. Máximo 350 palabras por respuesta.

## CONTEXTO DE LOS DATOS

- Frustración: escala 0–2 (0=ok, 2=muy frustrado). Promedio >0.5 es señal de alerta.
- Tasa de resolución: % sesiones resueltas. Menos de 50% es crítico para cualquier tipo de solicitud.
- Churn risk: alta probabilidad de que el cliente se haya ido sin resolver su problema.
- Abandono: el cliente cerró el chat antes de recibir respuesta.
- Idiomas en el dataset: ES (español LATAM) y PT (portugués Brasil).
- Período actual de métricas: snapshot mensual más reciente disponible.`;

function jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  
  if (jsonSchema && jsonSchema.type === "object" && jsonSchema.properties) {
    const requiredFields = jsonSchema.required || [];
    
    for (const [key, prop] of Object.entries(jsonSchema.properties as Record<string, any>)) {
      let fieldSchema: z.ZodTypeAny;
      
      switch (prop.type) {
        case "string":
          if (prop.enum) {
            fieldSchema = z.enum(prop.enum as [string, ...string[]]);
          } else {
            fieldSchema = z.string();
          }
          break;
        case "number":
        case "integer":
          fieldSchema = z.number();
          break;
        case "boolean":
          fieldSchema = z.boolean();
          break;
        case "array":
          fieldSchema = z.array(z.any());
          break;
        default:
          fieldSchema = z.any();
      }
      
      if (prop.description) {
        fieldSchema = fieldSchema.describe(prop.description);
      }
      
      if (!requiredFields.includes(key)) {
        fieldSchema = fieldSchema.optional();
      }
      
      shape[key] = fieldSchema;
    }
  }
  
  return z.object(shape);
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  // Dynamic MCP Tools Loading
  const mcpToolsMapped: Record<string, any> = {};
  try {
    const mcpManager = McpClientManager.getInstance();
    await mcpManager.connectAll();
    const mcpTools = mcpManager.getTools();

    for (const mcpTool of mcpTools) {
      mcpToolsMapped[mcpTool.name] = tool({
        description: mcpTool.description,
        execute: async (args) => {
          const result = await mcpManager.callTool(mcpTool.name, args);
          if (result && result.content && result.content[0] && result.content[0].type === "text") {
            return result.content[0].text;
          }
          return JSON.stringify(result);
        },
        inputSchema: jsonSchemaToZod(mcpTool.inputSchema)
      });
    }
  } catch (err) {
    console.error("[Chat Route] Error loading dynamic MCP tools:", err);
  }

  const combinedTools = {
    ...copilotTools,
    ...mcpToolsMapped
  };

  const result = streamText({
    model: groq("qwen/qwen3-32b"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: combinedTools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
