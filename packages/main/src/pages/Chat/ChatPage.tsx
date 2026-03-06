import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Container, Group, Paper, Title } from '@mantine/core';

import { useChatApi } from './hooks/useChatApi';
import { useConversations } from './hooks/useConversations';
import { useAgents } from './hooks/useAgents';
import { useTeams } from './hooks/useTeams';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';

import ListView from './components/ListView';
import ChatMessageList from './components/ChatMessageList';
import ChatInputBar from './components/ChatInputBar';
import ModelSelectorModal from './components/ModelSelectorModal';

import type { Agent, Conversation } from './types';

export default function Chat() {
  const [activeView, setActiveView] = useState<'list' | 'chat'>('list');

  const api = useChatApi();
  const conversationsHook = useConversations(api);
  const agentsHook = useAgents(api);
  const teamsHook = useTeams(api);
  const models = useModels(api, activeView);
  const chat = useChat(api, {
    conversations: conversationsHook,
    agents: agentsHook,
    teams: teamsHook,
    models,
  });

  // Fetch conversations, agents, and teams on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Run once on mount only
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convResponse, agentsResponse, teamsResponse] = await Promise.all([
          api.authFetch(api.endpoints.conversations),
          api.authFetch(api.endpoints.agents),
          api.authFetch(api.endpoints.teams),
        ]);

        if (convResponse.ok) {
          const data = (await convResponse.json()) as { conversations: Conversation[] };
          conversationsHook.setConversations(data.conversations);
        }
        if (agentsResponse.ok) {
          const data = (await agentsResponse.json()) as { agents: Agent[] };
          agentsHook.setAgents(data.agents);
        }
        if (teamsResponse.ok) {
          const data = (await teamsResponse.json()) as { teams: import('./types').Team[] };
          teamsHook.setTeams(data.teams);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        conversationsHook.setIsLoadingConversations(false);
        agentsHook.setIsLoadingAgents(false);
        teamsHook.setIsLoadingTeams(false);
      }
    };
    fetchData();
  }, []);

  const startNewConversation = (agent?: Agent) => {
    conversationsHook.setCurrentConversationId(null);
    agentsHook.setCurrentAgent(agent || null);
    chat.setMessages([]);
    if (agent?.model) models.setSelectedModel(agent.model);
    if (agent?.service) models.setSelectedService(agent.service as 'ollama' | 'ghmodels');
    setActiveView('chat');
  };

  const handleOpenConversation = async (conversation: Conversation) => {
    setActiveView('chat');
    await conversationsHook.openConversation(conversation, {
      setMessages: chat.setMessages,
      setIsLoadingMessages: chat.setIsLoadingMessages,
      setCurrentAgent: agentsHook.setCurrentAgent,
      setSelectedModel: models.setSelectedModel,
      setSelectedService: models.setSelectedService,
    });
  };

  const handleBackToList = () => {
    setActiveView('list');
    chat.setMessages([]);
    conversationsHook.setCurrentConversationId(null);
    agentsHook.setCurrentAgent(null);
    chat.setError(null);
  };

  // List View
  if (activeView === 'list') {
    return (
      <ListView
        conversations={conversationsHook.conversations}
        isLoadingConversations={conversationsHook.isLoadingConversations}
        onOpenConversation={handleOpenConversation}
        onDeleteConversation={conversationsHook.deleteConversation}
        onStartNewConversation={startNewConversation}
        agents={agentsHook.agents}
        isLoadingAgents={agentsHook.isLoadingAgents}
        isAgentModalOpen={agentsHook.isAgentModalOpen}
        editingAgent={agentsHook.editingAgent}
        onSaveAgent={agentsHook.saveAgent}
        onDeleteAgent={agentsHook.deleteAgent}
        onOpenAgentEditor={agentsHook.openAgentEditor}
        onCloseAgentEditor={agentsHook.closeAgentEditor}
        teams={teamsHook.teams}
        isLoadingTeams={teamsHook.isLoadingTeams}
        isTeamModalOpen={teamsHook.isTeamModalOpen}
        editingTeam={teamsHook.editingTeam}
        isExecutingTeam={teamsHook.isExecutingTeam}
        teamExecuteResult={teamsHook.teamExecuteResult}
        onSaveTeam={teamsHook.saveTeam}
        onDeleteTeam={teamsHook.deleteTeam}
        onOpenTeamEditor={teamsHook.openTeamEditor}
        onCloseTeamEditor={teamsHook.closeTeamEditor}
        onExecuteTeamTask={teamsHook.executeTeamTask}
        onClearTeamResult={() => teamsHook.setTeamExecuteResult(null)}
        availableModels={models.availableModels}
      />
    );
  }

  // Chat View
  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button onClick={handleBackToList} variant="subtle">
            ← Back to Conversations
          </Button>
          <Title order={1}>AI Chat</Title>
        </Group>
        <Button component={Link} to="/" variant="subtle">
          Home
        </Button>
      </Group>

      <Paper
        shadow="sm"
        p="md"
        withBorder
        style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}
      >
        <ChatMessageList
          messages={chat.messages}
          isLoading={chat.isLoading}
          isLoadingMessages={chat.isLoadingMessages}
          currentAgent={agentsHook.currentAgent}
          selectedModel={models.selectedModel}
          selectedService={models.selectedService}
          availableModels={models.availableModels}
          viewport={chat.viewport}
        />

        {chat.error && (
          <Alert color="red" mb="md" title="Error">
            {chat.error}
          </Alert>
        )}

        <ModelSelectorModal
          opened={models.isModelModalOpen}
          onClose={() => models.setIsModelModalOpen(false)}
          availableModels={models.availableModels}
          selectedModel={models.selectedModel}
          onSelect={models.handleModelSelect}
          getCapabilityColor={models.getCapabilityColor}
        />

        <ChatInputBar
          chat={chat}
          models={models}
          agents={agentsHook.agents}
          currentAgent={agentsHook.currentAgent}
          teams={teamsHook.teams}
          selectedTeamId={teamsHook.selectedTeamId}
          onTeamSelect={teamsHook.setSelectedTeamId}
          onAgentChange={startNewConversation}
        />
      </Paper>
    </Container>
  );
}
