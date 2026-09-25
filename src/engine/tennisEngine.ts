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

  return baseAverage * affinity * (player.form || 1.0);
}

export function simulateSinglePoint(
  player1: Player,
  player2: Player,
  surface: SurfaceType,
  server: 1 | 2,
  inTiebreak: boolean,
  currentScoreP1: number,
  currentScoreP2: number
): PointSimulationResult {
  const servingPlayer = server === 1 ? player1 : player2;
  const receivingPlayer = server === 1 ? player2 : player1;

  const serverEffRating = calculateSurfaceRating(servingPlayer, surface);
  const receiverEffRating = calculateSurfaceRating(receivingPlayer, surface);

  // Pressure situation (break points, game points, tiebreak)
  const isPressure = inTiebreak || (currentScoreP1 >= 3 && currentScoreP2 >= 3);
  const serverClutch = isPressure ? (servingPlayer.stats.clutch / 100) : 1.0;
  const receiverClutch = isPressure ? (receivingPlayer.stats.clutch / 100) : 1.0;

  // Serve power & Ace probability
  const surfaceSpeed = surface === 'Grass' ? 1.25 : surface === 'Indoor Hard' ? 1.15 : surface === 'Hard' ? 1.05 : 0.85;
  const aceChance = ((servingPlayer.stats.serve - 60) / 300) * surfaceSpeed * 0.45;
  const dfChance = Math.max(0.015, (100 - servingPlayer.stats.mental) / 2000);

  const roll = Math.random();

  // 1. Double Fault
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

  // 2. Ace
  if (roll < dfChance + aceChance) {
    const pointWinner = server;
    const speed = Math.round(180 + (servingPlayer.stats.serve - 50) * 1.1 + Math.random() * 15);
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

  // 3. Rally simulation
  const rallyLength = Math.floor(2 + Math.random() * (surface === 'Clay' ? 9 : 5));
  const serverAdvantage = 1.12 * (servingPlayer.stats.serve / 85);
  const adjustedServerPower = serverEffRating * serverClutch * serverAdvantage;
  const adjustedReceiverPower = receiverEffRating * receiverClutch;

  const serverWinProb = adjustedServerPower / (adjustedServerPower + adjustedReceiverPower);
  const serverWins = Math.random() < serverWinProb;
  const pointWinner: 1 | 2 = serverWins ? server : (server === 1 ? 2 : 1);
  const winnerPlayer = pointWinner === 1 ? player1 : player2;

  const isWinnerShot = Math.random() < 0.38;
  const outcomeType = isWinnerShot ? 'winner' : (Math.random() < 0.6 ? 'unforced_error' : 'forced_error');

  let desc = '';
  if (outcomeType === 'winner') {
    const shots = ['мощный форхенд по линии', 'косой кросс с бэкхенда', 'точный укороченный под сетку', 'смэш у сетки'];
    const chosenShot = shots[Math.floor(Math.random() * shots.length)];
    desc = `Виннер! ${winnerPlayer.nameRu} пробивает ${chosenShot} (розыгрыш ${rallyLength} уд.)`;
  } else if (outcomeType === 'unforced_error') {
    const loser = pointWinner === 1 ? player2 : player1;
    desc = `Невынужденная ошибка: ${loser.nameRu} посылает мяч в сетку или аут (${rallyLength} уд.)`;
  } else {
    desc = `Вынужденная ошибка после агрессивной атаки от ${winnerPlayer.nameRu}`;
  }

  // Visual ball trail coordinates
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

  const stats: MatchDetailedStats = {
    aces: [0, 0],
    doubleFaults: [0, 0],
    firstServePercentage: [62 + Math.floor(Math.random() * 12), 62 + Math.floor(Math.random() * 12)],
    firstServePointsWon: [0, 0],
    secondServePointsWon: [0, 0],
    breakPointsConverted: [0, 0],
    breakPointsTotal: [0, 0],
    winners: [0, 0],
    unforcedErrors: [0, 0],
    totalPointsWon: [0, 0],
    fastestServeKmH: [
      Math.round(200 + (player1.stats.serve - 70) * 0.8 + Math.random() * 10),
      Math.round(200 + (player2.stats.serve - 70) * 0.8 + Math.random() * 10),
    ],
  };

  let server: 1 | 2 = Math.random() > 0.5 ? 1 : 2;

  while (p1SetsWon < setsToWin && p2SetsWon < setsToWin) {
    let p1Games = 0;
    let p2Games = 0;

    while (true) {
      // Check set finish
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
          const pt = simulateSinglePoint(player1, player2, surface, server, true, p1Tb, p2Tb);
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
        const pt = simulateSinglePoint(player1, player2, surface, server, false, p1Points, p2Points);
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
