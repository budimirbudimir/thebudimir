import { useState } from 'react';
import type { ChatApi } from './useChatApi';
import type { Agent, Conversation, ConversationMessage, Message } from '../types';

export interface ConversationsState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoadingConversations: boolean;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setCurrentConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoadingConversations: React.Dispatch<React.SetStateAction<boolean>>;
  openConversation: (
    conversation: Conversation,
    callbacks: {
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
      setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
      setCurrentAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
      setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
      setSelectedService: React.Dispatch<React.SetStateAction<'ollama' | 'ghmodels'>>;
    },
  ) => Promise<void>;
  deleteConversation: (id: string, e: React.MouseEvent) => Promise<void>;
  createConversation: (params: {
    title: string;
    model: string;
    service: string;
    agentId?: string;
  }) => Promise<string | null>;
}

export function useConversations(api: ChatApi): ConversationsState {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const openConversation = async (
    conversation: Conversation,
    callbacks: {
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
      setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
      setCurrentAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
      setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
      setSelectedService: React.Dispatch<React.SetStateAction<'ollama' | 'ghmodels'>>;
    },
  ) => {
    setCurrentConversationId(conversation.id);
    callbacks.setIsLoadingMessages(true);

    if (conversation.model) {
      callbacks.setSelectedModel(conversation.model);
    }
    if (conversation.service) {
      callbacks.setSelectedService(conversation.service as 'ollama' | 'ghmodels');
    }

    try {
      const response = await api.authFetch(
        `${api.endpoints.conversations}/${conversation.id}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          conversation: Conversation;
          messages: ConversationMessage[];
          agent: Agent | null;
        };
        callbacks.setMessages(
          data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
          })),
        );
        callbacks.setCurrentAgent(data.agent);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      callbacks.setIsLoadingMessages(false);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await api.authFetch(
        `${api.endpoints.conversations}/${id}`,
        { method: 'DELETE' },
      );
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const createConversation = async (params: {
    title: string;
    model: string;
    service: string;
    agentId?: string;
  }): Promise<string | null> => {
    try {
      const response = await api.authFetch(api.endpoints.conversations, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (response.ok) {
        const data = (await response.json()) as { conversation: Conversation };
        setCurrentConversationId(data.conversation.id);
        setConversations((prev) => [data.conversation, ...prev]);
        return data.conversation.id;
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
    return null;
  };

  return {
    conversations,
    currentConversationId,
    isLoadingConversations,
    setConversations,
    setCurrentConversationId,
    setIsLoadingConversations,
    openConversation,
    deleteConversation,
    createConversation,
  };
}
