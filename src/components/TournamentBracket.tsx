import { useState } from 'react';
import { AlertCircle, Award, ChevronRight, Dices, Eye, FastForward, FileText, Trophy, Zap } from 'lucide-react';
import { advanceTournamentRound } from '../engine/seasonManager';
import { simulateFullMatchInstantly } from '../engine/tennisEngine';
import { Match, Season, Tournament } from '../types';
import { sanitizePlayer } from '../utils/storage';

interface TournamentBracketProps {
  tournament: Tournament;
  season?: Season;
  onSelectTournament?: (index: number) => void;
  onSelectMatchToWatch: (match: Match) => void;
  onSelectMatchCard: (match: Match) => void;
  onSelectPlayer: (playerId: string) => void;
  onTournamentUpdate: (updatedTournament: Tournament) => void;
  onNextTournament: () => void;
}

export function TournamentBracket({
  tournament,
  season,
  onSelectTournament,
  onSelectMatchToWatch,
  onSelectMatchCard,
  onSelectPlayer,
  onTournamentUpdate,
  onNextTournament,
}: TournamentBracketProps) {
  const roundOrder = tournament.drawSize === 8 ? ['QF', 'SF', 'F'] : ['R32', 'R16', 'QF', 'SF', 'F'];
  const [activeRoundTab, setActiveRoundTab] = useState<string>(tournament.currentRound || roundOrder[0]);

  const matchesInRound =
    activeRoundTab === 'Q'
      ? tournament.qualifyingMatches || []
      : tournament.matches.filter(m => m.roundName === activeRoundTab);
  const isAtp = tournament.tour === 'ATP';

  const getRoundDisplay = (r: string) => {
    if (r === 'Q') return 'Квалификация (Q-Finals)';
    if (r === 'R64') return '1/32 финала';
    if (r === 'R32') return '1/16 финала';
    if (r === 'R16') return '1/8 финала';
    if (r === 'QF') return '1/4 финала';
    if (r === 'SF') return '1/2 финала';
    if (r === 'F') return 'Финал';
    return r;
  };

  // Find all tournaments occurring in the same week
  const sameWeekTournaments = season
    ? season.tournaments
        .map((t, idx) => ({ ...t, originalIndex: idx }))
        .filter(t => t.week === tournament.week)
    : [];

  const currentActiveTrnIndex = season?.currentTournamentIndex ?? 0;
  const currentActiveTrn = season?.tournaments[currentActiveTrnIndex];
  const isCurrentActive = !season || tournament.id === currentActiveTrn?.id;
  const isArchived = Boolean(season && tournament.completed && !isCurrentActive);
  const isUpcoming = Boolean(season && !tournament.completed && !isCurrentActive);

  const nextTrnIndex = (season?.currentTournamentIndex ?? 0) + 1;
  const nextTrn = season?.tournaments[nextTrnIndex];
  const isNextInSameWeek = Boolean(nextTrn && nextTrn.week === tournament.week);

  // Execute single match simulation instantly without confirmation
  const handleSimulateMatch = (match: Match) => {
    const simulated = simulateFullMatchInstantly({ ...match }, tournament.surface);
    const updatedMatches = tournament.matches.map(m => (m.id === match.id ? simulated : m));
    const updated = { ...tournament, matches: updatedMatches };

    advanceTournamentRound(updated);
    onTournamentUpdate(updated);
  };

  // Execute round simulation instantly without confirmation
  const handleSimulateCurrentRound = () => {
    const updatedMatches = tournament.matches.map(m => {
      if (m.roundName === activeRoundTab && !m.isCompleted) {
        return simulateFullMatchInstantly({ ...m }, tournament.surface);
      }
      return m;
    });

    const updated = { ...tournament, matches: updatedMatches };
    advanceTournamentRound(updated);
    if (updated.currentRound !== activeRoundTab && roundOrder.includes(updated.currentRound)) {
      setActiveRoundTab(updated.currentRound);
    }
    onTournamentUpdate(updated);
  };

  // Execute full tournament simulation instantly without confirmation
  const handleSimulateEntireTournament = () => {
    let current = { ...tournament };
    while (!current.completed) {
      const updatedMatches = current.matches.map(m => {
        if (!m.isCompleted) {
          return simulateFullMatchInstantly({ ...m }, current.surface);
        }
        return m;
      });
      current.matches = updatedMatches;
      const advanced = advanceTournamentRound(current);
      if (!advanced) break;
    }
    setActiveRoundTab(current.currentRound);
    onTournamentUpdate(current);
  };

  const finalMatch = tournament.matches.find(m => m.roundName === 'F');
  const champion = finalMatch?.winnerId
    ? sanitizePlayer(
        finalMatch.winnerId === finalMatch.player1.id
          ? finalMatch.player1
          : finalMatch.player2
      )
    : null;

  return (
    <div id="tournament-bracket-view" className="space-y-4 sm:space-y-6">
      {/* Week Tournaments Sequence Banner (Playing in sequence, no shared players) */}
      {sameWeekTournaments.length > 1 && (
        <div className="rounded-2xl bg-slate-900/95 border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs">
                W{tournament.week}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-white">
                    Неделя {tournament.week} ({tournament.dates}) • Турниры играются по очереди
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {sameWeekTournaments.length} турнира в неделю
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Турниры проводятся последовательно. Составы участников разделены — каждый теннисист выступает строго в одном турнире недели.
                </p>
              </div>
            </div>

            {/* If currently viewing non-active tournament, quick jump back button */}
            {!isCurrentActive && currentActiveTrn && onSelectTournament && (
              <button
                onClick={() => onSelectTournament(currentActiveTrnIndex)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 self-start sm:self-auto"
              >
                К текущему турниру ({currentActiveTrn.tour} {currentActiveTrn.city}) →
              </button>
            )}
          </div>

          {/* Sequential tournament queue list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {sameWeekTournaments.map((t, idx) => {
              const isViewingThis = t.id === tournament.id;
              const isActiveInSeason = season && season.currentTournamentIndex === t.originalIndex;
              const isFinished = t.completed;
              const isAtpItem = t.tour === 'ATP';
              const orderNum = idx + 1;

              // Extract winner if finished
              const fin = t.matches.find(m => m.roundName === 'F');
              const winPlayer = fin?.winnerId
                ? sanitizePlayer(
                    fin.winnerId === fin.player1.id
                      ? fin.player1
                      : fin.player2
                  )
                : null;

              return (
                <button
                  key={t.id}
                  id={`week-tournament-seq-${idx}`}
                  onClick={() => onSelectTournament && onSelectTournament(t.originalIndex)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${
                    isViewingThis
                      ? isAtpItem
                        ? 'bg-sky-950/40 border-sky-400 ring-2 ring-sky-400/40 shadow-lg'
                        : 'bg-rose-950/40 border-rose-400 ring-2 ring-rose-400/40 shadow-lg'
                      : isActiveInSeason
                      ? 'bg-emerald-950/30 border-emerald-500/70 hover:border-emerald-400'
                      : isFinished
                      ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-900 hover:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Очередь #{orderNum}
                    </span>

                    {isActiveInSeason ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                        В игре
                      </span>
                    ) : isFinished ? (
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        ✓ Завершён
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        В очереди ⏳
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{t.flag}</span>
                      <span
                        className={`text-xs font-black px-1.5 py-0.2 rounded uppercase ${
                          isAtpItem ? 'bg-sky-500/20 text-sky-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {t.tour}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {t.city}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>{t.category}</span>
                      <span className="text-slate-500">{t.surface}</span>
                    </div>

                    {isFinished && winPlayer && (
                      <div className="text-[10px] text-amber-300 font-medium mt-1 truncate">
                        🏆 {winPlayer.name}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Status info bar */}
          {!isCurrentActive && (
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                {isArchived ? (
                  <span>
                    ℹ️ <strong>Архив:</strong> Этот турнир недели уже сыгран. Результаты зафиксированы.
                  </span>
                ) : (
                  <span>
                    ⏳ <strong>Очередь:</strong> Этот турнир начнётся по очереди, когда завершится текущий турнир недели ({currentActiveTrn?.tour} {currentActiveTrn?.city}).
                  </span>
                )}
              </div>
              {currentActiveTrn && onSelectTournament && (
                <button
                  onClick={() => onSelectTournament(currentActiveTrnIndex)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  Перейти к текущему турниру →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tournament Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isAtp
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {tournament.tour} Tour
              </span>
              <span className="text-xl">{tournament.flag}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {tournament.category}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {tournament.surface}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {tournament.dates}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {tournament.nameRu} ({tournament.name})
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {tournament.city}, {tournament.country} • Сетка: {tournament.drawSize} участников • Очки победителю: +{tournament.pointsWinner} {tournament.tour}
            </p>

            {/* Seeding & Dynamic Rankings Rules Info */}
            <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                ⭐ Реальный посев:
              </span>
              <span>
                1-я и 2-я ракетки разведены в противоположные половины сетки (встреча только в финале). Сеяные 1–4 встретятся не ранее 1/2, сеяные 1–8 — не ранее 1/4 финала.
              </span>
            </div>
          </div>

          {/* Tournament Actions / Champion Badge */}
          <div className="flex flex-wrap items-center gap-2">
            {tournament.completed && champion ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    {isAtp ? 'Победитель турнира' : 'Победительница турнира'}
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer hover:underline" onClick={() => onSelectPlayer(champion.id)}>
                    <span>{champion.flag}</span>
                    <span>{champion.name}</span>
                  </div>
                </div>

                {isCurrentActive ? (
                  <button
                    id="next-tournament-btn"
                    onClick={onNextTournament}
                    className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>
                      {isNextInSameWeek && nextTrn
                        ? `След. турнир недели (${nextTrn.tour} ${nextTrn.city}) →`
                        : nextTrn
                        ? `Неделя ${tournament.week} завершена! Неделя ${nextTrn.week} (${nextTrn.tour} ${nextTrn.city}) →`
                        : `Завершить сезон ${season?.year} →`}
                    </span>
                  </button>
                ) : (
                  currentActiveTrn && onSelectTournament && (
                    <button
                      onClick={() => onSelectTournament(currentActiveTrnIndex)}
                      className="ml-auto px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      К текущему турниру недели ({currentActiveTrn.tour} {currentActiveTrn.city}) →
                    </button>
                  )
                )}
              </div>
            ) : isUpcoming ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-xl font-medium">
                  ⏳ Начнётся по очереди после текущего турнира недели
                </span>
                {currentActiveTrn && onSelectTournament && (
                  <button
                    onClick={() => onSelectTournament(currentActiveTrnIndex)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    Играть текущий: {currentActiveTrn.tour} {currentActiveTrn.city} →
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="simulate-round-btn"
                  onClick={handleSimulateCurrentRound}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-sky-400" />
                  Симулировать раунд ({activeRoundTab})
                </button>

                <button
                  id="simulate-entire-tournament-btn"
                  onClick={handleSimulateEntireTournament}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  Симулировать турнир
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Round Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-800/80 pt-4 overflow-x-auto pb-1">
          {/* Qualification Tab */}
          {tournament.qualifyingMatches && tournament.qualifyingMatches.length > 0 && (
            <button
              id="round-tab-Q"
              onClick={() => setActiveRoundTab('Q')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeRoundTab === 'Q'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-emerald-300 hover:bg-slate-700 border border-emerald-500/30'
              }`}
            >
              <span>🎾 Квалификация</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-950/80 text-emerald-300 font-black border border-emerald-500/40">
                4 Финала
              </span>
            </button>
          )}

          {roundOrder.map(r => {
            const hasMatches = tournament.matches.some(m => m.roundName === r);
            if (!hasMatches && r !== roundOrder[0]) return null;

            const isCurrent = tournament.currentRound === r && !tournament.completed;

            return (
              <button
                key={r}
                id={`round-tab-${r}`}
                onClick={() => setActiveRoundTab(r)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeRoundTab === r
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {r === 'R32' && '1/16 финала (R32)'}
                {r === 'R16' && '1/8 финала (R16)'}
                {r === 'QF' && '1/4 финала (QF)'}
                {r === 'SF' && 'Полуфинал (SF)'}
                {r === 'F' && 'Финал 🏆'}
                {isCurrent && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pre-tournament Withdrawals & Lucky Losers Notice Card */}
      {((tournament.withdrawals && tournament.withdrawals.length > 0) || (tournament.luckyLosersPool && tournament.luckyLosersPool.length > 0)) && (
        <div className="rounded-2xl bg-slate-900/90 border border-amber-500/30 p-4 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-amber-300">
                Снятия до турнира и распределение Lucky Loser [LL]
              </h3>
            </div>
            {tournament.luckyLosersPool && tournament.luckyLosersPool.length > 0 && (
              <span className="text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                В пуле ожидания LL: {tournament.luckyLosersPool.length} {tournament.luckyLosersPool.length === 1 ? 'игрок' : 'игрока'}
              </span>
            )}
          </div>

          {tournament.withdrawals && tournament.withdrawals.length > 0 ? (
            <div className="space-y-1.5">
              {tournament.withdrawals.map((w, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      🚑 Снялся:
                    </span>
                    <span className="text-white font-medium">
                      {w.originalPlayerFlag} {w.originalPlayerName}
                    </span>
                    <span className="text-slate-400 text-[11px]">({w.reason})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-300 font-medium shrink-0">
                    <span>Заменён на:</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      [LL]
                    </span>
                    <span className="text-white font-semibold">{w.replacementPlayerFlag} {w.replacementPlayerName}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Все участники основной сетки здоровы и готовы к турниру. Игроки Lucky Loser находятся в резерве на случай снятий.
            </p>
          )}
        </div>
      )}

      {/* Matches Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            Матчи раунда {getRoundDisplay(activeRoundTab)} ({matchesInRound.length})
          </h2>
          <span className="text-xs text-slate-500">
            {activeRoundTab === 'Q'
              ? 'Победители выходят в основу [Q], проигравшие формируют пул Lucky Loser [LL]'
              : 'Зрительский режим: просмотр по шагам или быстрый расчет'}
          </span>
        </div>

        {matchesInRound.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 text-sm">
            Матчи этого раунда сформируются после завершения предыдущего раунда.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {matchesInRound.map(match => {
              const p1 = sanitizePlayer(match.player1);
              const p2 = sanitizePlayer(match.player2);
              const isKseniaMatch = p1.id === 'ksenia-morey' || p2.id === 'ksenia-morey';
              const p1Won = match.isCompleted && match.winnerId === p1.id;
              const p2Won = match.isCompleted && match.winnerId === p2.id;
              const isQual = activeRoundTab === 'Q';

              return (
                <div
                  key={match.id}
                  id={`match-card-${match.id}`}
                  className={`rounded-2xl border transition-all p-4 flex flex-col justify-between ${
                    isKseniaMatch
                      ? 'bg-slate-900/95 border-emerald-500/50 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                      : isQual
                      ? 'bg-slate-900/80 border-emerald-900/40 hover:border-emerald-700/50'
                      : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top match header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-slate-400 font-semibold">{match.roundName}</span>
                        {isQual && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Финал квалификации
                          </span>
                        )}
                        {isKseniaMatch && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ⭐ Ксения Морей
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {match.isWalkover ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            🚑 W/O (Отказ)
                          </span>
                        ) : match.isRetired ? (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            title={match.retirementReason}
                          >
                            🚑 Отказ в матче
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-medium ${
                              match.isCompleted ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {match.isCompleted ? 'Завершён' : 'Ожидает зрителя'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Players & Scores */}
                    <div className="space-y-2">
                      {/* Player 1 Row */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer ${
                          p1Won ? 'bg-emerald-950/30 text-emerald-300 font-bold' : 'text-slate-200 hover:bg-slate-800/50'
                        }`}
                        onClick={() => onSelectPlayer(p1.id)}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                          {match.p1Seed && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                              [{match.p1Seed}]
                            </span>
                          )}
                          {match.p1EntryType === 'Q' && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0"
                              title="Пробился через квалификацию"
                            >
                              [Q]
                            </span>
                          )}
                          {match.p1EntryType === 'LL' && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0"
                              title="Лаки-лузер из квалификации"
                            >
                              [LL]
                            </span>
                          )}

                          <span className="text-lg shrink-0">{p1.flag}</span>
                          <span className="text-sm truncate hover:underline">{p1.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium">#{p1.rank}</span>

                          {/* Daily Form Dice Pill */}
                          {match.p1DailyForm && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                match.p1DailyForm.modifier > 0
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : match.p1DailyForm.modifier < 0
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                              title={`Кубик формы дня: ${match.p1DailyForm.roll} (${match.p1DailyForm.label})`}
                            >
                              🎲{match.p1DailyForm.roll}
                            </span>
                          )}

                          {/* Fatigue & Injury pill */}
                          {p1.fatigue && p1.fatigue >= 40 && (
                            <span
                              className="text-[10px] font-mono text-amber-400 font-bold shrink-0"
                              title={`Усталость игрока: ${p1.fatigue}%`}
                            >
                              ⚡{p1.fatigue}%
                            </span>
                          )}
                          {p1.injury && (
                            <span
                              className="text-[10px] text-rose-400 shrink-0"
                              title={`Травма: ${p1.injury.type} (${p1.injury.severity})`}
                            >
                              🚑
                            </span>
                          )}

                          {p1Won && <span className="text-[10px] text-emerald-400 ml-1 font-bold">✓</span>}
                        </div>
                        <div className="flex gap-1.5 font-mono text-sm shrink-0">
                          {match.sets.map((s, idx) => (
                            <span
                              key={idx}
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                                s.winner === 1 && match.isCompleted ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {s.p1Games}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Player 2 Row */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer ${
                          p2Won ? 'bg-emerald-950/30 text-emerald-300 font-bold' : 'text-slate-200 hover:bg-slate-800/50'
                        }`}
                        onClick={() => onSelectPlayer(p2.id)}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                          {match.p2Seed && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                              [{match.p2Seed}]
                            </span>
                          )}
                          {match.p2EntryType === 'Q' && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0"
                              title="Пробился через квалификацию"
                            >
                              [Q]
                            </span>
                          )}
                          {match.p2EntryType === 'LL' && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0"
                              title="Лаки-лузер из квалификации"
                            >
                              [LL]
                            </span>
                          )}

                          <span className="text-lg shrink-0">{p2.flag}</span>
                          <span className="text-sm truncate hover:underline">{p2.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium">#{p2.rank}</span>

                          {/* Daily Form Dice Pill */}
                          {match.p2DailyForm && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                match.p2DailyForm.modifier > 0
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : match.p2DailyForm.modifier < 0
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                              title={`Кубик формы дня: ${match.p2DailyForm.roll} (${match.p2DailyForm.label})`}
                            >
                              🎲{match.p2DailyForm.roll}
                            </span>
                          )}

                          {/* Fatigue & Injury pill */}
                          {p2.fatigue && p2.fatigue >= 40 && (
                            <span
                              className="text-[10px] font-mono text-amber-400 font-bold shrink-0"
                              title={`Усталость игрока: ${p2.fatigue}%`}
                            >
                              ⚡{p2.fatigue}%
                            </span>
                          )}
                          {p2.injury && (
                            <span
                              className="text-[10px] text-rose-400 shrink-0"
                              title={`Травма: ${p2.injury.type} (${p2.injury.severity})`}
                            >
                              🚑
                            </span>
                          )}

                          {p2Won && <span className="text-[10px] text-emerald-400 ml-1 font-bold">✓</span>}
                        </div>
                        <div className="flex gap-1.5 font-mono text-sm shrink-0">
                          {match.sets.map((s, idx) => (
                            <span
                              key={idx}
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                                s.winner === 2 && match.isCompleted ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {s.p2Games}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {match.isCompleted ? (
                      <button
                        onClick={() => onSelectMatchCard(match)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/80"
                      >
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        Посмотреть протокол сетов (S1, S2...)
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onSelectMatchToWatch(match)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Смотреть розыгрыш
                        </button>

                        <button
                          onClick={() => handleSimulateMatch(match)}
                          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Быстрая симуляция матча"
                        >
                          <Zap className="w-3.5 h-3.5 fill-amber-300" />
                          Симулировать
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
