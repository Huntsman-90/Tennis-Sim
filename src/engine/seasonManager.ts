import { INITIAL_TOURNAMENTS_SCHEDULE } from '../data/tournaments';
import { Match, Player, SeasonState, Tournament, TourType, TournamentCategory } from '../types';
import { simulateFullMatch } from './tennisEngine';

export function getTournamentTier(category: TournamentCategory): number {
  if (category === 'Grand Slam' || category === 'ATP Finals' || category === 'WTA Finals') return 1;
  if (category === 'Masters 1000' || category === 'WTA 1000') return 2;
  if (category === 'ATP 500' || category === 'WTA 500') return 3;
  if (category === 'ATP 250' || category === 'WTA 250') return 4;
  if (category === 'W100' || category === 'W75') return 5;
  if (category === 'W50' || category === 'M25') return 6;
  if (category === 'W35') return 7;
  return 8; // M15, W15
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

export function generateTournamentDrawWithPlayers(
  template: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>,
  tournamentPlayers: Player[],
  allPlayers: Player[],
  excludedIds?: Set<string>
): Tournament {
  const drawSize = template.drawSize;
  const numRounds = Math.log2(drawSize);

  // Pad tournamentPlayers if fewer than drawSize
  const filledPlayers = [...tournamentPlayers];
  if (filledPlayers.length < drawSize) {
    const assignedIds = new Set(filledPlayers.map((p) => p.id));
    if (excludedIds) {
      excludedIds.forEach((id) => assignedIds.add(id));
    }
    const backups = allPlayers
      .filter((p) => p.tour === template.tour && !p.retired && !assignedIds.has(p.id))
      .sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < backups.length && filledPlayers.length < drawSize; i++) {
      filledPlayers.push(backups[i]);
      assignedIds.add(backups[i].id);
      if (excludedIds) excludedIds.add(backups[i].id);
    }
  }

  // Sort tournament players by rank so index 0 is top seed
  filledPlayers.sort((a, b) => a.rank - b.rank);

  // Standard Tennis Seeding Placement (Seed 1 top, Seed 2 bottom, etc.)
  const seededIndices = getStandardBracketSeeding(drawSize);
  const seededDraw: Player[] = new Array(drawSize);

  for (let slot = 0; slot < drawSize; slot++) {
    const playerIdx = seededIndices[slot];
    seededDraw[slot] = filledPlayers[playerIdx] || filledPlayers[slot % filledPlayers.length];
  }

  const maxSeeds = drawSize >= 64 ? 32 : drawSize >= 32 ? 16 : 8;

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
        if (p1) {
          const sIndex = filledPlayers.findIndex((p) => p.id === p1.id);
          if (sIndex >= 0 && sIndex < maxSeeds) s1 = sIndex + 1;
        }
        if (p2) {
          const sIndex = filledPlayers.findIndex((p) => p.id === p2.id);
          if (sIndex >= 0 && sIndex < maxSeeds) s2 = sIndex + 1;
        }
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
    isDrawn: true,
  };
}

