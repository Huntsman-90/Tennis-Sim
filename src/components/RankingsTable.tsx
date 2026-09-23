import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Search, Trophy } from 'lucide-react';
import { Player, TourType } from '../types';

interface RankingsTableProps {
  players: Player[];
  onSelectPlayer: (playerId: string) => void;
  initialTour?: TourType;
}

export function RankingsTable({ players, onSelectPlayer, initialTour = 'ATP' }: RankingsTableProps) {
  const [selectedTour, setSelectedTour] = useState<TourType>(initialTour);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTier, setFilterTier] = useState<'all' | 'top10' | 'top50' | 'top100' | 'recent'>('all');

  const tourPlayers = players.filter(p => p.tour === selectedTour);

  const filtered = tourPlayers.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.country.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    if (filterTier === 'recent') return (p.recentPointsGained && p.recentPointsGained > 0) || Boolean(p.lastTournamentResult);
    if (filterTier === 'top10') return p.rank <= 10;
    if (filterTier === 'top50') return p.rank <= 50;
    if (filterTier === 'top100') return p.rank <= 100;
    return true;
  });

  const isAtp = selectedTour === 'ATP';

  return (
    <div id="rankings-view-container" className="space-y-4">
      
      {/* Tour Selector & Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
        
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>{isAtp ? 'Официальный Рейтинг ATP (PIF ATP Rankings)' : 'Официальный Рейтинг WTA (PIF WTA Rankings)'}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Динамический рейтинг: очки начисляются по итогам каждого завершённого турнира и определяют посев в сетках сезона.
          </p>
        </div>

        {/* Tour Switcher Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedTour('ATP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isAtp
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🎾</span>
              <span>ATP Тур (Мужчины)</span>
            </button>
            <button
              onClick={() => setSelectedTour('WTA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                !isAtp
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌸</span>
              <span>WTA Тур (Женщины)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Dynamic Ranking System Informative Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex items-center gap-3 text-xs text-slate-300">
        <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
          📈
        </span>
        <div className="leading-relaxed">
          <span className="text-white font-semibold">Система динамических очков: </span>
          Большой Шлем — до 2000 оч., Masters 1000 — до 1000 оч., 500 — до 500 оч., 250 — до 250 оч.
          Повышение в рейтинге позволяет игрокам получать статус сеяных [1]–[16] и избегать сильных соперников до поздних стадий турниров.
        </div>
      </div>

      {/* Filter bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск игрока или страны..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500 w-full sm:w-64"
          />
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto flex-wrap gap-1">
          {(['all', 'recent', 'top10', 'top50', 'top100'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTier === tier
                  ? isAtp
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-rose-500 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tier === 'all' && 'Все'}
              {tier === 'recent' && 'С очками в сезоне ⚡'}
              {tier === 'top10' && 'Топ-10'}
              {tier === 'top50' && 'Топ-50'}
              {tier === 'top100' && 'Топ-100'}
            </button>
          ))}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 w-16 text-center">Ранг</th>
                <th className="py-3.5 px-2 w-10 text-center">Динамика</th>
                <th className="py-3.5 px-4">{isAtp ? 'Теннисист' : 'Теннисистка'}</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Стиль игры</th>
                <th className="py-3.5 px-4 hidden sm:table-cell text-center">В / П</th>
                <th className="py-3.5 px-4 hidden sm:table-cell text-center">Титулы</th>
                <th className="py-3.5 px-4 text-right">{isAtp ? 'Очки ATP' : 'Очки WTA'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(p => {
                const rankDiff = (p.prevRank || p.rank) - p.rank;
                const isRank1 = p.rank === 1;

                return (
                  <tr
                    key={p.id}
                    id={`player-row-${p.id}`}
                    onClick={() => onSelectPlayer(p.id)}
                    className="transition-colors cursor-pointer hover:bg-slate-800/60"
                  >
                    {/* Rank */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-white">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${
                          isRank1
                            ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20'
                            : p.rank <= 3
                            ? 'bg-slate-200 text-slate-950 font-bold'
                            : p.rank <= 10
                            ? 'bg-slate-800 text-amber-300 border border-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {p.rank}
                      </span>
                    </td>

                    {/* Rank Movement */}
                    <td className="py-3 px-2 text-center font-mono">
                      {rankDiff > 0 ? (
                        <span className="text-emerald-400 flex items-center justify-center font-bold">
                          <ChevronUp className="w-3.5 h-3.5" />
                          {rankDiff}
                        </span>
                      ) : rankDiff < 0 ? (
                        <span className="text-rose-400 flex items-center justify-center font-bold">
                          <ChevronDown className="w-3.5 h-3.5" />
                          {Math.abs(rankDiff)}
                        </span>
                      ) : (
                        <span className="text-slate-600 flex items-center justify-center">
                          <Minus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>

                    {/* Name & Flag */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl shrink-0">{p.flag}</span>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap hover:underline">
                            <span>{p.name}</span>
                            {p.rank <= 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                TOP 3
                              </span>
                            )}
                            {p.rank <= 16 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 hidden sm:inline-block">
                                Посев [{p.rank}]
                              </span>
                            )}
                            {p.lastTournamentResult && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30">
                                {p.lastTournamentResult}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {p.country} • {p.age} лет {p.nameEn ? `• ${p.nameEn}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Style */}
                    <td className="py-3 px-4 hidden md:table-cell text-slate-300 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60">
                        {p.style}
                      </span>
                    </td>

                    {/* W / L */}
                    <td className="py-3 px-4 hidden sm:table-cell text-center font-mono text-slate-300">
                      <span className="text-emerald-400 font-bold">{p.wins}</span>
                      <span className="text-slate-600 mx-1">-</span>
                      <span className="text-rose-400">{p.losses}</span>
                    </td>

                    {/* Titles */}
                    <td className="py-3 px-4 hidden sm:table-cell text-center font-mono">
                      {p.careerTitles > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                          🏆 {p.careerTitles}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Points */}
                    <td className="py-3 px-4 text-right font-mono">
                      <div className="font-bold text-emerald-400 text-sm">
                        {p.points.toLocaleString()}
                      </div>
                      {p.recentPointsGained && p.recentPointsGained > 0 ? (
                        <div className="text-[10px] text-emerald-400 font-bold">
                          +{p.recentPointsGained}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
