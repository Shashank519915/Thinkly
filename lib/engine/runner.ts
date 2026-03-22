import { createClient } from "@supabase/supabase-js";
import { WorkflowNode, WorkflowEdge } from '@/types/workflow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { decrypt, getSecretToken } from '@/lib/crypto';

export interface RunLog {
  nodeId: string;
  nodeLabel?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  input?: any;
  output?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  timestamp: string; // For backward compatibility or main display
}

export class AutomationRunner {
  private instanceId: string;
  private userId: string;
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private logs: RunLog[] = [];
  private integrations: Record<string, string> = {};

  // Public for access within class logic
  private _triggerData: any = {};
  private _inputData: any = {};

  constructor(instanceId: string, userId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    this.instanceId = instanceId;

    this.userId = userId;
    this.nodes = nodes;
    this.edges = edges;
  }

  private async fetchIntegrations() {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', this.userId);

    if (error) throw error;

    data.forEach(integration => {
      try {
        const decryptedValue = getSecretToken(integration.encrypted_secret);
        this.integrations[integration.service_name] = decryptedValue;
      } catch (e) {
        console.error(`Failed to decrypt integration for ${integration.service_name}:`, e);
      }
    });
  }

  private async updateStatus(status: string, currentStep?: string) {
    await supabase
      .from('automation_instances')
      .update({
        status,
        logs: this.logs,
        current_step_id: currentStep,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.instanceId);
  }

  private addLog(log: Omit<RunLog, 'timestamp'>) {
    this.logs.push({ ...log, timestamp: new Date().toISOString() });
  }

  async run() {
    try {
      await this.updateStatus('running');
      await this.fetchIntegrations();

      // Fetch trigger/input data if available from DB
      const { data: instanceData } = await supabase
        .from('automation_instances')
        .select('trigger_data, input_data')
        .eq('id', this.instanceId)
        .single();

      const triggerData = (instanceData as any)?.trigger_data || {};
      const inputData = (instanceData as any)?.input_data || {};
      this._triggerData = triggerData;
      this._inputData = inputData;

      // Initialize logs with placeholders
      this.logs = this.nodes.map(n => ({
        nodeId: n.id,
        nodeLabel: n.label,
        status: 'pending',
        input: {},
        output: {},
        startedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }));

      // If the first node is a trigger, we pre-fill its output with triggerData
      if (this.nodes[0] && this.nodes[0].type === 'trigger') {
        const log = this.logs[0];
        log.status = 'success';
        log.output = triggerData;
        log.completedAt = new Date().toISOString();
        // Skip execution of the trigger node itself as we have the data
      }

      let currentNodeId = (this.nodes[0]?.type === 'trigger') ? this.getNextNodeId(this.nodes[0], triggerData) : this.nodes[0]?.id;

      while (currentNodeId) {
        const node = this.nodes.find(n => n.id === currentNodeId);
        if (!node) break;

        const log = this.logs.find(l => l.nodeId === node.id)!;
        log.status = 'running';
        log.startedAt = new Date().toISOString();

        // Granular update to DB
        await this.updateStatus('running', node.id);

        try {
          const result = await this.executeNode(node);
          log.status = 'success';
          log.output = result;
          log.completedAt = new Date().toISOString();
          currentNodeId = this.getNextNodeId(node, result);
        } catch (err: any) {
          log.status = 'failed';
          log.error = err.message;
          log.completedAt = new Date().toISOString();
          await this.updateStatus('failed', node.id);
          throw err;
        }
      }

      await this.updateStatus('success');
    } catch (err: any) {
      console.error("Automation Run Error:", err);
      // Ensure we mark the whole instance as failed
      await this.updateStatus('failed');
    }
  }

  private async executeNode(node: WorkflowNode): Promise<any> {
    const hydratedPrompt = this.resolveTemplates(node.description || "");

    console.log(`Executing node: ${node.label} (${node.tool})`);

    const tool = node.tool?.toLowerCase();

    if (tool === 'openai' || tool === 'ai' || tool?.includes('gemini')) {
      const res = await this.runAINode(node, hydratedPrompt);
      console.log(`\n============== [AI Node Output]==============\nRAW Text:\n${res.text}\n\n[Parsed JSON]:\n${JSON.stringify(res.jsonOutput, null, 2)}\n=============================================\n`);
      return res;
    } else if (tool === 'googlesheets' || tool === 'sheets' || tool === 'google sheets') {
      const res = await this.runSheetsNode(node, hydratedPrompt);
      console.log(`[Google Sheets Node] Appended Row(s). Spreadhseet Output:`, res.updates ? res.updates.updatedRows : res);
      return res;
    } else if (tool === 'gmail' || tool?.includes('gmail')) {
      const res = await this.runGmailNode(node, hydratedPrompt);
      console.log(`[Gmail Node] Email Sent! Output:`, res);
      return res;
    }

    return { message: `Executed ${node.label} (Mock)`, timestamp: new Date().toISOString() };
  }

  private resolveObject(obj: any): any {
    if (typeof obj === 'string') return this.resolveTemplates(obj);
    if (Array.isArray(obj)) return obj.map(o => this.resolveObject(o));
    if (typeof obj === 'object' && obj !== null) {
      const res: any = {};
      for (const k in obj) res[k] = this.resolveObject(obj[k]);
      return res;
    }
    return obj;
  }

  private resolveTemplates(text: string): string {
    const context: Record<string, any> = {
      $trigger: {},
      $input: {}
    };

    // 1. Fill logs context
    let lastAiOutput: any = null;
    this.logs.forEach(l => {
      if (l.status === 'success' && l.output) {
        context[l.nodeId] = l.output;
        if (l.output.jsonOutput && !lastAiOutput) {
          lastAiOutput = l.output;
        }
      }
    });

    if (lastAiOutput) {
      context['$ai_extract_data_1'] = lastAiOutput;
      context['$ai'] = lastAiOutput;
    }

    // 2. Setup trigger/input aliases
    if (this._triggerData) {
      context['$trigger'] = { ...this._triggerData };

      // Auto-Parse traditional standard FROM addresses
      const fromVal = context['$trigger'].from;
      if (typeof fromVal === 'string') {
        const match = fromVal.match(/(.*?)<(.*?)>/);
        if (match) {
          context['$trigger'].from = {
            name: match[1].replace(/"/g, '').trim(),
            email: match[2].trim(),
            raw: fromVal
          };
        } else {
          context['$trigger'].from = { name: fromVal.split('@')[0], email: fromVal, raw: fromVal };
        }
      }
    }
    if (this._inputData) {
      context['$input'] = { ...this._inputData };
    }

    // 3. Robust Resolver Helper
    const getValue = (path: string): any => {
      // Handle conditional expressions like {{ $error ? ... : ... }}
      // If it contains a `?`, evaluate it as a JS expression against the context.
      if (path.includes('?')) {
        try {
          const evalFunc = new Function('$error', '$trigger', '$ai', '$input', `return ${path.trim()}`);
          return evalFunc(context['$error'], context['$trigger'], context['$ai'], context['$input']);
        } catch (e) {
          console.error("[Hydrator] Expression Eval Error:", e);
          // Fallback to standard logic if eval fails
        }
      }

      // Handle fallback logic (||)
      if (path.includes('||')) {
        const options = path.split('||');
        for (const opt of options) {
          const res = getValue(opt.trim());
          const isFalsyStr = typeof res === 'string' && (res.toLowerCase() === 'unknown' || res.toLowerCase() === 'n/a');
          if (res !== undefined && res !== null && res !== "" && !isFalsyStr && res !== matchString(opt.trim())) return res;
        }
        return undefined;
      }

      // Handle literals (e.g. 'there')
      if ((path.startsWith("'") && path.endsWith("'")) || (path.startsWith('"') && path.endsWith('"'))) {
        return path.slice(1, -1);
      }

      // Standard path traversal
      const parts = path.trim().replace(/^\$/, '').split('.');
      let current: any = context;
      
      // If the first part is a known root ($trigger, $input, $ai), start there
      const firstPart = parts[0];
      if (context[`$${firstPart}`]) {
        current = context[`$${firstPart}`];
        parts.shift();
      } else if (context[firstPart]) {
        // Handle cases where the key might not have a leading $ in user blueprint
        current = context[firstPart];
        parts.shift();
      }

      for (const part of parts) {
        if (!current) return undefined;
        
        let next = current[part];
        
        // Fuzzy match: if direct fails, try snake_case vs camelCase
        if (next === undefined) {
          const keys = Object.keys(current);
          const fuzzyMatch = keys.find(k => 
            k.replace(/_/g, '').toLowerCase() === part.replace(/_/g, '').toLowerCase()
          );
          if (fuzzyMatch) next = current[fuzzyMatch];
        }
        
        current = next;
      }
      return current;
    };

    const matchString = (str: string) => `{{${str}}}`;

    console.log(`[Hydrator] Context Keys: ${Object.keys(context).join(', ')}`);

    return text.replace(/\{\{(.+?)\}\}/g, (match, path) => {
      const result = getValue(path.trim());
      console.log(`[Hydrator] Path: ${path.trim()} -> Result: ${typeof result === 'string' ? result.substring(0, 30) + '...' : (result !== undefined ? '[Value]' : 'UNDEFINED')}`);
      
      // If result is null/undefined, return empty string to avoid showing raw {{code}} in output
      if (result === undefined || result === null) return "";
      return typeof result === 'object' ? JSON.stringify(result) : String(result);
    });
  }

  private async runAINode(node: WorkflowNode, prompt: string): Promise<any> {
    // 0. SMART INJECTOR: If the prompt doesn't seem to contain the dynamic data (no {{}} or short), 
    // and we have trigger body, append it automatically.
    let finalPrompt = prompt;
    const hasDynamicTag = (node.description || "").includes('{{');
    const triggerBody = this._triggerData?.body?.plainText || this._triggerData?.body;

    if (!hasDynamicTag && triggerBody) {
       console.log(`[Smart Injector] No data tag found in AI node. Auto-appending email body.`);
       finalPrompt = `${prompt}\n\n--- EMAIL BODY ---\n${triggerBody}`;
    }

    // SWITCH: Using Gemini API (v1.5 Flash) due to OpenAI quota limits
    const geminiKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY_2 not found in environment. Please add it to Vercel/local env.");

    // Safely strip HTML out of raw emails to aggressively conserve tokens.
    const cleanPrompt = finalPrompt.replace(/<[^>]*>?/gm, '').substring(0, 10000);
    const systemInstruction = "You are an automated extraction engine. Always output ONLY raw JSON formatted exactly as requested. Do not wrap in markdown tags like ```json.";

    console.log(`[AI Node] Prompt Sent to Gemini: ${cleanPrompt.substring(0, 200)}...`);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemInstruction}\n\nEmail Text to analyze:\n${cleanPrompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(`Gemini API Error: ${errData.error?.message || "Unknown error"}`);
    }

    const result = await res.json();
    const textMsg = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let jsonOutput = null;
    try {
      // Gemini Flash with responseMimeType usually returns clean JSON
      const trimmed = textMsg.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        jsonOutput = JSON.parse(trimmed);
      } else {
        // Fallback: search for JSON in markdown-wrapped response
        const jsonMatch = textMsg.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const str = jsonMatch ? jsonMatch[1] : textMsg;
        jsonOutput = JSON.parse(str.trim());
      }
    } catch (e) {
      console.error("JSON Parse Error in AI Node:", e);
    }

    return { text: textMsg, jsonOutput };
  }