export function generateTournamentsForWeek(
  weekTemplates: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>[],
  allPlayers: Player[]
): Tournament[] {
  const tourMap = new Map<TourType, typeof weekTemplates>();
  weekTemplates.forEach((t) => {
    if (!tourMap.has(t.tour)) tourMap.set(t.tour, []);
    tourMap.get(t.tour)!.push(t);
  });

  const generatedTournaments: Tournament[] = [];

  tourMap.forEach((groupTemplates, tour) => {
    const eligible = allPlayers
      .filter((p) => p.tour === tour && !p.retired)
      .sort((a, b) => a.rank - b.rank);

    let availablePlayers = [...eligible];
    const weekAssignedIds = new Set<string>();

    const sortedGroup = [...groupTemplates].sort((a, b) => {
      return getTournamentTier(a.category) - getTournamentTier(b.category);
    });

    const tierGroups = new Map<number, typeof sortedGroup>();
    sortedGroup.forEach((t) => {
      const tier = getTournamentTier(t.category);
      if (!tierGroups.has(tier)) tierGroups.set(tier, []);
      tierGroups.get(tier)!.push(t);
    });

    const sortedTiers = Array.from(tierGroups.keys()).sort((a, b) => a - b);

    sortedTiers.forEach((tier) => {
      const tList = tierGroups.get(tier)!;
      if (tList.length === 1) {
        const t = tList[0];
        const assigned = availablePlayers.slice(0, t.drawSize);
        availablePlayers = availablePlayers.slice(t.drawSize);
        assigned.forEach((p) => weekAssignedIds.add(p.id));
        generatedTournaments.push(generateTournamentDrawWithPlayers(t, assigned, allPlayers, weekAssignedIds));
      } else {
        const k = tList.length;
        const totalNeeded = tList.reduce((sum, t) => sum + t.drawSize, 0);
        const tierPlayers = availablePlayers.slice(0, totalNeeded);
        availablePlayers = availablePlayers.slice(totalNeeded);
        tierPlayers.forEach((p) => weekAssignedIds.add(p.id));

        const buckets: Player[][] = Array.from({ length: k }, () => []);
        const capacities = tList.map((t) => t.drawSize);

        for (let i = 0; i < tierPlayers.length; i++) {
          const player = tierPlayers[i];
          const round = Math.floor(i / k);
          const pos = i % k;
          const primaryBucketIdx = (round % 2 === 0) ? pos : (k - 1 - pos);

          if (buckets[primaryBucketIdx].length < capacities[primaryBucketIdx]) {
            buckets[primaryBucketIdx].push(player);
          } else {
            const altIdx = buckets.findIndex((b, idx) => b.length < capacities[idx]);
            if (altIdx >= 0) buckets[altIdx].push(player);
          }
        }

        tList.forEach((t, idx) => {
          generatedTournaments.push(generateTournamentDrawWithPlayers(t, buckets[idx], allPlayers, weekAssignedIds));
        });
      }
    });
  });

  const templateOrder = new Map<string, number>();
  weekTemplates.forEach((t, idx) => templateOrder.set(t.id, idx));

  generatedTournaments.sort((a, b) => {
    return (templateOrder.get(a.id) ?? 0) - (templateOrder.get(b.id) ?? 0);
  });

  return generatedTournaments;
}

export function createSeasonTournaments(
  templates: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>[],
  allPlayers: Player[],
  initialWeek: number = 1
): Tournament[] {
  const week1Templates = templates.filter((t) => t.week === initialWeek);
  const week1Drawn = generateTournamentsForWeek(week1Templates, allPlayers);
  const week1Map = new Map<string, Tournament>();
  week1Drawn.forEach((t) => week1Map.set(t.id, t));

  return templates.map((template) => {
    if (template.week === initialWeek && week1Map.has(template.id)) {
      return week1Map.get(template.id)!;
    }
    return {
      ...template,
      matches: [],
      isCompleted: false,
      currentRound: 0,
      isDrawn: false,
    };
  });
}

export function drawTournamentsForWeek(
  tournaments: Tournament[],
  targetWeek: number,
  allPlayers: Player[]
): Tournament[] {
  const weekTournaments = tournaments.filter((t) => t.week === targetWeek);
  if (weekTournaments.length === 0) return tournaments;

  const alreadyDrawn = weekTournaments.every((t) => t.isDrawn && t.matches.length > 0);
  if (alreadyDrawn) return tournaments;

  const templatesForWeek = INITIAL_TOURNAMENTS_SCHEDULE.filter((t) => t.week === targetWeek);
  const drawn = generateTournamentsForWeek(templatesForWeek, allPlayers);
  const drawnMap = new Map<string, Tournament>();
  drawn.forEach((t) => drawnMap.set(t.id, t));

  return tournaments.map((t) => {
    if (t.week === targetWeek && drawnMap.has(t.id)) {
      return drawnMap.get(t.id)!;
    }
    return t;
  });
}

