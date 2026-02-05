import { useUser } from '@clerk/clerk-react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';

interface ShoppingListItem {
  id: string;
  text: string;
  addedBy: {
    userId: string;
    userName: string;
  };
  createdAt: string;
}

export default function ShoppingList() {
  const { user } = useUser();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiEndpoint = import.meta.env.PROD
    ? 'https://api.thebudimir.com/v1/shopping-list'
    : 'http://localhost:3000/v1/shopping-list';

  // Fetch shopping list items
  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch shopping list');
      }
      const data = (await response.json()) as { items: ShoppingListItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: apiEndpoint is constant
  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: input,
          userId: user.id,
          userName: user.fullName || user.username || 'Unknown User',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      const data = (await response.json()) as { item: ShoppingListItem };
      setItems([...items, data.item]);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setError(null);
    try {
      const response = await fetch(`${apiEndpoint}/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(items.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Title order={1}>🛒 Shopping List</Title>
        <Text c="dimmed">
          Shared shopping list for all users. Add items and see who added what!
        </Text>

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        <Paper p="md" withBorder>
          <form onSubmit={handleAddItem}>
            <Group gap="xs">
              <TextInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Add an item..."
                style={{ flex: 1 }}
                disabled={isSubmitting}
              />
              <Button 
                type="submit" 
                loading={isSubmitting} 
                disabled={!input.trim()}
                style={{
                  background: !input.trim() || isSubmitting
                    ? '#4c1d95' 
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  border: 'none',
                }}
              >
                Add
              </Button>
            </Group>
          </form>
        </Paper>

        {isLoading ? (
          <Box style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader size="lg" />
          </Box>
        ) : items.length === 0 ? (
          <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
            <Text c="dimmed">No items yet. Add the first one!</Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            {items.map((item) => (
              <Paper 
                key={item.id} 
                p="md" 
                withBorder
              >
                <Group justify="space-between" align="flex-start">
                  <Box style={{ flex: 1 }}>
                    <Text size="lg" fw={500}>
                      {item.text}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Added by {item.addedBy.userName} • {formatDate(item.createdAt)}
                    </Text>
                  </Box>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label="Delete item"
                    style={{
                      color: '#f87171',
                      '&:hover': {
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                      },
                    }}
                  >
                    🗑️
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        <Text size="sm" c="dimmed" style={{ textAlign: 'center' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'} in the list
        </Text>
      </Stack>
    </Container>
  );
}
