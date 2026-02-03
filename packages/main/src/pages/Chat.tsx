import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  FileButton,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useAuth } from '@clerk/clerk-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrl?: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  size?: number;
  capabilities?: string[];
}

interface ModelsResponse {
  ollama: ModelInfo[];
  ghmodels: ModelInfo[];
}

export default function Chat() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelsResponse>({
    ollama: [],
    ghmodels: [],
  });
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedService, setSelectedService] = useState<'ollama' | 'ghmodels'>('ghmodels');
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
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

  const modelsEndpoint = import.meta.env.PROD
    ? 'https://api.thebudimir.com/v1/models'
    : 'http://localhost:3000/v1/models';

  // Fetch available models on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: modelsEndpoint is constant based on env
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(modelsEndpoint);
        if (response.ok) {
          const data = (await response.json()) as ModelsResponse;
          setAvailableModels(data);

          // Set default model
          if (data.ghmodels.length > 0) {
            setSelectedModel(data.ghmodels[0].id);
            setSelectedService('ghmodels');
          } else if (data.ollama.length > 0) {
            setSelectedModel(data.ollama[0].id);
            setSelectedService('ollama');
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, [modelsEndpoint]);

  const handleImageSelect = (file: File | null) => {
    setSelectedImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-switch to Ollama vision model when image is selected
      if (availableModels.ollama.length > 0) {
        // Find a vision-capable model (llava, glm, or models with 'vision' in name)
        const visionModel = availableModels.ollama.find(
          (m) =>
            m.name.toLowerCase().includes('llava') ||
            m.name.toLowerCase().includes('glm') ||
            m.name.toLowerCase().includes('vision')
        );

        if (visionModel) {
          setSelectedModel(visionModel.id);
          setSelectedService('ollama');
          setImageWarning(null);
        } else {
          // Use first Ollama model as fallback but warn user
          setSelectedModel(availableModels.ollama[0].id);
          setSelectedService('ollama');
          setImageWarning(
            'No vision-capable models detected. Consider using llava-phi3 or glm-4.6v-flash.'
          );
        }
      } else {
        // No Ollama models available
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || 'What do you see in this image?',
      timestamp: new Date().toISOString(),
      imageUrl: imagePreview || undefined, // Use base64 data URL directly
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const imageDataToSend = imagePreview; // Store before clearing
    clearImage();
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: userMessage.content,
          imageData: imageDataToSend, // Send base64 data URL
          systemPrompt: 'You are a helpful assistant.',
          useWebSearch,
          model: selectedModel,
          service: selectedService,
        }),
      });

      const data = (await response.json()) as { response?: string; error?: string };
      // Check if we got an error response
      if (!response.ok) {
        // Show error as an assistant message
        const errorMessage: Message = {
          role: 'assistant',
          content:
            data.error ||
            data.response ||
            `Sorry, I encountered an error (HTTP ${response.status}). Please try again.`,
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

  const getSelectedModelInfo = () => {
    return (
      availableModels.ollama.find((m) => m.id === selectedModel) ||
      availableModels.ghmodels.find((m) => m.id === selectedModel)
    );
  };

  const handleModelSelect = (model: ModelInfo, service: 'ollama' | 'ghmodels') => {
    setSelectedModel(model.id);
    setSelectedService(service);
    setIsModelModalOpen(false);
  };

  const getCapabilityColor = (capability: string) => {
    const colorMap: Record<string, string> = {
      vision: 'grape',
      tools: 'blue',
      code: 'cyan',
      text: 'gray',
    };
    return colorMap[capability.toLowerCase()] || 'gray';
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
                  {message.imageUrl && (
                    <Image
                      src={message.imageUrl}
                      alt="Uploaded image"
                      mb="sm"
                      radius="sm"
                      fit="contain"
                      style={{ maxHeight: '300px' }}
                    />
                  )}
                  <Box
                    style={{
                      '& a': {
                        color: message.role === 'user' ? '#60a5fa' : '#2563eb',
                        textDecoration: 'underline',
                      },
                      '& code': {
                        backgroundColor: message.role === 'user' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                      },
                      '& pre': {
                        backgroundColor: '#1f2937',
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        marginTop: '8px',
                        marginBottom: '8px',
                      },
                      '& pre code': {
                        backgroundColor: 'transparent',
                        padding: '0',
                      },
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </Box>
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
          <Modal
            opened={isModelModalOpen}
            onClose={() => setIsModelModalOpen(false)}
            title={<Text fw={700} size="lg">Select AI Model</Text>}
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
                      <Paper
                        key={model.id}
                        p="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedModel === model.id ? 'var(--mantine-color-blue-6)' : undefined,
                          borderWidth: selectedModel === model.id ? 2 : 1,
                        }}
                        onClick={() => handleModelSelect(model, 'ghmodels')}
                      >
                        <Group justify="space-between" mb="xs">
                          <Text fw={600}>{model.name}</Text>
                          {selectedModel === model.id && (
                            <Badge color="blue" variant="filled" size="sm">
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
                              <Badge
                                key={cap}
                                color={getCapabilityColor(cap)}
                                variant="light"
                                size="sm"
                              >
                                {cap}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Paper>
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
                      <Paper
                        key={model.id}
                        p="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedModel === model.id ? 'var(--mantine-color-blue-6)' : undefined,
                          borderWidth: selectedModel === model.id ? 2 : 1,
                        }}
                        onClick={() => handleModelSelect(model, 'ollama')}
                      >
                        <Group justify="space-between" mb="xs">
                          <Text fw={600}>{model.name}</Text>
                          {selectedModel === model.id && (
                            <Badge color="blue" variant="filled" size="sm">
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
                              <Badge
                                key={cap}
                                color={getCapabilityColor(cap)}
                                variant="light"
                                size="sm"
                              >
                                {cap}
                              </Badge>
                            ))}
                          </Group>
                        )}
                        {model.size && (
                          <Text size="xs" c="dimmed" mt="xs">
                            Size: {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
                          </Text>
                        )}
                      </Paper>
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

          <form onSubmit={handleSubmit}>
            <Group gap="sm" mb="sm">
              <Button
                onClick={() => setIsModelModalOpen(true)}
                disabled={isLoading}
                variant="default"
                size="sm"
                style={{ minWidth: '250px' }}
              >
                {getSelectedModelInfo()?.name || 'Select Model'}
              </Button>
              <Checkbox
                label="Enable web search"
                checked={useWebSearch}
                onChange={(e) => setUseWebSearch(e.currentTarget.checked)}
                disabled={isLoading}
                size="sm"
              />
              <FileButton
                onChange={handleImageSelect}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                disabled={isLoading}
              >
                {(props) => (
                  <Button {...props} size="xs" variant="light" disabled={isLoading}>
                    📷 Attach Image
                  </Button>
                )}
              </FileButton>
              {selectedImage && (
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={clearImage}
                  disabled={isLoading}
                >
                  ✕ Remove
                </Button>
              )}
            </Group>
            {imageWarning && (
              <Alert color="yellow" mb="sm" title="Image Analysis Note">
                {imageWarning}
              </Alert>
            )}
            {imagePreview && (
              <Paper p="xs" mb="sm" withBorder>
                <Image
                  src={imagePreview}
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
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                disabled={isLoading}
                size="md"
              />
              <Button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedImage)}
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
