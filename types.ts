export enum Sender {
  User = 'user',
  Bot = 'bot',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  isStreaming?: boolean;
  groundingUrls?: Array<{uri: string, title: string}>;
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

export interface AudioVisualizerProps {
  isActive: boolean;
}

// Extend global window for the widget loader
declare global {
  interface Window {
    mountIllescasWidget: (elementId: string) => void;
  }
}