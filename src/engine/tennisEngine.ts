import { Match, MatchDetailedStats, MatchScore, Player, SurfaceType } from '../types';

export interface PointSimulationResult {
  winner: 1 | 2;
  outcomeType: 'ace' | 'winner' | 'unforced_error' | 'forced_error' | 'double_fault' | 'service_winner';
  rallyLength: number;
  descriptionRu: string;
  ballPath: Array<{ x: number; y: number }>;
  isGameWon: boolean;
  isSetWon: boolean;
  isMatchWon: boolean;
  server: 1 | 2;
}

export function calculateSurfaceRating(player: Player, surface: SurfaceType): number {
  let affinity = 1.0;
  if (surface === 'Hard' || surface === 'Indoor Hard') {
    affinity = player.stats.hardAffinity;
  } else if (surface === 'Clay') {
    affinity = player.stats.clayAffinity;
  } else if (surface === 'Grass') {
    affinity = player.stats.grassAffinity;
  }

  const baseAverage = (
    player.stats.serve * 0.25 +
    player.stats.forehand * 0.25 +
    player.stats.backhand * 0.20 +
    player.stats.speed * 0.15 +
    player.stats.mental * 0.15
  );

  // Moderate additive adjustments: surface affinity adds ±1-2 rating pts, form adds ±1 pt
  const affinityBonus = (affinity - 1.0) * 6;
  const formBonus = ((player.form || 1.0) - 1.0) * 8;

  return baseAverage + affinityBonus + formBonus;
}

