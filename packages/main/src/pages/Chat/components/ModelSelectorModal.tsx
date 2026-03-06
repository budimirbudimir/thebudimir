import { Badge, Box, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import type { ModelInfo, ModelsResponse } from '../types';

interface ModelSelectorModalProps {
  opened: boolean;
  onClose: () => void;
  availableModels: ModelsResponse;
  selectedModel: string;
  onSelect: (model: ModelInfo, service: 'ollama' | 'ghmodels') => void;
  getCapabilityColor: (capability: string) => string;
}

function ModelCard({
  model,
  isSelected,
  onClick,
  getCapabilityColor,
  showSize,
}: {
  model: ModelInfo;
  isSelected: boolean;
  onClick: () => void;
  getCapabilityColor: (capability: string) => string;
  showSize?: boolean;
}) {
  return (
    <Paper
      p="md"
      withBorder
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? '#a855f7' : undefined,
        borderWidth: isSelected ? 2 : 1,
        background: isSelected
          ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)'
          : undefined,
        transition: 'all 0.2s ease',
      }}
      onClick={onClick}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={600}>{model.name}</Text>
        {isSelected && (
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
            <Badge key={cap} color={getCapabilityColor(cap)} variant="light" size="sm">
              {cap}
            </Badge>
          ))}
        </Group>
      )}
      {showSize && model.size && (
        <Text size="xs" c="dimmed" mt="xs">
          Size: {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
        </Text>
      )}
    </Paper>
  );
}

export default function ModelSelectorModal({
  opened,
  onClose,
  availableModels,
  selectedModel,
  onSelect,
  getCapabilityColor,
}: ModelSelectorModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} size="lg">
          Select AI Model
        </Text>
      }
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
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  onClick={() => onSelect(model, 'ghmodels')}
                  getCapabilityColor={getCapabilityColor}
                />
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
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  onClick={() => onSelect(model, 'ollama')}
                  getCapabilityColor={getCapabilityColor}
                  showSize
                />
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
  );
}
