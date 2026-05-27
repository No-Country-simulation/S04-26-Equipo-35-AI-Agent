const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { createMcpExpressApp } = require("@modelcontextprotocol/sdk/server/express.js");
const z = require("zod");

function runServer(name, port, registerToolsFn) {
  const app = createMcpExpressApp();
  const transports = {};

  const server = new McpServer({
    name: name,
    version: "1.0.0"
  }, { capabilities: {} });

  registerToolsFn(server);

  app.get("/mcp", async (req, res) => {
    try {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      transport.onclose = () => {
        console.log(`[${name}] SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };

      await server.connect(transport);
      console.log(`[${name}] Established SSE session: ${sessionId}`);
    } catch (error) {
      console.error(`[${name}] Error establishing SSE stream:`, error);
      if (!res.headersSent) {
        res.status(500).send("Error establishing SSE stream");
      }
    }
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      res.status(400).send("Missing sessionId parameter");
      return;
    }
    const transport = transports[sessionId];
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error(`[${name}] Error handling request:`, error);
      if (!res.headersSent) {
        res.status(500).send("Error handling request");
      }
    }
  });

  app.listen(port, (err) => {
    if (err) {
      console.error(`[${name}] Failed to start on port ${port}:`, err);
      return;
    }
    console.log(`[${name}] running on port ${port}. SSE URL: http://localhost:${port}/mcp`);
  });

  return { server, transports };
}

// 1. Jira Server (Port 3010)
runServer("Jira Mock Server", 3010, (server) => {
  server.registerTool(
    "jira_create_issue",
    {
      description: "Crea una issue o historia de usuario en Jira",
      inputSchema: z.object({
        title: z.string().describe("Título de la issue o historia de usuario"),
        description: z.string().describe("Descripción detallada del problema o criterios de aceptación"),
        severity: z.enum(["critical", "high", "medium", "low"]).describe("Nivel de severidad"),
        assignee: z.string().optional().describe("Nombre del equipo o persona responsable")
      })
    },
    async ({ title, description, severity, assignee }) => {
      const ticketId = `CONV-${Math.floor(100 + Math.random() * 900)}`;
      console.log(`[Jira Server] Creando ticket: ${ticketId} - ${title}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              ticket_id: ticketId,
              url: `https://jira.atlassian.com/browse/${ticketId}`,
              message: `Ticket Jira ${ticketId} creado exitosamente y asignado al equipo ${assignee || 'Sin asignar'}.`
            })
          }
        ]
      };
    }
  );
});

// 2. Slack Server (Port 3011)
runServer("Slack Mock Server", 3011, (server) => {
  server.registerTool(
    "slack_send_message",
    {
      description: "Envía un mensaje formateado a un canal de Slack",
      inputSchema: z.object({
        channel: z.string().describe("Canal de Slack, ej: #cx-alerts-producto, #cx-alerts-dev"),
        message: z.string().describe("Mensaje formateado a enviar")
      })
    },
    async ({ channel, message }) => {
      console.log(`[Slack Server] Enviando mensaje a ${channel}:\n${message}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              channel: channel,
              message: `Mensaje enviado con éxito al canal ${channel}.`
            })
          }
        ]
      };
    }
  );
});

// 3. Trello Server (Port 3012)
runServer("Trello Mock Server", 3012, (server) => {
  server.registerTool(
    "trello_create_card",
    {
      description: "Crea una tarjeta en un tablero de Trello",
      inputSchema: z.object({
        name: z.string().describe("Nombre o título de la tarjeta Trello"),
        desc: z.string().describe("Descripción o notas detalladas"),
        listName: z.string().optional().describe("Nombre de la lista (ej: Backlog, En desarrollo)")
      })
    },
    async ({ name, desc, listName }) => {
      const cardId = `tre-${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[Trello Server] Creando tarjeta: ${name} en lista ${listName || 'Backlog'}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              card_id: cardId,
              url: `https://trello.com/c/${cardId}`,
              message: `Tarjeta "${name}" creada en Trello en la lista ${listName || 'Backlog'}.`
            })
          }
        ]
      };
    }
  );
});

console.log("Mock MCP servers running successfully!");
