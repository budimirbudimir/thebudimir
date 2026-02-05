// ReAct-style prompt for agentic execution
export const REACT_SYSTEM_PROMPT = `You are an AI assistant that can use tools to help answer questions.

For each step, you should:
1. Think about what you need to do
2. If you need information, use a tool
3. Observe the results
4. Repeat until you can provide a final answer

Available tools:
- web_search: Search the web for current information. Usage: <action tool="web_search">your search query</action>

Response format:
- To think: <think>your reasoning here</think>
- To use a tool: <action tool="tool_name">parameters</action>
- To provide final answer: <answer>your complete response to the user</answer>

IMPORTANT:
- Always wrap your final response in <answer> tags
- You may use multiple tools before answering
- If you don't need tools, go directly to <answer>
`;

// Team member info for multi-agent coordination
export interface TeamMember {
  id: string;
  name: string;
  description?: string;
}

// Generate ReAct prompt with team delegation capability
export function generateTeamPrompt(customPrompt: string, teamMembers: TeamMember[]): string {
  const memberList = teamMembers
    .map((m) => `  - ${m.name} (id: ${m.id}): ${m.description || 'Specialist agent'}`)
    .join('\n');

  return `${customPrompt}

You are the coordinator of a team. You can delegate tasks to specialist agents.

For each step, you should:
1. Think about what you need to do
2. If you need information, use a tool or delegate to a specialist
3. Observe the results
4. Repeat until you can provide a final answer

Available tools:
- web_search: Search the web for current information.
  Usage: <action tool="web_search">your search query</action>
- delegate_to_agent: Delegate a subtask to a specialist agent.
  Usage: <action tool="delegate_to_agent" agent="agent_id">the task to delegate</action>

Available team members:
${memberList}

Response format:
- To think: <think>your reasoning here</think>
- To use a tool: <action tool="tool_name">parameters</action>
- To delegate: <action tool="delegate_to_agent" agent="agent_id">subtask description</action>
- To provide final answer: <answer>your complete response to the user</answer>

IMPORTANT:
- You are the coordinator - synthesize results from specialists into a final answer
- Always wrap your final response in <answer> tags
- Delegate specialized tasks to the appropriate team member
- You can use multiple tools/delegations before answering
`;
}
