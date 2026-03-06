import { useState } from 'react';
import type { Team, TeamExecuteResult } from '../types';
import type { ChatApi } from './useChatApi';

export interface TeamsState {
  teams: Team[];
  isLoadingTeams: boolean;
  isTeamModalOpen: boolean;
  editingTeam: Team | null;
  isExecutingTeam: boolean;
  teamExecuteResult: TeamExecuteResult | null;
  selectedTeamId: string | null;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  setIsLoadingTeams: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTeamId: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamExecuteResult: React.Dispatch<React.SetStateAction<TeamExecuteResult | null>>;
  saveTeam: (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  openTeamEditor: (team?: Team) => void;
  closeTeamEditor: () => void;
  executeTeamTask: (teamId: string, task: string) => Promise<void>;
}

export function useTeams(api: ChatApi): TeamsState {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isExecutingTeam, setIsExecutingTeam] = useState(false);
  const [teamExecuteResult, setTeamExecuteResult] = useState<TeamExecuteResult | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const saveTeam = async (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTeam) {
        const response = await api.authFetch(`${api.endpoints.teams}/${editingTeam.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamData),
        });
        if (response.ok) {
          const data = (await response.json()) as { team: Team };
          setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? data.team : t)));
        }
      } else {
        const response = await api.authFetch(api.endpoints.teams, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      const response = await api.authFetch(`${api.endpoints.teams}/${id}`, { method: 'DELETE' });
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

  const closeTeamEditor = () => {
    setIsTeamModalOpen(false);
    setEditingTeam(null);
  };

  const executeTeamTask = async (teamId: string, task: string) => {
    setIsExecutingTeam(true);
    setTeamExecuteResult(null);
    try {
      const response = await api.authFetch(`${api.endpoints.teams}/${teamId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return {
    teams,
    isLoadingTeams,
    isTeamModalOpen,
    editingTeam,
    isExecutingTeam,
    teamExecuteResult,
    selectedTeamId,
    setTeams,
    setIsLoadingTeams,
    setSelectedTeamId,
    setTeamExecuteResult,
    saveTeam,
    deleteTeam,
    openTeamEditor,
    closeTeamEditor,
    executeTeamTask,
  };
}
