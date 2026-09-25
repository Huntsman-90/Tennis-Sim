import React from 'react';
import { Calendar as CalIcon, CheckCircle2, Trophy, Clock } from 'lucide-react';
import { Player, Tournament } from '../types';

interface CalendarViewProps {
  tournaments: Tournament[];
  currentTournamentIndex: number;
  players: Player[];
  onSelectTournament: (index: number) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tournaments,
  currentTournamentIndex,
  players,
  onSelectTournament,
}) => {
  const getPlayer = (id?: string) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Calendar Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <CalIcon className="w-6 h-6 text-emerald-400" />
            <span>Календарь теннисного сезона</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Хронологический список всех турниров Большого Шлема, Мастерсов 1000, 500 и Итоговых турниров
          </p>
        </div>
      </div>

      {/* Grid of Season Tournaments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((tourn, idx) => {
          const isCurrent = idx === currentTournamentIndex;
          const isCompleted = tourn.isCompleted;
          const champ = getPlayer(tourn.championId);

          return (
            <div
              key={tourn.id}
              onClick={() => onSelectTournament(idx)}
              className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-lg flex flex-col justify-between relative overflow-hidden ${
                isCurrent
                  ? 'bg-slate-900 border-emerald-500 shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                  : isCompleted
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Card Top */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                    tourn.tour === 'ATP'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {tourn.tour} • {tourn.category}
                  </span>

                  <span className="text-[11px] font-mono text-slate-400">
                    Неделя {tourn.week}
                  </span>
                </div>

                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-2xl">{tourn.flag}</span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                      {tourn.nameRu}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tourn.city}, {tourn.country} • {tourn.surface}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Bottom status */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {isCompleted && champ ? (
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Чемпион: {champ.nameRu}</span>
                  </div>
                ) : isCurrent ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Текущий турнир</span>
                  </div>
                ) : (
                  <span className="text-slate-500 font-medium">Предстоящий</span>
                )}

                <span className="font-mono text-slate-400 font-semibold">
                  +{(tourn.pointsWinner)} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
