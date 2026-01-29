import '../App.css';

export default function Home() {
  return (
    <div className="App">
      <p className="Title">Budimir Budimir</p>

      <p className="Quote">My four core principles:</p>
      <ul className="List">
        <li>Strong opinions, loosely held</li>
        <li>First do it, then do it right, then do it better</li>
        <li>Do not ship broken windows</li>
        <li>Never stop learning</li>
      </ul>

      <div className="Icons">
        <a
          target="_blank"
          href="https://www.linkedin.com/in/budimirbudimir/"
          title="LinkedIn"
          rel="noopener"
        >
          <img
            className="Icon"
            height="32"
            width="32"
            src="https://unpkg.com/simple-icons@v6/icons/linkedin.svg"
            alt="LinkedIn"
          />
        </a>
        <a target="_blank" href="https://github.com/budimirbudimir" title="GitHub" rel="noopener">
          <img
            className="Icon"
            height="32"
            width="32"
            src="https://unpkg.com/simple-icons@v6/icons/github.svg"
            alt="GitHub"
          />
        </a>
        <a target="_blank" href="mailto:budimirbudimir@msn.com" title="Email" rel="noopener">
          <img
            className="Icon"
            height="32"
            width="32"
            src="https://unpkg.com/simple-icons@v6/icons/microsoftoutlook.svg"
            alt="Email"
          />
        </a>
      </div>
    </div>
  );
}
