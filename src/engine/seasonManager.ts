import { INITIAL_TOURNAMENTS_SCHEDULE } from '../data/tournaments';
import { Match, Player, SeasonState, Tournament, TourType } from '../types';
import { simulateFullMatch } from './tennisEngine';

export function initializeNewSeason(players: Player[], year: number = 2026): SeasonState {
  const tournaments: Tournament[] = INITIAL_TOURNAMENTS_SCHEDULE.map((t, idx) => {
    return generateTournamentDraw(t, players, idx === 0);
  });

  return {
    year,
    currentTournamentIndex: 0,
    tournaments,
    completedTournaments: [],
    history: [],
  };
}

export function getStandardBracketSeeding(drawSize: number): number[] {
  const rounds = Math.log2(drawSize);
  let list = [1, 2];
  for (let r = 1; r < rounds; r++) {
    const nextList: number[] = [];
    const sum = Math.pow(2, r + 1) + 1;
    for (let i = 0; i < list.length; i++) {
      if (i % 2 === 0) {
        nextList.push(list[i]);
        nextList.push(sum - list[i]);
      } else {
        nextList.push(sum - list[i]);
        nextList.push(list[i]);
      }
    }
    list = nextList;
  }
  // Convert 1-based seed numbers (1..N) to 0-based indices (0..N-1)
  return list.map((seed) => seed - 1);
}

export function generateTournamentDraw(
  template: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>,
  allPlayers: Player[],
  _isFirst: boolean = false
): Tournament {
  const eligiblePlayers = allPlayers
    .filter((p) => p.tour === template.tour && !p.retired)
    .sort((a, b) => a.rank - b.rank);

  const drawSize = template.drawSize;
  const numRounds = Math.log2(drawSize);

  // Take top ranked players up to drawSize
  const tournamentPlayers = eligiblePlayers.slice(0, drawSize);

  // Standard Tennis Seeding Placement (Seed 1 at top, Seed 2 at bottom, Seeds 3-4 in opposite halves)
  const seededIndices = getStandardBracketSeeding(drawSize);
  const seededDraw: Player[] = new Array(drawSize);

  for (let slot = 0; slot < drawSize; slot++) {
    const playerIdx = seededIndices[slot];
    seededDraw[slot] = tournamentPlayers[playerIdx] || tournamentPlayers[slot % tournamentPlayers.length];
  }

  // Generate matches round by round
  let currentRoundSize = drawSize / 2;
  const roundMatchesMap: Map<number, Match[]> = new Map();

  for (let round = 0; round < numRounds; round++) {
    const roundMatches: Match[] = [];
    const isFirstRound = round === 0;
    const roundName = getRoundName(round, numRounds);

    for (let m = 0; m < currentRoundSize; m++) {
      const matchId = `${template.id}-r${round}-m${m}`;

      let p1Id: string | null = null;
      let p2Id: string | null = null;
      let s1: number | undefined = undefined;
      let s2: number | undefined = undefined;

      if (isFirstRound) {
        const p1 = seededDraw[m * 2];
        const p2 = seededDraw[m * 2 + 1];
        p1Id = p1 ? p1.id : null;
        p2Id = p2 ? p2.id : null;
        if (p1 && p1.rank <= 32) s1 = p1.rank;
        if (p2 && p2.rank <= 32) s2 = p2.rank;
      }

      const match: Match = {
        id: matchId,
        tournamentId: template.id,
        round,
        roundName,
        player1Id: p1Id,
        player2Id: p2Id,
        seed1: s1,
        seed2: s2,
        isCompleted: false,
      };

      roundMatches.push(match);
    }

    roundMatchesMap.set(round, roundMatches);
    currentRoundSize /= 2;
  }

  // Link child matches to next match IDs
  for (let round = 0; round < numRounds - 1; round++) {
    const currMatches = roundMatchesMap.get(round)!;
    const nextMatches = roundMatchesMap.get(round + 1)!;

    for (let i = 0; i < currMatches.length; i++) {
      const targetNextMatch = nextMatches[Math.floor(i / 2)];
      currMatches[i].nextMatchId = targetNextMatch.id;
      currMatches[i].nextMatchSlot = (i % 2 === 0 ? 1 : 2);
    }
  }

  const allMatchesList: Match[] = [];
  for (let r = 0; r < numRounds; r++) {
    allMatchesList.push(...roundMatchesMap.get(r)!);
  }

  return {
    ...template,
    matches: allMatchesList,
    isCompleted: false,
    currentRound: 0,
  };
}

