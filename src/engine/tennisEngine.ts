import { DailyForm, GameLog, Match, MatchStats, Player, PointHistory, SetLog, Surface, TournamentEntryType } from '../types';

export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function roll2d6(): { die1: number; die2: number; total: number } {
  const die1 = rollDice(6);
  const die2 = rollDice(6);
  return { die1, die2, total: die1 + die2 };
}

/**
 * Rolls the Daily Form (Форма дня) using a d6 die.
 * This introduces real variance, giving lower-ranked players a legitimate shot
 * at upsetting heavy favorites when on peak inspiration!
 */
export function rollDailyForm(player: Player, forcedRoll?: number): DailyForm {
  const roll = forcedRoll && forcedRoll >= 1 && forcedRoll <= 6 ? forcedRoll : rollDice(6);
  switch (roll) {
    case 1:
      return {
        roll: 1,
        label: 'Спад / Не в духе ❄️',
        modifier: -0.5,
        description: 'Небольшая скованность в затяжных розыгрышах (-0.5 к розыгрышам)',
      };
    case 2:
      return {
        roll: 2,
        label: 'Тяжёлый старт 📉',
        modifier: -0.25,
        description: 'Лёгкая нехватка резкости (-0.25 к розыгрышам)',
      };
    case 3:
      return {
        roll: 3,
        label: 'Обычная форма ⚖️',
        modifier: 0,
        description: 'Стабильный теннис в соответствии с классом (0)',
      };
    case 4:
      return {
        roll: 4,
        label: 'Рабочий тонус 👍',
        modifier: 0,
        description: 'Хорошая концентрация в ключевых очках (0)',
      };
    case 5:
      return {
        roll: 5,
        label: 'На подъёме 📈',
        modifier: 0.25,
        description: 'Острые глубокие удары, точность (+0.25 к розыгрышам)',
      };
    case 6:
    default:
      return {
        roll: 6,
        label: 'На кураже! 🔥',
        modifier: 0.5,
        description: 'Вдохновение и лёгкость в розыгрышах (+0.5 к розыгрышам)',
      };
  }
}

/**
 * Calculates penalty to rally/reaction based on accumulated fatigue (0-100%).
 */
export function getFatigueModifier(fatigue = 0): number {
  if (fatigue < 40) return 0;
  if (fatigue < 65) return -1;
  if (fatigue < 85) return -2;
  return -3;
}

/**
 * Calculates penalty if player is playing with an injury.
 */
export function getInjuryModifier(player: Player): number {
  if (!player.injury) return 0;
  if (player.injury.severity === 'light') return -1;
  if (player.injury.severity === 'moderate') return -2;
  return -3;
}

/**
 * Calculates fatigue accumulated during a match based on played games and sets.
 */
export function calculateMatchFatigueGain(totalGames: number, setsCount: number, stamina = 3): number {
  const base = setsCount >= 3 ? 18 : 10;
  const gameAdd = Math.floor(totalGames / 4);
  const staminaMitigation = Math.max(0, (stamina - 3) * 2);
  return Math.max(6, Math.min(30, base + gameAdd - staminaMitigation));
}

export function getSurfaceBonus(player: Player, surface: Surface): number {
  const isClay = surface.includes('Грунт');
  const isGrass = surface.includes('Трава');

  if (player.id === 'ksenia-morey') {
    if (isClay) return 1;
    if (isGrass) return -1;
    return 0;
  }

  if (player.style === 'Базлайнер') {
    if (isClay) return 1;
    if (isGrass) return -1;
    return 0;
  }
  if (player.style === 'Подача+сетка') {
    if (isGrass) return 2;
    if (isClay) return -1;
    return 0;
  }
  if (player.style === 'Защитник') {
    if (isClay) return 1;
    if (isGrass) return -1;
    return 0;
  }
  return 0;
}

export function getRankingBonus(rank: number): number {
  if (rank <= 10) return 1;
  if (rank <= 30) return 0.5;
  return 0; // No rank penalties for lower ranked players
}

// Convert tennis game score state
export function getScoreLabel(pointsWon: number, opponentPointsWon: number, isTiebreak = false): string {
  if (isTiebreak) {
    return pointsWon.toString();
  }
  if (pointsWon === 0) return '0';
  if (pointsWon === 1) return '15';
  if (pointsWon === 2) return '30';
  if (pointsWon === 3) return '40';
  if (pointsWon >= 4) {
    if (pointsWon === opponentPointsWon) return '40';
    if (pointsWon === opponentPointsWon + 1) return 'AD';
    if (pointsWon >= opponentPointsWon + 2) return 'GAME';
  }
  return '40';
}