  private async runSheetsNode(node: WorkflowNode, input: string): Promise<any> {
    const token = this.integrations['google'];
    if (!token) throw new Error("Google integration not found. Please connect it in the Integrations tab.");

    const config = this.resolveObject((node as any).config || {});
    const apiEndpoint = this.resolveTemplates((node as any).apiEndpoint || "");

    // Parse the endpoint: POST /spreadsheets/v4/{spreadsheetId}/sheets/{sheetName}/rows
    // Or just extract the spreadsheetId and sheetName
    let spreadsheetId = config.spreadsheetId || this._inputData?.spreadsheetId;
    let sheetName = config.sheetName || this._inputData?.sheetName || 'Sheet1';

    if (apiEndpoint) {
      const match = apiEndpoint.match(/spreadsheets\/([^/]+)\/sheets\/([^/]+)/);
      if (match) {
        spreadsheetId = match[1];
        sheetName = match[2];
      }
    }

    if (!spreadsheetId) throw new Error("Missing spreadsheetId for Google Sheets node.");

    const range = `${sheetName}!A1`;
    const values = config.values || [input];

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [values] })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Google Sheets API Error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return { message: "Appended to Google Sheet", data };
  }

  private async runGmailNode(node: WorkflowNode, input: string): Promise<any> {
    const token = this.integrations['google'];
    if (!token) throw new Error("Google integration not found (needed for Gmail).");

    const config = this.resolveObject((node as any).config || {});
    const to = config.to || this._inputData?.to;
    const subject = config.subject || this._inputData?.subject || "No Subject";
    const body = config.body || this._inputData?.body || input;
    const threadId = config.threadId || this._inputData?.threadId; // Optional

    if (!to) throw new Error("Missing 'to' address for Gmail node.");

    // Construct raw email RFC 2822 format
    let rawStr = `To: ${to}\r\n`;
    rawStr += `Subject: ${subject}\r\n`;
    if (config.inReplyTo) {
      rawStr += `In-Reply-To: ${config.inReplyTo}\r\n`;
      rawStr += `References: ${config.inReplyTo}\r\n`;
    }
    rawStr += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    rawStr += body;

    // Custom Base64 URL encode
    const encodedEmail = Buffer.from(rawStr).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const reqBody: any = { raw: encodedEmail };
    if (threadId) reqBody.threadId = threadId;

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Gmail API Error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return { message: "Email sent successfully", data };
  }

  private getNextNodeId(node: WorkflowNode, result: any): string | undefined {
    // Check for success/failure paths if they exist
    if (result && result.success === false) {
      const falseNext = (node as any).falseNextNodes || (node as any).false_next_nodes || [];
      if (falseNext.length > 0) return falseNext[0];
    }

    const nextArr = node.nextNodes || (node as any).next_nodes || [];
    return nextArr[0];
  }
}
