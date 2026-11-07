import React, { useMemo, useState } from 'react';
import { Eye, Play, Sparkles, Trophy, FastForward, CheckCircle2, Calendar, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Match, Player, Tournament } from '../types';
import { getProjectedSeedsForTournament, getRoundName } from '../engine/seasonManager';

interface TournamentBracketProps {
  tournament: Tournament;
  players: Player[];
  currentActiveWeek?: number;
  isLastTournamentInSeason?: boolean;
  seasonYear?: number;
  onSelectMatchToWatch: (match: Match) => void;
  onSimulateMatch: (match: Match) => void;
  onSimulateCurrentRound: () => void;
  onSimulateEntireTournament: () => void;
  onNextTournament: () => void;
  onSimulateUpToWeek?: (targetWeek: number) => void;
  onReturnToCurrentTournament?: () => void;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({
  tournament,
  players,
  currentActiveWeek = 1,
  isLastTournamentInSeason = false,
  seasonYear,
  onSelectMatchToWatch,
  onSimulateMatch,
  onSimulateCurrentRound,
  onSimulateEntireTournament,
  onNextTournament,
  onSimulateUpToWeek,
  onReturnToCurrentTournament,
}) => {
  const [selectedRound, setSelectedRound] = useState<number>(0);

  const getPlayer = (id: string | null): Player | undefined => {
    if (!id) return undefined;
    return players.find((p) => p.id === id);
  };

  const isDrawn = Boolean(tournament.isDrawn && tournament.matches && tournament.matches.length > 0);
  const totalRounds = Math.log2(tournament.drawSize);
  const roundsArray = Array.from({ length: totalRounds }, (_, i) => i);

  // Trigger celebration confetti when tournament just completed
  const champion = getPlayer(tournament.championId || null);

  const handleFireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const projectedInfo = useMemo(() => {
    if (isDrawn) return null;
    return getProjectedSeedsForTournament(tournament, players);
  }, [isDrawn, tournament, players]);

  return (
    <div className="space-y-6 pb-12">
      {/* Tournament Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide ${
                tournament.category === 'Grand Slam'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : tournament.tour === 'WTA' || ['W15', 'W35', 'W50', 'W75', 'W100'].includes(tournament.category)
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : tournament.category === 'M15' || tournament.category === 'M25'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              }`}>
                {tournament.tour} • {tournament.category}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                Покрытие: {tournament.surface}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                Сетка: {tournament.drawSize} игроков ({tournament.setsToWin === 3 ? 'Best of 5' : 'Best of 3'})
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                Неделя {tournament.week}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span>{tournament.flag}</span>
              <span>{tournament.nameRu}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400">
              {tournament.city}, {tournament.country} • Призовой фонд: ${(tournament.prizeMoneyPool).toLocaleString('en-US')} • Победитель получает +{tournament.pointsWinner} очков
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isDrawn ? (
              !tournament.isCompleted ? (
                <>
                  <button
                    onClick={onSimulateCurrentRound}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <FastForward className="w-4 h-4 text-emerald-400" />
                    <span>Симулировать раунд</span>
                  </button>

                  <button
                    onClick={onSimulateEntireTournament}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Симулировать турнир</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onNextTournament}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg cursor-pointer ${
                    isLastTournamentInSeason
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/20'
                  }`}
                >
                  {isLastTournamentInSeason ? (
                    <>
                      <Trophy className="w-4 h-4 text-slate-950" />
                      <span>Завершить сезон {seasonYear || ''} и подвести итоги 🏆</span>
                    </>
                  ) : (
                    <span>Следующий турнир по календарю →</span>
                  )}
                </button>
              )
            ) : (
              <>
                {onSimulateUpToWeek && tournament.week > currentActiveWeek && (
                  <button
                    onClick={() => onSimulateUpToWeek(tournament.week)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Симулировать сезон до недели {tournament.week}</span>
                  </button>
                )}
                {onReturnToCurrentTournament && (
                  <button
                    onClick={onReturnToCurrentTournament}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2 border border-slate-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-400" />
                    <span>К турнирам недели {currentActiveWeek}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Champion celebration card if completed */}
        {tournament.isCompleted && champion && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4 bg-emerald-950/30 rounded-2xl p-4 border border-emerald-500/30 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{champion.flag}</span>
              <div>
                <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                  Победитель турнира
                </div>
                <div className="text-lg font-black text-white">{champion.nameRu}</div>
                <div className="text-xs text-slate-400">
                  +{tournament.pointsWinner} очков ATP/WTA • Призовые: ${(tournament.prizeMoneyPool * 0.22).toLocaleString('en-US')}
                </div>
              </div>
            </div>

            <button
              onClick={handleFireConfetti}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              🎉 Салют
            </button>
          </div>
        )}
      </div>

      {/* Undrawn Future Week View: Projected Entry List & Seeds */}
      {!isDrawn ? (
        <div className="space-y-6 animate-in fade-in">
          {/* Info Banner */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Ожидает жеребьевки
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Неделя {tournament.week}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  Официальная сетка турнира будет сформирована в начале недели {tournament.week}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  По правилам тура окончательный список участников и номера посева определяются строго по официальному мировому рейтингу на момент наступления недели турнира (с учетом набранных и потерянных очков за предшествующие недели).
                </p>
                {projectedInfo && (
                  <div className="pt-2 text-xs text-emerald-400 font-semibold">
                    Ориентировочная граница прямого попадания в сетку: Топ-{projectedInfo.cutoffRank} мирового рейтинга
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Projected Seeds List */}
          {projectedInfo && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>Предварительный посев участников (по текущему рейтингу)</span>
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  {projectedInfo.topSeeds.length} сеяных игроков
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {projectedInfo.topSeeds.map((player, idx) => (
                  <div
                    key={player.id}
                    className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2.5 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xl shrink-0">{player.flag}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {player.nameRu}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {player.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-slate-300">
                        #{player.rank}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400">
                        {player.points.toLocaleString('en-US')} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Active Drawn Tournament View: Rounds & Matches */
        <>
          {/* Round Tabs Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {roundsArray.map((r) => {
              const rName = getRoundName(r, totalRounds);
              const roundMatches = tournament.matches.filter((m) => m.round === r);
              const completedCount = roundMatches.filter((m) => m.isCompleted).length;
              const isAllCompleted = completedCount === roundMatches.length;

              return (
                <button
                  key={r}
                  onClick={() => setSelectedRound(r)}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    selectedRound === r
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{rName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                    selectedRound === r ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {completedCount}/{roundMatches.length}
                  </span>
                  {isAllCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Matches Grid for Selected Round */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournament.matches
              .filter((m) => m.round === selectedRound)
              .map((match) => {
                const p1 = getPlayer(match.player1Id);
                const p2 = getPlayer(match.player2Id);
                const isP1Winner = match.winnerId && match.winnerId === match.player1Id;
                const isP2Winner = match.winnerId && match.winnerId === match.player2Id;

                return (
                  <div
                    key={match.id}
                    className={`bg-slate-900/80 border rounded-3xl p-4 shadow-xl transition-all relative overflow-hidden flex flex-col justify-between ${
                      match.isCompleted
                        ? 'border-slate-800/80 bg-slate-900/50'
                        : p1 && p2
                        ? 'border-emerald-500/40 shadow-emerald-500/5 hover:border-emerald-500/60'
                        : 'border-slate-800/50 opacity-70'
                    }`}
                  >
                    {/* Match Card Header */}
                    <div className="flex items-center justify-between text-xs mb-3 text-slate-400 font-medium">
                      <span>{match.roundName}</span>
                      {match.isCompleted ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          Завершен
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                          Ожидает
                        </span>
                      )}
                    </div>

                    {/* Player 1 Row */}
                    <div className={`flex items-center justify-between p-2 rounded-xl mb-1.5 ${
                      isP1Winner ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-slate-950/40'
                    }`}>
                      <div className="flex items-center gap-2 truncate">
                        {match.seed1 && (
                          <span className="text-[10px] font-mono font-bold px-1 rounded bg-slate-800 text-amber-400">
                            [{match.seed1}]
                          </span>
                        )}
                        <span className="text-base">{p1?.flag || '🏳️'}</span>
                        <span className={`text-xs sm:text-sm font-semibold truncate ${
                          isP1Winner ? 'text-emerald-300 font-bold' : p1 ? 'text-white' : 'text-slate-500'
                        }`}>
                          {p1?.nameRu || 'Ожидает победителя'}
                        </span>
                      </div>

                      {/* Set scores display */}
                      {match.score && (
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold shrink-0">
                          {match.score.sets.map((set, sIdx) => (
                            <span
                              key={sIdx}
                              className={`px-1.5 py-0.5 rounded ${
                                set[0] > set[1] ? 'bg-emerald-500/30 text-emerald-300 font-black' : 'text-slate-400'
                              }`}
                            >
                              {set[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Player 2 Row */}
                    <div className={`flex items-center justify-between p-2 rounded-xl mb-3 ${
                      isP2Winner ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-slate-950/40'
                    }`}>
                      <div className="flex items-center gap-2 truncate">
                        {match.seed2 && (
                          <span className="text-[10px] font-mono font-bold px-1 rounded bg-slate-800 text-amber-400">
                            [{match.seed2}]
                          </span>
                        )}
                        <span className="text-base">{p2?.flag || '🏳️'}</span>
                        <span className={`text-xs sm:text-sm font-semibold truncate ${
                          isP2Winner ? 'text-emerald-300 font-bold' : p2 ? 'text-white' : 'text-slate-500'
                        }`}>
                          {p2?.nameRu || 'Ожидает победителя'}
                        </span>
                      </div>

                      {/* Set scores display */}
                      {match.score && (
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold shrink-0">
                          {match.score.sets.map((set, sIdx) => (
                            <span
                              key={sIdx}
                              className={`px-1.5 py-0.5 rounded ${
                                set[1] > set[0] ? 'bg-emerald-500/30 text-emerald-300 font-black' : 'text-slate-400'
                              }`}
                            >
                              {set[1]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for Match */}
                    <div className="flex items-center gap-2 pt-1">
                      {p1 && p2 && !match.isCompleted ? (
                        <>
                          <button
                            onClick={() => onSelectMatchToWatch(match)}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Зритель</span>
                          </button>

                          <button
                            onClick={() => onSimulateMatch(match)}
                            className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                            title="Быстрая симуляция матча"
                          >
                            <Play className="w-3.5 h-3.5 text-sky-400" />
                            <span>Симуляция</span>
                          </button>
                        </>
                      ) : match.isCompleted ? (
                        <button
                          onClick={() => onSelectMatchToWatch(match)}
                          className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/60"
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Статистика матча</span>
                        </button>
                      ) : (
                        <div className="w-full py-1.5 text-center text-xs text-slate-500 italic">
                          Ожидает результатов предыдущего раунда
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};
