#!/usr/bin/env node
// CLI entry: `node offline-agents/run.mjs <agent> "<prompt>"`
// Default agent: pm.

import { runAgent, agents, config } from "./runtime.mjs";

function usage() {
  const keys = Object.keys(agents).join("|");
  console.error(`Usage: node offline-agents/run.mjs [${keys}] "<prompt>"`);
  console.error(`Model: ${config.model}  Host: ${config.host}`);
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  usage();
  process.exit(1);
}

let agentKey = "pm";
let prompt;
if (agents[argv[0]]) {
  agentKey = argv[0];
  prompt = argv.slice(1).join(" ");
} else {
  prompt = argv.join(" ");
}

if (!prompt) {
  usage();
  process.exit(1);
}

try {
  const out = await runAgent(agentKey, prompt);
  process.stdout.write(out + "\n");
} catch (err) {
  console.error(`[run] ${err.message}`);
  process.exit(1);
}