export function simulateSinglePoint(
  player1: Player,
  player2: Player,
  surface: SurfaceType,
  server: 1 | 2,
  inTiebreak: boolean,
  currentScoreP1: number,
  currentScoreP2: number,
  currentGamesP1: number = 0,
  currentGamesP2: number = 0
): PointSimulationResult {
  const servingPlayer = server === 1 ? player1 : player2;
  const receivingPlayer = server === 1 ? player2 : player1;
  const isAtp = servingPlayer.tour === 'ATP';

  // 1. Tour-specific baseline server win percentage in modern professional tennis
  // Calibrated for tight, competitive sets (6-4, 7-5, 7-6) with dominant hold rates for both players
  // ATP baseline on serve: ~67.0% (hold rate ~88%)
  // WTA baseline on serve: ~63.5% (hold rate ~80%)
  const baseServerProb = isAtp ? 0.670 : 0.635;

  // 2. Surface speed modifier
  const surfaceModifier =
    surface === 'Grass'
      ? 0.020
      : surface === 'Indoor Hard'
      ? 0.010
      : surface === 'Hard'
      ? 0.005
      : -0.015; // Clay gives returners slightly more break chances

  // 3. Skill comparison: Serve vs Return & Baseline Rally
  const serverServeSkill = servingPlayer.stats.serve;
  const receiverReturnSkill =
    receivingPlayer.stats.forehand * 0.4 +
    receivingPlayer.stats.backhand * 0.4 +
    receivingPlayer.stats.speed * 0.2;
  const serveVsReturnDiff = serverServeSkill - receiverReturnSkill;

  const serverEffRating = calculateSurfaceRating(servingPlayer, surface);
  const receiverEffRating = calculateSurfaceRating(receivingPlayer, surface);
  const rallyDiff = serverEffRating - receiverEffRating;

  // Highly compressed skill gradient: maximum shift is strictly bounded to ±2.0%
  // This ensures favorites still prevail over a full match, but breaks are hard-fought (0-2 per set)
  const rawSkillEffect = (serveVsReturnDiff * 0.0003) + (rallyDiff * 0.0005);
  const skillEffect = Math.max(-0.020, Math.min(0.020, rawSkillEffect));

  // 4. Pressure, clutch & trailing game resilience
  // In pro tennis, a server trailing by a break focuses intensely to avoid falling into a 6-1 or 6-0 deficit
  const trailingGames = server === 1 ? (currentGamesP2 - currentGamesP1) : (currentGamesP1 - currentGamesP2);
  const trailingResilience = trailingGames >= 2 ? 0.038 : trailingGames === 1 ? 0.015 : 0;

  const isPressure = inTiebreak || (currentScoreP1 >= 3 && currentScoreP2 >= 3);
  const rawClutchDiff = (servingPlayer.stats.clutch - receivingPlayer.stats.clutch) * 0.0004;
  const pressureEffect = isPressure ? Math.max(-0.012, Math.min(0.012, rawClutchDiff)) : 0;

  // 5. Ace & Double Fault chances
  const surfaceAceMultiplier = surface === 'Grass' ? 1.35 : surface === 'Indoor Hard' ? 1.20 : surface === 'Hard' ? 1.05 : 0.70;
  const tourAceMultiplier = isAtp ? 1.0 : 0.62;
  const aceChance = Math.max(0.018, ((servingPlayer.stats.serve - 65) / 250) * 0.26) * surfaceAceMultiplier * tourAceMultiplier;
  const dfChance = Math.max(0.015, Math.min(0.048, (100 - servingPlayer.stats.mental) / 1000 * 0.45));

  const roll = Math.random();

  // Double Fault
  if (roll < dfChance) {
    const pointWinner = server === 1 ? 2 : 1;
    return {
      winner: pointWinner,
      outcomeType: 'double_fault',
      rallyLength: 0,
      descriptionRu: `Двойная ошибка на подаче у ${servingPlayer.nameRu}`,
      ballPath: [{ x: 50, y: server === 1 ? 90 : 10 }, { x: 45, y: 50 }],
      isGameWon: false,
      isSetWon: false,
      isMatchWon: false,
      server,
    };
  }

  // Ace
  if (roll < dfChance + aceChance) {
    const pointWinner = server;
    const baseSpeed = isAtp ? 198 : 172;
    const speed = Math.round(baseSpeed + (servingPlayer.stats.serve - 70) * 0.8 + Math.random() * 12);
    return {
      winner: pointWinner,
      outcomeType: 'ace',
      rallyLength: 1,
      descriptionRu: `Эйс навылет (${speed} км/ч) от ${servingPlayer.nameRu}!`,
      ballPath: [
        { x: 50, y: server === 1 ? 90 : 10 },
        { x: Math.random() > 0.5 ? 25 : 75, y: server === 1 ? 25 : 75 },
      ],
      isGameWon: false,
      isSetWon: false,
      isMatchWon: false,
      server,
    };
  }

  // 6. Rally outcome: bounded logistic point probability with trailing resilience
  // Guarantees server win prob remains in high-hold zone, preventing 6-0 and 6-1 blowouts
  const minProb = isAtp ? 0.60 : 0.57;
  const maxProb = isAtp ? 0.72 : 0.69;
  const finalServerWinProb = Math.max(minProb, Math.min(maxProb, baseServerProb + surfaceModifier + skillEffect + pressureEffect + trailingResilience));

  const serverWins = Math.random() < finalServerWinProb;
  const pointWinner: 1 | 2 = serverWins ? server : (server === 1 ? 2 : 1);
  const winnerPlayer = pointWinner === 1 ? player1 : player2;

  // Rally length based on surface
  const rallyLength = surface === 'Clay'
    ? Math.floor(4 + Math.random() * 8)
    : surface === 'Grass'
    ? Math.floor(2 + Math.random() * 4)
    : Math.floor(3 + Math.random() * 6);

  const isWinnerShot = Math.random() < 0.36;
  const outcomeType = isWinnerShot ? 'winner' : (Math.random() < 0.55 ? 'unforced_error' : 'forced_error');

  let desc = '';
  if (outcomeType === 'winner') {
    const shots = ['мощный форхенд по линии', 'косой кросс с бэкхенда', 'точный укороченный под сетку', 'смэш у сетки', 'прострел с задней линии'];
    const chosenShot = shots[Math.floor(Math.random() * shots.length)];
    desc = `Виннер! ${winnerPlayer.nameRu} пробивает ${chosenShot} (розыгрыш ${rallyLength} уд.)`;
  } else if (outcomeType === 'unforced_error') {
    const loser = pointWinner === 1 ? player2 : player1;
    desc = `Невынужденная ошибка: ${loser.nameRu} срывает удар в аут (${rallyLength} уд.)`;
  } else {
    desc = `Вынужденная ошибка соперника после острой атаки ${winnerPlayer.nameRu}`;
  }

  const ballPath: Array<{ x: number; y: number }> = [
    { x: 50, y: server === 1 ? 90 : 10 },
    { x: 40 + Math.random() * 20, y: 50 },
    { x: 20 + Math.random() * 60, y: server === 1 ? 20 : 80 },
  ];

  return {
    winner: pointWinner,
    outcomeType,
    rallyLength,
    descriptionRu: desc,
    ballPath,
    isGameWon: false,
    isSetWon: false,
    isMatchWon: false,
    server,
  };
}

export function formatGameScore(p1Points: number, p2Points: number): [string, string] {
  if (p1Points >= 3 && p2Points >= 3) {
    if (p1Points === p2Points) return ['40', '40']; // Deuce
    if (p1Points > p2Points) return ['AD', '40'];
    return ['40', 'AD'];
  }
  const scoreMap = ['0', '15', '30', '40'];
  return [scoreMap[Math.min(3, p1Points)], scoreMap[Math.min(3, p2Points)]];
}

