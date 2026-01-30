import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface ApiStatus {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  model?: string;
}

interface ServiceStatus {
  name: string;
  endpoint: string;
  status: 'online' | 'offline' | 'loading';
  data?: ApiStatus;
  error?: string;
  lastChecked?: string;
}

export default function Status() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'API Server',
      endpoint: import.meta.env.PROD
        ? 'https://api.thebudimir.com/v1/status'
        : 'http://localhost:3000/v1/status',
      status: 'loading',
    },
    {
      name: 'GitHub Models (AI)',
      endpoint: import.meta.env.PROD
        ? 'https://api.thebudimir.com/v1/chat'
        : 'http://localhost:3000/v1/chat',
      status: 'loading',
    },
  ]);

  const checkAllServicesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const checkStatus = async (service: ServiceStatus): Promise<ServiceStatus> => {
      try {
        // For AI endpoint, send a test message
        const isAIEndpoint = service.endpoint.includes('/chat');
        const response = await fetch(
          service.endpoint,
          isAIEndpoint
            ? {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'health check' }),
              }
            : undefined
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // AI service returns 503 if not configured
          if (response.status === 503) {
            throw new Error(errorData.error || 'Service not configured');
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
          ...service,
          status: 'online',
          data,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ...service,
          status: 'offline',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        };
      }
    };

    const checkAllServices = async () => {
      setServices((currentServices) => {
        Promise.all(currentServices.map(checkStatus)).then(setServices);
        return currentServices;
      });
    };

    checkAllServicesRef.current = checkAllServices;

    checkAllServices();
    const interval = setInterval(checkAllServices, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    checkAllServicesRef.current?.();
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return 'green';
      case 'offline':
        return 'red';
      default:
        return 'yellow';
    }
  };

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>System Status</Title>
        <Button component={Link} to="/" variant="subtle">
          ← Back to Home
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {services.map((service) => (
          <Paper key={service.name} shadow="sm" p="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={3}>{service.name}</Title>
              <Badge color={getStatusColor(service.status)} variant="filled">
                {service.status.toUpperCase()}
              </Badge>
            </Group>

            <Stack gap="sm">
              {service.data && (
                <>
                  {service.data.version && (
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Version:
                      </Text>
                      <Text size="sm">{service.data.version}</Text>
                    </Group>
                  )}
                  {service.data.model && (
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Model:
                      </Text>
                      <Text size="sm">{service.data.model}</Text>
                    </Group>
                  )}
                  {service.data.uptime !== undefined && (
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Uptime:
                      </Text>
                      <Text size="sm">{Math.floor(service.data.uptime)}s</Text>
                    </Group>
                  )}
                </>
              )}

              {service.error && (
                <Paper p="sm" bg="red.0" withBorder>
                  <Text size="sm" c="red.9" fw={500}>
                    Error:
                  </Text>
                  <Text size="sm" c="red.9">
                    {service.error}
                  </Text>
                </Paper>
              )}

              {service.lastChecked && (
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Last Checked:
                  </Text>
                  <Text size="sm">{new Date(service.lastChecked).toLocaleTimeString()}</Text>
                </Group>
              )}

              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Endpoint:
                </Text>
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  {service.endpoint}
                </Text>
              </Group>
            </Stack>

            <Button fullWidth mt="md" onClick={handleRefresh} variant="light">
              Refresh Status
            </Button>
          </Paper>
        ))}
      </SimpleGrid>
    </Container>
  );
}