export interface PlayPointResult {
  point: PointHistory;
  p1Points: number;
  p2Points: number;
  isGameOver: boolean;
  gameWinner?: 1 | 2;
  p1ScoreDisplay: string;
  p2ScoreDisplay: string;
}

export function simulateOnePoint(
  match: Match,
  server: 1 | 2,
  p1PointsCurrent: number,
  p2PointsCurrent: number,
  surface: Surface,
  isTiebreak = false
): PlayPointResult {
  const p1 = match.player1;
  const p2 = match.player2;
  const serverPlayer = server === 1 ? p1 : p2;
  const returnerPlayer = server === 1 ? p2 : p1;

  // Ensure daily form is rolled and present
  if (!match.p1DailyForm) match.p1DailyForm = rollDailyForm(p1);
  if (!match.p2DailyForm) match.p2DailyForm = rollDailyForm(p2);

  // Step 1: Serve roll (d20 + bonuses)
  let serveModifier = serverPlayer.serveBonus;
  if (surface.includes('Трава')) serveModifier += 1;

  // Daily form subtle effect on serve (mild +0.5 boost only on peak inspiration 6, no harsh penalties)
  if (server === 1) {
    if (match.p1DailyForm.roll === 6) serveModifier += 0.5;
  } else {
    if (match.p2DailyForm.roll === 6) serveModifier += 0.5;
  }

  const rawD20 = rollDice(20);
  const serveTotal = rawD20 + serveModifier;

  let serveType: PointHistory['serveType'] = 'neutral';
  let serverRallyBonus = 0;
  let returnerRallyBonus = 0;
  let pointWinner: 1 | 2 | null = null;
  let commentary = '';
  let isWinnerShot = false;

  if (serveTotal <= 1) {
    serveType = 'double_fault';
    pointWinner = server === 1 ? 2 : 1;
    commentary = `☠️ Двойная ошибка ${serverPlayer.name}! Очко уходит сопернице.`;
  } else if (serveTotal >= 19) {
    serveType = 'ace';
    pointWinner = server;
    commentary = `⚡ ЭЙС! ${serverPlayer.name} вколачивает подачу под боковую линию со скоростью 195 км/ч!`;
  } else if (serveTotal <= 4) {
    serveType = 'weak';
    returnerRallyBonus = 1;
  } else if (serveTotal >= 16) {
    serveType = 'power';
    serverRallyBonus = 2;
  } else if (serveTotal >= 10) {
    serveType = 'good';
    serverRallyBonus = 1;
  } else {
    serveType = 'neutral';
  }

  let p1RollTotal = 0;
  let p2RollTotal = 0;
  let p1RallyRaw = 0;
  let p2RallyRaw = 0;

  // Step 2: Rally if not Ace or Double Fault
  if (pointWinner === null) {
    // Pressure situations:
    // Check if break point
    const isBreakPointForP1 = !isTiebreak && server === 2 && p1PointsCurrent >= 3 && p1PointsCurrent > p2PointsCurrent;
    const isBreakPointForP2 = !isTiebreak && server === 1 && p2PointsCurrent >= 3 && p2PointsCurrent > p1PointsCurrent;

    let p1Pressure = 0;
    let p2Pressure = 0;
    if (isBreakPointForP1) {
      if (rollDice(6) <= 2) p1Pressure += 1;
    }
    if (isBreakPointForP2) {
      if (rollDice(6) <= 2) p2Pressure += 1;
    }

    const p1Surface = getSurfaceBonus(p1, surface);
    const p2Surface = getSurfaceBonus(p2, surface);
    const p1RankBonus = getRankingBonus(p1.rank);
    const p2RankBonus = getRankingBonus(p2.rank);

    const p1FormBonus = match.p1DailyForm.modifier;
    const p2FormBonus = match.p2DailyForm.modifier;
    const p1FatigueBonus = getFatigueModifier(p1.fatigue);
    const p2FatigueBonus = getFatigueModifier(p2.fatigue);
    const p1InjuryBonus = getInjuryModifier(p1);
    const p2InjuryBonus = getInjuryModifier(p2);

    const r1 = roll2d6();
    const r2 = roll2d6();
    p1RallyRaw = r1.total;
    p2RallyRaw = r2.total;

    p1RollTotal = p1RallyRaw + p1RankBonus + p1Surface + (server === 1 ? serverRallyBonus : returnerRallyBonus) + p1Pressure + p1FormBonus + p1FatigueBonus + p1InjuryBonus;
    p2RollTotal = p2RallyRaw + p2RankBonus + p2Surface + (server === 2 ? serverRallyBonus : returnerRallyBonus) + p2Pressure + p2FormBonus + p2FatigueBonus + p2InjuryBonus;

    // Tie check
    if (p1RollTotal === p2RollTotal) {
      const re1 = rollDice(6);
      const re2 = rollDice(6);
      p1RollTotal += re1;
      p2RollTotal += re2;
      if (p1RollTotal === p2RollTotal) {
        p1RollTotal += Math.random() > 0.5 ? 1 : 0;
      }
    }

    const diff = Math.abs(p1RollTotal - p2RollTotal);
    if (p1RollTotal > p2RollTotal) {
      pointWinner = 1;
      if (diff >= 4) {
        isWinnerShot = true;
        if (match.p1DailyForm.roll === 6) {
          commentary = `💥 ВИННЕР! ${p1.name} на бешеном кураже (🎲6) вколачивает мяч под боковую линию (${p1RallyRaw}+${p1RollTotal - p1RallyRaw} vs ${p2RallyRaw}+${p2RollTotal - p2RallyRaw})!`;
        } else {
          commentary = `💥 ВИННЕР! ${p1.name} наносит сокрушительный удар по линии (${p1RallyRaw}+${p1RollTotal - p1RallyRaw} vs ${p2RallyRaw}+${p2RollTotal - p2RallyRaw})!`;
        }
      } else {
        if (match.p2DailyForm.roll === 1) {
          commentary = `❄️ ${p2.name} ошибается по длине — сказывается плохой игровой день (🎲1).`;
        } else {
          commentary = `${p1.name} выигрывает затяжной розыгрыш после ошибки ${p2.name} по длине.`;
        }
      }
    } else {
      pointWinner = 2;
      if (diff >= 4) {
        isWinnerShot = true;
        if (match.p2DailyForm.roll === 6) {
          commentary = `💥 ВИННЕР! ${p2.name} на пике вдохновения (🎲6) пробивает кросс навылет (${p2RallyRaw}+${p2RollTotal - p2RallyRaw} vs ${p1RallyRaw}+${p1RollTotal - p1RallyRaw})!`;
        } else {
          commentary = `💥 ВИННЕР! ${p2.name} пробивает острый кросс навылет (${p2RallyRaw}+${p2RollTotal - p2RallyRaw} vs ${p1RallyRaw}+${p1RollTotal - p1RallyRaw})!`;
        }
      } else {
        if (match.p1DailyForm.roll === 1) {
          commentary = `❄️ ${p1.name} срывает удар в сетку — не лучший день по форме (🎲1).`;
        } else {
          commentary = `${p2.name} вынуждает соперницу ошибиться укороченным мячом.`;
        }
      }
    }
  }

  // Update points
  let nextP1Points = p1PointsCurrent;
  let nextP2Points = p2PointsCurrent;
  if (pointWinner === 1) nextP1Points++;
  else nextP2Points++;

  let isGameOver = false;
  let gameWinner: 1 | 2 | undefined = undefined;

  if (isTiebreak) {
    if (nextP1Points >= 7 && nextP1Points - nextP2Points >= 2) {
      isGameOver = true;
      gameWinner = 1;
    } else if (nextP2Points >= 7 && nextP2Points - nextP1Points >= 2) {
      isGameOver = true;
      gameWinner = 2;
    }
  } else {
    if (nextP1Points >= 4 && nextP1Points - nextP2Points >= 2) {
      isGameOver = true;
      gameWinner = 1;
    } else if (nextP2Points >= 4 && nextP2Points - nextP1Points >= 2) {
      isGameOver = true;
      gameWinner = 2;
    }
  }

  const p1ScoreDisplay = getScoreLabel(nextP1Points, nextP2Points, isTiebreak);
  const p2ScoreDisplay = getScoreLabel(nextP2Points, nextP1Points, isTiebreak);

  const pointHistory: PointHistory = {
    server,
    p1Score: p1ScoreDisplay,
    p2Score: p2ScoreDisplay,
    p1PointsWon: nextP1Points,
    p2PointsWon: nextP2Points,
    pointWinner,
    serveRoll: serveTotal,
    serveType,
    p1RallyRoll: p1RallyRaw || undefined,
    p2RallyRoll: p2RallyRaw || undefined,
    p1RallyTotal: p1RollTotal || undefined,
    p2RallyTotal: p2RollTotal || undefined,
    isWinnerShot,
    commentary,
  };

  return {
    point: pointHistory,
    p1Points: nextP1Points,
    p2Points: nextP2Points,
    isGameOver,
    gameWinner,
    p1ScoreDisplay,
    p2ScoreDisplay,
  };
}

