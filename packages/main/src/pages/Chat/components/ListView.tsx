import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Agent, Conversation, ModelsResponse, Team, TeamExecuteResult } from '../types';
import AgentEditorModal from './AgentEditorModal';
import TeamEditorModal from './TeamEditorModal';

interface ListViewProps {
  // Conversations
  conversations: Conversation[];
  isLoadingConversations: boolean;
  onOpenConversation: (conversation: Conversation) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => Promise<void>;
  onStartNewConversation: (agent?: Agent, isPrivate?: boolean) => void;
  // Agents
  agents: Agent[];
  isLoadingAgents: boolean;
  isAgentModalOpen: boolean;
  editingAgent: Agent | null;
  onSaveAgent: (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteAgent: (id: string, e?: React.MouseEvent) => Promise<void>;
  onOpenAgentEditor: (agent?: Agent) => void;
  onCloseAgentEditor: () => void;
  // Teams
  teams: Team[];
  isLoadingTeams: boolean;
  isTeamModalOpen: boolean;
  editingTeam: Team | null;
  isExecutingTeam: boolean;
  teamExecuteResult: TeamExecuteResult | null;
  onSaveTeam: (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteTeam: (id: string) => Promise<void>;
  onOpenTeamEditor: (team?: Team) => void;
  onCloseTeamEditor: () => void;
  onExecuteTeamTask: (teamId: string, task: string) => Promise<void>;
  onClearTeamResult: () => void;
  // Models (for agent editor)
  availableModels: ModelsResponse;
}

export default function ListView({
  conversations,
  isLoadingConversations,
  onOpenConversation,
  onDeleteConversation,
  onStartNewConversation,
  agents,
  isLoadingAgents,
  isAgentModalOpen,
  editingAgent,
  onSaveAgent,
  onDeleteAgent,
  onOpenAgentEditor,
  onCloseAgentEditor,
  teams,
  isLoadingTeams,
  isTeamModalOpen,
  editingTeam,
  isExecutingTeam,
  teamExecuteResult,
  onSaveTeam,
  onDeleteTeam,
  onOpenTeamEditor,
  onCloseTeamEditor,
  onExecuteTeamTask,
  onClearTeamResult,
  availableModels,
}: ListViewProps) {
  const [listTab, setListTab] = useState<'conversations' | 'agents' | 'teams'>('conversations');

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>AI Chat</Title>
        <Button component={Link} to="/" variant="subtle">
          ← Back to Home
        </Button>
      </Group>

      <Paper
        shadow="sm"
        p="md"
        withBorder
        style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}
      >
        <SegmentedControl
          value={listTab}
          onChange={(value) => setListTab(value as 'conversations' | 'agents' | 'teams')}
          data={[
            { label: 'Conversations', value: 'conversations' },
            { label: 'Agents', value: 'agents' },
            { label: 'Teams', value: 'teams' },
          ]}
          mb="md"
          color="violet"
        />

        {listTab === 'conversations' ? (
          <>
            <Group mb="md">
              <Button
                onClick={() => onStartNewConversation()}
                size="lg"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  border: 'none',
                  flex: 1,
                }}
              >
                + Start Conversation
              </Button>
              <Button
                onClick={() => onStartNewConversation(undefined, true)}
                size="lg"
                style={{
                  background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)',
                  border: 'none',
                  flex: 1,
                }}
              >
                🔒 Start Private Conversation
              </Button>
            </Group>

