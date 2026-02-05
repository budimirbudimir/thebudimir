import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { ServiceStatus } from '../StatusPage';

interface ServiceCardProps {
  service: ServiceStatus;
  onRefresh: () => void;
  getStatusColor: (status: ServiceStatus['status']) => string;
}

export default function ServiceCard({
  service,
  onRefresh,
  getStatusColor,
}: ServiceCardProps) {
  return (
    <Paper
      shadow="sm"
      p="lg"
      withBorder
      style={{
        borderColor:
          service.status === 'online'
            ? '#7c3aed'
            : service.status === 'offline'
              ? '#ef4444'
              : undefined,
      }}
    >
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
            {service.data.models !== undefined && (
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Models Available:
                </Text>
                <Text size="sm">{service.data.models}</Text>
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
          <Paper
            p="sm"
            withBorder
            style={{ backgroundColor: '#1a0d0d', borderColor: '#7f1d1d' }}
          >
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
            <Text size="sm">
              {new Date(service.lastChecked).toLocaleTimeString()}
            </Text>
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

      <Button
        fullWidth
        mt="md"
        onClick={onRefresh}
        variant="light"
        style={{
          background:
            'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
          borderColor: '#7c3aed',
          color: '#a855f7',
          '&:hover': {
            background:
              'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
          },
        }}
      >
        Refresh Status
      </Button>
    </Paper>
  );
}
