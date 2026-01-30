import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Status from './pages/Status';
import './App.css';

const App = () => (
  <BrowserRouter>
    <div className="app-container">
      <nav className="nav-bar">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/status" className="nav-link">Status</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/status" element={<Status />} />
      </Routes>
    </div>
  </BrowserRouter>
);

export default App;
