import * as Sentry from '@sentry/bun';
import * as mistral from '../services/mistral';
import * as ollama from '../services/ollama';
import { verifyToken } from '../auth';
import { teamsDb, type Team } from '../storage/teams';
import { agentsDb, type Agent } from '../storage/agents';

export async function handleTeamRoutes(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  aiService: { isConfigured(): boolean; chat: (...args: any[]) => Promise<any> },
): Promise<Response | null> {
  // GET /v1/teams - List all teams for authenticated user
  if (url.pathname === '/v1/teams' && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const teams = await teamsDb.getAllForUser(authResult.userId);
      return Response.json({ teams }, { headers: corsHeaders });
    } catch (error) {
      console.error('Teams fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Teams fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch teams' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // POST /v1/teams - Create new team
  if (url.pathname === '/v1/teams' && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const body = (await req.json()) as {
        name?: string;
        description?: string;
        coordinatorAgentId?: string;
        memberAgentIds?: string[];
        executionMode?: 'sequential' | 'parallel';
      };

      if (!body.name || !body.coordinatorAgentId) {
        return Response.json(
          { error: 'Name and coordinator agent are required' },
          { status: 400, headers: corsHeaders },
        );
      }

      // Verify coordinator agent belongs to user
      const coordinator = await agentsDb.getByIdForUser(
        body.coordinatorAgentId,
        authResult.userId,
      );
      if (!coordinator) {
        return Response.json(
          { error: 'Coordinator agent not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      // Verify all member agents belong to user
      if (body.memberAgentIds && body.memberAgentIds.length > 0) {
        for (const memberId of body.memberAgentIds) {
          const member = await agentsDb.getByIdForUser(memberId, authResult.userId);
          if (!member) {
            return Response.json(
              { error: `Member agent ${memberId} not found` },
              { status: 404, headers: corsHeaders },
            );
          }
        }
      }

      const now = new Date().toISOString();
      const team: Team = {
        id: crypto.randomUUID(),
        userId: authResult.userId,
        name: body.name,
        description: body.description,
        coordinatorAgentId: body.coordinatorAgentId,
        memberAgentIds: body.memberAgentIds || [],
        executionMode: body.executionMode || 'sequential',
        createdAt: now,
        updatedAt: now,
      };

      await teamsDb.create(team);
      return Response.json({ team }, { status: 201, headers: corsHeaders });
    } catch (error) {
      console.error('Team create error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Team create error' },
      });
      return Response.json(
        { error: 'Failed to create team' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // GET /v1/teams/:id - Get team details
  if (url.pathname.match(/^\/v1\/teams\/[^/]+$/) && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const teamId = url.pathname.split('/').pop();
      if (!teamId) {
        return Response.json(
          { error: 'Team ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const team = await teamsDb.getByIdForUser(teamId, authResult.userId);
      if (!team) {
        return Response.json(
          { error: 'Team not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      // Load coordinator and member agents
      const coordinator = await agentsDb.getByIdForUser(
        team.coordinatorAgentId,
        authResult.userId,
      );
      const members = await Promise.all(
        team.memberAgentIds.map((id) => agentsDb.getByIdForUser(id, authResult.userId)),
      );

      return Response.json(
        {
          team,
          coordinator,
          members: members.filter(Boolean),
        },
        { headers: corsHeaders },
      );
    } catch (error) {
      console.error('Team fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Team fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch team' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // PATCH /v1/teams/:id - Update team
  if (url.pathname.match(/^\/v1\/teams\/[^/]+$/) && req.method === 'PATCH') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const teamId = url.pathname.split('/').pop();
      if (!teamId) {
        return Response.json(
          { error: 'Team ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const body = (await req.json()) as Partial<
        Omit<Team, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
      >;

      const updated = await teamsDb.updateForUser(teamId, authResult.userId, body);
      if (!updated) {
        return Response.json(
          { error: 'Team not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      const team = await teamsDb.getByIdForUser(teamId, authResult.userId);
      return Response.json({ team }, { headers: corsHeaders });
    } catch (error) {
      console.error('Team update error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Team update error' },
      });
      return Response.json(
        { error: 'Failed to update team' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // DELETE /v1/teams/:id - Delete team
  if (url.pathname.match(/^\/v1\/teams\/[^/]+$/) && req.method === 'DELETE') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const teamId = url.pathname.split('/').pop();
      if (!teamId) {
        return Response.json(
          { error: 'Team ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const deleted = await teamsDb.deleteForUser(teamId, authResult.userId);
      if (!deleted) {
        return Response.json(
          { error: 'Team not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json({ success: true, deletedId: teamId }, { headers: corsHeaders });
    } catch (error) {
      console.error('Team delete error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Team delete error' },
      });
      return Response.json(
        { error: 'Failed to delete team' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // POST /v1/teams/:id/execute - Execute a task with a team
  if (url.pathname.match(/^\/v1\/teams\/[^/]+\/execute$/) && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const teamId = url.pathname.split('/')[3];
      if (!teamId) {
        return Response.json(
          { error: 'Team ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const body = (await req.json()) as { task?: string };
      if (!body.task) {
        return Response.json(
          { error: 'Task is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      // Load team
      const team = await teamsDb.getByIdForUser(teamId, authResult.userId);
      if (!team) {
        return Response.json(
          { error: 'Team not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      // Load coordinator and members
      const coordinator = await agentsDb.getByIdForUser(
        team.coordinatorAgentId,
        authResult.userId,
      );
      if (!coordinator) {
        return Response.json(
          { error: 'Coordinator agent not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      const members = (
        await Promise.all(
          team.memberAgentIds.map((id) => agentsDb.getByIdForUser(id, authResult.userId)),
        )
      ).filter((m): m is Agent => m !== null);

      // Build team members info for the coordinator prompt
      const teamMembers: ollama.TeamMember[] = members.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
      }));

      // Generate the team prompt for the coordinator
      const teamPrompt = ollama.generateTeamPrompt(coordinator.systemPrompt, teamMembers);

      // Track execution steps for response
      const steps: Array<{ agent: string; action: string; result: string }> = [];
      const toolsUsed: string[] = [];

      // Select service based on coordinator config
      const selectedService =
        coordinator.service === 'ghmodels'
          ? mistral
          : coordinator.service === 'ollama'
            ? ollama
            : aiService;

      // Execute coordinator with ReAct loop that handles delegation
      const maxIterations = coordinator.maxIterations || 5;
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: teamPrompt },
        { role: 'user', content: body.task },
      ];

      console.log(
        `🤝 Team execute: ${team.name} (coordinator: ${coordinator.name}, ${members.length} members)`,
      );
      console.log(`   Task: ${body.task.substring(0, 100)}...`);

      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        console.log(`   📍 Team iteration ${iteration}/${maxIterations}`);

        // Call coordinator
        const response = await selectedService.chat({
          message: messages[messages.length - 1].content,
          systemPrompt: teamPrompt,
          temperature: coordinator.temperature,
          maxTokens: coordinator.maxTokens,
          useTools: coordinator.tools?.includes('web_search'),
          model: coordinator.model,
        });

        const responseText = response.response;

        // Check for final answer
        const answer = ollama.parseAnswer(responseText);
        if (answer) {
          console.log(`   ✅ Team task completed`);
          return Response.json(
            {
              response: answer,
              team: team.name,
              coordinator: coordinator.name,
              steps,
              toolsUsed: [...toolsUsed, ...(response.toolsUsed || [])],
            },
            { headers: corsHeaders },
          );
        }

        // Check for delegation
        const delegation = ollama.parseDelegation(responseText);
        if (delegation) {
          const member = members.find((m) => m.id === delegation.agentId);
          if (member) {
            console.log(
              `   🔄 Delegating to ${member.name}: ${delegation.task.substring(0, 50)}...`,
            );
            toolsUsed.push(`delegate_to_agent(${member.name})`);

            // Execute member agent
            const memberService =
              member.service === 'ghmodels'
                ? mistral
                : member.service === 'ollama'
                  ? ollama
                  : aiService;

            const memberResponse = await memberService.chat({
              message: delegation.task,
              systemPrompt: member.systemPrompt,
              temperature: member.temperature,
              maxTokens: member.maxTokens,
              useTools: member.tools?.includes('web_search'),
              model: member.model,
            });

            steps.push({
              agent: member.name,
              action: delegation.task,
              result: memberResponse.response,
            });

            if (memberResponse.toolsUsed) {
              toolsUsed.push(...memberResponse.toolsUsed);
            }

            // Add observation for coordinator
            messages.push({ role: 'assistant', content: responseText });
            messages.push({
              role: 'user',
              content:
                `<observation>Response from ${member.name}:\n${memberResponse.response}</observation>\n\nBased on this information, continue reasoning or provide your final answer in <answer> tags.`,
            });
            continue;
          } else {
            // Unknown agent ID
            messages.push({ role: 'assistant', content: responseText });
            messages.push({
              role: 'user',
              content:
                `<observation>Error: Agent with ID "${delegation.agentId}" not found in team.</observation>\n\nPlease try a different agent or provide your final answer.`,
            });
            continue;
          }
        }

        // No structured output - treat as final response
        console.log(`   ⚠️ No structured tags, treating as final`);
        return Response.json(
          {
            response: responseText,
            team: team.name,
            coordinator: coordinator.name,
            steps,
            toolsUsed: [...toolsUsed, ...(response.toolsUsed || [])],
          },
          { headers: corsHeaders },
        );
      }

      // Max iterations reached
      return Response.json(
        {
          response:
            'Max iterations reached. The team was unable to complete the task within the allowed steps.',
          team: team.name,
          coordinator: coordinator.name,
          steps,
          toolsUsed,
          error: 'max_iterations_reached',
        },
        { headers: corsHeaders },
      );
    } catch (error) {
      console.error('Team execute error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Team execute error' },
      });
      return Response.json(
        { error: 'Failed to execute team task' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return null;
}
