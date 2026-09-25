import React, { useState } from 'react';
import { Search, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Player, TourType } from '../types';

interface RankingsTableProps {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
}

export const RankingsTable: React.FC<RankingsTableProps> = ({
  players,
  onSelectPlayer,
}) => {
  const [selectedTour, setSelectedTour] = useState<TourType>('ATP');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredPlayers = players
    .filter((p) => p.tour === selectedTour && !p.retired)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.country.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Tour Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>Мировой рейтинг теннисистов</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Официальный рейтинг ATP и WTA с пересчетом очков после каждого турнира
          </p>
        </div>

        {/* ATP vs WTA Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setSelectedTour('ATP')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              selectedTour === 'ATP'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ATP Тур (Мужчины)
          </button>
          <button
            onClick={() => setSelectedTour('WTA')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              selectedTour === 'WTA'
                ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            WTA Тур (Женщины)
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по имени игрока или стране..."
          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-lg"
        />
      </div>

      {/* Table Component */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 text-center w-16">Ранг</th>
                <th className="py-3.5 px-4">Игрок</th>
                <th className="py-3.5 px-4 text-center">Очки</th>
                <th className="py-3.5 px-4 text-center hidden md:table-cell">Титулы в сезоне</th>
                <th className="py-3.5 px-4 text-center hidden lg:table-cell">Шлемы</th>
                <th className="py-3.5 px-4 text-center hidden sm:table-cell">Матчи (В/П)</th>
                <th className="py-3.5 px-4 text-right">Призовые</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
              {filteredPlayers.map((player) => {
                const rankDiff = player.previousRank - player.rank;

                return (
                  <tr
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className="hover:bg-slate-800/50 transition cursor-pointer group"
                  >
                    {/* Rank + rank diff */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-white">
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.rank}</span>
                        {rankDiff > 0 && (
                          <span className="text-[10px] text-emerald-400 flex items-center">
                            <TrendingUp className="w-3 h-3" />+{rankDiff}
                          </span>
                        )}
                        {rankDiff < 0 && (
                          <span className="text-[10px] text-rose-400 flex items-center">
                            <TrendingDown className="w-3 h-3" />
                            {rankDiff}
                          </span>
                        )}
                        {rankDiff === 0 && (
                          <span className="text-[10px] text-slate-600">
                            <Minus className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Player Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{player.flag}</span>
                        <div>
                          <div className="font-bold text-white group-hover:text-emerald-400 transition">
                            {player.nameRu}
                          </div>
                          <div className="text-[11px] text-slate-500">{player.country}</div>
                        </div>
                      </div>
                    </td>

                    {/* Points */}
                    <td className="py-3 px-4 text-center font-mono font-extrabold text-emerald-400">
                      {player.points.toLocaleString('en-US')}
                    </td>

                    {/* Titles */}
                    <td className="py-3 px-4 text-center hidden md:table-cell font-mono text-slate-300">
                      {player.titles > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          <Trophy className="w-3 h-3" />
                          {player.titles}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>

                    {/* Grand Slams */}
                    <td className="py-3 px-4 text-center hidden lg:table-cell font-mono text-slate-300">
                      {player.grandSlams}
                    </td>

                    {/* W/L */}
                    <td className="py-3 px-4 text-center hidden sm:table-cell font-mono text-slate-400">
                      <span className="text-emerald-400 font-bold">{player.matchesWon}</span> /{' '}
                      <span className="text-rose-400">{player.matchesLost}</span>
                    </td>

                    {/* Prize Money */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-300">
                      ${player.prizeMoney.toLocaleString('en-US')}
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
};
