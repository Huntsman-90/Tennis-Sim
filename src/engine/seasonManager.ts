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

export function getBracketRoundCount(drawSize: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, drawSize))));
}

function getBracketSize(drawSize: number): number {
  return 2 ** getBracketRoundCount(drawSize);
}

export function getStandardBracketSeeding(drawSize: number): number[] {
  const rounds = getBracketRoundCount(drawSize);
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
  // The unfilled seed positions in a non-power-of-two draw become byes.
  return list.map((seed) => seed - 1);
}

function createBracketMatches(
  tournamentId: string,
  drawSize: number,
  seededDraw: Array<Player | undefined>
): Match[] {
  const totalRounds = getBracketRoundCount(drawSize);
  const bracketSize = getBracketSize(drawSize);
  const rounds: Match[][] = [];

  for (let round = 0; round < totalRounds; round++) {
    const matchCount = bracketSize / (2 ** (round + 1));
    const matches = Array.from({ length: matchCount }, (_, index): Match => {
      const match: Match = {
        id: `${tournamentId}-r${round}-m${index}`,
        tournamentId,
        round,
        roundName: getRoundName(round, totalRounds),
        player1Id: null,
        player2Id: null,
        isCompleted: false,
      };
      if (round === 0) {
        const p1 = seededDraw[index * 2];
        const p2 = seededDraw[index * 2 + 1];
        match.player1Id = p1?.id || null;
        match.player2Id = p2?.id || null;
        if (p1 && p1.rank <= 32) match.seed1 = p1.rank;
        if (p2 && p2.rank <= 32) match.seed2 = p2.rank;
      }
      return match;
    });
    rounds.push(matches);
  }

  for (let round = 0; round < totalRounds - 1; round++) {
    rounds[round].forEach((match, index) => {
      match.nextMatchId = rounds[round + 1][Math.floor(index / 2)].id;
      match.nextMatchSlot = index % 2 === 0 ? 1 : 2;
    });
  }
  return rounds.flat();
}

function resolveBracketByes(tournament: Tournament): void {
  const totalRounds = getBracketRoundCount(tournament.drawSize);
  for (let round = 0; round < totalRounds; round++) {
    const matches = tournament.matches.filter((match) => match.round === round);
    for (const match of matches) {
      if (round === 0) {
        if (!match.player1Id || !match.player2Id) {
          match.isCompleted = true;
          match.winnerId = match.player1Id || match.player2Id || undefined;
          match.score = undefined;
        } else if (match.isCompleted && (!match.winnerId || ![match.player1Id, match.player2Id].includes(match.winnerId))) {
          match.isCompleted = false;
          match.winnerId = undefined;
          match.score = undefined;
        }
        continue;
      }

      const childMatches = tournament.matches
        .filter((child) => child.round === round - 1 && child.nextMatchId === match.id)
        .sort((a, b) => (a.nextMatchSlot || 0) - (b.nextMatchSlot || 0));
      if (childMatches.length !== 2) continue;

      const [first, second] = childMatches;
      match.player1Id = first.isCompleted ? first.winnerId || null : null;
      match.player2Id = second.isCompleted ? second.winnerId || null : null;
      match.seed1 = first.isCompleted && first.winnerId === first.player1Id
        ? first.seed1
        : first.isCompleted && first.winnerId === first.player2Id ? first.seed2 : undefined;
      match.seed2 = second.isCompleted && second.winnerId === second.player1Id
        ? second.seed1
        : second.isCompleted && second.winnerId === second.player2Id ? second.seed2 : undefined;

      if (!first.isCompleted || !second.isCompleted) {
        match.isCompleted = false;
        match.winnerId = undefined;
        match.score = undefined;
        continue;
      }

      const participants = [match.player1Id, match.player2Id].filter((id): id is string => Boolean(id));
      if (participants.length < 2) {
        match.isCompleted = true;
        match.winnerId = participants[0];
        match.score = undefined;
      } else if (
        match.isCompleted &&
        (!match.score || !match.winnerId || !participants.includes(match.winnerId))
      ) {
        // A former bye is now a real match after a bracket repair or player fill-in.
        match.isCompleted = false;
        match.winnerId = undefined;
        match.score = undefined;
      }
    }
  }

  const finalMatch = tournament.matches.find((match) => match.round === totalRounds - 1);
  if (finalMatch?.isCompleted && finalMatch.winnerId) {
    tournament.isCompleted = true;
    tournament.championId = finalMatch.winnerId;
    const loserId = finalMatch.player1Id === finalMatch.winnerId ? finalMatch.player2Id : finalMatch.player1Id;
    tournament.runnerUpId = loserId || undefined;
  } else {
    tournament.isCompleted = false;
    tournament.championId = undefined;
    tournament.runnerUpId = undefined;
  }
}

