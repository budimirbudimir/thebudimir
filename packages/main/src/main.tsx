import '@mantine/core/styles.css';
import './index.css';

import { ClerkProvider } from '@clerk/clerk-react';
import { createTheme, MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

const theme = createTheme({
  /** Put your mantine theme override here */
});

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </MantineProvider>
  </StrictMode>
);