export function repairTournamentBracket(tournament: Tournament, allPlayers: Player[]): Tournament {
  const updatedTournament = JSON.parse(JSON.stringify(tournament)) as Tournament;
  const eligiblePlayers = allPlayers
    .filter((p) => p.tour === updatedTournament.tour && !p.retired)
    .sort((a, b) => a.rank - b.rank);

  const numRounds = Math.log2(updatedTournament.drawSize);

  // Group matches by round
  const roundMatchesMap = new Map<number, Match[]>();
  for (let r = 0; r < numRounds; r++) {
    roundMatchesMap.set(r, updatedTournament.matches.filter((m) => m.round === r));
  }

  // 1. Ensure all nextMatchId / nextMatchSlot links are completely valid
  for (let round = 0; round < numRounds - 1; round++) {
    const currMatches = roundMatchesMap.get(round) || [];
    const nextMatches = roundMatchesMap.get(round + 1) || [];

    for (let i = 0; i < currMatches.length; i++) {
      const targetNextMatch = nextMatches[Math.floor(i / 2)];
      if (targetNextMatch) {
        currMatches[i].nextMatchId = targetNextMatch.id;
        currMatches[i].nextMatchSlot = (i % 2 === 0 ? 1 : 2);
      }
    }
  }

  // 2. Fix missing players in Round 0
  const r0Matches = roundMatchesMap.get(0) || [];
  const assignedPlayerIds = new Set<string>();
  r0Matches.forEach((m) => {
    if (m.player1Id) assignedPlayerIds.add(m.player1Id);
    if (m.player2Id) assignedPlayerIds.add(m.player2Id);
  });

  const unassignedPlayers = eligiblePlayers.filter((p) => !assignedPlayerIds.has(p.id));
  let unassignedIdx = 0;

  r0Matches.forEach((m) => {
    if (!m.player1Id && unassignedIdx < unassignedPlayers.length) {
      m.player1Id = unassignedPlayers[unassignedIdx++].id;
      const pObj = allPlayers.find((p) => p.id === m.player1Id);
      if (pObj && pObj.rank <= 32) m.seed1 = pObj.rank;
    }
    if (!m.player2Id && unassignedIdx < unassignedPlayers.length) {
      m.player2Id = unassignedPlayers[unassignedIdx++].id;
      const pObj = allPlayers.find((p) => p.id === m.player2Id);
      if (pObj && pObj.rank <= 32) m.seed2 = pObj.rank;
    }
  });

  // 3. Propagate completed match winners forward to next round matches
  for (let round = 0; round < numRounds - 1; round++) {
    const currMatches = roundMatchesMap.get(round) || [];
    for (const match of currMatches) {
      if (match.isCompleted && match.winnerId && match.nextMatchId) {
        const nextMatch = updatedTournament.matches.find((m) => m.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 1) {
            nextMatch.player1Id = match.winnerId;
            const pObj = allPlayers.find((p) => p.id === match.winnerId);
            if (pObj && pObj.rank <= 32) nextMatch.seed1 = pObj.rank;
          } else {
            nextMatch.player2Id = match.winnerId;
            const pObj = allPlayers.find((p) => p.id === match.winnerId);
            if (pObj && pObj.rank <= 32) nextMatch.seed2 = pObj.rank;
          }
        }
      }
    }
  }

  // 4. Check if final completed
  const finalMatch = updatedTournament.matches.find((m) => m.round === numRounds - 1);
  if (finalMatch && finalMatch.isCompleted && finalMatch.winnerId) {
    updatedTournament.isCompleted = true;
    updatedTournament.championId = finalMatch.winnerId;
    const loserId = finalMatch.player1Id === finalMatch.winnerId ? finalMatch.player2Id : finalMatch.player1Id;
    if (loserId) updatedTournament.runnerUpId = loserId;
  }

  return updatedTournament;
}

