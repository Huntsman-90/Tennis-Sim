import { useState, useMemo } from 'react';
import { Calendar, CheckCircle2, ChevronRight, Search, Trophy, Filter } from 'lucide-react';
import { Season, TourType, TournamentCategory } from '../types';

interface CalendarViewProps {
  season: Season;
  onSelectTournament: (index: number) => void;
  onSetCurrentTournament?: (index: number) => void;
}

type CategoryFilter = 'ALL' | 'SLAM' | '1000' | '500' | '250' | 'FINALS';

export function CalendarView({ season, onSelectTournament, onSetCurrentTournament }: CalendarViewProps) {
  const [tourFilter, setTourFilter] = useState<'ALL' | TourType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const activeSeasonWeek = useMemo(() => {
    const curActive = season.tournaments[season.currentTournamentIndex];
    if (curActive && !curActive.completed) {
      return curActive.week;
    }
    const firstUncompleted = season.tournaments.find(t => !t.completed);
    return firstUncompleted ? firstUncompleted.week : (curActive?.week ?? 1);
  }, [season]);

  // Check if any tournament in the active week is currently in progress (has completed matches, but is not finished)
  const activeWeekTournamentInProgress = useMemo(() => {
    return season.tournaments.find(
      t => t.week === activeSeasonWeek && !t.completed && (
        t.matches.some(m => m.isCompleted) || (t.qualifyingMatches?.some(m => m.isCompleted) ?? false)
      )
    );
  }, [season, activeSeasonWeek]);

  const filteredTournaments = useMemo(() => {
    return season.tournaments
      .map((trn, idx) => ({ trn, originalIndex: idx }))
      .filter(({ trn }) => {
        // Tour filter
        if (tourFilter !== 'ALL' && trn.tour !== tourFilter) return false;

        // Category filter
        if (categoryFilter !== 'ALL') {
          if (categoryFilter === 'SLAM' && trn.category !== 'Grand Slam') return false;
          if (categoryFilter === '1000' && !trn.category.includes('1000')) return false;
          if (categoryFilter === '500' && !trn.category.includes('500')) return false;
          if (categoryFilter === '250' && !trn.category.includes('250')) return false;
          if (categoryFilter === 'FINALS' && !trn.category.includes('Finals')) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = trn.nameRu.toLowerCase().includes(q) || trn.name.toLowerCase().includes(q);
          const matchCity = trn.city.toLowerCase().includes(q) || trn.country.toLowerCase().includes(q);
          if (!matchName && !matchCity) return false;
        }

        return true;
      });
  }, [season.tournaments, tourFilter, categoryFilter, searchQuery]);

  // Count stats
  const atpCount = season.tournaments.filter(t => t.tour === 'ATP').length;
  const wtaCount = season.tournaments.filter(t => t.tour === 'WTA').length;
  const count250 = season.tournaments.filter(t => t.category.includes('250')).length;
  const count500 = season.tournaments.filter(t => t.category.includes('500')).length;
  const count1000 = season.tournaments.filter(t => t.category.includes('1000')).length;

  return (
    <div id="calendar-view-container" className="space-y-4">
      
      {/* Header */}
      <div className="flex flex-col gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-400" />
              <span>Официальный Календарь Сезона {season.year}: ATP & WTA Туры</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Полное расписание сезона: Grand Slam 🏆 ({season.tournaments.filter(t => t.category === 'Grand Slam').length}), 
              1000 ({count1000}), 500 ({count500}), 250 ({count250}) и Итоговые чемпионаты ({season.tournaments.filter(t => t.category.includes('Finals')).length})
            </p>
          </div>

          {/* Tour Selection */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                id="tour-filter-all"
                onClick={() => setTourFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  tourFilter === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Все туры ({season.tournaments.length})
              </button>
              <button
                id="tour-filter-atp"
                onClick={() => setTourFilter('ATP')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tourFilter === 'ATP'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🎾</span>
                <span>ATP ({atpCount})</span>
              </button>
              <button
                id="tour-filter-wta"
                onClick={() => setTourFilter('WTA')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tourFilter === 'WTA'
                    ? 'bg-rose-500 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🌸</span>
                <span>WTA ({wtaCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Category Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-thin">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Уровень:</span>
            </span>

            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setCategoryFilter('SLAM')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1 ${
                categoryFilter === 'SLAM'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
              }`}
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>Grand Slam</span>
            </button>
            <button
              onClick={() => setCategoryFilter('1000')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                categoryFilter === '1000'
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
              }`}
            >
              1000 ({count1000})
            </button>
            <button
              onClick={() => setCategoryFilter('500')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                categoryFilter === '500'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
              }`}
            >
              500 ({count500})
            </button>
            <button
              onClick={() => setCategoryFilter('250')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                categoryFilter === '250'
                  ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
              }`}
            >
              250 ({count250})
            </button>
            <button
              onClick={() => setCategoryFilter('FINALS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                categoryFilter === 'FINALS'
                  ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
              }`}
            >
              Finals (2)
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по турниру или городу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid of tournaments */}
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 text-sm">Турниры по заданным фильтрам не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTournaments.map(({ trn, originalIndex }) => {
            const isCurrent = originalIndex === season.currentTournamentIndex;
            const isPast = trn.completed;
            const isAtp = trn.tour === 'ATP';
            const isCurrentWeek = trn.week === activeSeasonWeek;
            const isPlayableThisWeek = isCurrentWeek && !isPast;
            const isLockedInWeek = Boolean(
              isPlayableThisWeek &&
              activeWeekTournamentInProgress &&
              activeWeekTournamentInProgress.id !== trn.id
            );
            const isJoint = season.tournaments.some(
              other => other.week === trn.week && other.tour !== trn.tour && (
                trn.category === 'Grand Slam' ||
                trn.city.toLowerCase() === other.city.toLowerCase() ||
                trn.name.split(' ')[0] === other.name.split(' ')[0]
              )
            );

            return (
              <div
                key={trn.id}
                id={`calendar-tournament-card-${originalIndex}`}
                onClick={() => {
                  if (isPlayableThisWeek && !isLockedInWeek && onSetCurrentTournament) {
                    onSetCurrentTournament(originalIndex);
                  } else {
                    onSelectTournament(originalIndex);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : isPlayableThisWeek && !isLockedInWeek
                    ? 'bg-slate-900/90 border-slate-700 hover:border-sky-500/60 shadow-sm ring-1 ring-sky-500/20'
                    : isLockedInWeek
                    ? 'bg-slate-950/50 border-slate-900/80 opacity-70 hover:opacity-90'
                    : isPast
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-900 hover:border-slate-800 opacity-90'
                }`}
              >
                <div>
                  {/* Header tags */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isAtp
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {trn.tour}
                      </span>
                      <span className="text-sm">{trn.flag}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        trn.category === 'Grand Slam'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : trn.category.includes('1000')
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : trn.category.includes('500')
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : trn.category.includes('250')
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      }`}>
                        {trn.category}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {trn.surface}
                      </span>
                      {isJoint && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium" title="Общий турнир: раздельные сетки ATP и WTA">
                          🤝 Общий (ATP/WTA)
                        </span>
                      )}
                    </div>

                    {isCurrent && !isPast && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 animate-pulse">
                        Идёт сейчас
                      </span>
                    )}
                    {isLockedInWeek && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                        🔒 Заблокирован
                      </span>
                    )}
                    {isPlayableThisWeek && !isCurrent && !isLockedInWeek && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                        🎾 Доступен сейчас
                      </span>
                    )}
                    {isPast && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Завершён
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-white hover:underline mt-1">
                    {trn.nameRu}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {trn.city}, {trn.country}
                  </p>
                  <div className="text-xs text-slate-500 font-mono mt-2 flex items-center justify-between flex-wrap gap-1">
                    <span>📅 Неделя {trn.week} · {trn.dates} ({trn.month})</span>
                    {season.tournaments.filter(t => t.week === trn.week).length > 1 && (
                      <span className="text-[10px] text-indigo-300 font-sans px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        {isCurrentWeek ? 'Турнир текущей недели' : `Турнир недели #${trn.week}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-400">
                    Победителю: <strong className="text-amber-400 font-mono">+{trn.pointsWinner} очков</strong>
                  </span>

                  {isLockedInWeek ? (
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      🔒 Ждёт {activeWeekTournamentInProgress?.city}
                    </span>
                  ) : isPlayableThisWeek && !isCurrent ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSetCurrentTournament) onSetCurrentTournament(originalIndex);
                        else onSelectTournament(originalIndex);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>▶ Играть</span>
                    </button>
                  ) : (
                    <button
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      title="Открыть турнир"
                    >
                      <ChevronRight className="w-4 h-4 text-emerald-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
