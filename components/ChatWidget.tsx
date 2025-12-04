import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MessageCircle, X, MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { Message, Sender, ConnectionState } from '../types';
import { sendMessageStream, initializeChat } from '../services/geminiService';
import VoiceMode from './VoiceMode';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from '../services/audioUtils';
import { LIVE_MODEL, SYSTEM_INSTRUCTION_VOICE } from '../constants';

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: '¡Hola! Soy tu asistente de Illescas. Pregúntame sobre qué ver, dónde comer o la historia de la ciudad.',
      sender: Sender.Bot,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  
  // Live API State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Refs for Live API to avoid closure staleness
  const sessionRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // --- Text Chat Logic ---

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: Sender.User,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const botMessageId = (Date.now() + 1).toString();
    // Placeholder for streaming response
    setMessages(prev => [...prev, {
      id: botMessageId,
      text: '',
      sender: Sender.Bot,
      timestamp: new Date(),
      isStreaming: true
    }]);

    try {
      let fullText = '';
      let groundingUrls: Array<{uri: string, title: string}> = [];

      const stream = sendMessageStream(userMessage.text);
      
      for await (const chunk of stream) {
        const textChunk = chunk.text || '';
        fullText += textChunk;
        
        // Extract grounding metadata if available
        const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
           chunks.forEach((c: any) => {
             if (c.web?.uri && c.web?.title) {
               groundingUrls.push({ uri: c.web.uri, title: c.web.title });
             }
           });
        }

        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, text: fullText, groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined } 
            : msg
        ));
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, text: "Lo siento, tuve un problema al procesar tu pregunta. Por favor intenta de nuevo." } 
          : msg
      ));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId ? { ...msg, isStreaming: false } : msg
      ));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Live API Logic ---

  const startVoiceMode = async () => {
    setIsVoiceMode(true);
    setConnectionState(ConnectionState.Connecting);

    try {
      if (!process.env.API_KEY) throw new Error("No API Key");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Setup Audio Contexts
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION_VOICE,
        },
        callbacks: {
            onopen: () => {
                setConnectionState(ConnectionState.Connected);
                processAudioInput(stream, sessionPromise);
            },
            onmessage: async (message: LiveServerMessage) => {
                handleServerMessage(message);
            },
            onclose: () => {
                console.log("Session closed");
                setConnectionState(ConnectionState.Disconnected);
            },
            onerror: (err) => {
                console.error("Session error", err);
                setConnectionState(ConnectionState.Error);
            }
        }
      });
      sessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to start voice mode:", error);
      setConnectionState(ConnectionState.Error);
    }
  };

  const processAudioInput = (stream: MediaStream, sessionPromise: Promise<any>) => {
    if (!inputContextRef.current) return;
    
    const source = inputContextRef.current.createMediaStreamSource(stream);
    const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (isMicMuted) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Simple volume calculation for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      setVolumeLevel(Math.min(rms * 5, 1)); // Amplify for visual

      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
      }).catch(err => console.error(err));
    };

    source.connect(processor);
    processor.connect(inputContextRef.current.destination);
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
      const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      
      if (audioData && audioContextRef.current) {
          // Play audio
          try {
              const audioBytes = base64ToUint8Array(audioData);
              const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
              
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              
              const outputNode = audioContextRef.current.destination;
              source.connect(outputNode);

              // Schedule
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);

              // Fake volume modulation for bot speaking (randomized for effect as we don't analyze output stream easily here)
              setVolumeLevel(0.4 + Math.random() * 0.4);
              setTimeout(() => setVolumeLevel(0), audioBuffer.duration * 1000);

          } catch (e) {
              console.error("Audio decode error", e);
          }
      }
      
      const interrupted = message.serverContent?.interrupted;
      if (interrupted) {
          sourcesRef.current.forEach(s => s.stop());
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
      }
  };

  const stopVoiceMode = () => {
    // Cleanup
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    // Note: Live API session.close() isn't strictly exposed in the promise result directly in all SDK versions, 
    // but disconnecting the stream and context effectively stops it. 
    // Ideally we would call session.close() if available on the resolved object.
    
    setIsVoiceMode(false);
    setConnectionState(ConnectionState.Disconnected);
    setVolumeLevel(0);
  };

  // --- Render ---

  // Use a very high z-index to ensure it floats above any host website content
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 font-sans text-slate-800">
      
      {/* Chat Container */}
      {isOpen && (
        <div className={`relative w-[90vw] md:w-[400px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 border border-slate-100`}>
          
          {/* Header */}
          <div className="bg-indigo-600 p-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                 <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Illescas Chat</h2>
                <p className="text-xs text-indigo-100 opacity-90">Asistente oficial inteligente</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Voice Mode Overlay */}
          <VoiceMode 
            isOpen={isVoiceMode}
            onClose={stopVoiceMode}
            connectionState={connectionState}
            isMicMuted={isMicMuted}
            onToggleMic={() => setIsMicMuted(!isMicMuted)}
            volumeLevel={volumeLevel}
          />

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scrollbar-hide">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                    msg.sender === Sender.User
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  
                  {/* Citations/Grounding */}
                  {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100/20">
                      <p className="text-xs opacity-70 mb-1">Fuentes:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingUrls.map((url, i) => (
                          <a 
                            key={i} 
                            href={url.uri} 
                            target="_blank" 
                            rel="noreferrer"
                            className={`text-xs flex items-center gap-1 hover:underline ${msg.sender === Sender.User ? 'text-indigo-200' : 'text-indigo-600'}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {url.title || 'Enlace'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-400">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
             <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Pregunta sobre Illescas..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 text-slate-700 placeholder:text-slate-400"
                  disabled={isLoading || isVoiceMode}
                />
                
                {inputValue.trim() ? (
                  <button 
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={startVoiceMode}
                    className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-indigo-700 rounded-full transition-colors"
                    title="Hablar con Illescas"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
             </div>
             <p className="text-[10px] text-center text-slate-400 mt-2">
               Información generada por IA sobre Illescas. Verifica los datos importantes.
             </p>
          </div>
        </div>
      )}

      {/* Floating Action Button (Launcher) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 ${
          isOpen ? 'bg-slate-700 rotate-90' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-7 h-7 text-white" />
        )}
      </button>

    </div>
  );
};

export default ChatWidget;