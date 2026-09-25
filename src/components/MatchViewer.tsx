import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, FastForward, RotateCcw, Volume2, VolumeX, CheckCircle, ArrowLeft } from 'lucide-react';
import { Match, MatchDetailedStats, MatchScore, Player, SurfaceType } from '../types';
import { formatGameScore, simulateSinglePoint } from '../engine/tennisEngine';
import { soundFx } from '../utils/audio';

interface MatchViewerProps {
  match: Match;
  player1: Player;
  player2: Player;
  surface: SurfaceType;
  setsToWin: 2 | 3;
  onMatchFinished: (matchId: string, winnerId: string, score: MatchScore) => void;
  onBackToBracket: () => void;
}

export const MatchViewer: React.FC<MatchViewerProps> = ({
  match,
  player1,
  player2,
  surface,
  setsToWin,
  onMatchFinished,
  onBackToBracket,
}) => {
  // Live state
  const [sets, setSets] = useState<Array<[number, number]>>(
    match.score ? match.score.sets : [[0, 0]]
  );
  const [currentSetIdx, setCurrentSetIdx] = useState<number>(
    match.score ? match.score.sets.length - 1 : 0
  );
  const [currentGamePoints, setCurrentGamePoints] = useState<[number, number]>([0, 0]);
  const [server, setServer] = useState<1 | 2>(1);
  const [inTiebreak, setInTiebreak] = useState<boolean>(false);
  const [tiebreakScore, setTiebreakScore] = useState<[number, number]>([0, 0]);
  const [isMatchOver, setIsMatchOver] = useState<boolean>(match.isCompleted);
  const [matchWinner, setMatchWinner] = useState<string | null>(match.winnerId || null);
  const [pointLogs, setPointLogs] = useState<string[]>([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<number>(800); // ms per point
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getMuted());
  const [ballPos, setBallPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isBallActive, setIsBallActive] = useState<boolean>(false);

  // Match stats
  const [stats, setStats] = useState<MatchDetailedStats>(
    match.score?.stats || {
      aces: [0, 0],
      doubleFaults: [0, 0],
      firstServePercentage: [65, 63],
      firstServePointsWon: [0, 0],
      secondServePointsWon: [0, 0],
      breakPointsConverted: [0, 0],
      breakPointsTotal: [0, 0],
      winners: [0, 0],
      unforcedErrors: [0, 0],
      totalPointsWon: [0, 0],
      fastestServeKmH: [
        Math.round(205 + (player1.stats.serve - 70) * 0.7),
        Math.round(205 + (player2.stats.serve - 70) * 0.7),
      ],
    }
  );

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pointLogs]);

  // Point simulator step
  const handlePlayNextPoint = () => {
    if (isMatchOver) return;

    const currentP1Games = sets[currentSetIdx] ? sets[currentSetIdx][0] : 0;
    const currentP2Games = sets[currentSetIdx] ? sets[currentSetIdx][1] : 0;

    let p1Pt = inTiebreak ? tiebreakScore[0] : currentGamePoints[0];
    let p2Pt = inTiebreak ? tiebreakScore[1] : currentGamePoints[1];

    const ptResult = simulateSinglePoint(
      player1,
      player2,
      surface,
      server,
      inTiebreak,
      p1Pt,
      p2Pt
    );

    // Audio SFX
    if (ptResult.outcomeType === 'ace') {
      soundFx.playAce();
    } else if (ptResult.outcomeType === 'double_fault') {
      // no hit
    } else {
      soundFx.playRacketHit(ptResult.outcomeType === 'winner');
    }

    // Visual Ball Animation
    setIsBallActive(true);
    setBallPos(ptResult.ballPath[ptResult.ballPath.length - 1]);

    // Update Stats
    const updatedStats = { ...stats };
    if (ptResult.winner === 1) updatedStats.totalPointsWon[0]++;
    else updatedStats.totalPointsWon[1]++;

    if (ptResult.outcomeType === 'ace') updatedStats.aces[ptResult.winner - 1]++;
    if (ptResult.outcomeType === 'double_fault') updatedStats.doubleFaults[ptResult.winner === 1 ? 1 : 0]++;
    if (ptResult.outcomeType === 'winner') updatedStats.winners[ptResult.winner - 1]++;
    if (ptResult.outcomeType === 'unforced_error') updatedStats.unforcedErrors[ptResult.winner === 1 ? 1 : 0]++;
    setStats(updatedStats);

    // Add log
    setPointLogs((prev) => [...prev.slice(-40), ptResult.descriptionRu]);

    // Handle Tiebreak logic
    if (inTiebreak) {
      const newTb: [number, number] = [
        ptResult.winner === 1 ? p1Pt + 1 : p1Pt,
        ptResult.winner === 2 ? p2Pt + 1 : p2Pt,
      ];
      setTiebreakScore(newTb);

      // Server toggle in tiebreak (every 2 points after 1st point)
      if ((newTb[0] + newTb[1]) % 2 === 1) {
        setServer((s) => (s === 1 ? 2 : 1));
      }

      // Check Tiebreak won (7 points with 2 pt margin)
      if ((newTb[0] >= 7 || newTb[1] >= 7) && Math.abs(newTb[0] - newTb[1]) >= 2) {
        const tbWinner = newTb[0] > newTb[1] ? 1 : 2;
        handleSetWon(tbWinner, true);
      }
      return;
    }

    // Handle Regular Game Logic
    let newP1Pt = ptResult.winner === 1 ? p1Pt + 1 : p1Pt;
    let newP2Pt = ptResult.winner === 2 ? p2Pt + 1 : p2Pt;

    // Game won check
    if (newP1Pt >= 4 && newP1Pt - newP2Pt >= 2) {
      handleGameWon(1);
    } else if (newP2Pt >= 4 && newP2Pt - newP1Pt >= 2) {
      handleGameWon(2);
    } else {
      setCurrentGamePoints([newP1Pt, newP2Pt]);
    }
  };

  const handleGameWon = (gameWinner: 1 | 2) => {
    soundFx.playCrowdApplause();
    setCurrentGamePoints([0, 0]);
    const updatedSets = [...sets];
    const currSet = [...updatedSets[currentSetIdx]] as [number, number];

    if (gameWinner === 1) currSet[0]++;
    else currSet[1]++;
    updatedSets[currentSetIdx] = currSet;
    setSets(updatedSets);

    // Switch server
    setServer((s) => (s === 1 ? 2 : 1));

    // Check Set Won
    if (currSet[0] >= 6 && currSet[0] - currSet[1] >= 2) {
      handleSetWon(1, false);
    } else if (currSet[1] >= 6 && currSet[1] - currSet[0] >= 2) {
      handleSetWon(2, false);
    } else if (currSet[0] === 6 && currSet[1] === 6) {
      // Enter Tiebreak!
      setInTiebreak(true);
      setTiebreakScore([0, 0]);
      setPointLogs((prev) => [...prev, '🔥 ТАЙ-БРЕЙК ДО 7 ОЧКОВ!']);
    }
  };

  const handleSetWon = (setWinner: 1 | 2, wasTiebreak: boolean) => {
    setInTiebreak(false);
    setTiebreakScore([0, 0]);
    setCurrentGamePoints([0, 0]);

    const updatedSets = [...sets];
    if (wasTiebreak) {
      const curr = [...updatedSets[currentSetIdx]] as [number, number];
      if (setWinner === 1) curr[0] = 7;
      else curr[1] = 7;
      updatedSets[currentSetIdx] = curr;
      setSets(updatedSets);
    }

    // Count sets won
    let p1Sets = 0;
    let p2Sets = 0;
    updatedSets.forEach((s) => {
      if (s[0] > s[1]) p1Sets++;
      else if (s[1] > s[0]) p2Sets++;
    });

    const setWinnerPlayer = setWinner === 1 ? player1 : player2;
    setPointLogs((prev) => [...prev, `🏆 СЕТ ЗА ${setWinnerPlayer.nameRu.toUpperCase()}!`]);

    // Check Match Won
    if (p1Sets === setsToWin || p2Sets === setsToWin) {
      const winnerId = p1Sets === setsToWin ? player1.id : player2.id;
      setIsMatchOver(true);
      setMatchWinner(winnerId);
      setIsAutoPlaying(false);
      soundFx.playWinnerFanfare();

      const finalScore: MatchScore = {
        sets: updatedSets,
        winnerId,
        durationMinutes: 45 * updatedSets.length + Math.floor(Math.random() * 20),
        stats,
      };

      onMatchFinished(match.id, winnerId, finalScore);
    } else {
      // Start next set
      setSets([...updatedSets, [0, 0]]);
      setCurrentSetIdx((idx) => idx + 1);
    }
  };

  // Auto-play timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isAutoPlaying && !isMatchOver) {
      timer = setInterval(() => {
        handlePlayNextPoint();
      }, autoPlaySpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAutoPlaying, isMatchOver, autoPlaySpeed, sets, currentSetIdx, currentGamePoints, inTiebreak, tiebreakScore, server]);

  const gameScoreFormatted = formatGameScore(currentGamePoints[0], currentGamePoints[1]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Bar with Back button & Mute */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToBracket}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>К турнирной сетке</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const muted = soundFx.toggleMute();
              setIsMuted(muted);
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Live Scoreboard */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              {match.roundName}
            </span>
            <span className="text-xs text-slate-400">
              Покрытие: <strong className="text-white">{surface}</strong>
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            {isMatchOver ? 'Матч завершен' : inTiebreak ? '🔥 Тай-брейк' : `Сет ${currentSetIdx + 1}`}
          </div>
        </div>

        {/* Players Score Rows */}
        <div className="space-y-3">
          {/* Player 1 Row */}
          <div className={`flex items-center justify-between p-3.5 rounded-2xl transition ${
            matchWinner === player1.id ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-950/60'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              {server === 1 && !isMatchOver && (
                <span className="text-xs animate-bounce" title="Подает">🎾</span>
              )}
              {match.seed1 && (
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                  [{match.seed1}]
                </span>
              )}
              <span className="text-xl">{player1.flag}</span>
              <div className="truncate">
                <div className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                  <span>{player1.nameRu}</span>
                  <span className="text-xs text-slate-400 font-normal">#{player1.rank}</span>
                </div>
              </div>
            </div>

            {/* Sets & Points */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono">
              {sets.map((set, sIdx) => (
                <div
                  key={sIdx}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                    set[0] > set[1] ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {set[0]}
                </div>
              ))}

              {/* Live Point */}
              {!isMatchOver && (
                <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">
                  {inTiebreak ? tiebreakScore[0] : gameScoreFormatted[0]}
                </div>
              )}
            </div>
          </div>

          {/* Player 2 Row */}
          <div className={`flex items-center justify-between p-3.5 rounded-2xl transition ${
            matchWinner === player2.id ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-950/60'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              {server === 2 && !isMatchOver && (
                <span className="text-xs animate-bounce" title="Подает">🎾</span>
              )}
              {match.seed2 && (
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                  [{match.seed2}]
                </span>
              )}
              <span className="text-xl">{player2.flag}</span>
              <div className="truncate">
                <div className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                  <span>{player2.nameRu}</span>
                  <span className="text-xs text-slate-400 font-normal">#{player2.rank}</span>
                </div>
              </div>
            </div>

            {/* Sets & Points */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono">
              {sets.map((set, sIdx) => (
                <div
                  key={sIdx}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                    set[1] > set[0] ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {set[1]}
                </div>
              ))}

              {/* Live Point */}
              {!isMatchOver && (
                <div className="w-10 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/20">
                  {inTiebreak ? tiebreakScore[1] : gameScoreFormatted[1]}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2.5D Tennis Court Simulation View */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-gradient-to-b from-blue-900/60 via-emerald-950/40 to-blue-950/80 rounded-3xl border-2 border-emerald-500/30 overflow-hidden shadow-2xl flex items-center justify-center p-4">
        {/* Court markings */}
        <div className="w-[85%] h-[80%] border-2 border-white/60 relative bg-emerald-700/30 backdrop-blur-xs">
          {/* Net */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/90 shadow-md shadow-black flex items-center justify-center">
            <div className="w-full h-2 border-b border-dashed border-white/40" />
          </div>

          {/* Service Lines */}
          <div className="absolute top-[25%] left-0 right-0 h-0.5 bg-white/50" />
          <div className="absolute top-[75%] left-0 right-0 h-0.5 bg-white/50" />
          <div className="absolute top-[25%] bottom-[25%] left-1/2 w-0.5 bg-white/50" />

          {/* Player avatars on court */}
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="text-xl sm:text-2xl drop-shadow-md">🧍‍♂️</div>
            <span className="text-[10px] font-bold bg-slate-950/80 px-2 py-0.5 rounded text-white border border-slate-700">
              {player2.nameRu.split(' ')[1] || player2.nameRu}
            </span>
          </div>

          <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-[10px] font-bold bg-slate-950/80 px-2 py-0.5 rounded text-white border border-slate-700">
              {player1.nameRu.split(' ')[1] || player1.nameRu}
            </span>
            <div className="text-xl sm:text-2xl drop-shadow-md">🧍‍♂️</div>
          </div>

          {/* Animated Tennis Ball */}
          {isBallActive && (
            <div
              className="absolute w-3.5 h-3.5 rounded-full bg-lime-300 shadow-lg shadow-lime-400 border border-lime-100 transition-all duration-300 pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-pulse"
              style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
            />
          )}
        </div>
      </div>

      {/* Match Control Buttons */}
      {!isMatchOver ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayNextPoint}
              disabled={isAutoPlaying}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Сыграть 1 розыгрыш</span>
            </button>

            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg cursor-pointer ${
                isAutoPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              }`}
            >
              {isAutoPlaying ? <Pause className="w-4 h-4" /> : <FastForward className="w-4 h-4 text-emerald-400" />}
              <span>{isAutoPlaying ? 'Пауза автоигры' : 'Автоигра'}</span>
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 px-2">Скорость:</span>
            {[
              { label: '1x', speed: 900 },
              { label: '2x', speed: 450 },
              { label: '5x', speed: 150 },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => setAutoPlaySpeed(s.speed)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  autoPlaySpeed === s.speed
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-sm font-bold text-white">Матч завершен!</div>
              <div className="text-xs text-slate-300">
                Победитель: <strong>{matchWinner === player1.id ? player1.nameRu : player2.nameRu}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={onBackToBracket}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            Вернуться в сетку
          </button>
        </div>
      )}

      {/* Match Commentary Live Logs */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span>Текстовая трансляция розыгрышей</span>
        </h3>
        <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs text-slate-300 pr-2">
          {pointLogs.length === 0 ? (
            <div className="text-slate-500 italic py-3 text-center">
              Нажмите «Сыграть 1 розыгрыш» или «Автоигра» для начала матча
            </div>
          ) : (
            pointLogs.map((log, idx) => (
              <div
                key={idx}
                className={`py-1 px-2.5 rounded-lg ${
                  log.includes('СЕТ') || log.includes('🏆')
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                    : log.includes('Эйс')
                    ? 'bg-sky-500/15 text-sky-300 font-semibold'
                    : log.includes('Двойная')
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'bg-slate-950/40 text-slate-300'
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Match Statistics Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-4 text-center">Статистика матча</h3>
        
        <div className="space-y-3">
          {[
            { label: 'Эйсы', v1: stats.aces[0], v2: stats.aces[1] },
            { label: 'Двойные ошибки', v1: stats.doubleFaults[0], v2: stats.doubleFaults[1] },
            { label: 'Виннеры (активные очки)', v1: stats.winners[0], v2: stats.winners[1] },
            { label: 'Невынужденные ошибки', v1: stats.unforcedErrors[0], v2: stats.unforcedErrors[1] },
            { label: 'Макс. скорость подачи', v1: `${stats.fastestServeKmH[0]} км/ч`, v2: `${stats.fastestServeKmH[1]} км/ч` },
            { label: 'Всего выиграно очков', v1: stats.totalPointsWon[0], v2: stats.totalPointsWon[1] },
          ].map((row, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-950/50">
              <span className="font-bold text-white w-20 text-left">{row.v1}</span>
              <span className="text-slate-400 font-medium text-center flex-1">{row.label}</span>
              <span className="font-bold text-white w-20 text-right">{row.v2}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
