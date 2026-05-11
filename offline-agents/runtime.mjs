// Minimal local-agent harness. Talks to Ollama's HTTP API.
// Zero deps; requires Node 18+ (global fetch).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "events.jsonl");

export const config = {
  host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL || "kimi-k2",
};

export function logEvent(kind, payload) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const line = JSON.stringify({ t: new Date().toISOString(), kind, ...payload });
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export async function ollamaChat({ messages, model = config.model, host = config.host }) {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

export const agents = {
  pm: {
    name: "project-manager",
    system: [
      "You are the Project Manager agent for an offline-first AI dev workflow.",
      "Your job: summarize work, maintain a single source of truth (SSOT), and",
      "produce concise next-step checklists. Output sections: SUMMARY, SSOT_DELTA,",
      "NEXT_STEPS. Keep each section under 10 short bullets. No fluff.",
    ].join(" "),
  },
  helper: {
    name: "code-helper",
    system: [
      "You are the Code Helper agent. Given a task and minimal context, produce",
      "small, targeted diffs or code snippets. Prefer Node/TypeScript idioms.",
      "Call out unknowns explicitly instead of inventing APIs.",
    ].join(" "),
  },
};

export async function runAgent(agentKey, userInput, history = []) {
  const agent = agents[agentKey];
  if (!agent) throw new Error(`Unknown agent: ${agentKey}`);
  const messages = [
    { role: "system", content: agent.system },
    ...history,
    { role: "user", content: userInput },
  ];
  logEvent("agent_request", { agent: agent.name, model: config.model, input: userInput });
  const content = await ollamaChat({ messages });
  logEvent("agent_response", { agent: agent.name, output: content });
  return content;
}
