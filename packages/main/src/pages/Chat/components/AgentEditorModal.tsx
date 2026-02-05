import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Group,
} from '@mantine/core';
import type { Agent, ModelsResponse } from '../ChatPage';

interface AgentEditorModalProps {
  opened: boolean;
  onClose: () => void;
  agent: Agent | null;
  onSave: (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  availableModels: ModelsResponse;
}

export default function AgentEditorModal({
  opened,
  onClose,
  agent,
  onSave,
  availableModels,
}: AgentEditorModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [service, setService] = useState<'ollama' | 'ghmodels' | ''>('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [maxIterations, setMaxIterations] = useState(5);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      if (agent) {
        setName(agent.name);
        setDescription(agent.description || '');
        setSystemPrompt(agent.systemPrompt);
        setModel(agent.model || '');
        setService((agent.service as 'ollama' | 'ghmodels' | '') || '');
        setTemperature(agent.temperature);
        setMaxTokens(agent.maxTokens);
        setMaxIterations(agent.maxIterations ?? 5);
        setEnableWebSearch(agent.tools?.includes('web_search') || false);
      } else {
        setName('');
        setDescription('');
        setSystemPrompt('');
        setModel('');
        setService('');
        setTemperature(0.7);
        setMaxTokens(2000);
        setMaxIterations(5);
        setEnableWebSearch(false);
      }
    }
  }, [opened, agent]);

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) return;

    setIsSaving(true);
    try {
      const tools: string[] = [];
      if (enableWebSearch) tools.push('web_search');

      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim(),
        model: model || undefined,
        service: service || undefined,
        temperature,
        maxTokens,
        maxIterations,
        tools,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const allModels = [
    ...availableModels.ollama.map((m) => ({ ...m, service: 'ollama' as const })),
    ...availableModels.ghmodels.map((m) => ({ ...m, service: 'ghmodels' as const })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={agent ? 'Edit Agent' : 'Create Agent'}
      size="lg"
      styles={{
        header: { backgroundColor: '#1e1b2e', borderBottom: '1px solid #4c1d95' },
        body: { backgroundColor: '#1e1b2e' },
        content: { backgroundColor: '#1e1b2e' },
      }}
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="My Custom Agent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <TextInput
          label="Description"
          placeholder="Brief description of what this agent does"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Textarea
          label="System Prompt"
          placeholder="You are a helpful assistant that..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          minRows={4}
          autosize
          maxRows={8}
        />

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Model (optional)
          </Text>
          <SegmentedControl
            value={service}
            onChange={(value) => {
              setService(value as 'ollama' | 'ghmodels' | '');
              setModel('');
            }}
            data={[
              { label: 'Any', value: '' },
              { label: 'GitHub Models', value: 'ghmodels' },
              { label: 'Ollama', value: 'ollama' },
            ]}
            fullWidth
            mb="xs"
          />
          {service && (
            <ScrollArea.Autosize mah={150}>
              <Stack gap="xs">
                {(service === 'ollama' ? availableModels.ollama : availableModels.ghmodels).map((m) => (
                  <Paper
                    key={m.id}
                    p="xs"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderColor: model === m.id ? '#7c3aed' : undefined,
                      backgroundColor: model === m.id ? 'rgba(124, 58, 237, 0.1)' : undefined,
                    }}
                    onClick={() => setModel(m.id)}
                  >
                    <Text size="sm" fw={500}>
                      {m.name}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
          {model && (
            <Text size="xs" c="dimmed" mt="xs">
              Selected: {allModels.find((m) => m.id === model)?.name || model}
            </Text>
          )}
        </Box>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Temperature: {temperature.toFixed(1)}
          </Text>
          <Slider
            value={temperature}
            onChange={setTemperature}
            min={0}
            max={2}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 1, label: '1' },
              { value: 2, label: '2' },
            ]}
            color="violet"
          />
          <Text size="xs" c="dimmed" mt="xs">
            Lower = more focused, higher = more creative
          </Text>
        </Box>

        <NumberInput
          label="Max Tokens"
          value={maxTokens}
          onChange={(value) => setMaxTokens(typeof value === 'number' ? value : 2000)}
          min={100}
          max={32000}
          step={100}
        />

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Max Iterations: {maxIterations}
          </Text>
          <Slider
            value={maxIterations}
            onChange={setMaxIterations}
            min={1}
            max={10}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
            ]}
            color="violet"
          />
          <Text size="xs" c="dimmed" mt="xs">
            Max reasoning steps when using tools (ReAct loop)
          </Text>
        </Box>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Tools
          </Text>
          <Switch
            label="Web Search"
            description="Allow the agent to search the web for information"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.currentTarget.checked)}
            color="violet"
          />
        </Box>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!name.trim() || !systemPrompt.trim()}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              border: 'none',
            }}
          >
            {agent ? 'Save Changes' : 'Create Agent'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