            <ScrollArea style={{ flex: 1 }}>
              {isLoadingConversations ? (
                <Box ta="center" py="xl">
                  <Loader color="violet" />
                  <Text c="dimmed" mt="sm">
                    Loading conversations...
                  </Text>
                </Box>
              ) : conversations.length === 0 ? (
                <Box ta="center" py="xl">
                  <Text size="lg" c="dimmed">
                    No conversations yet
                  </Text>
                  <Text size="sm" c="dimmed" mt="xs">
                    Start a new conversation to begin chatting
                  </Text>
                </Box>
              ) : (
                <Stack gap="sm">
                  {conversations.map((conversation) => (
                    <Paper
                      key={conversation.id}
                      p="md"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        ...(conversation.isPrivate && {
                          borderColor: '#ca8a04',
                          borderLeft: '3px solid #ca8a04',
                          background: 'rgba(202, 138, 4, 0.05)',
                        }),
                      }}
                      onClick={() => onOpenConversation(conversation)}
                    >
                      <Group justify="space-between">
                        <Box style={{ flex: 1 }}>
                          <Text fw={600} lineClamp={1}>
                            {conversation.title}
                          </Text>
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">
                              {new Date(conversation.updatedAt).toLocaleDateString()}{' '}
                              {new Date(conversation.updatedAt).toLocaleTimeString()}
                            </Text>
                            {conversation.isPrivate && (
                              <Badge size="xs" color="yellow" variant="light">
                                🔒 Private
                              </Badge>
                            )}
                            {conversation.agentId && (
                              <Badge size="xs" color="violet" variant="light">
                                {agents.find((a) => a.id === conversation.agentId)?.name || 'Agent'}
                              </Badge>
                            )}
                          </Group>
                        </Box>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={(e) => onDeleteConversation(conversation.id, e)}
                        >
                          ✕
                        </ActionIcon>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </>
        ) : listTab === 'agents' ? (
          <>
            <Button
              onClick={() => onOpenAgentEditor()}
              size="lg"
              mb="md"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                border: 'none',
              }}
            >
              + Create New Agent
            </Button>

            <ScrollArea style={{ flex: 1 }}>
              {isLoadingAgents ? (
                <Box ta="center" py="xl">
                  <Loader color="violet" />
                  <Text c="dimmed" mt="sm">
                    Loading agents...
                  </Text>
                </Box>
              ) : agents.length === 0 ? (
                <Box ta="center" py="xl">
                  <Text size="lg" c="dimmed">
                    No agents yet
                  </Text>
                  <Text size="sm" c="dimmed" mt="xs">
                    Create an agent to customize AI behavior
                  </Text>
                </Box>
              ) : (
                <Stack gap="sm">
                  {agents.map((agent) => (
                    <Paper key={agent.id} p="md" withBorder style={{ transition: 'all 0.2s ease' }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Box style={{ flex: 1 }}>
                          <Text fw={600} lineClamp={1}>
                            {agent.name}
                          </Text>
                          {agent.description && (
                            <Text size="sm" c="dimmed" lineClamp={1}>
                              {agent.description}
                            </Text>
                          )}
                          <Group gap="xs" mt="xs">
                            {agent.model && (
                              <Badge size="xs" color="blue" variant="light">
                                {agent.model}
                              </Badge>
                            )}
                            {agent.tools?.includes('web_search') && (
                              <Badge size="xs" color="teal" variant="light">
                                Web Search
                              </Badge>
                            )}
                          </Group>
                        </Box>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            color="violet"
                            onClick={() => onStartNewConversation(agent)}
                          >
                            Chat
                          </Button>
                          <ActionIcon
                            color="blue"
                            variant="subtle"
                            onClick={() => onOpenAgentEditor(agent)}
                          >
                            ✎
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => onDeleteAgent(agent.id)}
                          >
                            ✕
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </>
        ) : listTab === 'teams' ? (
          <>
            <Button
              onClick={() => onOpenTeamEditor()}
              size="lg"
              mb="md"
              disabled={agents.length < 2}
              style={{
                background:
                  agents.length < 2
                    ? undefined
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                border: 'none',
              }}
            >
              + Create New Team
            </Button>
            {agents.length < 2 && (
              <Text size="sm" c="dimmed" mb="md">
                Create at least 2 agents before creating a team
              </Text>
            )}

            <ScrollArea style={{ flex: 1 }}>
              {isLoadingTeams ? (
                <Box ta="center" py="xl">
                  <Loader color="violet" />
                  <Text c="dimmed" mt="sm">
                    Loading teams...
                  </Text>
                </Box>
              ) : teams.length === 0 ? (
                <Box ta="center" py="xl">
                  <Text size="lg" c="dimmed">
                    No teams yet
                  </Text>
                  <Text size="sm" c="dimmed" mt="xs">
                    Create a team to enable multi-agent collaboration
                  </Text>
                </Box>
              ) : (
                <Stack gap="sm">
                  {teams.map((team) => (
                    <Paper key={team.id} p="md" withBorder style={{ transition: 'all 0.2s ease' }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Box style={{ flex: 1 }}>
                          <Text fw={600} lineClamp={1}>
                            {team.name}
                          </Text>
                          {team.description && (
                            <Text size="sm" c="dimmed" lineClamp={1}>
                              {team.description}
                            </Text>
                          )}
                          <Group gap="xs" mt="xs">
                            <Badge size="xs" color="violet" variant="light">
                              {agents.find((a) => a.id === team.coordinatorAgentId)?.name ||
                                'Coordinator'}
                            </Badge>
                            <Badge size="xs" color="teal" variant="light">
                              {team.memberAgentIds.length} members
                            </Badge>
                            <Badge size="xs" color="blue" variant="light">
                              {team.executionMode}
                            </Badge>
                          </Group>
                        </Box>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            onClick={() => {
                              const task = prompt('Enter a task for the team:');
                              if (task) onExecuteTeamTask(team.id, task);
                            }}
                          >
                            Run
                          </Button>
                          <ActionIcon
                            color="blue"
                            variant="subtle"
                            onClick={() => onOpenTeamEditor(team)}
                          >
                            ✎
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => onDeleteTeam(team.id)}
                          >
                            ✕
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>

            {/* Team Execute Result Modal */}
            <Modal
              opened={teamExecuteResult !== null || isExecutingTeam}
              onClose={onClearTeamResult}
              title="Team Execution Result"
              size="xl"
              styles={{
                header: { backgroundColor: '#1e1b2e', borderBottom: '1px solid #4c1d95' },
                body: { backgroundColor: '#1e1b2e' },
                content: { backgroundColor: '#1e1b2e' },
              }}
            >
              {isExecutingTeam ? (
                <Box ta="center" py="xl">
                  <Loader color="violet" />
                  <Text c="dimmed" mt="sm">
                    Team is working on the task...
                  </Text>
                </Box>
              ) : (
                teamExecuteResult && (
                  <Stack gap="md">
                    <Box>
                      <Text size="sm" fw={500}>
                        Response:
                      </Text>
                      <Paper p="md" bg="#0f0e1a" withBorder>
                        <Text>{teamExecuteResult.response}</Text>
                      </Paper>
                    </Box>
                    {teamExecuteResult.steps.length > 0 && (
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          Delegation Steps:
                        </Text>
                        <Stack gap="xs">
                          {teamExecuteResult.steps.map((step) => (
                            <Paper
                              key={`${step.agent}-${step.action}-${step.result.substring(0, 30)}`}
                              p="sm"
                              withBorder
                            >
                              <Group gap="xs" mb="xs">
                                <Badge size="xs" color="violet">
                                  {step.agent}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                  {step.action}
                                </Text>
                              </Group>
                              <Text size="sm">
                                {step.result.substring(0, 200)}
                                {step.result.length > 200 ? '...' : ''}
                              </Text>
                            </Paper>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {teamExecuteResult.toolsUsed.length > 0 && (
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">
                          Tools used:
                        </Text>
                        {teamExecuteResult.toolsUsed.map((tool) => (
                          <Badge key={tool} size="xs" color="teal" variant="light">
                            {tool}
                          </Badge>
                        ))}
                      </Group>
                    )}
                  </Stack>
                )
              )}
            </Modal>
          </>
        ) : null}
      </Paper>

      <AgentEditorModal
        opened={isAgentModalOpen}
        onClose={onCloseAgentEditor}
        agent={editingAgent}
        onSave={onSaveAgent}
        availableModels={availableModels}
      />

      <TeamEditorModal
        opened={isTeamModalOpen}
        onClose={onCloseTeamEditor}
        team={editingTeam}
        onSave={onSaveTeam}
        agents={agents}
      />
    </Container>
  );
}