export function repairSeasonState(season: SeasonState, allPlayers: Player[]): SeasonState {
  const existingMap = new Map<string, Tournament>();
  season.tournaments.forEach((t) => existingMap.set(t.id, t));

  const updatedTournaments: Tournament[] = INITIAL_TOURNAMENTS_SCHEDULE.map((template) => {
    if (existingMap.has(template.id)) {
      return repairTournamentBracket(existingMap.get(template.id)!, allPlayers);
    } else {
      return generateTournamentDraw(template, allPlayers, false);
    }
  });

  return {
    ...season,
    tournaments: updatedTournaments,
  };
}

export function getRoundName(round: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  if (remaining === 1) return 'Финал';
  if (remaining === 2) return '1/2 финала';
  if (remaining === 3) return '1/4 финала';
  if (remaining === 4) return '1/8 финала';
  if (remaining === 5) return '1/16 финала';
  if (remaining === 6) return '1/32 финала';
  return `Раунд ${round + 1}`;
}

export function advanceTournamentMatch(
  tournament: Tournament,
  matchId: string,
  winnerId: string,
  players: Player[]
): { updatedTournament: Tournament; updatedPlayers: Player[] } {
  const updatedTournament = JSON.parse(JSON.stringify(tournament)) as Tournament;
  const match = updatedTournament.matches.find((m) => m.id === matchId);
  if (!match) return { updatedTournament, updatedPlayers: players };

  match.isCompleted = true;
  match.winnerId = winnerId;

  // Propagate to next match
  if (match.nextMatchId) {
    const nextMatch = updatedTournament.matches.find((m) => m.id === match.nextMatchId);
    if (nextMatch) {
      if (match.nextMatchSlot === 1) {
        nextMatch.player1Id = winnerId;
        const winnerObj = players.find((p) => p.id === winnerId);
        if (winnerObj && winnerObj.rank <= 32) nextMatch.seed1 = winnerObj.rank;
      } else {
        nextMatch.player2Id = winnerId;
        const winnerObj = players.find((p) => p.id === winnerId);
        if (winnerObj && winnerObj.rank <= 32) nextMatch.seed2 = winnerObj.rank;
      }
    }
  }

  // Check if final match
  const maxRound = Math.log2(updatedTournament.drawSize) - 1;
  if (match.round === maxRound) {
    updatedTournament.isCompleted = true;
    updatedTournament.championId = winnerId;
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
    if (loserId) updatedTournament.runnerUpId = loserId;
  }

  // Update player form / match records
  const updatedPlayers = players.map((p) => {
    if (p.id === winnerId) {
      return {
        ...p,
        matchesWon: p.matchesWon + 1,
        form: Math.min(1.25, p.form + 0.01),
      };
    }
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
    if (p.id === loserId) {
      return {
        ...p,
        matchesLost: p.matchesLost + 1,
        form: Math.max(0.75, p.form - 0.015),
      };
    }
    return p;
  });

  return { updatedTournament, updatedPlayers };
}