export function getCurrentActiveWeek(tournaments: Tournament[]): number {
  const uncompleted = tournaments.find((t) => !t.isCompleted);
  return uncompleted ? uncompleted.week : 46;
}

export function getProjectedSeedsForTournament(
  template: Tournament,
  allPlayers: Player[]
): { topSeeds: Player[]; cutoffRank: number } {
  if (!template) {
    return { topSeeds: [], cutoffRank: 100 };
  }

  const eligible = allPlayers
    .filter((p) => p.tour === template.tour && !p.retired)
    .sort((a, b) => a.rank - b.rank);

  const weekTemplates = INITIAL_TOURNAMENTS_SCHEDULE.filter(
    (t) => t.week === template.week && t.tour === template.tour
  );

  const higherTiers = weekTemplates.filter(
    (t) => getTournamentTier(t.category) < getTournamentTier(template.category)
  );
  const higherTierCapacity = higherTiers.reduce((sum, t) => sum + t.drawSize, 0);

  const sameTier = weekTemplates.filter(
    (t) => getTournamentTier(t.category) === getTournamentTier(template.category)
  );

  const pool = eligible.slice(higherTierCapacity);
  const maxSeeds = template.drawSize >= 64 ? 32 : template.drawSize >= 32 ? 16 : 8;

  let projectedTopSeeds: Player[] = [];
  if (sameTier.length > 1) {
    projectedTopSeeds = pool.filter((_, idx) => idx % sameTier.length === 0).slice(0, maxSeeds);
  } else {
    projectedTopSeeds = pool.slice(0, maxSeeds);
  }

  const cutoff = pool[template.drawSize - 1]?.rank || (higherTierCapacity + template.drawSize);

  return {
    topSeeds: projectedTopSeeds,
    cutoffRank: cutoff,
  };
}

export function simulateSeasonUpToWeek(
  season: SeasonState,
  players: Player[],
  targetWeek: number
): { updatedSeason: SeasonState; updatedPlayers: Player[] } {
  let currTournaments = [...season.tournaments];
  let currPlayers = [...players];

  const allWeeks = [...new Set(currTournaments.map((t) => t.week))].sort((a, b) => a - b);

  for (const week of allWeeks) {
    if (week >= targetWeek) break;

    // Ensure week is drawn
    currTournaments = drawTournamentsForWeek(currTournaments, week, currPlayers);

    // Simulate all uncompleted tournaments of this week
    for (let i = 0; i < currTournaments.length; i++) {
      const tourn = currTournaments[i];
      if (tourn.week === week && !tourn.isCompleted) {
        const { completedTournament, updatedPlayers } = simulateEntireTournament(tourn, currPlayers);
        currTournaments[i] = completedTournament;
        currPlayers = finalizeTournamentAndDistributePoints(completedTournament, updatedPlayers);
      }
    }
  }

  // Draw the target week tournaments with the newly earned rankings
  currTournaments = drawTournamentsForWeek(currTournaments, targetWeek, currPlayers);

  // Find the first tournament index of targetWeek
  const targetIdx = currTournaments.findIndex((t) => t.week === targetWeek);

  const updatedSeason: SeasonState = {
    ...season,
    currentTournamentIndex: targetIdx >= 0 ? targetIdx : season.currentTournamentIndex,
    tournaments: currTournaments,
  };

  return { updatedSeason, updatedPlayers: currPlayers };
}

export function generateSeasonTournaments(
  templates: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>[],
  allPlayers: Player[]
): Tournament[] {
  return createSeasonTournaments(templates, allPlayers, 1);
}

export function initializeNewSeason(players: Player[], year: number = 2026): SeasonState {
  const tournaments = createSeasonTournaments(INITIAL_TOURNAMENTS_SCHEDULE, players, 1);

  return {
    year,
    currentTournamentIndex: 0,
    tournaments,
    completedTournaments: [],
    history: [],
  };
}

