import { useEffect, useRef, useState } from 'react';
import type { Message, TeamExecuteResult } from '../types';
import type { AgentsState } from './useAgents';
import type { ChatApi } from './useChatApi';
import type { ConversationsState } from './useConversations';
import type { ModelsState } from './useModels';
import type { TeamsState } from './useTeams';

interface UseChatDeps {
  conversations: ConversationsState;
  agents: AgentsState;
  teams: TeamsState;
  models: ModelsState;
}

export interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  isLoadingMessages: boolean;
  isPrivate: boolean;
  error: string | null;
  useWebSearch: boolean;
  chatMode: 'single' | 'team';
  selectedImage: File | null;
  imagePreview: string | null;
  imageWarning: string | null;
  viewport: React.RefObject<HTMLDivElement | null>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPrivate: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setUseWebSearch: React.Dispatch<React.SetStateAction<boolean>>;
  setChatMode: React.Dispatch<React.SetStateAction<'single' | 'team'>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleAbort: () => void;
  handleImageSelect: (file: File | null) => void;
  clearImage: () => void;
}

export function useChat(api: ChatApi, deps: UseChatDeps): ChatState {
  const { conversations, agents, teams, models } = deps;

  const [isPrivate, setIsPrivate] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [chatMode, setChatMode] = useState<'single' | 'team'>('single');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleImageSelect = (file: File | null) => {
    setSelectedImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      if (models.availableModels.ollama.length > 0) {
        const visionModel = models.availableModels.ollama.find(
          (m) =>
            m.name.toLowerCase().includes('llava') ||
            m.name.toLowerCase().includes('glm') ||
            m.name.toLowerCase().includes('vision')
        );

        if (visionModel) {
          models.setSelectedModel(visionModel.id);
          models.setSelectedService('ollama');
          setImageWarning(null);
        } else {
          models.setSelectedModel(models.availableModels.ollama[0].id);
          models.setSelectedService('ollama');
          setImageWarning(
            'No vision-capable models detected. Consider using llava-phi3 or glm-4.6v-flash.'
          );
        }
      } else {
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

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    abortControllerRef.current = new AbortController();

    const userMessageContent = input.trim() || 'What do you see in this image?';

    const userMessage: Message = {
      role: 'user',
      content: userMessageContent,
      timestamp: new Date().toISOString(),
      imageUrl: imagePreview || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const imageDataToSend = chatMode === 'single' ? imagePreview : null;
    clearImage();
    setIsLoading(true);
    setError(null);

    // Create conversation if this is the first message (single-agent, text only)
    let convId = conversations.currentConversationId;
    if (chatMode === 'single' && !convId && !imageDataToSend) {
      const title =
        userMessage.content.length > 50
          ? `${userMessage.content.substring(0, 50)}...`
          : userMessage.content;

      convId = await conversations.createConversation({
        title,
        model: models.selectedModel,
        service: models.selectedService,
        agentId: agents.currentAgent?.id,
        isPrivate,
      });
    }

    try {
      if (chatMode === 'team') {
        if (!teams.selectedTeamId) {
          setError('Please select a team before running a team task.');
          return;
        }

        const response = await api.authFetch(
          `${api.endpoints.teams}/${teams.selectedTeamId}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: userMessageContent }),
            signal: abortControllerRef.current.signal,
          }
        );

        const data = (await response.json()) as TeamExecuteResult & { error?: string };

        if (!response.ok) {
          const errorContent =
            data.error ||
            `Sorry, the team was unable to complete the task (HTTP ${response.status}).`;
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: errorContent, timestamp: new Date().toISOString() },
          ]);
        } else {
          const header = `Team ${data.team} (coordinator: ${data.coordinator})`;
          const body = data.response || 'Team did not return a response.';
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `${header}\n\n${body}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        return;
      }

      const response = await api.authFetch(api.endpoints.chat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageContent,
          imageData: imageDataToSend,
          systemPrompt: 'You are a helpful assistant.',
          useWebSearch,
          model: models.selectedModel,
          service: models.selectedService,
          conversationId: imageDataToSend ? undefined : convId,
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = (await response.json()) as { response?: string; error?: string };

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              data.error ||
              data.response ||
              `Sorry, I encountered an error (HTTP ${response.status}). Please try again.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response || 'Sorry, I received an empty response.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request aborted by user');
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "Sorry, I couldn't connect to the server. Please check your connection and try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
      console.error('Chat error:', err);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  return {
    messages,
    input,
    isLoading,
    isLoadingMessages,
    isPrivate,
    error,
    useWebSearch,
    chatMode,
    selectedImage,
    imagePreview,
    imageWarning,
    viewport,
    setMessages,
    setInput,
    setIsLoadingMessages,
    setIsPrivate,
    setError,
    setUseWebSearch,
    setChatMode,
    handleSubmit,
    handleAbort,
    handleImageSelect,
    clearImage,
  };
}
