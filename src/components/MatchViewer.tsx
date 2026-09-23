import { useEffect, useRef, useState } from 'react';
import {
  FastForward,
  FileText,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import {
  checkSetCompletion,
  simulateFullGame,
  simulateFullMatchInstantly,
  simulateOnePoint
} from '../engine/tennisEngine';
import { GameLog, Match, PointHistory, Surface } from '../types';
import { isSoundEnabled, playAceSound, playHitSound, playPointWonSound, toggleSound } from '../utils/audio';
import { ConfirmSimulationModal } from './ConfirmSimulationModal';

interface MatchViewerProps {
  key?: string | number;
  match: Match;
  surface: Surface;
  onMatchComplete: (updatedMatch: Match) => void;
  onOpenCard: (match: Match) => void;
  onOpenPlayer: (playerId: string) => void;
}

export type AutoSpeed = '0.5x' | '1x' | '2x' | '3x';

export const SPEED_DELAYS: Record<AutoSpeed, number> = {
  '0.5x': 5000, // 5 секунд (особая замедленная скорость)
  '1x': 3000,   // 3 секунды
  '2x': 2000,   // 2 секунды
  '3x': 1000,   // 1 секунда
};

export function MatchViewer({
  match,
  surface,
  onMatchComplete,
  onOpenCard,
  onOpenPlayer,
}: MatchViewerProps) {
  const [currentMatch, setCurrentMatch] = useState<Match>(match);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(false);
  const [autoSpeed, setAutoSpeed] = useState<AutoSpeed>('1x');
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled());
  const [isConfirmSimulateOpen, setIsConfirmSimulateOpen] = useState<boolean>(false);

  // Point-in-progress state
  const [p1Points, setP1Points] = useState<number>(0);
  const [p2Points, setP2Points] = useState<number>(0);
  const [currentServer, setCurrentServer] = useState<1 | 2>(1);
  const [recentPoint, setRecentPoint] = useState<PointHistory | null>(null);
  const [activeGamePoints, setActiveGamePoints] = useState<PointHistory[]>([]);
  const [p1Prog, setP1Prog] = useState<string[]>([]);
  const [p2Prog, setP2Prog] = useState<string[]>([]);

  // Ball court animation coordinate
  const [ballSide, setBallSide] = useState<'top' | 'bottom' | 'center'>('center');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync if prop changes
  useEffect(() => {
    setCurrentMatch(match);
  }, [match]);

  const p1 = currentMatch.player1;
  const p2 = currentMatch.player2;
  const currentSet = currentMatch.sets[currentMatch.currentSetIndex] || currentMatch.sets[0];
  const isTiebreak = currentSet?.p1Games === 6 && currentSet?.p2Games === 6;

  // Sound toggle
  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
  };

  // Step 1 Point
  const stepOnePoint = () => {
    if (currentMatch.isCompleted) return;

    playHitSound();

    const result = simulateOnePoint(
      currentMatch,
      currentServer,
      p1Points,
      p2Points,
      surface,
      isTiebreak
    );

    setRecentPoint(result.point);
    setP1Points(result.p1Points);
    setP2Points(result.p2Points);
    setActiveGamePoints(prev => [...prev, result.point]);

    setP1Prog(prev => [...prev, result.p1ScoreDisplay]);
    setP2Prog(prev => [...prev, result.p2ScoreDisplay]);

    setBallSide(result.point.pointWinner === 1 ? 'bottom' : 'top');

    // Update match stats
    const updated = { ...currentMatch };
    if (result.point.pointWinner === 1) updated.stats.totalPointsWon[0]++;
    else updated.stats.totalPointsWon[1]++;

    if (result.point.serveType === 'ace') {
      playAceSound();
      if (currentServer === 1) updated.stats.aces[0]++;
      else updated.stats.aces[1]++;
    } else if (result.point.serveType === 'double_fault') {
      if (currentServer === 1) updated.stats.doubleFaults[0]++;
      else updated.stats.doubleFaults[1]++;
    }

    if (result.point.isWinnerShot) {
      playPointWonSound(true);
      if (result.point.pointWinner === 1) updated.stats.winners[0]++;
      else updated.stats.winners[1]++;
    }

    // Add to narrative
    updated.narrativeHistory.unshift(result.point.commentary);

    // If game complete
    if (result.isGameOver && result.gameWinner) {
      playPointWonSound(true);
      const winner = result.gameWinner;
      const newP1Games = winner === 1 ? currentSet.p1Games + 1 : currentSet.p1Games;
      const newP2Games = winner === 2 ? currentSet.p2Games + 1 : currentSet.p2Games;
      const isBreak = winner !== currentServer && !isTiebreak;

      if (isBreak) {
        if (winner === 1) updated.stats.breakPointsWon[0]++;
        else updated.stats.breakPointsWon[1]++;
      }

      const gameLog: GameLog = {
        gameIndex: currentSet.games.length + 1,
        setIndex: currentSet.setIndex,
        server: currentServer,
        winner,
        p1GamesAtEnd: newP1Games,
        p2GamesAtEnd: newP2Games,
        p1Progression: [...p1Prog, result.p1ScoreDisplay],
        p2Progression: [...p2Prog, result.p2ScoreDisplay],
        points: [...activeGamePoints, result.point],
        isBreak,
        isTiebreak,
      };

      currentSet.p1Games = newP1Games;
      currentSet.p2Games = newP2Games;
      currentSet.games.push(gameLog);

      // Reset game points
      setP1Points(0);
      setP2Points(0);
      setActiveGamePoints([]);
      setP1Prog([]);
      setP2Prog([]);

      // Rotate server
      setCurrentServer(currentServer === 1 ? 2 : 1);

      // Check Set completion
      const setCheck = checkSetCompletion(currentSet);
      if (setCheck.isComplete && setCheck.winner) {
        currentSet.winner = setCheck.winner;
        const p1SetsWon = updated.sets.filter(s => s.winner === 1).length;
        const p2SetsWon = updated.sets.filter(s => s.winner === 2).length;

        if (p1SetsWon === 2 || p2SetsWon === 2) {
          updated.isCompleted = true;
          updated.winnerId = p1SetsWon === 2 ? p1.id : p2.id;
          updated.scoreText = updated.sets.map(s => `${s.p1Games}:${s.p2Games}`).join(', ');
          setIsPlayingAuto(false);
          onMatchComplete(updated);
        } else {
          // Start next set
          updated.currentSetIndex++;
          updated.sets.push({
            setIndex: updated.currentSetIndex + 1,
            p1Games: 0,
            p2Games: 0,
            games: [],
            winner: 1,
          });
        }
      }
    }

    setCurrentMatch(updated);
  };

  // Step full game
  const stepOneGame = () => {
    if (currentMatch.isCompleted) return;
    playHitSound();

    const updated = { ...currentMatch };
    const curSet = updated.sets[updated.currentSetIndex];
    const isTb = curSet.p1Games === 6 && curSet.p2Games === 6;

    simulateFullGame(updated, currentServer, surface, isTb);
    setCurrentServer(currentServer === 1 ? 2 : 1);
    setP1Points(0);
    setP2Points(0);
    setActiveGamePoints([]);
    setP1Prog([]);
    setP2Prog([]);

    const setCheck = checkSetCompletion(curSet);
    if (setCheck.isComplete && setCheck.winner) {
      curSet.winner = setCheck.winner;
      const p1SetsWon = updated.sets.filter(s => s.winner === 1).length;
      const p2SetsWon = updated.sets.filter(s => s.winner === 2).length;

      if (p1SetsWon === 2 || p2SetsWon === 2) {
        updated.isCompleted = true;
        updated.winnerId = p1SetsWon === 2 ? p1.id : p2.id;
        updated.scoreText = updated.sets.map(s => `${s.p1Games}:${s.p2Games}`).join(', ');
        setIsPlayingAuto(false);
        onMatchComplete(updated);
      } else {
        updated.currentSetIndex++;
        updated.sets.push({
          setIndex: updated.currentSetIndex + 1,
          p1Games: 0,
          p2Games: 0,
          games: [],
          winner: 1,
        });
      }
    }

    setCurrentMatch(updated);
  };

  // Fast Simulate Match with safety confirmation
  const handleRequestSimulateMatch = () => {
    setIsConfirmSimulateOpen(true);
  };

  const executeSimulateMatch = () => {
    setIsConfirmSimulateOpen(false);
    setIsPlayingAuto(false);
    playPointWonSound(true);
    const simulated = simulateFullMatchInstantly({ ...currentMatch }, surface);
    setCurrentMatch(simulated);
    onMatchComplete(simulated);
  };

  // Auto-play interval
  useEffect(() => {
    if (isPlayingAuto && !currentMatch.isCompleted) {
      const delay = SPEED_DELAYS[autoSpeed] || 3000;
      timerRef.current = setInterval(() => {
        stepOnePoint();
      }, delay);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlayingAuto, autoSpeed, currentMatch, currentServer, p1Points, p2Points]);

  return (
    <div id="match-viewer-container" className="space-y-4">
      {/* Top Match Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
              p1.tour === 'ATP'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            {p1.tour === 'ATP' ? '🎾 ATP Тур (Мужчины)' : '🌸 WTA Тур (Женщины)'}
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {match.roundName}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Покрытие: <strong className="text-slate-200">{surface}</strong>
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            {currentMatch.isCompleted ? 'Матч завершен' : 'В процессе розыгрыша'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSound}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            title={soundOn ? 'Выключить звук' : 'Включить звук'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            id="view-game-card-btn"
            onClick={() => onOpenCard(currentMatch)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            Карточка Игры (Протокол S1)
          </button>
        </div>
      </div>

      {/* Match Control Center (Управление просмотром матча) - помещено вверху над счётом */}
      <div className="p-4 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Step & Auto Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="step-point-btn"
            disabled={currentMatch.isCompleted}
            onClick={stepOnePoint}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            Следующий розыгрыш
          </button>

          <button
            id="step-game-btn"
            disabled={currentMatch.isCompleted}
            onClick={stepOneGame}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-medium text-xs sm:text-sm rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <SkipForward className="w-4 h-4 text-sky-400" />
            Следующий гейм
          </button>

          {/* Auto play toggle */}
          <button
            id="auto-play-btn"
            disabled={currentMatch.isCompleted}
            onClick={() => setIsPlayingAuto(!isPlayingAuto)}
            className={`px-4 py-2.5 font-semibold text-xs sm:text-sm rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
              isPlayingAuto
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {isPlayingAuto ? <Square className="w-4 h-4 fill-current" /> : <FastForward className="w-4 h-4 text-amber-400" />}
            {isPlayingAuto ? 'Пауза' : 'Авто-просмотр'}
          </button>

          {/* Speed Selector (0.5x = 5с, 1x = 3с, 2x = 2с, 3x = 1с) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            <span className="text-[11px] text-slate-400 font-medium px-2 hidden sm:inline">Скорость:</span>
            {(['0.5x', '1x', '2x', '3x'] as AutoSpeed[]).map((spd) => {
              const isSelected = autoSpeed === spd;
              const labelSeconds = spd === '0.5x' ? '5с' : spd === '1x' ? '3с' : spd === '2x' ? '2с' : '1с';
              return (
                <button
                  key={spd}
                  onClick={() => setAutoSpeed(spd)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`Скорость ${spd}: 1 розыгрыш каждые ${labelSeconds}`}
                >
                  {spd} <span className="text-[10px] opacity-80 font-sans font-normal">({labelSeconds})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Instant Simulation Button */}
        <div className="flex items-center gap-2">
          {!currentMatch.isCompleted ? (
            <button
              id="simulate-match-instant-btn"
              onClick={handleRequestSimulateMatch}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              Симулировать матч
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {currentMatch.isWalkover ? (
                <span className="text-xs text-rose-300 font-semibold px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5">
                  🚑 Walkover (W/O): {currentMatch.retirementReason || 'Отказ до матча'}
                </span>
              ) : currentMatch.isRetired ? (
                <span className="text-xs text-amber-300 font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5">
                  🚑 Отказ в матче: {currentMatch.retirementReason || 'Травма'} ({currentMatch.scoreText})
                </span>
              ) : (
                <span className="text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  Матч завершён: {currentMatch.scoreText}
                </span>
              )}
              <button
                onClick={() => onOpenCard(currentMatch)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Открыть протокол сетов
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Player 1 Card */}
        <div
          onClick={() => onOpenPlayer(p1.id)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            currentMatch.winnerId === p1.id
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{p1.flag}</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentMatch.p1Seed && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      [{currentMatch.p1Seed}]
                    </span>
                  )}
                  {currentMatch.p1EntryType === 'Q' && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      title="Квалифаер"
                    >
                      [Q]
                    </span>
                  )}
                  {currentMatch.p1EntryType === 'LL' && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      title="Лаки-лузер"
                    >
                      [LL]
                    </span>
                  )}
                  <h3 className="font-bold text-lg text-white hover:underline">{p1.name}</h3>
                  {currentServer === 1 && <span className="text-base animate-pulse">🎾</span>}
                </div>

                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                      p1.tour === 'ATP'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {p1.tour}
                  </span>
                  <span className="text-xs text-slate-400">
                    #{p1.rank} {p1.tour} • {p1.style}
                  </span>
                </div>

                {/* Daily Form Dice Pill */}
                {currentMatch.p1DailyForm && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border flex items-center gap-1 ${
                        currentMatch.p1DailyForm.modifier > 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : currentMatch.p1DailyForm.modifier < 0
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                      title="Бросок кубика d6 на форму дня"
                    >
                      <span>🎲 Форма d6: {currentMatch.p1DailyForm.roll}</span>
                      <span>({currentMatch.p1DailyForm.modifier > 0 ? '+' : ''}{currentMatch.p1DailyForm.modifier})</span>
                      <span className="text-slate-400 font-sans font-normal">• {currentMatch.p1DailyForm.label}</span>
                    </span>
                  </div>
                )}

                {/* Fatigue & Injury indicator */}
                {((p1.fatigue && p1.fatigue >= 35) || p1.injury) && (
                  <div className="flex items-center gap-2 mt-1 text-[11px]">
                    {p1.fatigue && p1.fatigue >= 35 && (
                      <span className="text-amber-400 font-mono font-semibold flex items-center gap-0.5">
                        ⚡ Усталость: {p1.fatigue}%
                      </span>
                    )}
                    {p1.injury && (
                      <span className="text-rose-400 font-medium flex items-center gap-0.5">
                        🚑 {p1.injury.type} ({p1.injury.severity})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Game points + Sets */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {currentMatch.sets.map((s, idx) => (
                  <span
                    key={idx}
                    className={`w-7 h-8 rounded flex items-center justify-center font-mono font-bold text-sm ${
                      idx === currentMatch.currentSetIndex
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {s.p1Games}
                  </span>
                ))}
              </div>

              <div className="w-12 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-xl text-emerald-400 shadow-inner">
                {p1Prog.length > 0 ? p1Prog[p1Prog.length - 1] : '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Player 2 Card */}
        <div
          onClick={() => onOpenPlayer(p2.id)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            currentMatch.winnerId === p2.id
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{p2.flag}</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentMatch.p2Seed && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      [{currentMatch.p2Seed}]
                    </span>
                  )}
                  {currentMatch.p2EntryType === 'Q' && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      title="Квалифаер"
                    >
                      [Q]
                    </span>
                  )}
                  {currentMatch.p2EntryType === 'LL' && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      title="Лаки-лузер"
                    >
                      [LL]
                    </span>
                  )}
                  <h3 className="font-bold text-lg text-white hover:underline">{p2.name}</h3>
                  {currentServer === 2 && <span className="text-base animate-pulse">🎾</span>}
                </div>

                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                      p2.tour === 'ATP'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {p2.tour}
                  </span>
                  <span className="text-xs text-slate-400">
                    #{p2.rank} {p2.tour} • {p2.style}
                  </span>
                </div>

                {/* Daily Form Dice Pill */}
                {currentMatch.p2DailyForm && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border flex items-center gap-1 ${
                        currentMatch.p2DailyForm.modifier > 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : currentMatch.p2DailyForm.modifier < 0
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                      title="Бросок кубика d6 на форму дня"
                    >
                      <span>🎲 Форма d6: {currentMatch.p2DailyForm.roll}</span>
                      <span>({currentMatch.p2DailyForm.modifier > 0 ? '+' : ''}{currentMatch.p2DailyForm.modifier})</span>
                      <span className="text-slate-400 font-sans font-normal">• {currentMatch.p2DailyForm.label}</span>
                    </span>
                  </div>
                )}

                {/* Fatigue & Injury indicator */}
                {((p2.fatigue && p2.fatigue >= 35) || p2.injury) && (
                  <div className="flex items-center gap-2 mt-1 text-[11px]">
                    {p2.fatigue && p2.fatigue >= 35 && (
                      <span className="text-amber-400 font-mono font-semibold flex items-center gap-0.5">
                        ⚡ Усталость: {p2.fatigue}%
                      </span>
                    )}
                    {p2.injury && (
                      <span className="text-rose-400 font-medium flex items-center gap-0.5">
                        🚑 {p2.injury.type} ({p2.injury.severity})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Game points + Sets */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {currentMatch.sets.map((s, idx) => (
                  <span
                    key={idx}
                    className={`w-7 h-8 rounded flex items-center justify-center font-mono font-bold text-sm ${
                      idx === currentMatch.currentSetIndex
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {s.p2Games}
                  </span>
                ))}
              </div>

              <div className="w-12 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-xl text-emerald-400 shadow-inner">
                {p2Prog.length > 0 ? p2Prog[p2Prog.length - 1] : '0'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Court Visualizer + Dice Action Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Tennis Court Representation */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden min-h-[300px]">
          {/* Surface texture tint */}
          <div
            className={`w-full max-w-md h-64 rounded-xl border-2 border-white/60 relative flex flex-col justify-between shadow-2xl p-3 ${
              surface.includes('Грунт')
                ? 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 border-amber-200/50'
                : surface.includes('Трава')
                ? 'bg-gradient-to-b from-emerald-800 via-emerald-900 to-green-950 border-emerald-200/50'
                : 'bg-gradient-to-b from-blue-700 via-blue-800 to-indigo-950 border-blue-200/50'
            }`}
          >
            {/* Player 2 top side */}
            <div className="flex items-center justify-between text-xs text-white/90 px-3 z-10">
              <div className="flex items-center gap-1.5 font-semibold bg-black/40 px-2 py-0.5 rounded-full">
                <span>{p2.flag}</span>
                <span>{p2.name}</span>
                {currentServer === 2 && <span>🎾</span>}
              </div>
              <span className="text-[10px] text-white/70">#{p2.rank}</span>
            </div>

            {/* Service boxes lines */}
            <div className="absolute inset-x-6 top-10 bottom-10 border border-white/40 pointer-events-none">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white/80 flex items-center justify-center">
                <span className="bg-white/20 text-[9px] text-white font-mono px-2 py-0.5 rounded-full">
                  СЕТКА
                </span>
              </div>
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-white/40" />
            </div>

            {/* Ball animation */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 z-20 ${
                ballSide === 'top'
                  ? 'top-14 scale-90'
                  : ballSide === 'bottom'
                  ? 'bottom-14 scale-110'
                  : 'top-1/2 -translate-y-1/2 scale-100'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-lime-400 border-2 border-white shadow-lg shadow-lime-500/50 flex items-center justify-center text-[8px] animate-bounce">
                🎾
              </div>
            </div>

            {/* Player 1 bottom side */}
            <div className="flex items-center justify-between text-xs text-white/90 px-3 z-10">
              <div className="flex items-center gap-1.5 font-semibold bg-black/40 px-2 py-0.5 rounded-full">
                <span>{p1.flag}</span>
                <span>{p1.name}</span>
                {currentServer === 1 && <span>🎾</span>}
              </div>
              <span className="text-[10px] text-white/70">#{p1.rank}</span>
            </div>
          </div>

          {/* Dice & Math breakdown for latest point */}
          {recentPoint && (
            <div className="mt-3 w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-mono flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">Подача d20:</span>
                <span>{recentPoint.serveRoll} ({recentPoint.serveType})</span>
              </div>
              {recentPoint.p1RallyRoll !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">2d6:</span>
                  <span>{recentPoint.p1RallyTotal} vs {recentPoint.p2RallyTotal}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Commentary & Narrative History */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col h-[340px]">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Хроника Розыгрышей
            </h4>
            <span className="text-[10px] text-slate-500">Живой репортаж матча</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            {currentMatch.narrativeHistory.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border ${
                  idx === 0
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 font-medium'
                    : 'bg-slate-900/50 border-slate-800/60 text-slate-300'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation modal for simulating match to completion */}
      <ConfirmSimulationModal
        isOpen={isConfirmSimulateOpen}
        type="match"
        title={`Симулировать матч до конца?`}
        description={`Текущий розыгрыш между ${p1.name} и ${p2.name} будет мгновенно рассчитан до победного сета. Итоговый счёт будет зафиксирован в турнирной сетке, а игра сразу же автоматически сохранится.`}
        details={{
          match: currentMatch,
          surface,
          roundName: currentMatch.roundName,
        }}
        onConfirm={executeSimulateMatch}
        onCancel={() => setIsConfirmSimulateOpen(false)}
      />
    </div>
  );
}
