import React, { useEffect } from 'react';
import { AlertTriangle, FastForward, Trophy, X, Zap } from 'lucide-react';
import { Match } from '../types';

export type SimulationType = 'match' | 'round' | 'tournament';

export interface ConfirmSimulationModalProps {
  isOpen: boolean;
  type: SimulationType;
  title: string;
  description: string;
  details?: {
    match?: Match;
    roundName?: string;
    tournamentName?: string;
    unplayedCount?: number;
    surface?: string;
    tour?: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSimulationModal({
  isOpen,
  type,
  title,
  description,
  details,
  onConfirm,
  onCancel,
}: ConfirmSimulationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const getRoundLabel = (r?: string) => {
    if (!r) return '';
    if (r === 'R64') return '1/32 финала (R64)';
    if (r === 'R32') return '1/16 финала (R32)';
    if (r === 'R16') return '1/8 финала (R16)';
    if (r === 'QF') return '1/4 финала (Четвертьфинал)';
    if (r === 'SF') return '1/2 финала (Полуфинал)';
    if (r === 'F') return 'Финал 🏆';
    return r;
  };

  const getActionName = () => {
    if (type === 'tournament') return 'Симулировать турнир';
    if (type === 'round') return 'Симулировать раунд';
    return 'Симулировать матч';
  };

  return (
    <div
      id="simulation-confirm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        id="simulation-confirm-dialog"
        className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 overflow-hidden space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              {type === 'tournament' ? (
                <Trophy className="w-5 h-5 text-amber-400" />
              ) : type === 'round' ? (
                <FastForward className="w-5 h-5 text-amber-400" />
              ) : (
                <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Защита от случайного нажатия
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                {title}
              </h3>
            </div>
          </div>

          <button
            id="simulation-confirm-close-btn"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Отказаться (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Warning */}
        <div className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            {description}
          </p>

          {/* Details Card */}
          {type === 'match' && details?.match && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                <span>Стадия: <strong className="text-slate-200">{getRoundLabel(details.match.roundName)}</strong></span>
                {details.surface && (
                  <span>Покрытие: <strong className="text-slate-200">{details.surface}</strong></span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  {details.match.p1Seed && (
                    <span className="text-[10px] font-black text-amber-300 bg-amber-400/20 px-1 py-0.2 rounded border border-amber-400/30 shrink-0">
                      [{details.match.p1Seed}]
                    </span>
                  )}
                  <span>{details.match.player1.flag}</span>
                  <span className="text-white truncate">{details.match.player1.name}</span>
                  <span className="text-slate-500 text-[10px]">#{details.match.player1.rank}</span>
                </div>

                <div className="flex items-center gap-1.5 truncate justify-end">
                  {details.match.p2Seed && (
                    <span className="text-[10px] font-black text-amber-300 bg-amber-400/20 px-1 py-0.2 rounded border border-amber-400/30 shrink-0">
                      [{details.match.p2Seed}]
                    </span>
                  )}
                  <span>{details.match.player2.flag}</span>
                  <span className="text-white truncate">{details.match.player2.name}</span>
                  <span className="text-slate-500 text-[10px]">#{details.match.player2.rank}</span>
                </div>
              </div>
            </div>
          )}

          {type === 'round' && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Раунд для симуляции:</span>
                <strong className="text-amber-400 font-bold">{getRoundLabel(details?.roundName)}</strong>
              </div>
              {details?.unplayedCount !== undefined && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Осталось матчей к расчету:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">
                    {details.unplayedCount} {details.unplayedCount === 1 ? 'матч' : 'матчей'}
                  </span>
                </div>
              )}
            </div>
          )}

          {type === 'tournament' && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Турнир:</span>
                <strong className="text-amber-400 font-bold">{details?.tournamentName}</strong>
              </div>
              {details?.tour && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Тур:</span>
                  <span className="font-semibold text-slate-200">{details.tour}</span>
                </div>
              )}
              {details?.unplayedCount !== undefined && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Оставшихся матчей в турнире:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">
                    {details.unplayedCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Auto-save notification note */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <span className="shrink-0 font-bold">💾</span>
            <span>
              Результаты и турнирная сетка будут <strong>автоматически сохранены</strong> сразу после завершения симуляции.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            id="simulation-confirm-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            Отказаться
          </button>

          <button
            id="simulation-confirm-submit-btn"
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>Да, {getActionName().toLowerCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
