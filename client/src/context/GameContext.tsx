import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type GameCtx = {
  pin: string;
  setPin: (v: string) => void;
  nick: string;
  setNick: (v: string) => void;
  playerId: number | null;
  setPlayerId: (v: number | null) => void;
  theme: 'dark' | 'light';
  setTheme: (v: 'dark' | 'light') => void;
};

const GameContext = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [pin, setPin] = useState('');
  const [nick, setNick] = useState('');
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('fh_theme') as 'dark' | 'light') || 'dark');

  return (
    <GameContext.Provider value={{ pin, setPin, nick, setNick, playerId, setPlayerId, theme, setTheme }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}