export function createNewMatch(
  tournamentId: string,
  roundName: string,
  p1: Player,
  p2: Player,
  p1Seed?: number,
  p2Seed?: number,
  p1EntryType?: TournamentEntryType,
  p2EntryType?: TournamentEntryType
): Match {
  const p1DailyForm = rollDailyForm(p1);
  const p2DailyForm = rollDailyForm(p2);

  const seedPrefix1 = p1Seed
    ? `[${p1Seed}] `
    : p1EntryType === 'Q'
    ? '[Q] '
    : p1EntryType === 'LL'
    ? '[LL] '
    : '';
  const seedPrefix2 = p2Seed
    ? `[${p2Seed}] `
    : p2EntryType === 'Q'
    ? '[Q] '
    : p2EntryType === 'LL'
    ? '[LL] '
    : '';

  return {
    id: `m_${tournamentId}_${roundName}_${p1.id}_vs_${p2.id}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    tournamentId,
    roundName,
    player1: p1,
    player2: p2,
    p1Seed,
    p2Seed,
    p1EntryType: p1EntryType || (p1Seed ? 'SEED' : undefined),
    p2EntryType: p2EntryType || (p2Seed ? 'SEED' : undefined),
    p1DailyForm,
    p2DailyForm,
    sets: [
      { setIndex: 1, p1Games: 0, p2Games: 0, games: [], winner: 1 },
    ],
    currentSetIndex: 0,
    isCompleted: false,
    scoreText: '',
    stats: {
      aces: [0, 0],
      doubleFaults: [0, 0],
      winners: [0, 0],
      unforcedErrors: [0, 0],
      breakPointsWon: [0, 0],
      breakPointsTotal: [0, 0],
      totalPointsWon: [0, 0],
      firstServePercentage: [68, 65],
    },
    narrativeHistory: [
      `🎾 Матч начался! ${seedPrefix1}${p1.name} (${p1.flag} #${p1.rank}, 🎲${p1DailyForm.roll}) vs ${seedPrefix2}${p2.name} (${p2.flag} #${p2.rank}, 🎲${p2DailyForm.roll})`
    ],
    createdAt: Date.now(),
  };
}