export function generateTournamentDraw(
  template: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>,
  allPlayers: Player[],
  _isFirst: boolean = false
): Tournament {
  const eligible = allPlayers
    .filter((p) => p.tour === template.tour && !p.retired)
    .sort((a, b) => a.rank - b.rank);
  return generateTournamentDrawWithPlayers(template, eligible.slice(0, template.drawSize), allPlayers);
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
  if (!season.tournaments || season.tournaments.length !== INITIAL_TOURNAMENTS_SCHEDULE.length) {
    const cleanTournaments = createSeasonTournaments(INITIAL_TOURNAMENTS_SCHEDULE, allPlayers, 1);
    return {
      ...season,
      currentTournamentIndex: 0,
      tournaments: cleanTournaments,
    };
  }

  const activeWeek = getCurrentActiveWeek(season.tournaments);

  const existingMap = new Map<string, Tournament>();
  season.tournaments.forEach((t) => existingMap.set(t.id, t));

  let updatedTournaments: Tournament[] = INITIAL_TOURNAMENTS_SCHEDULE.map((template) => {
    const existing = existingMap.get(template.id);
    if (!existing) {
      return {
        ...template,
        matches: [],
        isCompleted: false,
        currentRound: 0,
        isDrawn: false,
      };
    }

    if (existing.week > activeWeek) {
      // Future week: Keep undrawn so it generates dynamically when reached!
      return {
        ...template,
        matches: [],
        isCompleted: false,
        currentRound: 0,
        isDrawn: false,
      };
    }

    // Past or current week: repair if matches exist
    if (existing.matches && existing.matches.length > 0) {
      return {
        ...repairTournamentBracket(existing, allPlayers),
        isDrawn: true,
      };
    }

    return {
      ...existing,
      isDrawn: false,
    };
  });

  // Ensure current active week is drawn
  updatedTournaments = drawTournamentsForWeek(updatedTournaments, activeWeek, allPlayers);

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
      } else if (m.roundName === '1/32 финала' && loserId && !pointsMap.has(loserId)) {
        roundPoints = tournament.pointsR64;
        roundPrize = Math.round(tournament.prizeMoneyPool * 0.004);
        pointsMap.set(loserId, { points: roundPoints, prize: roundPrize, wonTitle: false });
      }
    }
  });

  const updatedPlayers = players.map((p) => {
    if (p.tour !== tournament.tour) return p;

    const tourneyPointsHistory = p.tournamentPoints || {};
    // Defended points = points earned at this specific tournament in the previous season edition
    const defendedPoints = tourneyPointsHistory[tournament.id] || 0;

    let earnedPoints = 0;
    let prize = 0;
    let wonTitle = false;

    if (pointsMap.has(p.id)) {
      const award = pointsMap.get(p.id)!;
      earnedPoints = award.points;
      prize = award.prize;
      wonTitle = award.wonTitle;
    } else {
      const playedInTournament = tournament.matches.some(
        (m) => m.player1Id === p.id || m.player2Id === p.id
      );
      if (playedInTournament) {
        earnedPoints = tournament.pointsR128 || tournament.pointsR64 || 0;
      }
    }

    const updatedTourneyPoints = {
      ...tourneyPointsHistory,
      [tournament.id]: earnedPoints,
    };

    const netPointsChange = earnedPoints - defendedPoints;
    const newPoints = Math.max(0, p.points + netPointsChange);

    return {
      ...p,
      previousPoints: p.points,
      points: newPoints,
      tournamentPoints: updatedTourneyPoints,
      prizeMoney: p.prizeMoney + prize,
      titles: wonTitle ? p.titles + 1 : p.titles,
      careerTitles: wonTitle ? p.careerTitles + 1 : p.careerTitles,
      grandSlams: wonTitle && tournament.category === 'Grand Slam' ? p.grandSlams + 1 : p.grandSlams,
    };
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
