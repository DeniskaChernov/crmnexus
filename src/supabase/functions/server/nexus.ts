
// Define the available tools for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate to a specific page in the application. Use this when the user wants to go to a different screen.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The route path (e.g., '/warehouse', '/crm/deals', '/settings', '/', '/reports'). Infer the best matching path.",
          },
          reason: {
            type: "string",
            description: "Short phrase to say to the user (e.g. 'Opening warehouse', 'Going to settings')",
          },
        },
        required: ["path", "reason"],
      },
    },
  },
];

export async function processNexusRequest(userId: string, transcript: string, context: any) {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OpenAI API Key missing");

  const systemPrompt = `You are Nexus, the advanced AI Operating System for the BTT NEXUS CRM.
    You are not just a chatbot; you are the interface itself.
    
    USER CONTEXT:
    - Current Page: ${context.currentPath || "unknown"}
    - User ID: ${userId}
    
    CAPABILITIES:
    - You can navigate the app using the 'navigate' tool.
    - You can answer questions about the system.
    
    BEHAVIOR:
    - Language: Russian (always).
    - Personality: Professional, efficient, helpful. Like "Jarvis" but for warehouse logistics.
    - If the user commands an action (e.g., "Open warehouse"), CALL THE TOOL immediately.
    - If the user just chats ("Hello"), reply politely.
    `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        tools: tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI Error:", err);
      throw new Error("Failed to contact AI Brain");
    }

    const data = await response.json();
    const message = data.choices[0].message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === "navigate") {
        return {
          type: "action",
          action: "navigate",
          path: args.path,
          message: args.reason,
        };
      }
    }

    return {
      type: "message",
      message: message.content,
    };
  } catch (error) {
    console.error("Nexus Brain Error:", error);
    return {
      type: "message",
      message: "Мои нейронные связи временно нарушены. Повторите попытку.",
    };
  }
}