export function finalizeTournamentAndDistributePoints(
  tournament: Tournament,
  players: Player[]
): Player[] {
  const pointsMap = new Map<string, { points: number; prize: number; wonTitle: boolean }>();

  tournament.matches.forEach((m) => {
    if (m.isCompleted && m.player1Id && m.player2Id) {
      const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
      const isWinner = m.winnerId;

      let roundPoints = 0;
      let roundPrize = 0;

      if (m.roundName === 'Финал') {
        if (isWinner) {
          pointsMap.set(isWinner, {
            points: tournament.pointsWinner,
            prize: Math.round(tournament.prizeMoneyPool * 0.22),
            wonTitle: true,
          });
        }
        if (loserId) {
          pointsMap.set(loserId, {
            points: tournament.pointsFinalist,
            prize: Math.round(tournament.prizeMoneyPool * 0.12),
            wonTitle: false,
          });
        }
      } else if (m.roundName === '1/2 финала' && loserId && !pointsMap.has(loserId)) {
        roundPoints = tournament.pointsSemi;
        roundPrize = Math.round(tournament.prizeMoneyPool * 0.06);
        pointsMap.set(loserId, { points: roundPoints, prize: roundPrize, wonTitle: false });
      } else if (m.roundName === '1/4 финала' && loserId && !pointsMap.has(loserId)) {
        roundPoints = tournament.pointsQuarter;
        roundPrize = Math.round(tournament.prizeMoneyPool * 0.035);
        pointsMap.set(loserId, { points: roundPoints, prize: roundPrize, wonTitle: false });
      } else if (m.roundName === '1/8 финала' && loserId && !pointsMap.has(loserId)) {
        roundPoints = tournament.pointsR16;
        roundPrize = Math.round(tournament.prizeMoneyPool * 0.018);
        pointsMap.set(loserId, { points: roundPoints, prize: roundPrize, wonTitle: false });
      } else if (m.roundName === '1/16 финала' && loserId && !pointsMap.has(loserId)) {
        roundPoints = tournament.pointsR32;
        roundPrize = Math.round(tournament.prizeMoneyPool * 0.009);
        pointsMap.set(loserId, { points: roundPoints, prize: roundPrize, wonTitle: false });
      }
    }
  });

  const updatedPlayers = players.map((p) => {
    if (pointsMap.has(p.id)) {
      const award = pointsMap.get(p.id)!;
      return {
        ...p,
        previousPoints: p.points,
        points: p.points + award.points,
        prizeMoney: p.prizeMoney + award.prize,
        titles: award.wonTitle ? p.titles + 1 : p.titles,
        careerTitles: award.wonTitle ? p.careerTitles + 1 : p.careerTitles,
        grandSlams: award.wonTitle && tournament.category === 'Grand Slam' ? p.grandSlams + 1 : p.grandSlams,
      };
    }
    return p;
  });

  return recalculateRankings(updatedPlayers);
}

export function recalculateRankings(players: Player[]): Player[] {
  const atp = players.filter((p) => p.tour === 'ATP' && !p.retired);
  const wta = players.filter((p) => p.tour === 'WTA' && !p.retired);
  const retired = players.filter((p) => p.retired);

  const sortTour = (list: Player[]) => {
    list.sort((a, b) => b.points - a.points || a.rank - b.rank);
    return list.map((p, idx) => ({
      ...p,
      previousRank: p.rank,
      rank: idx + 1,
    }));
  };

  const rankedAtp = sortTour(atp);
  const rankedWta = sortTour(wta);

  return [...rankedAtp, ...rankedWta, ...retired];
}

export function simulateEntireTournament(
  tournament: Tournament,
  players: Player[]
): { completedTournament: Tournament; updatedPlayers: Player[] } {
  let currTournament = JSON.parse(JSON.stringify(tournament)) as Tournament;
  let currPlayers = [...players];

  const totalRounds = Math.log2(currTournament.drawSize);

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = currTournament.matches.filter((m) => m.round === r && !m.isCompleted);
    for (const match of roundMatches) {
      if (match.player1Id && match.player2Id) {
        const p1 = currPlayers.find((p) => p.id === match.player1Id);
        const p2 = currPlayers.find((p) => p.id === match.player2Id);

        if (p1 && p2) {
          const sim = simulateFullMatch(p1, p2, currTournament.surface, currTournament.setsToWin);
          match.score = sim.score;
          const adv = advanceTournamentMatch(currTournament, match.id, sim.winnerId, currPlayers);
          currTournament = adv.updatedTournament;
          currPlayers = adv.updatedPlayers;
        }
      }
    }
  }

  currPlayers = finalizeTournamentAndDistributePoints(currTournament, currPlayers);
  return { completedTournament: currTournament, updatedPlayers: currPlayers };
}
