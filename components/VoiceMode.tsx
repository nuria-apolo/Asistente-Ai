import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff } from 'lucide-react';
import { ConnectionState } from '../types';

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: ConnectionState;
  isMicMuted: boolean;
  onToggleMic: () => void;
  volumeLevel: number; // 0 to 1
}

const VoiceMode: React.FC<VoiceModeProps> = ({ 
  isOpen, 
  onClose, 
  connectionState, 
  isMicMuted, 
  onToggleMic,
  volumeLevel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center text-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="absolute top-6 left-6 z-10">
         <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.Connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
            <span className="text-xs font-medium uppercase tracking-wider opacity-70">
              {connectionState === ConnectionState.Connected ? 'En vivo' : 'Conectando...'}
            </span>
         </div>
      </div>

      {/* Main Visualizer */}
      <div className="relative flex items-center justify-center w-full h-64">
        {/* Outer Rings */}
        <div className={`absolute w-32 h-32 rounded-full border-2 border-blue-400/30 ${connectionState === ConnectionState.Connected && !isMicMuted ? 'animate-pulse-ring' : ''}`}></div>
        <div className={`absolute w-48 h-48 rounded-full border border-indigo-400/20 ${connectionState === ConnectionState.Connected && !isMicMuted ? 'animate-pulse-ring' : ''}`} style={{ animationDelay: '0.5s' }}></div>
        
        {/* Core Visualizer */}
        <div className="flex items-center justify-center gap-1 h-16">
           {[...Array(5)].map((_, i) => {
             // Simple logic to create wave effect based on volume
             const height = Math.max(10, volumeLevel * 100 * (Math.random() + 0.5)); 
             const isAnimating = connectionState === ConnectionState.Connected && volumeLevel > 0.01;
             
             return (
               <div 
                  key={i}
                  className={`w-3 bg-gradient-to-t from-blue-400 to-indigo-300 rounded-full transition-all duration-75 ease-out`}
                  style={{ 
                    height: isAnimating ? `${height}px` : '4px',
                    opacity: isAnimating ? 1 : 0.3
                  }}
               ></div>
             );
           })}
        </div>
      </div>

      {/* Status Text */}
      <div className="mt-8 text-center px-8">
        <h3 className="text-xl font-semibold mb-2">Habla con Illescas</h3>
        <p className="text-sm text-blue-200/80">
          {connectionState === ConnectionState.Connecting 
            ? "Estableciendo conexión segura..." 
            : isMicMuted 
              ? "Micrófono silenciado" 
              : "Te escucho. Pregunta sobre el Greco, eventos o lugares."}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 flex items-center gap-4">
        <button
          onClick={onToggleMic}
          className={`p-4 rounded-full transition-all duration-300 shadow-lg ${
            isMicMuted 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-white text-indigo-900 hover:scale-105'
          }`}
        >
          {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default VoiceMode;