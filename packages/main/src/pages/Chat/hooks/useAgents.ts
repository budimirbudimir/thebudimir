import { useState } from 'react';
import type { ChatApi } from './useChatApi';
import type { Agent } from '../types';

export interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoadingAgents: boolean;
  isAgentModalOpen: boolean;
  editingAgent: Agent | null;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setCurrentAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
  setIsLoadingAgents: React.Dispatch<React.SetStateAction<boolean>>;
  saveAgent: (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteAgent: (id: string, e?: React.MouseEvent) => Promise<void>;
  openAgentEditor: (agent?: Agent) => void;
  closeAgentEditor: () => void;
}

export function useAgents(api: ChatApi): AgentsState {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const saveAgent = async (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingAgent) {
        const response = await api.authFetch(
          `${api.endpoints.agents}/${editingAgent.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData),
          },
        );
        if (response.ok) {
          const data = (await response.json()) as { agent: Agent };
          setAgents((prev) => prev.map((a) => (a.id === editingAgent.id ? data.agent : a)));
        }
      } else {
        const response = await api.authFetch(api.endpoints.agents, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      const response = await api.authFetch(
        `${api.endpoints.agents}/${id}`,
        { method: 'DELETE' },
      );
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

  const closeAgentEditor = () => {
    setIsAgentModalOpen(false);
    setEditingAgent(null);
  };

  return {
    agents,
    currentAgent,
    isLoadingAgents,
    isAgentModalOpen,
    editingAgent,
    setAgents,
    setCurrentAgent,
    setIsLoadingAgents,
    saveAgent,
    deleteAgent,
    openAgentEditor,
    closeAgentEditor,
  };
}
