import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  FileButton,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useAuth } from '@clerk/clerk-react';
import AgentEditorModal from './components/AgentEditorModal';
import TeamEditorModal from './components/TeamEditorModal';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  service?: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number; // Max ReAct loop iterations
  tools: string[];
  createdAt: string;
  updatedAt: string;
}

interface Conversation {
  id: string;
  agentId?: string;
  title: string;
  model?: string;
  service?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  size?: number;
  capabilities?: string[];
}

export interface ModelsResponse {
  ollama: ModelInfo[];
  ghmodels: ModelInfo[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  coordinatorAgentId: string;
  memberAgentIds: string[];
  executionMode: 'sequential' | 'parallel';
  createdAt: string;
  updatedAt: string;
}

interface TeamExecuteResult {
  response: string;
  team: string;
  coordinator: string;
  steps: Array<{ agent: string; action: string; result: string }>;
  toolsUsed: string[];
}

export default function Chat() {
  const { getToken } = useAuth();
  // View state
  const [activeView, setActiveView] = useState<'list' | 'chat' | 'agents'>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  
  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  
  // Team state
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isExecutingTeam, setIsExecutingTeam] = useState(false);
  const [teamExecuteResult, setTeamExecuteResult] = useState<TeamExecuteResult | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [chatMode, setChatMode] = useState<'single' | 'team'>('single');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelsResponse>({
    ollama: [],
    ghmodels: [],
  });
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedService, setSelectedService] = useState<'ollama' | 'ghmodels'>('ghmodels');
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);

  const apiBase = import.meta.env.PROD
    ? 'https://api.thebudimir.com'
    : 'http://localhost:3000';

  const apiEndpoint = `${apiBase}/v1/chat`;
  const modelsEndpoint = `${apiBase}/v1/models`;
  const conversationsEndpoint = `${apiBase}/v1/conversations`;
  const agentsEndpoint = `${apiBase}/v1/agents`;
  const teamsEndpoint = `${apiBase}/v1/teams`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch conversations, agents, and teams on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken();
        const headers = { ...(token && { 'Authorization': `Bearer ${token}` }) };
        
        // Fetch conversations, agents, and teams in parallel
        const [convResponse, agentsResponse, teamsResponse] = await Promise.all([
          fetch(conversationsEndpoint, { headers }),
          fetch(agentsEndpoint, { headers }),
          fetch(teamsEndpoint, { headers }),
        ]);
        
        if (convResponse.ok) {
          const data = (await convResponse.json()) as { conversations: Conversation[] };
          setConversations(data.conversations);
        }
        if (agentsResponse.ok) {
          const data = (await agentsResponse.json()) as { agents: Agent[] };
          setAgents(data.agents);
        }
        if (teamsResponse.ok) {
          const data = (await teamsResponse.json()) as { teams: Team[] };
          setTeams(data.teams);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoadingConversations(false);
        setIsLoadingAgents(false);
        setIsLoadingTeams(false);
      }
    };
    fetchData();
  }, [conversationsEndpoint, agentsEndpoint, teamsEndpoint, getToken]);

  // Fetch models when entering chat view (lazy load)
  useEffect(() => {
    if (activeView === 'chat' && !modelsLoaded) {
      const fetchModels = async () => {
        try {
          const response = await fetch(modelsEndpoint);
          if (response.ok) {
            const data = (await response.json()) as ModelsResponse;
            setAvailableModels(data);

            // Set default model if none selected
            if (!selectedModel) {
              if (data.ghmodels.length > 0) {
                setSelectedModel(data.ghmodels[0].id);
                setSelectedService('ghmodels');
              } else if (data.ollama.length > 0) {
                setSelectedModel(data.ollama[0].id);
                setSelectedService('ollama');
              }
            }
            setModelsLoaded(true);
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
        }
      };
      fetchModels();
    }
  }, [activeView, modelsLoaded, modelsEndpoint, selectedModel]);

  const handleImageSelect = (file: File | null) => {
    setSelectedImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-switch to Ollama vision model when image is selected
      if (availableModels.ollama.length > 0) {
        // Find a vision-capable model (llava, glm, or models with 'vision' in name)
        const visionModel = availableModels.ollama.find(
          (m) =>
            m.name.toLowerCase().includes('llava') ||
            m.name.toLowerCase().includes('glm') ||
            m.name.toLowerCase().includes('vision')
        );

        if (visionModel) {
          setSelectedModel(visionModel.id);
          setSelectedService('ollama');
          setImageWarning(null);
        } else {
          // Use first Ollama model as fallback but warn user
          setSelectedModel(availableModels.ollama[0].id);
          setSelectedService('ollama');
          setImageWarning(
            'No vision-capable models detected. Consider using llava-phi3 or glm-4.6v-flash.'
          );
        }
      } else {
        // No Ollama models available
        setImageWarning(
          'Image analysis requires Ollama with a vision model. Please install Ollama locally and pull a vision model (e.g., ollama pull llava-phi3).'
        );
      }
    } else {
      setImagePreview(null);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageWarning(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessageContent = input.trim() || 'What do you see in this image?';

    const userMessage: Message = {
      role: 'user',
      content: userMessageContent,
      timestamp: new Date().toISOString(),
      imageUrl: imagePreview || undefined, // Use base64 data URL directly
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const imageDataToSend = chatMode === 'single' ? imagePreview : null; // Store before clearing
    clearImage();
    setIsLoading(true);
    setError(null);

    // Create conversation if this is the first message (single-agent, text only)
    let convId = currentConversationId;
    const token = await getToken();
    if (chatMode === 'single' && !convId && !imageDataToSend && token) {
      try {
        // Auto-generate title from first message (first 50 chars)
        const title = userMessage.content.length > 50
          ? `${userMessage.content.substring(0, 50)}...`
          : userMessage.content;

        const createResponse = await fetch(conversationsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title,
            model: selectedModel,
            service: selectedService,
            agentId: currentAgent?.id,
          }),
        });

        if (createResponse.ok) {
          const createData = (await createResponse.json()) as { conversation: Conversation };
          convId = createData.conversation.id;
          setCurrentConversationId(convId);
          // Add to conversations list
          setConversations((prev) => [createData.conversation, ...prev]);
        }
      } catch (err) {
        console.error('Failed to create conversation:', err);
      }
    }

    try {
      if (chatMode === 'team') {
        if (!selectedTeamId) {
          setError('Please select a team before running a team task.');
          return;
        }

        const response = await fetch(`${teamsEndpoint}/${selectedTeamId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ task: userMessageContent }),
        });

        const data = (await response.json()) as TeamExecuteResult & { error?: string };

        if (!response.ok) {
          const errorContent =
            data.error ||
            `Sorry, the team was unable to complete the task (HTTP ${response.status}).`;
          const assistantError: Message = {
            role: 'assistant',
            content: errorContent,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantError]);
        } else {
          const header = `Team ${data.team} (coordinator: ${data.coordinator})`;
          const body = data.response || 'Team did not return a response.';
          const assistantMessage: Message = {
            role: 'assistant',
            content: `${header}\n\n${body}`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        return;
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: userMessageContent,
          imageData: imageDataToSend, // Send base64 data URL
          systemPrompt: 'You are a helpful assistant.',
          useWebSearch,
          model: selectedModel,
          service: selectedService,
          conversationId: imageDataToSend ? undefined : convId, // Don't persist image chats
        }),
      });

      const data = (await response.json()) as { response?: string; error?: string };
      // Check if we got an error response
      if (!response.ok) {
        // Show error as an assistant message
        const errorMessage: Message = {
          role: 'assistant',
          content:
            data.error ||
            data.response ||
            `Sorry, I encountered an error (HTTP ${response.status}). Please try again.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        // Normal successful response
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response || 'Sorry, I received an empty response.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      // Network or parsing errors - show as assistant message
      const errorMessage: Message = {
        role: 'assistant',
        content:
          `Sorry, I couldn't connect to the server. Please check your connection and try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToList = () => {
    setActiveView('list');
    setMessages([]);
    setCurrentConversationId(null);
    setCurrentAgent(null);
    setError(null);
  };

  const startNewConversation = (agent?: Agent) => {
    setCurrentConversationId(null);
    setCurrentAgent(agent || null);
    setMessages([]);
    // If agent has preferred model/service, use it
    if (agent?.model) setSelectedModel(agent.model);
    if (agent?.service) setSelectedService(agent.service as 'ollama' | 'ghmodels');
    setActiveView('chat');
  };

  const openConversation = async (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    setActiveView('chat');
    
    // Restore model/service from conversation if available
    if (conversation.model) {
      setSelectedModel(conversation.model);
    }
    if (conversation.service) {
      setSelectedService(conversation.service as 'ollama' | 'ghmodels');
    }
    
    // Load messages and agent info
    try {
      const token = await getToken();
      const response = await fetch(`${conversationsEndpoint}/${conversation.id}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      if (response.ok) {
        const data = (await response.json()) as { conversation: Conversation; messages: ConversationMessage[]; agent: Agent | null };
        setMessages(data.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })));
        setCurrentAgent(data.agent);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getToken();
      const response = await fetch(`${conversationsEndpoint}/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  // Agent CRUD functions
  const saveAgent = async (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const token = await getToken();
      if (editingAgent) {
        // Update existing agent
        const response = await fetch(`${agentsEndpoint}/${editingAgent.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(agentData),
        });
        if (response.ok) {
          const data = (await response.json()) as { agent: Agent };
          setAgents((prev) => prev.map((a) => (a.id === editingAgent.id ? data.agent : a)));
        }
      } else {
        // Create new agent
        const response = await fetch(agentsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(agentData),
        });
        if (response.ok) {
          const data = (await response.json()) as { agent: Agent };
          setAgents((prev) => [data.agent, ...prev]);
        }
      }
      setIsAgentModalOpen(false);
      setEditingAgent(null);
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const deleteAgent = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const token = await getToken();
      const response = await fetch(`${agentsEndpoint}/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      if (response.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const openAgentEditor = (agent?: Agent) => {
    setEditingAgent(agent || null);
    setIsAgentModalOpen(true);
  };

  // Team CRUD functions
  const saveTeam = async (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const token = await getToken();
      if (editingTeam) {
        const response = await fetch(`${teamsEndpoint}/${editingTeam.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(teamData),
        });
        if (response.ok) {
          const data = (await response.json()) as { team: Team };
          setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? data.team : t)));
        }
      } else {
        const response = await fetch(teamsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(teamData),
        });
        if (response.ok) {
          const data = (await response.json()) as { team: Team };
          setTeams((prev) => [data.team, ...prev]);
        }
      }
      setIsTeamModalOpen(false);
      setEditingTeam(null);
    } catch (error) {
      console.error('Failed to save team:', error);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${teamsEndpoint}/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      if (response.ok) {
        setTeams((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
    }
  };

  const openTeamEditor = (team?: Team) => {
    setEditingTeam(team || null);
    setIsTeamModalOpen(true);
  };

  const executeTeamTask = async (teamId: string, task: string) => {
    setIsExecutingTeam(true);
    setTeamExecuteResult(null);
    try {
      const token = await getToken();
      const response = await fetch(`${teamsEndpoint}/${teamId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ task }),
      });
      if (response.ok) {
        const data = (await response.json()) as TeamExecuteResult;
        setTeamExecuteResult(data);
      }
    } catch (error) {
      console.error('Failed to execute team task:', error);
    } finally {
      setIsExecutingTeam(false);
    }
  };

  const getSelectedModelInfo = () => {
    return (
      availableModels.ollama.find((m) => m.id === selectedModel) ||
      availableModels.ghmodels.find((m) => m.id === selectedModel)
    );
  };

  const selectedModelSupportsVision = () => {
    const model = getSelectedModelInfo();
    return model?.capabilities?.includes('vision') ?? false;
  };

  const selectedModelSupportsTools = () => {
    const model = getSelectedModelInfo();
    return model?.capabilities?.includes('tools') ?? false;
  };

  const handleModelSelect = (model: ModelInfo, service: 'ollama' | 'ghmodels') => {
    setSelectedModel(model.id);
    setSelectedService(service);
    setIsModelModalOpen(false);
  };

  const getCapabilityColor = (capability: string) => {
    const colorMap: Record<string, string> = {
      vision: 'grape',      multimodal: 'orange',      tools: 'blue',
      thinking: 'pink',
      code: 'cyan',
      text: 'gray',
      embedding: 'teal',
    };
    return colorMap[capability.toLowerCase()] || 'gray';
  };

  // State for list view tab
  const [listTab, setListTab] = useState<'conversations' | 'agents' | 'teams'>('conversations');

  // Conversation List View
  if (activeView === 'list') {
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
              <Button
                onClick={() => startNewConversation()}
                size="lg"
                mb="md"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  border: 'none',
                }}
              >
                + Start New Conversation
              </Button>

              <ScrollArea style={{ flex: 1 }}>
                {isLoadingConversations ? (
                  <Box ta="center" py="xl">
                    <Loader color="violet" />
                    <Text c="dimmed" mt="sm">Loading conversations...</Text>
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
                        }}
                        onClick={() => openConversation(conversation)}
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
                              {conversation.agentId && (
                                <Badge size="xs" color="violet" variant="light">
                                  {agents.find(a => a.id === conversation.agentId)?.name || 'Agent'}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={(e) => deleteConversation(conversation.id, e)}
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
                onClick={() => openAgentEditor()}
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
                    <Text c="dimmed" mt="sm">Loading agents...</Text>
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
                      <Paper
                        key={agent.id}
                        p="md"
                        withBorder
                        style={{
                          transition: 'all 0.2s ease',
                        }}
                      >
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
                              onClick={() => startNewConversation(agent)}
                            >
                              Chat
                            </Button>
                            <ActionIcon
                              color="blue"
                              variant="subtle"
                              onClick={() => openAgentEditor(agent)}
                            >
                              ✎
                            </ActionIcon>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => deleteAgent(agent.id)}
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
                onClick={() => openTeamEditor()}
                size="lg"
                mb="md"
                disabled={agents.length < 2}
                style={{
                  background: agents.length < 2 ? undefined : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
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
                    <Text c="dimmed" mt="sm">Loading teams...</Text>
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
                      <Paper
                        key={team.id}
                        p="md"
                        withBorder
                        style={{
                          transition: 'all 0.2s ease',
                        }}
                      >
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
                                {agents.find(a => a.id === team.coordinatorAgentId)?.name || 'Coordinator'}
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
                                if (task) executeTeamTask(team.id, task);
                              }}
                            >
                              Run
                            </Button>
                            <ActionIcon
                              color="blue"
                              variant="subtle"
                              onClick={() => openTeamEditor(team)}
                            >
                              ✎
                            </ActionIcon>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => deleteTeam(team.id)}
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
                onClose={() => setTeamExecuteResult(null)}
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
                    <Text c="dimmed" mt="sm">Team is working on the task...</Text>
                  </Box>
                ) : teamExecuteResult && (
                  <Stack gap="md">
                    <Box>
                      <Text size="sm" fw={500}>Response:</Text>
                      <Paper p="md" bg="#0f0e1a" withBorder>
                        <Text>{teamExecuteResult.response}</Text>
                      </Paper>
                    </Box>
                    {teamExecuteResult.steps.length > 0 && (
                      <Box>
                        <Text size="sm" fw={500} mb="xs">Delegation Steps:</Text>
                        <Stack gap="xs">
                          {teamExecuteResult.steps.map((step) => (
                            <Paper key={`${step.agent}-${step.action}-${step.result.substring(0, 30)}`} p="sm" withBorder>
                              <Group gap="xs" mb="xs">
                                <Badge size="xs" color="violet">{step.agent}</Badge>
                                <Text size="xs" c="dimmed">{step.action}</Text>
                              </Group>
                              <Text size="sm">{step.result.substring(0, 200)}{step.result.length > 200 ? '...' : ''}</Text>
                            </Paper>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {teamExecuteResult.toolsUsed.length > 0 && (
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Tools used:</Text>
                        {teamExecuteResult.toolsUsed.map((tool) => (
                          <Badge key={tool} size="xs" color="teal" variant="light">{tool}</Badge>
                        ))}
                      </Group>
                    )}
                  </Stack>
                )}
              </Modal>
            </>
          ) : null}
        </Paper>

        {/* Agent Editor Modal */}
        <AgentEditorModal
          opened={isAgentModalOpen}
          onClose={() => setIsAgentModalOpen(false)}
          agent={editingAgent}
          onSave={saveAgent}
          availableModels={availableModels}
        />

        {/* Team Editor Modal */}
        <TeamEditorModal
          opened={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          team={editingTeam}
          onSave={saveTeam}
          agents={agents}
        />
      </Container>
    );
  }

  // Chat View
  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button onClick={handleBackToList} variant="subtle">
            7 Back to Conversations
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
        <ScrollArea style={{ flex: 1 }} viewportRef={viewport} mb="md">
          <Stack gap="md" p="md">
            {messages.length === 0 && (
              <Box ta="center" py="xl">
                <Text size="lg" c="dimmed">
                  {currentAgent
                    ? `Start a conversation with ${currentAgent.name}`
                    : 'Start a conversation with the AI assistant'}
                </Text>
                {currentAgent?.description && (
                  <Text size="sm" c="dimmed" mt="xs">
                    {currentAgent.description}
                  </Text>
                )}
                {selectedModel && (
                  <Text size="sm" c="dimmed" mt="xs">
                    Using:{' '}
                    {availableModels.ollama.find((m) => m.id === selectedModel)?.name ||
                      availableModels.ghmodels.find((m) => m.id === selectedModel)?.name ||
                      selectedModel}
                    {' via '}
                    {selectedService === 'ollama' ? 'Ollama (Local)' : 'GitHub Models'}
                  </Text>
                )}
              </Box>
            )}

            {messages.map((message) => (
              <Box
                key={message.timestamp}
                style={{
                  maxWidth: '80%',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginLeft: message.role === 'user' ? 'auto' : 0,
                }}
              >
                <Paper
                  p="md"
                  bg={message.role === 'user' ? '#7c3aed' : '#1e1b2e'}
                  c="white"
                  style={{
                    border: message.role === 'assistant' ? '1px solid #4c1d95' : 'none',
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} tt="uppercase">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </Text>
                    <Text size="xs" opacity={0.7}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Text>
                  </Group>
                  {message.imageUrl && (
                    <Image
                      src={message.imageUrl}
                      alt="Uploaded image"
                      mb="sm"
                      radius="sm"
                      fit="contain"
                      style={{ maxHeight: '300px' }}
                    />
                  )}
                  <Box
                    style={{
                      '& a': {
                        color: '#c084fc',
                        textDecoration: 'underline',
                        fontWeight: 500,
                      },
                      '& a:hover': {
                        color: '#e9d5ff',
                      },
                      '& code': {
                        backgroundColor: 'rgba(124, 58, 237, 0.15)',
                        color: '#c084fc',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                      },
                      '& pre': {
                        backgroundColor: '#0f0e1a',
                        border: '1px solid #4c1d95',
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        marginTop: '8px',
                        marginBottom: '8px',
                      },
                      '& pre code': {
                        backgroundColor: 'transparent',
                        color: '#e9d5ff',
                        padding: '0',
                      },
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </Box>
                </Paper>
              </Box>
            ))}

            {isLoading && (
              <Box style={{ maxWidth: '80%' }}>
                <Paper p="md" bg="#1e1b2e" style={{ border: '1px solid #4c1d95' }}>
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} tt="uppercase">
                      Assistant
                    </Text>
                  </Group>
                  <Text c="dimmed" fs="italic">
                    Thinking...
                  </Text>
                </Paper>
              </Box>
            )}
          </Stack>
        </ScrollArea>

        {error && (
          <Alert color="red" mb="md" title="Error">
            {error}
          </Alert>
        )}

        <Box>
          <Modal
            opened={isModelModalOpen}
            onClose={() => setIsModelModalOpen(false)}
            title={<Text fw={700} size="lg">Select AI Model</Text>}
            size="lg"
          >
            <Stack gap="md">
              {availableModels.ghmodels.length > 0 && (
                <Box>
                  <Text fw={600} mb="sm" c="dimmed" size="sm">
                    GitHub Models (Cloud)
                  </Text>
                  <Stack gap="xs">
                    {availableModels.ghmodels.map((model) => (
                      <Paper
                        key={model.id}
                        p="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedModel === model.id ? '#a855f7' : undefined,
                          borderWidth: selectedModel === model.id ? 2 : 1,
                          background: selectedModel === model.id 
                            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)'
                            : undefined,
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => handleModelSelect(model, 'ghmodels')}
                      >
                        <Group justify="space-between" mb="xs">
                          <Text fw={600}>{model.name}</Text>
                          {selectedModel === model.id && (
                            <Badge color="violet" variant="filled" size="sm">
                              Selected
                            </Badge>
                          )}
                        </Group>
                        {model.description && (
                          <Text size="sm" c="dimmed" mb="xs">
                            {model.description}
                          </Text>
                        )}
                        {model.capabilities && model.capabilities.length > 0 && (
                          <Group gap="xs">
                            {model.capabilities.map((cap) => (
                              <Badge
                                key={cap}
                                color={getCapabilityColor(cap)}
                                variant="light"
                                size="sm"
                              >
                                {cap}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {availableModels.ollama.length > 0 && (
                <Box>
                  <Text fw={600} mb="sm" c="dimmed" size="sm">
                    Ollama (Local)
                  </Text>
                  <Stack gap="xs">
                    {availableModels.ollama.map((model) => (
                      <Paper
                        key={model.id}
                        p="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedModel === model.id ? '#a855f7' : undefined,
                          borderWidth: selectedModel === model.id ? 2 : 1,
                          background: selectedModel === model.id 
                            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)'
                            : undefined,
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => handleModelSelect(model, 'ollama')}
                      >
                        <Group justify="space-between" mb="xs">
                          <Text fw={600}>{model.name}</Text>
                          {selectedModel === model.id && (
                            <Badge color="violet" variant="filled" size="sm">
                              Selected
                            </Badge>
                          )}
                        </Group>
                        {model.description && (
                          <Text size="sm" c="dimmed" mb="xs">
                            {model.description}
                          </Text>
                        )}
                        {model.capabilities && model.capabilities.length > 0 && (
                          <Group gap="xs">
                            {model.capabilities.map((cap) => (
                              <Badge
                                key={cap}
                                color={getCapabilityColor(cap)}
                                variant="light"
                                size="sm"
                              >
                                {cap}
                              </Badge>
                            ))}
                          </Group>
                        )}
                        {model.size && (
                          <Text size="xs" c="dimmed" mt="xs">
                            Size: {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
                          </Text>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {availableModels.ghmodels.length === 0 && availableModels.ollama.length === 0 && (
                <Text c="dimmed" ta="center" py="xl">
                  No models available. Please check your configuration.
                </Text>
              )}
            </Stack>
          </Modal>

          <form onSubmit={handleSubmit}>
            <Group gap="sm" mb="sm">
              <Button
                onClick={() => setIsModelModalOpen(true)}
                disabled={isLoading}
                variant="default"
                size="sm"
                style={{ minWidth: '220px' }}
              >
                {getSelectedModelInfo()?.name || 'Select Model'}
              </Button>

              <Select
                placeholder="No agent (default assistant)"
                data={[
                  { value: '', label: 'No agent' },
                  ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
                ]}
                value={currentAgent?.id ?? ''}
                onChange={(value) => {
                  if (!value) {
                    startNewConversation();
                    return;
                  }
                  const agent = agents.find((a) => a.id === value) || null;
                  if (agent) {
                    startNewConversation(agent);
                  }
                }}
                size="xs"
                maw={220}
                disabled={isLoading}
              />

              <SegmentedControl
                value={chatMode}
                onChange={(value) => setChatMode(value as 'single' | 'team')}
                data={[
                  { label: 'Single Agent', value: 'single' },
                  { label: 'Team Task', value: 'team' },
                ]}
                size="xs"
              />

              {chatMode === 'team' && (
                <Select
                  placeholder={teams.length ? 'Select team' : 'No teams available'}
                  data={teams.map((team) => ({ value: team.id, label: team.name }))}
                  value={selectedTeamId}
                  onChange={(value) => setSelectedTeamId(value)}
                  size="xs"
                  maw={220}
                  disabled={teams.length === 0 || isLoading}
                />
              )}

              {chatMode === 'single' && selectedModelSupportsTools() && (
                <Checkbox
                  label="Enable web search"
                  checked={useWebSearch}
                  onChange={(e) => setUseWebSearch(e.currentTarget.checked)}
                  disabled={isLoading}
                  size="sm"
                />
              )}

              {chatMode === 'single' && selectedModelSupportsVision() && (
                <>
                  <FileButton
                    onChange={handleImageSelect}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    disabled={isLoading}
                  >
                    {(props) => (
                      <Button {...props} size="xs" variant="light" disabled={isLoading}>
                        4f7 Attach Image
                      </Button>
                    )}
                  </FileButton>
                  {selectedImage && (
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={clearImage}
                      disabled={isLoading}
                    >
                      0 Remove
                    </Button>
                  )}
                </>
              )}
            </Group>
            {imageWarning && (
              <Alert color="yellow" mb="sm" title="Image Analysis Note">
                {imageWarning}
              </Alert>
            )}
            {imagePreview && (
              <Paper p="xs" mb="sm" withBorder>
                <Image
                  src={imagePreview}
                  alt="Preview"
                  radius="sm"
                  fit="contain"
                  style={{ maxHeight: '150px' }}
                />
              </Paper>
            )}
            <Group gap="sm">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                disabled={isLoading}
                size="md"
                styles={{
                  input: {
                    borderColor: '#7c3aed',
                    '&:focus': {
                      borderColor: '#a855f7',
                      boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.2)',
                    },
                  },
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedImage)}
                size="md"
                leftSection={isLoading ? <Loader size="xs" color="white" /> : undefined}
                style={{
                  background: isLoading || (!input.trim() && !selectedImage) 
                    ? '#4c1d95' 
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  border: 'none',
                }}
              >
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </Group>
          </form>
        </Box>
      </Paper>
    </Container>
  );
}