export function simulateFullMatch(
  player1: Player,
  player2: Player,
  surface: SurfaceType,
  setsToWin: 2 | 3 = 2
): { score: MatchScore; winnerId: string } {
  const sets: Array<[number, number]> = [];
  const tiebreaks: Array<[number, number] | null> = [];

  let p1SetsWon = 0;
  let p2SetsWon = 0;

  const isAtp = player1.tour === 'ATP';
  const baseServeSpeed = isAtp ? 212 : 184;

  const stats: MatchDetailedStats = {
    aces: [0, 0],
    doubleFaults: [0, 0],
    firstServePercentage: [62 + Math.floor(Math.random() * 8), 62 + Math.floor(Math.random() * 8)],
    firstServePointsWon: [0, 0],
    secondServePointsWon: [0, 0],
    breakPointsConverted: [0, 0],
    breakPointsTotal: [0, 0],
    winners: [0, 0],
    unforcedErrors: [0, 0],
    totalPointsWon: [0, 0],
    fastestServeKmH: [
      Math.round(baseServeSpeed + (player1.stats.serve - 70) * 0.7 + Math.random() * 8),
      Math.round(baseServeSpeed + (player2.stats.serve - 70) * 0.7 + Math.random() * 8),
    ],
  };

  let server: 1 | 2 = Math.random() > 0.5 ? 1 : 2;

  while (p1SetsWon < setsToWin && p2SetsWon < setsToWin) {
    let p1Games = 0;
    let p2Games = 0;

    while (true) {
      // Check set finish (6-4, 6-3, 7-5, etc.)
      if (p1Games >= 6 && p1Games - p2Games >= 2) {
        sets.push([p1Games, p2Games]);
        tiebreaks.push(null);
        p1SetsWon++;
        break;
      }
      if (p2Games >= 6 && p2Games - p1Games >= 2) {
        sets.push([p1Games, p2Games]);
        tiebreaks.push(null);
        p2SetsWon++;
        break;
      }

      // Tiebreak at 6-6
      if (p1Games === 6 && p2Games === 6) {
        let p1Tb = 0;
        let p2Tb = 0;

        while ((p1Tb < 7 && p2Tb < 7) || Math.abs(p1Tb - p2Tb) < 2) {
          const pt = simulateSinglePoint(player1, player2, surface, server, true, p1Tb, p2Tb, p1Games, p2Games);
          if (pt.winner === 1) {
            p1Tb++;
            stats.totalPointsWon[0]++;
          } else {
            p2Tb++;
            stats.totalPointsWon[1]++;
          }
          if (pt.outcomeType === 'ace') stats.aces[pt.winner - 1]++;
          if (pt.outcomeType === 'double_fault') stats.doubleFaults[pt.winner === 1 ? 1 : 0]++;
          if (pt.outcomeType === 'winner') stats.winners[pt.winner - 1]++;
          if (pt.outcomeType === 'unforced_error') stats.unforcedErrors[pt.winner === 1 ? 1 : 0]++;

          if ((p1Tb + p2Tb) % 2 === 1) {
            server = server === 1 ? 2 : 1;
          }
        }

        if (p1Tb > p2Tb) {
          p1Games++;
          p1SetsWon++;
        } else {
          p2Games++;
          p2SetsWon++;
        }

        sets.push([p1Games, p2Games]);
        tiebreaks.push([p1Tb, p2Tb]);
        break;
      }

      // Regular Game simulation
      let p1Points = 0;
      let p2Points = 0;
      const initialServer = server;

      while (true) {
        const pt = simulateSinglePoint(player1, player2, surface, server, false, p1Points, p2Points, p1Games, p2Games);
        if (pt.winner === 1) {
          p1Points++;
          stats.totalPointsWon[0]++;
        } else {
          p2Points++;
          stats.totalPointsWon[1]++;
        }

        if (pt.outcomeType === 'ace') stats.aces[pt.winner - 1]++;
        if (pt.outcomeType === 'double_fault') stats.doubleFaults[pt.winner === 1 ? 1 : 0]++;
        if (pt.outcomeType === 'winner') stats.winners[pt.winner - 1]++;
        if (pt.outcomeType === 'unforced_error') stats.unforcedErrors[pt.winner === 1 ? 1 : 0]++;

        // Break point check
        if (server === 1 && p2Points >= 3 && p2Points > p1Points) {
          stats.breakPointsTotal[1]++;
        } else if (server === 2 && p1Points >= 3 && p1Points > p2Points) {
          stats.breakPointsTotal[0]++;
        }

        // Win Game check
        if (p1Points >= 4 && p1Points - p2Points >= 2) {
          p1Games++;
          if (initialServer === 2) stats.breakPointsConverted[0]++;
          break;
        }
        if (p2Points >= 4 && p2Points - p1Points >= 2) {
          p2Games++;
          if (initialServer === 1) stats.breakPointsConverted[1]++;
          break;
        }
      }

      server = server === 1 ? 2 : 1;
    }
  }

  const winnerId = p1SetsWon > p2SetsWon ? player1.id : player2.id;
  const durationMinutes = Math.round(45 * sets.length + Math.random() * 30);

  return {
    winnerId,
    score: {
      sets,
      tiebreaks,
      winnerId,
      durationMinutes,
      stats,
    },
  };
}
