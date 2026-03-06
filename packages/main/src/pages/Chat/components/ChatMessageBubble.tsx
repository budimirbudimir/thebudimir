import { Box, Group, Image, Paper, Text } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import type { Message } from '../types';

interface ChatMessageBubbleProps {
  message: Message;
}

const markdownStyles = {
  '& a': {
    color: '#c084fc',
    textDecoration: 'underline',
    fontWeight: 500,
  },
  '& a:hover': {
    color: '#e9d5ff',
  },
  '& code': {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    color: '#c084fc',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.9em',
  },
  '& pre': {
    backgroundColor: '#0f0e1a',
    border: '1px solid #4c1d95',
    padding: '12px',
    borderRadius: '8px',
    overflow: 'auto',
    marginTop: '8px',
    marginBottom: '8px',
  },
  '& pre code': {
    backgroundColor: 'transparent',
    color: '#e9d5ff',
    padding: '0',
  },
} as const;

export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  return (
    <Box
      style={{
        maxWidth: '80%',
        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
        marginLeft: message.role === 'user' ? 'auto' : 0,
      }}
    >
      <Paper
        p="md"
        bg={message.role === 'user' ? '#7c3aed' : '#1e1b2e'}
        c="white"
        style={{
          border: message.role === 'assistant' ? '1px solid #4c1d95' : 'none',
        }}
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
        <Box style={markdownStyles}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {message.content}
          </ReactMarkdown>
        </Box>
      </Paper>
    </Box>
  );
}
