import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Trophy,
  Calendar,
  Zap,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Info,
} from 'lucide-react';
import { Match, Player, Season, Tournament, TournamentCategory } from '../types';
import { isMajorTournamentCategory, isTier1MajorCategory } from '../engine/seasonManager';
import { getRoundPoints } from '../data/tournaments';

interface PlayerRatingChartProps {
  player: Player;
  season?: Season;
  allPlayers?: Player[];
  allMatches?: Match[];
}

export interface ChartDataPoint {
  id: string;
  shortName: string;
  fullName: string;
  fullNameRu: string;
  category: TournamentCategory | 'Start';
  week: number;
  city: string;
  surface?: string;
  flag: string;
  dates?: string;
  points: number;
  rank: number;
  pointsGained: number;
  result: string;
  isCompleted: boolean;
  isMajor: boolean;
  isTier1: boolean;
  isWinner: boolean;
  maxPointsAtStake?: number;
}

export function PlayerRatingChart({
  player,
  season,
  allPlayers = [],
}: PlayerRatingChartProps) {
  // Metric toggle: 'points' (Очки) vs 'rank' (Позиция в туре)
  const [metric, setMetric] = useState<'points' | 'rank'>('points');

  // Filter toggle: 'majors' (Только крупные) vs 'all' (Все турниры)
  const [filterScope, setFilterScope] = useState<'majors' | 'all'>('majors');

  // Timeline toggle: 'completed' (Только сыгранные) vs 'full' (Весь календарь сезона)
  const [timelineScope, setTimelineScope] = useState<'completed' | 'full'>('completed');

  // Build the complete timeline of data points
  const { chartData, seasonStats } = useMemo(() => {
    const rawTournaments = season?.tournaments || [];
    const playerTour = player.tour;

    // Filter relevant tournaments for this player's tour
    const tourTournaments = rawTournaments
      .filter(t => t.tour === playerTour)
      .sort((a, b) => a.week - b.week);

    // Initial starting baseline point
    const startPoints = player.initialPoints ?? Math.max(0, player.points - (player.recentPointsGained || 0));
    const startRank = player.initialRank ?? (player.prevRank || player.rank);

    const startPoint: ChartDataPoint = {
      id: 'season_start',
      shortName: 'Старт',
      fullName: `Старт сезона ${season?.year || 2026}`,
      fullNameRu: `Старт сезона ${season?.year || 2026}`,
      category: 'Start',
      week: 0,
      city: playerTour === 'WTA' ? 'Брисбен / Окленд' : 'Брисбен / Гонконг',
      flag: '🏁',
      dates: 'Январь (Неделя 1)',
      points: startPoints,
      rank: startRank,
      pointsGained: 0,
      result: 'Начальный рейтинг',
      isCompleted: true,
      isMajor: true,
      isTier1: true,
      isWinner: false,
    };

    const pointsList: ChartDataPoint[] = [startPoint];
    let runningPoints = startPoints;
    let peakRank = startRank;
    let maxPoints = startPoints;
    let totalMajorTournamentsCompleted = 0;
    let pointsFromMajors = 0;

    // Check existing snapshot map on the player
    const historyMap = new Map<string, typeof player.rankingHistory extends (infer U)[] ? U : never>();
    if (player.rankingHistory && Array.isArray(player.rankingHistory)) {
      player.rankingHistory.forEach(h => historyMap.set(h.tournamentId, h));
    }

    tourTournaments.forEach(trn => {
      const isMajor = isMajorTournamentCategory(trn.category);
      const isTier1 = isTier1MajorCategory(trn.category);
      const snapshot = historyMap.get(trn.id);

      // Check if player participated and calculate result
      let playerWon = false;
      let pointsGained = 0;
      let resultText = 'Пропуск';
      const participated = trn.matches.some(
        m => m.player1?.id === player.id || m.player2?.id === player.id
      ) || (trn.qualifyingMatches || []).some(
        m => m.player1?.id === player.id || m.player2?.id === player.id
      );

      if (snapshot) {
        pointsGained = snapshot.pointsGained;
        runningPoints = snapshot.points;
        resultText = snapshot.result || (pointsGained > 0 ? `+${pointsGained} очков` : 'Участие');
        if (resultText.includes('Титул') || resultText.includes('🏆') || trn.winnerPlayerId === player.id) {
          playerWon = true;
        }
      } else if (trn.completed) {
        // Calculate dynamically if completed but snapshot not yet written
        if (participated) {
          const finalMatch = trn.matches.find(m => m.roundName === 'F');
          if (finalMatch && finalMatch.isCompleted && finalMatch.winnerId === player.id) {
            playerWon = true;
            pointsGained = getRoundPoints(trn.category, 'F', true);
            resultText = `🏆 Титул (+${pointsGained})`;
          } else {
            const playerMatches = trn.matches.filter(
              m => m.isCompleted && (m.player1?.id === player.id || m.player2?.id === player.id)
            );
            if (playerMatches.length > 0) {
              const lastM = playerMatches[playerMatches.length - 1];
              const round = lastM.roundName;
              pointsGained = getRoundPoints(trn.category, round, false);
              resultText = `${round} (+${pointsGained})`;
            }
          }
        }
        runningPoints += pointsGained;
      }

      const pointRank = snapshot ? snapshot.rank : (trn.completed ? player.rank : player.rank);

      if (trn.completed) {
        if (pointRank < peakRank) peakRank = pointRank;
        if (runningPoints > maxPoints) maxPoints = runningPoints;
        if (isMajor) {
          totalMajorTournamentsCompleted++;
          pointsFromMajors += pointsGained;
        }
      }

      // Compact label for X-Axis
      let shortLabel = trn.city;
      if (trn.category === 'Grand Slam') {
        if (trn.city.includes('Мельбурн') || trn.name.includes('Australian')) shortLabel = 'AO 🏆';
        else if (trn.city.includes('Париж') || trn.name.includes('Roland')) shortLabel = 'RG 🏆';
        else if (trn.city.includes('Лондон') || trn.name.includes('Wimbledon')) shortLabel = 'Уимблдон 🏆';
        else if (trn.city.includes('Нью-Йорк') || trn.name.includes('US Open')) shortLabel = 'US Open 🏆';
        else shortLabel = `${trn.city} 🏆`;
      } else if (trn.category === 'ATP Finals' || trn.category === 'WTA Finals') {
        shortLabel = 'Finals 👑';
      } else if (trn.category === 'ATP Masters 1000' || trn.category === 'WTA 1000') {
        shortLabel = `${trn.city} ⭐`;
      }

      const point: ChartDataPoint = {
        id: trn.id,
        shortName: shortLabel,
        fullName: trn.name,
        fullNameRu: trn.nameRu,
        category: trn.category,
        week: trn.week,
        city: trn.city,
        surface: trn.surface,
        flag: trn.flag,
        dates: trn.dates,
        points: trn.completed ? runningPoints : player.points,
        rank: trn.completed ? pointRank : player.rank,
        pointsGained,
        result: trn.completed ? resultText : 'Предстоящий турнир',
        isCompleted: trn.completed,
        isMajor,
        isTier1,
        isWinner: playerWon,
        maxPointsAtStake: getRoundPoints(trn.category, 'F', true),
      };

      pointsList.push(point);
    });

    // Apply filtering based on user selection
    let filtered = pointsList;

    if (filterScope === 'majors') {
      // Keep Start + Grand Slams + 1000s + Finals + 500s where player scored
      filtered = filtered.filter(p => p.category === 'Start' || p.isMajor);
    }

    if (timelineScope === 'completed') {
      // Only show up to the currently completed tournaments (or at least start + any played)
      const hasAnyCompleted = filtered.some(p => p.isCompleted && p.category !== 'Start');
      if (hasAnyCompleted) {
        filtered = filtered.filter(p => p.isCompleted);
      } else {
        // If no tournaments completed yet, show start + next 4 major milestones
        filtered = filtered.filter((p, idx) => idx <= 4);
      }
    }

    return {
      chartData: filtered,
      seasonStats: {
        startPoints,
        startRank,
        currentPoints: player.points,
        currentRank: player.rank,
        peakRank,
        maxPoints,
        pointsDiff: player.points - startPoints,
        rankDiff: startRank - player.rank, // positive means climbed ranks
        totalMajorTournamentsCompleted,
        pointsFromMajors,
      },
    };
  }, [player, season, filterScope, timelineScope]);

  // Compute domains for Y-Axis
  const pointsMin = Math.max(0, Math.min(...chartData.map(d => d.points)) - 150);
  const pointsMax = Math.max(...chartData.map(d => d.points)) + 250;
  const ranksMax = Math.max(...chartData.map(d => d.rank), 20) + 2;

  return (
    <div id="player-rating-chart-container" className="space-y-4">
      {/* Top Stat Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-sky-400" />
            <span>Текущий рейтинг</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold text-white font-mono">
              #{seasonStats.currentRank}
            </span>
            <span className="text-xs text-slate-400">({seasonStats.currentPoints.toLocaleString()} очков)</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Старт сезона</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold text-slate-300 font-mono">
              #{seasonStats.startRank}
            </span>
            <span className="text-xs text-slate-500">({seasonStats.startPoints.toLocaleString()} очков)</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Динамика очков</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`text-base sm:text-lg font-bold font-mono ${
                seasonStats.pointsDiff > 0
                  ? 'text-emerald-400'
                  : seasonStats.pointsDiff < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {seasonStats.pointsDiff > 0 ? `+${seasonStats.pointsDiff}` : seasonStats.pointsDiff}
            </span>
            {seasonStats.rankDiff > 0 ? (
              <span className="text-xs text-emerald-400 flex items-center font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{seasonStats.rankDiff}
              </span>
            ) : seasonStats.rankDiff < 0 ? (
              <span className="text-xs text-rose-400 flex items-center font-medium">
                <ArrowDownRight className="w-3.5 h-3.5" /> {seasonStats.rankDiff}
              </span>
            ) : (
              <span className="text-xs text-slate-400 flex items-center">
                <Minus className="w-3 h-3" /> 0
              </span>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Крупные турниры</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold text-amber-300 font-mono">
              {seasonStats.totalMajorTournamentsCompleted}
            </span>
            <span className="text-xs text-slate-400">
              (+{seasonStats.pointsFromMajors.toLocaleString()} pts)
            </span>
          </div>
        </div>
      </div>

      {/* Control & Filter Bars */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
        {/* Metric Selector (Points vs Rank Position) */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1 hidden sm:inline">Показатель:</span>
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setMetric('points')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                metric === 'points'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📈 Очки рейтинга (PTS)
            </button>
            <button
              onClick={() => setMetric('rank')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                metric === 'rank'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏆 Позиция в туре (# Ранг)
            </button>
          </div>
        </div>

        {/* Filter Controls (Majors only vs All tournaments) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setFilterScope('majors')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                filterScope === 'majors'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⭐ Только крупные
            </button>
            <button
              onClick={() => setFilterScope('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Все турниры
            </button>
          </div>

          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setTimelineScope('completed')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                timelineScope === 'completed'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Сыгранные
            </button>
            <button
              onClick={() => setTimelineScope('full')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                timelineScope === 'full'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Весь сезон
            </button>
          </div>
        </div>
      </div>

      {/* Main Recharts Chart Card */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl relative">
        <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              {metric === 'points' ? 'Динамика рейтинговых очков' : 'Позиция в мировом рейтинге'}
            </span>
            <span className="text-slate-600">•</span>
            <span>Сезон {season?.year || 2026}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>Большой Шлем</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              <span>1000 / Masters</span>
            </span>
          </div>
        </div>

        {/* Chart Box with guaranteed explicit height for ResponsiveContainer */}
        <div className="w-full h-72 sm:h-80 min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
            >
              <defs>
                <linearGradient id="pointsGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>
                <linearGradient id="rankGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />

              <XAxis
                dataKey="shortName"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={45}
              />

              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                reversed={metric === 'rank'}
                domain={metric === 'rank' ? [1, ranksMax] : [pointsMin, pointsMax]}
                tickFormatter={(val: number) => (metric === 'rank' ? `#${val}` : `${val}`)}
              />

              <Tooltip content={<CustomChartTooltip metric={metric} />} />

              {/* Reference line for baseline rating */}
              <ReferenceLine
                y={metric === 'points' ? seasonStats.startPoints : seasonStats.startRank}
                stroke="#475569"
                strokeDasharray="4 4"
                label={{
                  value: metric === 'points' ? 'Старт сезона' : '# Старт',
                  fill: '#64748b',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />

              <Line
                type="monotone"
                dataKey={metric}
                stroke={metric === 'points' ? 'url(#pointsGradient)' : 'url(#rankGradient)'}
                strokeWidth={3}
                dot={<CustomChartDot metric={metric} />}
                activeDot={{
                  r: 8,
                  stroke: metric === 'points' ? '#34d399' : '#38bdf8',
                  strokeWidth: 3,
                  fill: '#0f172a',
                }}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend notes */}
        <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-2">
          <span>* Точки на графике отражают состояние рейтинга игрока после завершения каждого турнира</span>
          <span>Наведите курсор на точку для просмотра заработанных очков и результатов</span>
        </div>
      </div>

      {/* Major Tournaments Breakdown List */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Ключевые турниры сезона ({chartData.filter(d => d.category !== 'Start').length})</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            Хронология крупных этапов тура {player.tour}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {chartData.map((pt, idx) => {
            if (pt.category === 'Start') return null;

            const isGS = pt.category === 'Grand Slam';
            const is1000 = pt.category === 'ATP Masters 1000' || pt.category === 'WTA 1000';
            const isFinals = pt.category === 'ATP Finals' || pt.category === 'WTA Finals';

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  pt.isWinner
                    ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/30'
                    : pt.isCompleted
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-900/30 border-slate-800/60 opacity-65'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{pt.flag}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-white truncate">
                        {pt.city}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          isGS
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : isFinals
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : is1000
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isGS ? 'Grand Slam' : isFinals ? 'Finals' : is1000 ? '1000' : '500'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      Неделя {pt.week} • {pt.surface || 'Хард'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {pt.isCompleted ? (
                    <>
                      <div className="text-xs font-bold font-mono text-emerald-400">
                        {pt.pointsGained > 0 ? `+${pt.pointsGained} очков` : '0 очков'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                        {pt.result}
                      </div>
                      <div className="text-[10px] text-sky-400 font-mono">
                        #{pt.rank} ({pt.points} pts)
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-medium text-slate-400">
                        Предстоит
                      </div>
                      <div className="text-[10px] text-slate-500">
                        до +{pt.maxPointsAtStake} pts
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Custom SVG Dot for Recharts Line.
 * Visually distinguishes Grand Slams (Gold/Crown), 1000s (Sky Blue), Wins (Green Glow).
 */
function CustomChartDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;

  const data: ChartDataPoint = payload;
  const isGS = data.category === 'Grand Slam';
  const is1000 = data.category === 'ATP Masters 1000' || data.category === 'WTA 1000';
  const isFinals = data.category === 'ATP Finals' || data.category === 'WTA Finals';
  const isStart = data.category === 'Start';
  const isWinner = data.isWinner;

  if (isWinner) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill="#f59e0b" fillOpacity={0.25} />
        <circle cx={cx} cy={cy} r={6} fill="#fbbf24" stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  }

  if (isGS) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fef3c7" strokeWidth={2} />
      </g>
    );
  }

  if (isFinals) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6.5} fill="#a855f7" stroke="#f3e8ff" strokeWidth={2} />
      </g>
    );
  }

  if (is1000) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={5.5} fill="#0ea5e9" stroke="#e0f2fe" strokeWidth={1.5} />
      </g>
    );
  }

  if (isStart) {
    return (
      <circle cx={cx} cy={cy} r={5} fill="#94a3b8" stroke="#ffffff" strokeWidth={1.5} />
    );
  }

  // Upcoming or smaller tournaments
  if (!data.isCompleted) {
    return (
      <circle cx={cx} cy={cy} r={4} fill="#1e293b" stroke="#64748b" strokeWidth={1.5} strokeDasharray="2 2" />
    );
  }

  return (
    <circle cx={cx} cy={cy} r={4.5} fill="#10b981" stroke="#064e3b" strokeWidth={1.5} />
  );
}

/**
 * Custom Tooltip for Recharts.
 */
function CustomChartTooltip({ active, payload, metric }: any) {
  if (!active || !payload || !payload.length) return null;

  const data: ChartDataPoint = payload[0]?.payload;
  if (!data) return null;

  const isGS = data.category === 'Grand Slam';
  const is1000 = data.category === 'ATP Masters 1000' || data.category === 'WTA 1000';
  const isFinals = data.category === 'ATP Finals' || data.category === 'WTA Finals';

  return (
    <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-700 text-slate-100 shadow-2xl backdrop-blur-md max-w-xs text-xs space-y-2 z-50">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-base">{data.flag}</span>
          <span className="font-bold text-white truncate">{data.city}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isGS
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : isFinals
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : is1000
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : data.category === 'Start'
              ? 'bg-slate-700 text-slate-300'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          {data.category}
        </span>
      </div>

      <div className="text-[11px] text-slate-400">
        <div>{data.fullNameRu || data.fullName}</div>
        {data.dates && <div>Сроки: {data.dates}</div>}
      </div>

      {data.isCompleted ? (
        <div className="space-y-1 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-slate-300">
            <span>Результат турнира:</span>
            <span className="font-semibold text-emerald-400">{data.result}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Очки после турнира:</span>
            <span className="font-mono font-bold text-amber-400">{data.points.toLocaleString()} pts</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Позиция в рейтинге:</span>
            <span className="font-mono font-bold text-sky-400">#{data.rank}</span>
          </div>
        </div>
      ) : (
        <div className="pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
          <div className="text-amber-300 font-medium">📅 Предстоящий турнир сезона</div>
          <div>На кону: до {data.maxPointsAtStake} рейтинговых очков</div>
          <div>Текущий рейтинг: #{data.rank} ({data.points} pts)</div>
        </div>
      )}
    </div>
  );
}
