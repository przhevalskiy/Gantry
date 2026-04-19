// Parses [Role N] prefixed messages into a tree structure for the live monitor.
// Blocked on Bug 1.1 — child workflow messages don't persist yet.
// This module is ready; the data will flow once the bug is fixed.

export type AgentRole = 'Strategist' | 'Scout' | 'Agent' | 'Critic' | 'Verifier' | 'Executor' | 'Orchestrator';

export type AgentNode = {
  id: string;          // e.g. "Scout", "Agent 2", "Executor 0"
  role: AgentRole;
  index: number;
  status: 'running' | 'done' | 'failed';
  lastAction: string;
  messages: string[];
};

const TAG_PATTERN = /^\[(Scout|Agent \d+|Critic|Verifier \d+|Executor \d+|Orchestrator)\]\s*/;

export function parseAgentTag(content: string): { tag: string; body: string } | null {
  const match = content.match(TAG_PATTERN);
  if (!match) return null;
  return { tag: match[1], body: content.slice(match[0].length) };
}

function tagToRole(tag: string): AgentRole {
  if (tag === 'Scout') return 'Scout';
  if (tag === 'Critic') return 'Critic';
  if (tag === 'Orchestrator') return 'Orchestrator';
  if (tag.startsWith('Agent')) return 'Agent';
  if (tag.startsWith('Verifier')) return 'Verifier';
  if (tag.startsWith('Executor')) return 'Executor';
  return 'Agent';
}

function tagToIndex(tag: string): number {
  const m = tag.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function buildAgentTree(messages: { content: string }[]): AgentNode[] {
  const nodes = new Map<string, AgentNode>();

  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : '';
    const parsed = parseAgentTag(text);

    if (parsed) {
      const { tag, body } = parsed;
      if (!nodes.has(tag)) {
        nodes.set(tag, {
          id: tag,
          role: tagToRole(tag),
          index: tagToIndex(tag),
          status: 'running',
          lastAction: body,
          messages: [body],
        });
      } else {
        const node = nodes.get(tag)!;
        node.messages.push(body);
        node.lastAction = body;
        if (body.toLowerCase().includes('done') || body.toLowerCase().includes('complete')) {
          node.status = 'done';
        }
      }
    }
  }

  return Array.from(nodes.values());
}
