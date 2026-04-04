import { WorkflowNode } from "@/types/workflow";

export function generateN8nSchema(nodes: WorkflowNode[]) {
  // Mapping our simplified DAG to an n8n-compatible JSON schema structure
  const n8nNodes = nodes.map((node, index) => {
    // Generate positional coordinates (staggered mapping logic)
    const position = [250 + (index * 200), 300 + (index % 2 === 0 ? 0 : 150)];

    let type = "n8n-nodes-base.httpRequest";
    let parameters: Record<string, any> = {
      url: node.apiEndpoint?.split(" ")[1] || "https://api.example.com",
      method: node.apiEndpoint?.split(" ")[0] || "GET"
    };

    if (node.type === "trigger") {
      type = "n8n-nodes-base.webhook";
      parameters = { path: `webhook-${node.id}`, httpMethod: "POST" };
    } else if (node.type === "condition") {
      type = "n8n-nodes-base.if";
      parameters = { conditions: { string: [{ value1: "", value2: "" }] } };
    } else if (node.type === "error") {
      type = "n8n-nodes-base.stopAndError";
      parameters = { errorMessage: node.description };
    } else if (node.label.toLowerCase().includes("batch") || node.description.toLowerCase().includes("batch")) {
      type = "n8n-nodes-base.splitInBatches";
      parameters = { batchSize: 50 };
    } else if (node.tool?.toLowerCase().includes("gemini") || node.tool?.toLowerCase().includes("ai")) {
      type = "n8n-nodes-base.googleGemini";
      parameters = { resource: "message", operation: "create", model: "models/gemini-1.5-pro", prompt: node.description };
    } else if (node.tool?.toLowerCase().includes("notion") || node.label.toLowerCase().includes("notion")) {
      type = "n8n-nodes-base.notion";
      parameters = { resource: "databasePage", operation: "create", databaseId: "YOUR_NOTION_DB_ID" };
    } else if (node.tool?.toLowerCase().includes("slack") || node.label.toLowerCase().includes("slack")) {
      type = "n8n-nodes-base.slack";
      parameters = { resource: "message", operation: "post", channel: "#general", text: node.description };
    } else if (node.tool?.toLowerCase().includes("airtable") || node.label.toLowerCase().includes("airtable")) {
      type = "n8n-nodes-base.airtable";
      parameters = { resource: "record", operation: "create", baseId: "YOUR_BASE_ID", tableId: "YOUR_TABLE_NAME" };
    } else if (node.tool?.toLowerCase().includes("redis") || node.label.toLowerCase().includes("idempotency")) {
      type = "n8n-nodes-base.redis";
      parameters = { operation: "get", key: "={{$json.id}}" };
    }

    return {
      parameters,
      id: node.id,
      name: node.label,
      type,
      typeVersion: 1,
      position,
      notesInFlow: true,
      notes: node.description
    };
  });

  const n8nConnections: Record<string, any> = {};

  nodes.forEach(node => {
    if (node.nextNodes && node.nextNodes.length > 0) {
      n8nConnections[node.label] = {
        main: [
          node.nextNodes.map(targetId => {
            const targetNode = nodes.find(n => n.id === targetId);
            return {
              node: targetNode?.label || targetId,
              type: "main",
              index: 0
            };
          })
        ]
      };
    }
  });

  return {
    meta: {
      templateCredsSetupCompleted: true
    },
    nodes: n8nNodes,
    connections: n8nConnections,
    settings: {
      executionOrder: "v1"
    }
  };
}