export function generateTournamentDraw(
  template: Omit<Tournament, 'matches' | 'isCompleted' | 'currentRound' | 'championId' | 'runnerUpId'>,
  allPlayers: Player[],
  _isFirst: boolean = false
): Tournament {
  const eligiblePlayers = allPlayers
    .filter((p) => p.tour === template.tour && !p.retired)
    .sort((a, b) => a.rank - b.rank);
  const tournamentPlayers = eligiblePlayers.slice(0, template.drawSize);
  const seededIndices = getStandardBracketSeeding(template.drawSize);
  const seededDraw = new Array<Player | undefined>(getBracketSize(template.drawSize));

  seededIndices.forEach((playerIndex, slot) => {
    seededDraw[slot] = tournamentPlayers[playerIndex];
  });

  const tournament: Tournament = {
    ...template,
    matches: createBracketMatches(template.id, template.drawSize, seededDraw),
    isCompleted: false,
    currentRound: 0,
  };
  resolveBracketByes(tournament);
  return tournament;
}

export function repairTournamentBracket(tournament: Tournament, allPlayers: Player[]): Tournament {
  const totalRounds = getBracketRoundCount(tournament.drawSize);
  const completedFinal = tournament.matches.find((match) => match.round === totalRounds - 1);
  if (
    tournament.isCompleted && completedFinal?.isCompleted && completedFinal.winnerId &&
    [completedFinal.player1Id, completedFinal.player2Id].includes(completedFinal.winnerId)
  ) {
    // Finished tournaments are historical records; ranking changes must not rewrite their draw/results.
    const preserved = JSON.parse(JSON.stringify(tournament)) as Tournament;
    const finalMatch = preserved.matches.find((match) => match.round === totalRounds - 1)!;
    preserved.championId = finalMatch.winnerId;
    preserved.runnerUpId = finalMatch.player1Id === finalMatch.winnerId
      ? finalMatch.player2Id || undefined
      : finalMatch.player1Id || undefined;
    preserved.currentRound = totalRounds;
    return preserved;
  }

  const bracketSize = getBracketSize(tournament.drawSize);
  const hasValidShape = Array.from({ length: totalRounds }, (_, round) => {
    const expectedCount = bracketSize / (2 ** (round + 1));
    return tournament.matches.filter((match) => match.round === round).length === expectedCount;
  }).every(Boolean);
  const oldMatches = new Map(tournament.matches.map((match) => [match.id, match]));
  const repaired = hasValidShape
    ? JSON.parse(JSON.stringify(tournament)) as Tournament
    : generateTournamentDraw(tournament, allPlayers);
  const eligiblePlayers = allPlayers
    .filter((player) => player.tour === repaired.tour && !player.retired)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, repaired.drawSize);
  const eligibleById = new Map(eligiblePlayers.map((player) => [player.id, player]));
  const firstRound = repaired.matches
    .filter((match) => match.round === 0)
    .sort((a, b) => Number(a.id.split('-m').pop()) - Number(b.id.split('-m').pop()));
  const generatedFirstRound = generateTournamentDraw(repaired, allPlayers).matches
    .filter((match) => match.round === 0)
    .sort((a, b) => Number(a.id.split('-m').pop()) - Number(b.id.split('-m').pop()));
  const assigned = new Set<string>();
  let entrantCount = 0;

  // Keep the existing entrants and their positions, but never exceed the tournament's draw size.
  for (const match of firstRound) {
    const oldMatch = oldMatches.get(match.id);
    for (const slot of [1, 2] as const) {
      const playerId = slot === 1 ? oldMatch?.player1Id : oldMatch?.player2Id;
      if (!playerId || !eligibleById.has(playerId) || assigned.has(playerId) || entrantCount >= repaired.drawSize) {
        if (slot === 1) match.player1Id = null;
        else match.player2Id = null;
        continue;
      }
      if (slot === 1) {
        match.player1Id = playerId;
        match.seed1 = oldMatch?.seed1 || eligibleById.get(playerId)?.rank;
      } else {
        match.player2Id = playerId;
        match.seed2 = oldMatch?.seed2 || eligibleById.get(playerId)?.rank;
      }
      assigned.add(playerId);
      entrantCount++;
    }
  }

  // Add eligible players into their seeded positions first; remaining vacancies stay byes.
  for (const generated of generatedFirstRound) {
    const target = firstRound.find((match) => match.id === generated.id);
    if (!target) continue;
    for (const slot of [1, 2] as const) {
      const playerId = slot === 1 ? generated.player1Id : generated.player2Id;
      const isVacant = slot === 1 ? !target.player1Id : !target.player2Id;
      if (!isVacant || !playerId || assigned.has(playerId) || entrantCount >= repaired.drawSize) continue;
      if (slot === 1) {
        target.player1Id = playerId;
        target.seed1 = generated.seed1;
      } else {
        target.player2Id = playerId;
        target.seed2 = generated.seed2;
      }
      assigned.add(playerId);
      entrantCount++;
    }
  }
  for (const player of eligiblePlayers) {
    if (entrantCount >= repaired.drawSize) break;
    if (assigned.has(player.id)) continue;
    const vacant = firstRound.flatMap((match) => [
      { match, slot: 1 as const },
      { match, slot: 2 as const },
    ]).find(({ match, slot }) => slot === 1 ? !match.player1Id : !match.player2Id);
    if (!vacant) break;
    if (vacant.slot === 1) {
      vacant.match.player1Id = player.id;
      vacant.match.seed1 = player.rank;
    } else {
      vacant.match.player2Id = player.id;
      vacant.match.seed2 = player.rank;
    }
    assigned.add(player.id);
    entrantCount++;
  }

  for (let round = 0; round < totalRounds; round++) {
    const matches = repaired.matches.filter((match) => match.round === round)
      .sort((a, b) => Number(a.id.split('-m').pop()) - Number(b.id.split('-m').pop()));
    const nextMatches = repaired.matches.filter((match) => match.round === round + 1)
      .sort((a, b) => Number(a.id.split('-m').pop()) - Number(b.id.split('-m').pop()));
    matches.forEach((match, index) => {
      match.roundName = getRoundName(round, totalRounds);
      match.nextMatchId = round < totalRounds - 1 ? nextMatches[Math.floor(index / 2)]?.id : undefined;
      match.nextMatchSlot = round < totalRounds - 1 ? (index % 2 === 0 ? 1 : 2) : undefined;
      if (round > 0) {
        match.player1Id = null;
        match.player2Id = null;
        match.seed1 = undefined;
        match.seed2 = undefined;
      }
      match.isCompleted = false;
      match.winnerId = undefined;
      match.score = undefined;
    });
  }
  repaired.isCompleted = false;
  repaired.championId = undefined;
  repaired.runnerUpId = undefined;
  repaired.currentRound = 0;

  // Restore results only when the exact participants in that match are unchanged.
  const restoreCompatibleResults = (round: number) => {
    for (const match of repaired.matches.filter((candidate) => candidate.round === round)) {
      const oldMatch = oldMatches.get(match.id);
      if (
        oldMatch?.isCompleted && oldMatch.winnerId &&
        oldMatch.player1Id === match.player1Id && oldMatch.player2Id === match.player2Id &&
        match.player1Id && match.player2Id &&
        (oldMatch.winnerId === match.player1Id || oldMatch.winnerId === match.player2Id)
      ) {
        match.isCompleted = true;
        match.winnerId = oldMatch.winnerId;
        match.score = oldMatch.score;
      }
    }
  };
  restoreCompatibleResults(0);
  resolveBracketByes(repaired);
  for (let round = 1; round < totalRounds; round++) {
    restoreCompatibleResults(round);
    resolveBracketByes(repaired);
  }
  repaired.currentRound = repaired.matches.find((match) => !match.isCompleted)?.round ?? totalRounds;
  return repaired;
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
  if (
    !match || match.isCompleted ||
    (match.player1Id !== winnerId && match.player2Id !== winnerId) ||
    !match.player1Id || !match.player2Id
  ) {
    return { updatedTournament, updatedPlayers: players };
  }

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

  resolveBracketByes(updatedTournament);
  const totalRounds = getBracketRoundCount(updatedTournament.drawSize);
  const nextUnplayedRound = updatedTournament.matches.find((candidate) => !candidate.isCompleted)?.round;
  updatedTournament.currentRound = nextUnplayedRound ?? totalRounds;

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
): { updatedTournament: Tournament; updatedPlayers: Player[] } {
  if (!tournament.isCompleted || tournament.pointsDistributed) {
    return { updatedTournament: tournament, updatedPlayers: players };
  }

  const pointsMap = new Map<string, { points: number; prize: number; wonTitle: boolean }>();

  const totalRounds = getBracketRoundCount(tournament.drawSize);
  const firstRoundPoints: Record<number, number> = {
    2: tournament.pointsSemi,
    3: tournament.pointsQuarter,
    4: tournament.pointsR16,
    5: tournament.pointsR32,
    6: tournament.pointsR64,
    7: tournament.pointsR128,
  };
  const awardByRoundsRemaining: Record<number, { points: number; prizeRate: number }> = {
    2: { points: tournament.pointsSemi, prizeRate: 0.06 },
    3: { points: tournament.pointsQuarter, prizeRate: 0.035 },
    4: { points: tournament.pointsR16, prizeRate: 0.018 },
    5: { points: tournament.pointsR32, prizeRate: 0.009 },
    6: { points: tournament.pointsR64, prizeRate: 0.004 },
    7: { points: tournament.pointsR128, prizeRate: 0.002 },
  };

  tournament.matches.forEach((m) => {
    if (!m.isCompleted || !m.player1Id || !m.player2Id || !m.winnerId) return;
    const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
    if (m.round === totalRounds - 1) {
      pointsMap.set(m.winnerId, {
        points: tournament.pointsWinner,
        prize: Math.round(tournament.prizeMoneyPool * 0.22),
        wonTitle: true,
      });
      pointsMap.set(loserId, {
        points: tournament.pointsFinalist,
        prize: Math.round(tournament.prizeMoneyPool * 0.12),
        wonTitle: false,
      });
      return;
    }

    if (pointsMap.has(loserId)) return;
    const award = awardByRoundsRemaining[totalRounds - m.round];
    if (award) {
      pointsMap.set(loserId, {
        points: award.points,
        prize: Math.round(tournament.prizeMoneyPool * award.prizeRate),
        wonTitle: false,
      });
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
        earnedPoints = firstRoundPoints[totalRounds] || 0;
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

  return {
    updatedTournament: { ...tournament, pointsDistributed: true },
    updatedPlayers: recalculateRankings(updatedPlayers),
  };
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

  const totalRounds = getBracketRoundCount(currTournament.drawSize);

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = currTournament.matches.filter((m) => m.round === r && !m.isCompleted);
    for (const match of roundMatches) {
      if (match.player1Id && match.player2Id) {
        const p1 = currPlayers.find((p) => p.id === match.player1Id);
        const p2 = currPlayers.find((p) => p.id === match.player2Id);

        if (p1 && p2) {
          const sim = simulateFullMatch(p1, p2, currTournament.surface, currTournament.setsToWin);
          const currentMatch = currTournament.matches.find((candidate) => candidate.id === match.id);
          if (currentMatch) currentMatch.score = sim.score;
          const adv = advanceTournamentMatch(currTournament, match.id, sim.winnerId, currPlayers);
          currTournament = adv.updatedTournament;
          currPlayers = adv.updatedPlayers;
        }
      }
    }
  }

  const finalized = finalizeTournamentAndDistributePoints(currTournament, currPlayers);
  return { completedTournament: finalized.updatedTournament, updatedPlayers: finalized.updatedPlayers };
}
