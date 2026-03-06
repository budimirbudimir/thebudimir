import {
  Alert,
  Box,
  Button,
  Checkbox,
  FileButton,
  Group,
  Image,
  Paper,
  SegmentedControl,
  Select,
  TextInput,
} from '@mantine/core';
import type { ChatState } from '../hooks/useChat';
import type { ModelsState } from '../hooks/useModels';
import type { Agent, Team } from '../types';

interface ChatInputBarProps {
  chat: ChatState;
  models: ModelsState;
  agents: Agent[];
  currentAgent: Agent | null;
  teams: Team[];
  selectedTeamId: string | null;
  onTeamSelect: (value: string | null) => void;
  onAgentChange: (agent?: Agent) => void;
}

export default function ChatInputBar({
  chat,
  models,
  agents,
  currentAgent,
  teams,
  selectedTeamId,
  onTeamSelect,
  onAgentChange,
}: ChatInputBarProps) {
  return (
    <Box>
      <form onSubmit={chat.handleSubmit}>
        <Group gap="sm" mb="sm">
          <Button
            onClick={() => models.setIsModelModalOpen(true)}
            disabled={chat.isLoading}
            variant="default"
            size="sm"
            style={{ minWidth: '220px' }}
          >
            {models.getSelectedModelInfo()?.name || 'Select Model'}
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
                onAgentChange();
                return;
              }
              const agent = agents.find((a) => a.id === value) || null;
              if (agent) {
                onAgentChange(agent);
              }
            }}
            size="xs"
            maw={220}
            disabled={chat.isLoading}
          />

          <SegmentedControl
            value={chat.chatMode}
            onChange={(value) => chat.setChatMode(value as 'single' | 'team')}
            data={[
              { label: 'Single Agent', value: 'single' },
              { label: 'Team Task', value: 'team' },
            ]}
            size="xs"
          />

          {chat.chatMode === 'team' && (
            <Select
              placeholder={teams.length ? 'Select team' : 'No teams available'}
              data={teams.map((team) => ({ value: team.id, label: team.name }))}
              value={selectedTeamId}
              onChange={(value) => onTeamSelect(value)}
              size="xs"
              maw={220}
              disabled={teams.length === 0 || chat.isLoading}
            />
          )}

          {chat.chatMode === 'single' && models.selectedModelSupportsTools() && (
            <Checkbox
              label="Enable web search"
              checked={chat.useWebSearch}
              onChange={(e) => chat.setUseWebSearch(e.currentTarget.checked)}
              disabled={chat.isLoading}
              size="sm"
            />
          )}

          {chat.chatMode === 'single' && models.selectedModelSupportsVision() && (
            <>
              <FileButton
                onChange={chat.handleImageSelect}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                disabled={chat.isLoading}
              >
                {(props) => (
                  <Button {...props} size="xs" variant="light" disabled={chat.isLoading}>
                    📷 Attach Image
                  </Button>
                )}
              </FileButton>
              {chat.selectedImage && (
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={chat.clearImage}
                  disabled={chat.isLoading}
                >
                  ✕ Remove
                </Button>
              )}
            </>
          )}
        </Group>
        {chat.imageWarning && (
          <Alert color="yellow" mb="sm" title="Image Analysis Note">
            {chat.imageWarning}
          </Alert>
        )}
        {chat.imagePreview && (
          <Paper p="xs" mb="sm" withBorder>
            <Image
              src={chat.imagePreview}
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
            value={chat.input}
            onChange={(e) => chat.setInput(e.currentTarget.value)}
            disabled={chat.isLoading}
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
          {chat.isLoading ? (
            <Button
              onClick={chat.handleAbort}
              size="md"
              color="red"
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                border: 'none',
              }}
            >
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!chat.input.trim() && !chat.selectedImage}
              size="md"
              style={{
                background:
                  !chat.input.trim() && !chat.selectedImage
                    ? '#4c1d95'
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                border: 'none',
              }}
            >
              Send
            </Button>
          )}
        </Group>
      </form>
    </Box>
  );
}
