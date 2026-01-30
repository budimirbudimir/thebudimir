import { SignIn, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
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

const App = () => (
  <BrowserRouter>
    <div className="app-container">
      <nav className="nav-bar">
        <Link to="/" className="nav-link">Home</Link>
        <SignedIn>
          <Link to="/status" className="nav-link">Status</Link>
        </SignedIn>
        <div className="user-button-wrapper">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link to="/login" className="nav-link">Login</Link>
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
      </Routes>
    </div>
  </BrowserRouter>
);

export default App;
