import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll when messages change
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const apiEndpoint = import.meta.env.PROD
    ? 'https://api.thebudimir.com/v1/chat'
    : 'http://localhost:3000/v1/chat';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          systemPrompt: 'You are a helpful assistant.',
          useWebSearch,
        }),
      });

      const data = (await response.json()) as { response?: string; error?: string };
      
      // Check if we got an error response
      if (!response.ok) {
        // Show error as an assistant message
        const errorMessage: Message = {
          role: 'assistant',
          content: data.error || data.response || `Sorry, I encountered an error (HTTP ${response.status}). Please try again.`,
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
        content: `Sorry, I couldn't connect to the server. Please check your connection and try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

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
        <ScrollArea style={{ flex: 1 }} viewportRef={viewport} mb="md">
          <Stack gap="md" p="md">
            {messages.length === 0 && (
              <Box ta="center" py="xl">
                <Text size="lg" c="dimmed">
                  Start a conversation with the AI assistant
                </Text>
                <Text size="sm" c="dimmed" mt="xs">
                  Powered by Ministral-3B via GitHub Models
                </Text>
              </Box>
            )}

            {messages.map((message, index) => (
              <Box
                key={`${message.timestamp}-${index}`}
                style={{
                  maxWidth: '80%',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginLeft: message.role === 'user' ? 'auto' : 0,
                }}
              >
                <Paper
                  p="md"
                  bg={message.role === 'user' ? 'blue.6' : 'gray.1'}
                  c={message.role === 'user' ? 'white' : 'black'}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} tt="uppercase">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </Text>
                    <Text size="xs" opacity={0.7}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Text>
                  </Group>
                  <Text style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                    {message.content}
                  </Text>
                </Paper>
              </Box>
            ))}

            {isLoading && (
              <Box style={{ maxWidth: '80%' }}>
                <Paper p="md" bg="gray.1">
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
          {messages.length > 0 && (
            <Group justify="flex-end" mb="xs">
              <Button
                size="xs"
                color="red"
                variant="subtle"
                onClick={handleClear}
                disabled={isLoading}
              >
                Clear
              </Button>
            </Group>
          )}
          <form onSubmit={handleSubmit}>
            <Checkbox
              label="Enable web search"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.currentTarget.checked)}
              disabled={isLoading}
              mb="sm"
              size="sm"
            />
            <Group gap="sm">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                disabled={isLoading}
                size="md"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="md"
                leftSection={isLoading ? <Loader size="xs" color="white" /> : undefined}
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
