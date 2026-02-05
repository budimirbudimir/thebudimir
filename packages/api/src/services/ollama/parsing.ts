// Parse delegate_to_agent action
export function parseDelegation(text: string): { agentId: string; task: string } | null {
  const delegateMatch = text.match(
    /<action\s+tool="delegate_to_agent"\s+agent="([^"]+)">(.*?)<\/action>/s,
  );
  if (delegateMatch) {
    return { agentId: delegateMatch[1], task: delegateMatch[2].trim() };
  }
  return null;
}

// Parse action tags from model output
export function parseAction(text: string): { tool: string; params: string } | null {
  const actionMatch = text.match(/<action\s+tool="([^"]+)">(.*?)<\/action>/s);
  if (actionMatch) {
    return { tool: actionMatch[1], params: actionMatch[2].trim() };
  }
  return null;
}

// Parse answer tags from model output
export function parseAnswer(text: string): string | null {
  const answerMatch = text.match(/<answer>(.*?)<\/answer>/s);
  return answerMatch ? answerMatch[1].trim() : null;
}
