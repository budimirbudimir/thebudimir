import { Button, Container, Group, SimpleGrid, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ServiceCard from './components/ServiceCard';

interface ApiStatus {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  model?: string;
  models?: number;
  url?: string;
}

export interface ServiceStatus {
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
        ? 'https://api.thebudimir.com/v1/ghmodels/status'
        : 'http://localhost:3000/v1/ghmodels/status',
      status: 'loading',
    },
    {
      name: 'Ollama (Local AI)',
      endpoint: import.meta.env.PROD
        ? 'https://api.thebudimir.com/v1/ollama/status'
        : 'http://localhost:3000/v1/ollama/status',
      status: 'loading',
    },
  ]);

  const checkAllServicesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const checkStatus = async (service: ServiceStatus): Promise<ServiceStatus> => {
      try {
        // For AI chat endpoint, send a test message
        const isAIChatEndpoint = service.endpoint.includes('/chat');
        const response = await fetch(
          service.endpoint,
          isAIChatEndpoint
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
        return 'violet';
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
          <ServiceCard
            key={service.name}
            service={service}
            onRefresh={handleRefresh}
            getStatusColor={getStatusColor}
          />
        ))}
      </SimpleGrid>
    </Container>
  );
}
