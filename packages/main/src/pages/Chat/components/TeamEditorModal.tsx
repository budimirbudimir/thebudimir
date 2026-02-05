import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { Agent, Team } from '../ChatPage';

interface TeamEditorModalProps {
  opened: boolean;
  onClose: () => void;
  team: Team | null;
  onSave: (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  agents: Agent[];
}

export default function TeamEditorModal({
  opened,
  onClose,
  team,
  onSave,
  agents,
}: TeamEditorModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coordinatorAgentId, setCoordinatorAgentId] = useState('');
  const [memberAgentIds, setMemberAgentIds] = useState<string[]>([]);
  const [executionMode, setExecutionMode] = useState<'sequential' | 'parallel'>('sequential');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      if (team) {
        setName(team.name);
        setDescription(team.description || '');
        setCoordinatorAgentId(team.coordinatorAgentId);
        setMemberAgentIds(team.memberAgentIds);
        setExecutionMode(team.executionMode);
      } else {
        setName('');
        setDescription('');
        setCoordinatorAgentId('');
        setMemberAgentIds([]);
        setExecutionMode('sequential');
      }
    }
  }, [opened, team]);

  const handleSave = async () => {
    if (!name.trim() || !coordinatorAgentId) return;
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        coordinatorAgentId,
        memberAgentIds,
        executionMode,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMember = (agentId: string) => {
    if (agentId === coordinatorAgentId) return;
    setMemberAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={team ? 'Edit Team' : 'Create Team'}
      size="lg"
      styles={{
        header: { backgroundColor: '#1e1b2e', borderBottom: '1px solid #4c1d95' },
        body: { backgroundColor: '#1e1b2e' },
        content: { backgroundColor: '#1e1b2e' },
      }}
    >
      <Stack gap="md">
        <TextInput
          label="Team Name"
          placeholder="Research Team"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <TextInput
          label="Description"
          placeholder="A team of specialists for research tasks"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Coordinator Agent (required)
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            The coordinator receives tasks and delegates to team members
          </Text>
          <ScrollArea.Autosize mah={150}>
            <Stack gap="xs">
              {agents.map((agent) => (
                <Paper
                  key={agent.id}
                  p="xs"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    borderColor: coordinatorAgentId === agent.id ? '#7c3aed' : undefined,
                    backgroundColor:
                      coordinatorAgentId === agent.id ? 'rgba(124, 58, 237, 0.1)' : undefined,
                  }}
                  onClick={() => {
                    setCoordinatorAgentId(agent.id);
                    setMemberAgentIds((prev) => prev.filter((id) => id !== agent.id));
                  }}
                >
                  <Text size="sm" fw={500}>
                    {agent.name}
                  </Text>
                  {agent.description && (
                    <Text size="xs" c="dimmed">
                      {agent.description}
                    </Text>
                  )}
                </Paper>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        </Box>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Team Members (specialists)
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            Select agents that the coordinator can delegate tasks to
          </Text>
          <ScrollArea.Autosize mah={150}>
            <Stack gap="xs">
              {agents
                .filter((a) => a.id !== coordinatorAgentId)
                .map((agent) => (
                  <Paper
                    key={agent.id}
                    p="xs"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderColor: memberAgentIds.includes(agent.id) ? '#10b981' : undefined,
                      backgroundColor:
                        memberAgentIds.includes(agent.id) ? 'rgba(16, 185, 129, 0.1)' : undefined,
                    }}
                    onClick={() => toggleMember(agent.id)}
                  >
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={500}>
                          {agent.name}
                        </Text>
                        {agent.description && (
                          <Text size="xs" c="dimmed">
                            {agent.description}
                          </Text>
                        )}
                      </Box>
                      {memberAgentIds.includes(agent.id) && (
                        <Badge size="xs" color="teal">
                          Selected
                        </Badge>
                      )}
                    </Group>
                  </Paper>
                ))}
            </Stack>
          </ScrollArea.Autosize>
        </Box>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Execution Mode
          </Text>
          <SegmentedControl
            value={executionMode}
            onChange={(value) => setExecutionMode(value as 'sequential' | 'parallel')}
            data={[
              { label: 'Sequential', value: 'sequential' },
              { label: 'Parallel', value: 'parallel' },
            ]}
            fullWidth
          />
          <Text size="xs" c="dimmed" mt="xs">
            Sequential: Coordinator delegates one task at a time. Parallel: All delegations run at once.
          </Text>
        </Box>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!name.trim() || !coordinatorAgentId}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              border: 'none',
            }}
          >
            {team ? 'Save Changes' : 'Create Team'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
