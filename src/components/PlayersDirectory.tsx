import React, { useState } from 'react';
import { Search, Trophy } from 'lucide-react';
import { Player, TourType } from '../types';

interface PlayersDirectoryProps {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
}

export const PlayersDirectory: React.FC<PlayersDirectoryProps> = ({
  players,
  onSelectPlayer,
}) => {
  const [selectedTour, setSelectedTour] = useState<TourType>('ATP');
  const [search, setSearch] = useState('');

  const filtered = players
    .filter((p) => p.tour === selectedTour && !p.retired)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.nameRu.toLowerCase().includes(search.toLowerCase()) ||
        p.country.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>База игроков тура</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Характеристики, форма, навыки подач, ударов и покрытие каждого теннисиста
          </p>
        </div>

        {/* Tour Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setSelectedTour('ATP')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              selectedTour === 'ATP'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ATP Игроки
          </button>
          <button
            onClick={() => setSelectedTour('WTA')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              selectedTour === 'WTA'
                ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            WTA Игроки
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск игрока..."
          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-lg"
        />
      </div>

      {/* Grid of Players */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((player) => (
          <div
            key={player.id}
            onClick={() => onSelectPlayer(player)}
            className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 p-4 rounded-3xl transition shadow-lg hover:shadow-emerald-500/10 cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{player.flag}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300">
                  #{player.rank}
                </span>
              </div>

              <h3 className="text-sm font-black text-white group-hover:text-emerald-400 transition truncate">
                {player.nameRu}
              </h3>
              <p className="text-xs text-slate-400 mb-3">{player.country} • {player.age} лет</p>

              {/* Mini Stats Bar */}
              <div className="space-y-1.5 text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Подача:</span>
                  <span className="font-bold text-white">{player.stats.serve}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Форхенд:</span>
                  <span className="font-bold text-white">{player.stats.forehand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Бэкхенд:</span>
                  <span className="font-bold text-white">{player.stats.backhand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Скорость:</span>
                  <span className="font-bold text-white">{player.stats.speed}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400">
              <span>Очки: <strong className="text-emerald-400">{player.points}</strong></span>
              {player.careerTitles > 0 && (
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Trophy className="w-3 h-3" />
                  {player.careerTitles}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
