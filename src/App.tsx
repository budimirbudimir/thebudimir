import React from 'react';

import './App.css';

const App = () => (
  <div className="App">
    <h1>Budimir Budimir</h1>
    <p>Crafting software since 2001</p>
    <p className="Principles">
      <span className="Transparency">Transparency.</span> <span className="Empathy">Empathy.</span> <span className="Purpose">Purpose.</span>
    </p>
    <p>If you have those, send me the message, I promise I will give my best to read it and reply.</p>

    <div className="Social">
      <a target="_blank" href="https://www.linkedin.com/in/budimirbudimir" title="LinkedIn">
        <img className="Icon" height="32" width="32" src="https://unpkg.com/simple-icons@v6/icons/linkedin.svg" />
      </a>
      <a target="_blank" href="https://github.com/budimirbudimir" title="GitHub">
        <img className="Icon" height="32" width="32" src="https://unpkg.com/simple-icons@v6/icons/github.svg" />
      </a>
      <a target="_blank" href="mailto:budimirbudimir@msn.com" title="Email">
        <img className="Icon" height="32" width="32" src="https://unpkg.com/simple-icons@v6/icons/microsoftoutlook.svg" />
      </a>
    </div>
  </div>
);

export default App;