// Simulates an entire game step-by-step and records exact point progressions
export function simulateFullGame(
  match: Match,
  server: 1 | 2,
  surface: Surface,
  isTiebreak = false
): GameLog {
  let p1Points = 0;
  let p2Points = 0;
  const p1Prog: string[] = [];
  const p2Prog: string[] = [];
  const points: PointHistory[] = [];

  let isGameOver = false;
  let winner: 1 | 2 = 1;

  while (!isGameOver) {
    const res = simulateOnePoint(match, server, p1Points, p2Points, surface, isTiebreak);
    p1Points = res.p1Points;
    p2Points = res.p2Points;
    points.push(res.point);

    // Update match stats
    if (res.point.pointWinner === 1) match.stats.totalPointsWon[0]++;
    else match.stats.totalPointsWon[1]++;

    if (res.point.serveType === 'ace') {
      if (server === 1) match.stats.aces[0]++;
      else match.stats.aces[1]++;
    } else if (res.point.serveType === 'double_fault') {
      if (server === 1) match.stats.doubleFaults[0]++;
      else match.stats.doubleFaults[1]++;
    }

    if (res.point.isWinnerShot) {
      if (res.point.pointWinner === 1) match.stats.winners[0]++;
      else match.stats.winners[1]++;
    }

    // Progression records the score sequence for this game:
    // e.g. 15, 30, 40, AD, etc.
    p1Prog.push(res.p1ScoreDisplay);
    p2Prog.push(res.p2ScoreDisplay);

    if (res.isGameOver && res.gameWinner) {
      isGameOver = true;
      winner = res.gameWinner;
    }
  }

  const currentSet = match.sets[match.currentSetIndex];
  const newP1Games = winner === 1 ? currentSet.p1Games + 1 : currentSet.p1Games;
  const newP2Games = winner === 2 ? currentSet.p2Games + 1 : currentSet.p2Games;

  const isBreak = winner !== server && !isTiebreak;
  if (isBreak) {
    if (winner === 1) match.stats.breakPointsWon[0]++;
    else match.stats.breakPointsWon[1]++;
  }

  const gameLog: GameLog = {
    gameIndex: currentSet.games.length + 1,
    setIndex: currentSet.setIndex,
    server,
    winner,
    p1GamesAtEnd: newP1Games,
    p2GamesAtEnd: newP2Games,
    p1Progression: p1Prog,
    p2Progression: p2Prog,
    points,
    isBreak,
    isTiebreak,
  };

  currentSet.p1Games = newP1Games;
  currentSet.p2Games = newP2Games;
  currentSet.games.push(gameLog);

  // Add narrative
  const winName = winner === 1 ? match.player1.name : match.player2.name;
  if (isBreak) {
    match.narrativeHistory.unshift(`🔥 БРЕЙК! ${winName} берет подачу соперницы! Счёт в сете: ${newP1Games}:${newP2Games}`);
  } else {
    match.narrativeHistory.unshift(`Гейм за ${winName} на своей подаче (${newP1Games}:${newP2Games})`);
  }

  return gameLog;
}

