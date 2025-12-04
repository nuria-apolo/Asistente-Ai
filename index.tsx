import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ChatWidget from './components/ChatWidget';

// 1. Standalone Integration Mode
// Allows the widget to be mounted into any specific div via global function from an external script
window.mountIllescasWidget = (elementId: string) => {
  const el = document.getElementById(elementId);
  if (el) {
    const root = ReactDOM.createRoot(el);
    root.render(
      <React.StrictMode>
        <ChatWidget />
      </React.StrictMode>
    );
  } else {
    console.warn("Illescas Widget: Container element not found:", elementId);
  }
};

// 2. Demo/Full App Mode
// Checks for the standard 'root' element used in the development environment
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// 3. Auto-Embed Mode
// Automatically finds a container with a specific ID (useful for simple copy-paste embeds)
const embedContainer = document.getElementById('illescas-chat-embed');
if (embedContainer) {
   const root = ReactDOM.createRoot(embedContainer);
   root.render(
      <React.StrictMode>
        <ChatWidget />
      </React.StrictMode>
   );
}