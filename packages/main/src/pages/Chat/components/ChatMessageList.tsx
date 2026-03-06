import { Box, Group, Loader, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import type { Agent, Message, ModelsResponse } from '../types';
import ChatMessageBubble from './ChatMessageBubble';

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  currentAgent: Agent | null;
  selectedModel: string;
  selectedService: 'ollama' | 'ghmodels';
  availableModels: ModelsResponse;
  viewport: React.RefObject<HTMLDivElement | null>;
}

export default function ChatMessageList({
  messages,
  isLoading,
  isLoadingMessages,
  currentAgent,
  selectedModel,
  selectedService,
  availableModels,
  viewport,
}: ChatMessageListProps) {
  return (
    <ScrollArea style={{ flex: 1 }} viewportRef={viewport} mb="md">
      <Stack gap="md" p="md">
        {isLoadingMessages && (
          <Box ta="center" py="md">
            <Loader color="violet" size="sm" />
            <Text size="sm" c="dimmed" mt="xs">
              Loading conversation...
            </Text>
          </Box>
        )}

        {messages.length === 0 && !isLoadingMessages && (
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
          <ChatMessageBubble key={message.timestamp} message={message} />
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
  );
}