export function checkSetCompletion(set: SetLog): { isComplete: boolean; winner?: 1 | 2 } {
  const { p1Games, p2Games } = set;
  if (p1Games >= 6 && p1Games - p2Games >= 2) return { isComplete: true, winner: 1 };
  if (p2Games >= 6 && p2Games - p1Games >= 2) return { isComplete: true, winner: 2 };
  if (p1Games === 7 && p2Games === 5) return { isComplete: true, winner: 1 };
  if (p2Games === 7 && p1Games === 5) return { isComplete: true, winner: 2 };
  if (p1Games === 7 && p2Games === 6) return { isComplete: true, winner: 1 };
  if (p2Games === 7 && p1Games === 6) return { isComplete: true, winner: 2 };
  return { isComplete: false };
}

// Simulates the entire match instantly, saving all point/game logs
export function simulateFullMatchInstantly(match: Match, surface: Surface): Match {
  if (match.isCompleted || match.isWalkover) {
    return match;
  }

  // Ensure daily form exists
  if (!match.p1DailyForm) match.p1DailyForm = rollDailyForm(match.player1);
  if (!match.p2DailyForm) match.p2DailyForm = rollDailyForm(match.player2);

  let server: 1 | 2 = Math.random() > 0.5 ? 1 : 2;
  let p1SetsWon = 0;
  let p2SetsWon = 0;

  while (!match.isCompleted) {
    const currentSet = match.sets[match.currentSetIndex];
    const isTiebreak = currentSet.p1Games === 6 && currentSet.p2Games === 6;

    simulateFullGame(match, server, surface, isTiebreak);
    server = server === 1 ? 2 : 1;

    // Check for realistic in-match retirement during sets 2 or 3
    if (match.currentSetIndex >= 1 && (currentSet.p1Games >= 2 || currentSet.p2Games >= 2)) {
      const p1Fatigue = match.player1.fatigue || 0;
      const p2Fatigue = match.player2.fatigue || 0;
      const p1HasInj = !!match.player1.injury;
      const p2HasInj = !!match.player2.injury;

      const p1Risk = p1Fatigue > 85 ? 0.05 : p1Fatigue > 70 ? 0.025 : p1HasInj ? 0.035 : 0.006;
      const p2Risk = p2Fatigue > 85 ? 0.05 : p2Fatigue > 70 ? 0.025 : p2HasInj ? 0.035 : 0.006;

      if (Math.random() < p1Risk || Math.random() < p2Risk) {
        const retiringPlayer: 1 | 2 = Math.random() < (p1Risk / (p1Risk + p2Risk)) ? 1 : 2;
        const loser = retiringPlayer === 1 ? match.player1 : match.player2;
        const winner = retiringPlayer === 1 ? match.player2 : match.player1;
        const injuryReasons = [
          'Мышечный спазм бедра',
          'Растяжение связок голеностопа',
          'Воспаление мышц плеча',
          'Тепловое истощение и судороги',
          'Острая боль в мышцах пресса',
        ];
        const reason = injuryReasons[Math.floor(Math.random() * injuryReasons.length)];
        match.isCompleted = true;
        match.isRetired = true;
        match.retiredPlayerId = loser.id;
        match.retirementReason = reason;
        match.winnerId = winner.id;
        match.scoreText = match.sets.map(s => `${s.p1Games}:${s.p2Games}`).join(', ') + ' (отказ)';
        match.narrativeHistory.unshift(
          `🚑 СНЯТИЕ С МАТЧА: ${loser.name} берёт медицинский перерыв и не может продолжать поединок из-за травмы (${reason}). Победа присуждается ${winner.name}! Итоговый счёт: ${match.scoreText}`
        );

        // Update fatigue & injury for retired player
        loser.injury = {
          type: reason,
          severity: 'moderate',
          weeksRemaining: 2,
          description: `Травма получена во время матча против ${winner.name}`,
        };

        // Clear point-by-point logs
        match.sets.forEach(s => {
          s.games.forEach(g => {
            g.points = [];
          });
        });
        match.narrativeHistory = match.narrativeHistory.slice(0, 5);
        break;
      }
    }

    const setStatus = checkSetCompletion(currentSet);
    if (setStatus.isComplete && setStatus.winner) {
      currentSet.winner = setStatus.winner;
      if (setStatus.winner === 1) p1SetsWon++;
      else p2SetsWon++;

      match.narrativeHistory.unshift(
        `🏆 СЕТ ${currentSet.setIndex} ЗАВЕРШЁН: ${setStatus.winner === 1 ? match.player1.name : match.player2.name} выигрывает со счетом ${currentSet.p1Games}:${currentSet.p2Games}`
      );

      // Check if match won (best of 3 sets)
      if (p1SetsWon === 2 || p2SetsWon === 2) {
        match.isCompleted = true;
        match.winnerId = p1SetsWon === 2 ? match.player1.id : match.player2.id;
        const winnerName = p1SetsWon === 2 ? match.player1.name : match.player2.name;
        match.scoreText = match.sets.map(s => `${s.p1Games}:${s.p2Games}`).join(', ');
        match.narrativeHistory.unshift(
          `🎉 МАТЧ ЗАВЕРШЁН! Победа ${winnerName}! Итоговый счёт: ${match.scoreText}`
        );
        // Clear point-by-point bloat from completed match to prevent memory and quota issues
        match.sets.forEach(s => {
          s.games.forEach(g => {
            g.points = [];
          });
        });
        match.narrativeHistory = match.narrativeHistory.slice(0, 5);
        break;
      } else {
        // Start next set
        match.currentSetIndex++;
        match.sets.push({
          setIndex: match.currentSetIndex + 1,
          p1Games: 0,
          p2Games: 0,
          games: [],
          winner: 1,
        });
      }
    }
  }

  // Update fatigue for both players
  const totalGames = match.sets.reduce((sum, s) => sum + s.p1Games + s.p2Games, 0);
  const setsCount = match.sets.length;
  const p1Gain = calculateMatchFatigueGain(totalGames, setsCount, match.player1.stats?.stamina);
  const p2Gain = calculateMatchFatigueGain(totalGames, setsCount, match.player2.stats?.stamina);
  match.player1.fatigue = Math.min(100, (match.player1.fatigue || 0) + p1Gain);
  match.player2.fatigue = Math.min(100, (match.player2.fatigue || 0) + p2Gain);

  return match;
}

export function applyWalkover(match: Match, winningPlayerNumber: 1 | 2, reason = 'Травма до матча'): Match {
  const winner = winningPlayerNumber === 1 ? match.player1 : match.player2;
  const loser = winningPlayerNumber === 1 ? match.player2 : match.player1;
  match.isCompleted = true;
  match.isWalkover = true;
  match.winnerId = winner.id;
  match.scoreText = 'W/O (травма)';
  match.narrativeHistory.unshift(
    `🚑 ВАЛКОВЕР (W/O): ${loser.name} снялся с матча (${reason}). ${winner.name} проходит в следующий круг без борьбы!`
  );
  return match;
}
