import { useState } from 'react';
import { Award, Check, Clock, Copy, Flame, Globe, HeartHandshake, RefreshCw, Search, Shield, Sparkles, Target, Trophy, Users, Zap } from 'lucide-react';
import { calculateRetirementChance } from '../engine/seasonManager';
import { Match, Player, Season, TourType } from '../types';

interface PlayersDirectoryProps {
  players: Player[];
  season: Season;
  allMatches: Match[];
  onSelectPlayer: (playerId: string) => void;
  onGenerateNextSeason: () => void;
}

export function PlayersDirectory({
  players,
  season,
  allMatches,
  onSelectPlayer,
  onGenerateNextSeason,
}: PlayersDirectoryProps) {
  const [selectedTour, setSelectedTour] = useState<'ALL' | TourType | 'RETIRED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<string>('all');
  const [snapshotCopied, setSnapshotCopied] = useState(false);

  const retiredList = season.retiredPlayersHistory || [];

  const filteredPlayers = players.filter(p => {
    if (selectedTour !== 'ALL' && selectedTour !== 'RETIRED' && p.tour !== selectedTour) return false;

    if (surfaceFilter !== 'all' && !p.favSurface?.includes(surfaceFilter)) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.country.toLowerCase().includes(q) ||
        p.style.toLowerCase().includes(q);
      if (!matchName) return false;
    }

    return true;
  }).sort((a, b) => {
    if (a.tour !== b.tour) return a.tour.localeCompare(b.tour);
    return a.rank - b.rank;
  });

  const filteredRetired = retiredList.filter(p => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.country.toLowerCase().includes(q) ||
        p.style.toLowerCase().includes(q);
      if (!matchName) return false;
    }
    return true;
  }).sort((a, b) => b.retiredYear - a.retiredYear || b.careerTitles - a.careerTitles);

  const curTrn = season.tournaments[season.currentTournamentIndex];

  const generateSnapshotText = (): string => {
    const topAtp = players.filter(p => p.tour === 'ATP').sort((a, b) => a.rank - b.rank).slice(0, 3);
    const topWta = players.filter(p => p.tour === 'WTA').sort((a, b) => a.rank - b.rank).slice(0, 3);

    return `=== СНАПШОТ СЕЗОНА | ${season.year} | ${curTrn?.tour || ''} ${curTrn?.nameRu || ''} ===
ТЕКУЩИЙ ТУРНИР: ${curTrn?.nameRu || ''} (${curTrn?.category}) — Раунд ${curTrn?.currentRound}
ТУР: ${curTrn?.tour} • Покрытие: ${curTrn?.surface}

ТОП-3 ATP:
${topAtp.map(p => `  #${p.rank} ${p.name} (${p.country}) — ${p.points} pts [${p.wins}W-${p.losses}L]`).join('\n')}

ТОП-3 WTA:
${topWta.map(p => `  #${p.rank} ${p.name} (${p.country}) — ${p.points} pts [${p.wins}W-${p.losses}L]`).join('\n')}

Сыграно матчей в сезоне: ${season.totalMatchesSimulated}
=== КОНЕЦ СНАПШОТА ===`;
  };

  const handleCopySnapshot = () => {
    navigator.clipboard.writeText(generateSnapshotText());
    setSnapshotCopied(true);
    setTimeout(() => setSnapshotCopied(false), 3000);
  };

  const isSeasonOver = season.currentTournamentIndex >= season.tournaments.length - 1 &&
    season.tournaments[season.tournaments.length - 1]?.completed;

  return (
    <div id="players-directory-view" className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Игроки & Звёзды Туров
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Звёзды ATP и WTA туров: карточки характеристик, любимые покрытия, коронные удары и статистика
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopySnapshot}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {snapshotCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
            <span>{snapshotCopied ? 'Скопировано!' : 'Скопировать снапшот'}</span>
          </button>

          {isSeasonOver && (
            <button
              onClick={onGenerateNextSeason}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Начать сезон {season.year + 1}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
        
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по имени, стране, стилю..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500 w-full"
          />
        </div>

        {/* Tour & Surface Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedTour('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedTour === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Все ({players.length})
            </button>
            <button
              onClick={() => setSelectedTour('ATP')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                selectedTour === 'ATP'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🎾 ATP</span>
            </button>
            <button
              onClick={() => setSelectedTour('WTA')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                selectedTour === 'WTA'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌸 WTA</span>
            </button>
            <button
              onClick={() => setSelectedTour('RETIRED')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                selectedTour === 'RETIRED'
                  ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
              title="Игроки, завершившие карьеру"
            >
              <HeartHandshake className="w-3.5 h-3.5 text-purple-400" />
              <span>Зал славы ({retiredList.length})</span>
            </button>
          </div>

          {selectedTour !== 'RETIRED' && (
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {['all', 'Хард', 'Грунт', 'Трава'].map(surf => (
                <button
                  key={surf}
                  onClick={() => setSurfaceFilter(surf)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    surfaceFilter === surf
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {surf === 'all' ? 'Любое' : surf}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* When Hall of Fame / Retired Players is selected */}
      {selectedTour === 'RETIRED' ? (
        <div>
          <div className="mb-4 p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">Зал славы • Легенды на пенсии</h3>
                <p className="text-xs text-slate-400">
                  Теннисисты, завершившие карьеру в возрасте 30+ лет после окончания сезонов.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-purple-300 bg-purple-900/60 px-2.5 py-1 rounded-lg border border-purple-500/30 shrink-0">
              Всего: {retiredList.length}
            </span>
          </div>

          {filteredRetired.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRetired.map(p => (
                <div
                  key={p.id}
                  className="bg-slate-900/90 border border-purple-500/30 hover:border-purple-500/60 rounded-2xl p-4 transition-all shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shrink-0">
                          {p.flag}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.country} • ушел в {p.retiredAtAge} лет
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          p.tour === 'ATP' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {p.tour}
                        </span>
                        <div className="text-[11px] font-mono text-purple-300 mt-1">
                          Сезон {p.retiredYear}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
                        {p.style}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300">
                        Пик: #{p.peakRank || p.rankAtRetirement}
                      </span>
                      {p.careerTitles > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                          🏆 {p.careerTitles}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono">
                      Итог: <strong className="text-emerald-400">{p.wins}В</strong> - <strong className="text-rose-400">{p.losses}П</strong>
                    </span>
                    <span className="text-[11px] text-purple-400 font-semibold">
                      Повесил ракетку
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
              Пока ни один теннисист не завершил карьеру. С приближением к 30+ годам игроки будут взвешивать уход на пенсию в конце каждого сезона.
            </div>
          )}
        </div>
      ) : (
        /* Active Players Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map(p => {
            const isAtp = p.tour === 'ATP';
            const isKsenia = p.id === 'ksenia-morey';
            const isVeteran = p.age >= 30;
            const isNewGen = p.age <= 21;
            const retireChance = isVeteran ? calculateRetirementChance(p) : 0;

            return (
              <div
                key={p.id}
                id={`player-card-${p.id}`}
                onClick={() => onSelectPlayer(p.id)}
                className={`bg-slate-900 border rounded-2xl p-4 transition-all hover:border-slate-600 hover:-translate-y-0.5 cursor-pointer shadow-md flex flex-col justify-between ${
                  isKsenia
                    ? 'border-emerald-500/50 shadow-emerald-500/10'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold shadow-md shrink-0"
                        style={{ backgroundColor: p.avatarColor || (isAtp ? '#0284c7' : '#e11d48') }}
                      >
                        <span>{p.flag}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-white hover:underline line-clamp-1">
                            {p.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{p.country} • {p.age} лет</span>
                          {isVeteran && (
                            <span
                              className="text-[10px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30"
                              title={`Ветеран (риск завершения карьеры в конце года: ${(retireChance * 100).toFixed(0)}%)`}
                            >
                              ⏳ Ветеран
                            </span>
                          )}
                          {isNewGen && (
                            <span
                              className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                              title="Молодой талант тура"
                            >
                              🌟 Дебютант
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isAtp
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {p.tour}
                      </span>
                      <div className="text-xs font-bold text-amber-400 font-mono mt-1">
                        #{p.rank}
                      </div>
                    </div>
                  </div>

                {/* Attributes Pill Row */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
                    {p.style}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
                    {p.favSurface}
                  </span>
                  {p.careerTitles > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
                      🏆 {p.careerTitles}
                    </span>
                  )}
                </div>

                {/* Stat bars */}
                <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 mb-3 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Подача</span>
                    <span className="font-mono text-slate-300 font-bold">
                      {'★'.repeat(p.stats?.serve || 3)}{'☆'.repeat(5 - (p.stats?.serve || 3))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Розыгрыш</span>
                    <span className="font-mono text-slate-300 font-bold">
                      {'★'.repeat(p.stats?.rally || 3)}{'☆'.repeat(5 - (p.stats?.rally || 3))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ментальность</span>
                    <span className="font-mono text-slate-300 font-bold">
                      {'★'.repeat(p.stats?.mental || 3)}{'☆'.repeat(5 - (p.stats?.mental || 3))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Bottom */}
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="font-mono text-slate-400">
                  <span className="text-emerald-400 font-semibold">{p.wins}В</span> - <span className="text-rose-400 font-semibold">{p.losses}П</span>
                </div>
                <div className="font-mono font-bold text-sky-400">
                  {p.points.toLocaleString()} pts
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {selectedTour !== 'RETIRED' && filteredPlayers.length === 0 && (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
          По вашему запросу игроки не найдены.
        </div>
      )}

    </div>
  );
}
