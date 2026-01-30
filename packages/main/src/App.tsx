import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import Chat from './pages/Chat';
import Home from './pages/Home';
import Status from './pages/Status';
import './App.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  );
};

const ThemeToggle = () => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  return (
    <ActionIcon
      onClick={toggleColorScheme}
      variant="subtle"
      size="lg"
      aria-label="Toggle color scheme"
    >
      {colorScheme === 'dark' ? '☀️' : '🌙'}
    </ActionIcon>
  );
};

const App = () => (
  <BrowserRouter>
    <div className="app-container">
      <nav className="nav-bar">
        <Link to="/" className="nav-link">
          Home
        </Link>
        <SignedIn>
          <Link to="/status" className="nav-link">
            Status
          </Link>
          <Link to="/chat" className="nav-link">
            Chat
          </Link>
        </SignedIn>
        <div className="user-button-wrapper">
          <ThemeToggle />
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link to="/login" className="nav-link">
              Login
            </Link>
          </SignedOut>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login/*"
          element={
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
              <SignIn
                routing="path"
                path="/login"
                signUpUrl="/login"
                afterSignInUrl="/status"
                afterSignUpUrl="/status"
              />
            </div>
          }
        />
        <Route
          path="/status"
          element={
            <ProtectedRoute>
              <Status />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  </BrowserRouter>
);

export default App;
