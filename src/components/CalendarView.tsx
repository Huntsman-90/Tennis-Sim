import React, { useMemo, useState } from 'react';
import { Calendar as CalIcon, Trophy, Clock, Search, Filter } from 'lucide-react';
import { Player, Tournament, TournamentCategory } from '../types';

interface CalendarViewProps {
  tournaments: Tournament[];
  currentTournamentIndex: number;
  currentActiveWeek?: number;
  players: Player[];
  onSelectTournament: (index: number) => void;
}

type TourFilter = 'all' | 'atp' | 'wta' | 'itf_men' | 'itf_women';

const isItfMenCategory = (cat: TournamentCategory) => cat === 'M15' || cat === 'M25';
const isItfWomenCategory = (cat: TournamentCategory) =>
  cat === 'W15' || cat === 'W35' || cat === 'W50' || cat === 'W75' || cat === 'W100';

export const CalendarView: React.FC<CalendarViewProps> = ({
  tournaments,
  currentTournamentIndex,
  players,
  onSelectTournament,
}) => {
  const [filter, setFilter] = useState<TourFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<string>('all');

  const getPlayer = (id?: string) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  const getCategoryBadgeClass = (tourn: Tournament) => {
    const cat = tourn.category;
    if (cat === 'Grand Slam') {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
    }
    // All WTA tournaments (WTA 1000, WTA 500, WTA 250, WTA Finals, W15-W100) in soft pastel pink
    if (tourn.tour === 'WTA' || isItfWomenCategory(cat) || cat.startsWith('WTA')) {
      if (cat === 'WTA 1000' || cat === 'WTA Finals') {
        return 'bg-rose-500/25 text-rose-200 border border-rose-400/50 shadow-sm shadow-rose-500/10';
      }
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
    }
    if (cat === 'Masters 1000') {
      return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40';
    }
    if (cat === 'ATP 500') {
      return 'bg-sky-500/20 text-sky-300 border border-sky-500/40';
    }
    if (cat === 'ATP 250') {
      return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
    }
    if (cat === 'ATP Finals') {
      return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
    }
    if (isItfMenCategory(cat)) {
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    }
    return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
  };

  const filteredTournamentsWithOriginalIndex = useMemo(() => {
    return tournaments
      .map((t, idx) => ({ tournament: t, originalIndex: idx }))
      .filter(({ tournament: t }) => {
        // Tour filter
        if (filter === 'atp') {
          if (t.tour !== 'ATP' || isItfMenCategory(t.category)) return false;
        } else if (filter === 'wta') {
          if (t.tour !== 'WTA' || isItfWomenCategory(t.category)) return false;
        } else if (filter === 'itf_men') {
          if (!isItfMenCategory(t.category)) return false;
        } else if (filter === 'itf_women') {
          if (!isItfWomenCategory(t.category)) return false;
        }

        // Surface filter
        if (surfaceFilter !== 'all' && t.surface !== surfaceFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = t.name.toLowerCase().includes(q) || t.nameRu.toLowerCase().includes(q);
          const matchesCity = t.city.toLowerCase().includes(q) || t.country.toLowerCase().includes(q);
          const matchesCategory = t.category.toLowerCase().includes(q);
          if (!matchesName && !matchesCity && !matchesCategory) return false;
        }

        return true;
      });
  }, [tournaments, filter, surfaceFilter, searchQuery]);

  const stats = useMemo(() => {
    let atpCount = 0;
    let wtaCount = 0;
    let itfMenCount = 0;
    let itfWomenCount = 0;

    tournaments.forEach((t) => {
      if (isItfMenCategory(t.category)) {
        itfMenCount++;
      } else if (isItfWomenCategory(t.category)) {
        itfWomenCount++;
      } else if (t.tour === 'ATP') {
        atpCount++;
      } else {
        wtaCount++;
      }
    });

    return { total: tournaments.length, atpCount, wtaCount, itfMenCount, itfWomenCount };
  }, [tournaments]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Calendar Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <CalIcon className="w-6 h-6 text-emerald-400" />
              <span>Календарь теннисного сезона</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Единое расписание туров: Grand Slam, ATP & WTA, а также серии ITF Men (M15, M25) и ITF Women (W15–W100)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800/80 px-3.5 py-2 rounded-2xl border border-slate-700/60 self-start md:self-auto">
            <span>Всего: <strong className="text-white font-mono">{stats.total}</strong> турниров</span>
            <span className="text-slate-600">•</span>
            <span>Текущая неделя: <strong className="text-emerald-400 font-mono">{tournaments[currentTournamentIndex]?.week || 1}</strong></span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Main Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Все ({stats.total})
            </button>
            <button
              onClick={() => setFilter('atp')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === 'atp'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 font-black'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              ATP Tour ({stats.atpCount})
            </button>
            <button
              onClick={() => setFilter('wta')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === 'wta'
                  ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20 font-black'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              WTA Tour ({stats.wtaCount})
            </button>
            <button
              onClick={() => setFilter('itf_men')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === 'itf_men'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-black'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              ITF Мужчины ({stats.itfMenCount})
            </button>
            <button
              onClick={() => setFilter('itf_women')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === 'itf_women'
                  ? 'bg-fuchsia-500 text-slate-950 shadow-md shadow-fuchsia-500/20 font-black'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              ITF Женщины ({stats.itfWomenCount})
            </button>
          </div>

          {/* Search & Surface Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск по турниру, городу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="relative">
              <select
                value={surfaceFilter}
                onChange={(e) => setSurfaceFilter(e.target.value)}
                className="bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">Все покрытия</option>
                <option value="Hard">Хард</option>
                <option value="Clay">Грунт</option>
                <option value="Grass">Трава</option>
                <option value="Indoor Hard">Хард (зал)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Season Tournaments */}
      {filteredTournamentsWithOriginalIndex.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">Турниры по заданным фильтрам не найдены</p>
          <p className="text-xs text-slate-500 mt-1">Попробуйте изменить поисковый запрос или фильтр категории</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTournamentsWithOriginalIndex.map(({ tournament: tourn, originalIndex: idx }) => {
            const isCurrent = idx === currentTournamentIndex;
            const isCompleted = tourn.isCompleted;
            const champ = getPlayer(tourn.championId);

            return (
              <div
                key={tourn.id}
                onClick={() => onSelectTournament(idx)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-lg flex flex-col justify-between relative overflow-hidden group ${
                  isCurrent
                    ? 'bg-slate-900 border-emerald-500 shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                    : isCompleted
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${getCategoryBadgeClass(tourn)}`}>
                      {tourn.tour} • {tourn.category}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400">
                      Неделя {tourn.week}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="text-2xl">{tourn.flag}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight truncate group-hover:text-emerald-300 transition-colors">
                        {tourn.nameRu}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {tourn.city}, {tourn.country} • {tourn.surface}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400 font-medium">
                    <span>Сетка: <strong className="text-slate-200 tabular-nums">{tourn.drawSize}</strong></span>
                    <span>•</span>
                    <span>Призовые: <strong className="text-slate-200 tabular-nums">${tourn.prizeMoneyPool.toLocaleString('en-US')}</strong></span>
                  </div>
                </div>

                {/* Card Bottom status */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {isCompleted && champ ? (
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold truncate max-w-[70%]">
                      <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Чемпион: {champ.nameRu}</span>
                    </div>
                  ) : isCurrent ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Текущий турнир</span>
                    </div>
                  ) : tourn.isDrawn && tourn.matches && tourn.matches.length > 0 ? (
                    <span className="text-emerald-400/80 font-medium">Сетка сформирована</span>
                  ) : (
                    <span className="text-slate-500 font-medium">Ожидает жеребьевки</span>
                  )}

                  <span className="font-mono text-emerald-400 font-bold tabular-nums">
                    +{tourn.pointsWinner} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
