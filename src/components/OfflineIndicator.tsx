import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/90 text-slate-950 px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md border border-amber-300/40 animate-fade-in">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950"></span>
      </span>
      <WifiOff className="w-4 h-4 text-slate-950 shrink-0" />
      <span>Оффлайн режим — все матчи, турниры и сохранения работают локально</span>
    </div>
  );
};
