import { ALL_INITIAL_PLAYERS } from '../data/players';
import { getRealTourQualifier } from '../data/realTourQualifiers';
import { getRoundPoints, TOURNAMENT_CALENDAR_2026, TournamentTemplate } from '../data/tournaments';
import {
  Match,
  Player,
  PlayerRankingSnapshot,
  PlayerStats,
  PlayerStyle,
  RetiredPlayer,
  Season,
  SeasonTransitionReport,
  Tournament,
  TournamentCategory,
  TournamentEntryType,
  TournamentWithdrawal,
  TourType,
} from '../types';
import { applyWalkover, createNewMatch, simulateFullMatchInstantly } from './tennisEngine';

export function isMajorTournamentCategory(cat: TournamentCategory): boolean {
  return (
    cat === 'Grand Slam' ||
    cat === 'ATP Masters 1000' ||
    cat === 'WTA 1000' ||
    cat === 'ATP Finals' ||
    cat === 'WTA Finals' ||
    cat === 'ATP 500' ||
    cat === 'WTA 500'
  );
}

export function isTier1MajorCategory(cat: TournamentCategory): boolean {
  return (
    cat === 'Grand Slam' ||
    cat === 'ATP Masters 1000' ||
    cat === 'WTA 1000' ||
    cat === 'ATP Finals' ||
    cat === 'WTA Finals'
  );
}

/**
 * Fills any shortfall in a draw with authentic real professional tour players (rankings #65 to #1500+).
 * Guaranteed: Real names, real countries/flags, realistic playing styles, and distinct IDs.
 */
function fillWithUniqueQualifiers(
  drawPlayers: Player[],
  template: TournamentTemplate,
  year: number,
  requiredSize: number,
  weekUsedNamesOrIds?: Set<string>
) {
  const usedNamesOrIds = weekUsedNamesOrIds || new Set<string>();
  drawPlayers.forEach(p => {
    usedNamesOrIds.add(p.id.toLowerCase());
    usedNamesOrIds.add(p.name.toLowerCase());
    if (p.nameEn) usedNamesOrIds.add(p.nameEn.toLowerCase());
  });

  let qNum = 1;
  while (drawPlayers.length < requiredSize) {
    const cleanCity = template.city.toLowerCase().replace(/[^a-z0-9]/g, '');
    const realPlayer = getRealTourQualifier(
      template.tour,
      `${cleanCity}_w${template.week}_${year}_${qNum}`,
      qNum + 10,
      usedNamesOrIds
    );
    const uniqueId = `real_qual_${template.tour.toLowerCase()}_w${template.week}_${cleanCity}_${realPlayer.id}_${qNum}`;
    const qualifierPlayer: Player = {
      ...realPlayer,
      id: uniqueId,
      favSurface: template.surface,
    };
    drawPlayers.push(qualifierPlayer);
    usedNamesOrIds.add(uniqueId.toLowerCase());
    usedNamesOrIds.add(qualifierPlayer.name.toLowerCase());
    if (qualifierPlayer.nameEn) usedNamesOrIds.add(qualifierPlayer.nameEn.toLowerCase());
    qNum++;
  }
}

/**
 * Distributes players among tournaments of the same tour occurring in the exact same week.
 * Guaranteed invariant: Every player returned in any tournament draw is strictly unique for this week.
 * No player can appear in more than one tournament in that week.
 */
function allocateTourPlayersForWeek(
  tourTemplates: TournamentTemplate[],
  tourPlayers: Player[],
  year: number
): Map<TournamentTemplate, Player[]> {
  const result = new Map<TournamentTemplate, Player[]>();
  if (tourTemplates.length === 0) return result;

  // Track player IDs and Names already committed to any tournament in this week
  const usedPlayerIdsInWeek = new Set<string>();
  const usedPlayerNamesInWeek = new Set<string>();

  const markUsedInWeek = (p: Player) => {
    usedPlayerIdsInWeek.add(p.id.toLowerCase());
    usedPlayerNamesInWeek.add(p.name.toLowerCase());
    if (p.nameEn) usedPlayerNamesInWeek.add(p.nameEn.toLowerCase());
  };

  const isPlayerUsedInWeek = (p: Player): boolean => {
    return (
      usedPlayerIdsInWeek.has(p.id.toLowerCase()) ||
      usedPlayerNamesInWeek.has(p.name.toLowerCase()) ||
      (!!p.nameEn && usedPlayerNamesInWeek.has(p.nameEn.toLowerCase()))
    );
  };

  // Sort available players by ranking (rank 1, 2, 3...)
  const sortedPlayers = [...tourPlayers].sort((a, b) => a.rank - b.rank);

  if (tourTemplates.length === 1) {
    const tpl = tourTemplates[0];
    const needed = tpl.drawSize === 8 ? 8 : 36;
    const selected: Player[] = [];

    for (const p of sortedPlayers) {
      if (selected.length >= needed) break;
      if (!isPlayerUsedInWeek(p)) {
        selected.push(p);
        markUsedInWeek(p);
      }
    }
    fillWithUniqueQualifiers(selected, tpl, year, needed, usedPlayerNamesInWeek);
    result.set(tpl, selected);
    return result;
  }

  // Multiple tournaments of the same tour in the same week!
  const categoryPriority: Record<string, number> = {
    'Grand Slam': 1,
    'ATP Finals': 1,
    'WTA Finals': 1,
    'ATP Masters 1000': 2,
    'WTA 1000': 2,
    'ATP 500': 3,
    'WTA 500': 3,
    'ATP 250': 4,
    'WTA 250': 4,
  };

  // Group tournaments by category priority
  const sortedTpls = [...tourTemplates].sort((a, b) => {
    const pA = categoryPriority[a.category] || 99;
    const pB = categoryPriority[b.category] || 99;
    return pA - pB;
  });

  const draws = new Map<TournamentTemplate, Player[]>();
  sortedTpls.forEach(t => draws.set(t, []));

  const isDifferentTiers = sortedTpls.some(t => t.category !== sortedTpls[0].category);

  if (isDifferentTiers) {
    // E.g. ATP 500 & ATP 250, or WTA 500 & WTA 250
    const higherTierTpls = sortedTpls.filter(
      t => categoryPriority[t.category] === categoryPriority[sortedTpls[0].category]
    );
    const lowerTierTpls = sortedTpls.filter(
      t => categoryPriority[t.category] > categoryPriority[sortedTpls[0].category]
    );

    let playerIdx = 0;

    // Top seeds: higher tier tournaments get top seeds first
    for (let s = 0; s < 8; s++) {
      for (const tpl of higherTierTpls) {
        while (playerIdx < sortedPlayers.length && isPlayerUsedInWeek(sortedPlayers[playerIdx])) {
          playerIdx++;
        }
        if (playerIdx < sortedPlayers.length) {
          const p = sortedPlayers[playerIdx++];
          draws.get(tpl)!.push(p);
          markUsedInWeek(p);
        }
      }
    }

    // Lower tier tournaments get their seeds from the remaining top pool
    for (let s = 0; s < 8; s++) {
      for (const tpl of lowerTierTpls) {
        while (playerIdx < sortedPlayers.length && isPlayerUsedInWeek(sortedPlayers[playerIdx])) {
          playerIdx++;
        }
        if (playerIdx < sortedPlayers.length) {
          const p = sortedPlayers[playerIdx++];
          draws.get(tpl)!.push(p);
          markUsedInWeek(p);
        }
      }
    }

    // Distribute remaining available players round-robin across all tournaments
    const roundRobinTpls = [...higherTierTpls, ...lowerTierTpls];
    let safetyCounter = 0;
    while (playerIdx < sortedPlayers.length && safetyCounter < 300) {
      safetyCounter++;
      let anyAdded = false;
      for (const tpl of roundRobinTpls) {
        const currentList = draws.get(tpl)!;
        const needed = tpl.drawSize === 8 ? 8 : 36;
        if (currentList.length < needed) {
          while (playerIdx < sortedPlayers.length && isPlayerUsedInWeek(sortedPlayers[playerIdx])) {
            playerIdx++;
          }
          if (playerIdx < sortedPlayers.length) {
            const p = sortedPlayers[playerIdx++];
            currentList.push(p);
            markUsedInWeek(p);
            anyAdded = true;
          }
        }
      }
      if (!anyAdded) break;
    }
  } else {
    // Equal categories (e.g. Brisbane 250 & Hong Kong 250; or Adelaide 250 & Auckland 250)
    // Distribute seeds and players round-robin so both tournaments have strong fields and NO duplicates
    let playerIdx = 0;
    let safetyCounter = 0;
    while (playerIdx < sortedPlayers.length && safetyCounter < 300) {
      safetyCounter++;
      let anyAdded = false;
      for (const tpl of sortedTpls) {
        const currentList = draws.get(tpl)!;
        const needed = tpl.drawSize === 8 ? 8 : 36;
        if (currentList.length < needed) {
          while (playerIdx < sortedPlayers.length && isPlayerUsedInWeek(sortedPlayers[playerIdx])) {
            playerIdx++;
          }
          if (playerIdx < sortedPlayers.length) {
            const p = sortedPlayers[playerIdx++];
            currentList.push(p);
            markUsedInWeek(p);
            anyAdded = true;
          }
        }
      }
      if (!anyAdded) break;
    }
  }

  // Ensure each draw has requiredSize and fill any shortfall with tournament-specific unique qualifiers
  for (const tpl of tourTemplates) {
    const list = draws.get(tpl)!;
    const needed = tpl.drawSize === 8 ? 8 : 36;
    fillWithUniqueQualifiers(list, tpl, year, needed, usedPlayerNamesInWeek);
    result.set(tpl, list);
  }

  return result;
}

export function createTournamentDraw(
  template: TournamentTemplate,
  year: number,
  drawPlayers: Player[]
): Tournament {
  // Sort draw players strictly by current ranking so top seeds are properly seeded (rank 1 is best)
  const sortedDraw = [...drawPlayers].sort((a, b) => a.rank - b.rank);

  const tournamentId = `trn_${template.tour.toLowerCase()}_${template.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${year}`;
  const initialRound = template.drawSize === 8 ? 'QF' : 'R32';
  const matches: Match[] = [];
  let qualifyingMatches: Match[] = [];
  let luckyLosersPool: Player[] = [];
  const withdrawals: TournamentWithdrawal[] = [];

  // Real Tennis Seeded bracket pairings:
  if (initialRound === 'QF') {
    // 8-player draw (e.g. ATP Finals / WTA Finals):
    // Real Tennis Seeding:
    // Match 0: [1] vs [8] (Winner feeds SF 1)
    // Match 1: [4] vs [5] (Winner feeds SF 1)
    // Match 2: [3] vs [6] (Winner feeds SF 2)
    // Match 3: [2] vs [7] (Winner feeds SF 2)
    const qfSeedsLayout = [
      { p1SeedIdx: 0, p1SeedNum: 1, p2SeedIdx: 7, p2SeedNum: 8 },
      { p1SeedIdx: 3, p1SeedNum: 4, p2SeedIdx: 4, p2SeedNum: 5 },
      { p1SeedIdx: 2, p1SeedNum: 3, p2SeedIdx: 5, p2SeedNum: 6 },
      { p1SeedIdx: 1, p1SeedNum: 2, p2SeedIdx: 6, p2SeedNum: 7 },
    ];
    for (const item of qfSeedsLayout) {
      if (sortedDraw[item.p1SeedIdx] && sortedDraw[item.p2SeedIdx]) {
        matches.push(
          createNewMatch(
            tournamentId,
            'QF',
            sortedDraw[item.p1SeedIdx],
            sortedDraw[item.p2SeedIdx],
            item.p1SeedNum,
            item.p2SeedNum,
            'SEED',
            'SEED'
          )
        );
      }
    }
  } else {
    // 32-player draw with Qualification Pre-generation:
    // Top 16 players: seeds [1] to [16]
    // Next 12 players: Direct Acceptances (DA)
    // Next 8 players (indices 28-35): 8 Qualifying participants playing 4 Q-Finals!
    const seeds = sortedDraw.slice(0, 16);
    const directAcceptances = sortedDraw.slice(16, 28);
    const initialCandidates = sortedDraw.slice(28, 36);

    const usedQualNames = new Set<string>();
    sortedDraw.slice(0, 28).forEach(p => {
      usedQualNames.add(p.id.toLowerCase());
      usedQualNames.add(p.name.toLowerCase());
      if (p.nameEn) usedQualNames.add(p.nameEn.toLowerCase());
    });

    // Ensure 8 strictly unique qualifying candidates:
    const qualifyingCandidates: Player[] = [];
    const seenCandidateNames = new Set<string>();

    for (const cand of initialCandidates) {
      const lower = cand.name.toLowerCase();
      if (!usedQualNames.has(lower) && !seenCandidateNames.has(lower)) {
        seenCandidateNames.add(lower);
        usedQualNames.add(lower);
        usedQualNames.add(cand.id.toLowerCase());
        qualifyingCandidates.push(cand);
      }
    }

    let qIdx = qualifyingCandidates.length + 1;
    while (qualifyingCandidates.length < 8) {
      const realPlayer = getRealTourQualifier(
        template.tour,
        `${tournamentId}_qcand_${qIdx}`,
        qIdx + 15,
        usedQualNames
      );
      const uniqueId = `real_cand_${template.tour.toLowerCase()}_${tournamentId}_${realPlayer.id}_${qIdx}`;
      const candPlayer: Player = {
        ...realPlayer,
        id: uniqueId,
        favSurface: template.surface,
      };
      usedQualNames.add(uniqueId.toLowerCase());
      usedQualNames.add(candPlayer.name.toLowerCase());
      if (candPlayer.nameEn) usedQualNames.add(candPlayer.nameEn.toLowerCase());
      qualifyingCandidates.push(candPlayer);
      qIdx++;
    }

    // Pre-generate the 4 Qualification matches (Q-Finals)
    const qPairings = [
      { p1Idx: 0, p2Idx: 7, qSeed1: 1, qSeed2: 8 },
      { p1Idx: 3, p2Idx: 4, qSeed1: 4, qSeed2: 5 },
      { p1Idx: 2, p2Idx: 5, qSeed1: 3, qSeed2: 6 },
      { p1Idx: 1, p2Idx: 6, qSeed1: 2, qSeed2: 7 },
    ];

    const qualifiers: Player[] = [];
    const llCandidates: Player[] = [];

    for (let q = 0; q < qPairings.length; q++) {
      const pair = qPairings[q];
      let p1 = qualifyingCandidates[pair.p1Idx];
      let p2 = qualifyingCandidates[pair.p2Idx];

      // Absolute safety invariant: p1 and p2 can NEVER be the same person!
      if (p1.id === p2.id || p1.name.toLowerCase() === p2.name.toLowerCase()) {
        const fresh = getRealTourQualifier(
          template.tour,
          `${tournamentId}_pair_repair_${q}`,
          q + 45,
          usedQualNames
        );
        p2 = {
          ...fresh,
          id: `real_cand_fix_${template.tour.toLowerCase()}_${tournamentId}_${fresh.id}_${q}`,
          favSurface: template.surface,
        };
        qualifyingCandidates[pair.p2Idx] = p2;
      }

      const qMatch = createNewMatch(
        `${tournamentId}_qual`,
        `Q-Final ${q + 1}`,
        p1,
        p2,
        pair.qSeed1,
        pair.qSeed2,
        'Q',
        'Q'
      );
      // Pre-simulate qualification instantly!
      const simMatch = simulateFullMatchInstantly(qMatch, template.surface);
      qualifyingMatches.push(simMatch);

      const qWinner = simMatch.winnerId === p1.id ? p1 : p2;
      const qLoser = simMatch.winnerId === p1.id ? p2 : p1;
      qualifiers.push(qWinner);
      llCandidates.push(qLoser);
    }

    // Lucky Losers pool is sorted by rank (best rank is LL #1)
    luckyLosersPool = [...llCandidates].sort((a, b) => a.rank - b.rank);

    // Assemble the 16 unseeded spots for R32:
    // 12 Direct Acceptances and 4 Qualifiers [Q]
    // Standard Grand Slam / ATP draw distributes Qualifiers at slots [3, 7, 11, 15]
    const unseededDraw: { player: Player; entryType: TournamentEntryType }[] = [];
    let daIdx = 0;
    let qualIdx = 0;
    for (let i = 0; i < 16; i++) {
      if (i === 3 || i === 7 || i === 11 || i === 15) {
        unseededDraw.push({
          player: qualifiers[qualIdx++] || directAcceptances[daIdx++],
          entryType: 'Q',
        });
      } else {
        unseededDraw.push({
          player: directAcceptances[daIdx++] || qualifiers[qualIdx++],
          entryType: 'DA',
        });
      }
    }

    // Official 16-match bracket layout:
    const r32SeedsLayout = [
      { seedIdx: 0, seedNum: 1, seedIsP1: true, unseededIdx: 0 },
      { seedIdx: 15, seedNum: 16, seedIsP1: false, unseededIdx: 1 },
      { seedIdx: 8, seedNum: 9, seedIsP1: true, unseededIdx: 2 },
      { seedIdx: 7, seedNum: 8, seedIsP1: false, unseededIdx: 3 },

      { seedIdx: 3, seedNum: 4, seedIsP1: true, unseededIdx: 4 },
      { seedIdx: 12, seedNum: 13, seedIsP1: false, unseededIdx: 5 },
      { seedIdx: 11, seedNum: 12, seedIsP1: true, unseededIdx: 6 },
      { seedIdx: 4, seedNum: 5, seedIsP1: false, unseededIdx: 7 },

      { seedIdx: 5, seedNum: 6, seedIsP1: true, unseededIdx: 8 },
      { seedIdx: 10, seedNum: 11, seedIsP1: false, unseededIdx: 9 },
      { seedIdx: 13, seedNum: 14, seedIsP1: true, unseededIdx: 10 },
      { seedIdx: 2, seedNum: 3, seedIsP1: false, unseededIdx: 11 },

      { seedIdx: 6, seedNum: 7, seedIsP1: true, unseededIdx: 12 },
      { seedIdx: 9, seedNum: 10, seedIsP1: false, unseededIdx: 13 },
      { seedIdx: 14, seedNum: 15, seedIsP1: true, unseededIdx: 14 },
      { seedIdx: 1, seedNum: 2, seedIsP1: false, unseededIdx: 15 },
    ];

    for (const item of r32SeedsLayout) {
      const seedPlayer = seeds[item.seedIdx] || sortedDraw[item.seedIdx];
      const opponent = unseededDraw[item.unseededIdx] || { player: sortedDraw[16 + (item.unseededIdx % 16)], entryType: 'DA' as TournamentEntryType };
      const p1 = item.seedIsP1 ? seedPlayer : opponent.player;
      const p2 = item.seedIsP1 ? opponent.player : seedPlayer;
      const p1Seed = item.seedIsP1 ? item.seedNum : undefined;
      const p2Seed = !item.seedIsP1 ? item.seedNum : undefined;
      const p1EntryType: TournamentEntryType = item.seedIsP1 ? 'SEED' : opponent.entryType;
      const p2EntryType: TournamentEntryType = !item.seedIsP1 ? 'SEED' : opponent.entryType;

      matches.push(createNewMatch(tournamentId, 'R32', p1, p2, p1Seed, p2Seed, p1EntryType, p2EntryType));
    }

    // Check for Pre-tournament Withdrawals:
    // If an entered player is injured, has extreme fatigue (>=80%), or gets a pre-tournament withdrawal roll (~4%),
    // they withdraw prior to the start of the tournament and are replaced by a Lucky Loser [LL] from the qualification!
    for (const m of matches) {
      for (const slot of ['p1', 'p2'] as const) {
        const player = slot === 'p1' ? m.player1 : m.player2;
        const currentEntry = slot === 'p1' ? m.p1EntryType : m.p2EntryType;
        if (currentEntry === 'Q' || currentEntry === 'LL') continue;

        const hasInjury = !!player.injury;
        const hasCriticalFatigue = (player.fatigue || 0) >= 80;
        const withdrawalRoll = Math.random() < 0.035;

        if ((hasInjury || hasCriticalFatigue || withdrawalRoll) && luckyLosersPool.length > 0) {
          const luckyLoser = luckyLosersPool.shift()!;
          const reasons = [
            'Растяжение мышц бедра на тренировке',
            'Воспаление сухожилия правого плеча',
            'Острая вирусная инфекция и температура',
            'Мышечное истощение после затяжного финала',
            'Спазм мышц поясницы',
          ];
          const reason = player.injury
            ? `${player.injury.type} (${player.injury.severity === 'severe' ? 'Тяжелая травма' : player.injury.severity === 'moderate' ? 'Травма средней тяжести' : 'Легкое повреждение'})`
            : hasCriticalFatigue
            ? 'Переутомление после серии тяжелых турниров'
            : reasons[Math.floor(Math.random() * reasons.length)];

          withdrawals.push({
            originalPlayerId: player.id,
            originalPlayerName: player.name,
            originalPlayerFlag: player.flag,
            reason,
            replacementPlayerId: luckyLoser.id,
            replacementPlayerName: luckyLoser.name,
            replacementPlayerFlag: luckyLoser.flag,
            type: 'LL',
            roundName: 'R32',
            withdrawnAt: Date.now(),
          });

          // Rest recovering player
          if (!player.injury) {
            player.fatigue = Math.max(0, (player.fatigue || 0) - 25);
          }

          if (slot === 'p1') {
            m.player1 = luckyLoser;
            m.p1Seed = undefined;
            m.p1EntryType = 'LL';
          } else {
            m.player2 = luckyLoser;
            m.p2Seed = undefined;
            m.p2EntryType = 'LL';
          }
        }
      }
    }
  }

  return {
    id: tournamentId,
    name: template.name,
    nameRu: template.nameRu,
    tour: template.tour,
    city: template.city,
    country: template.country,
    flag: template.flag,
    surface: template.surface,
    category: template.category,
    drawSize: template.drawSize,
    pointsWinner: template.pointsWinner,
    week: template.week,
    month: template.month,
    dates: template.dates,
    completed: false,
    matches,
    currentRound: initialRound,
    qualifyingMatches,
    qualifyingCompleted: qualifyingMatches.length > 0,
    luckyLosersPool,
    withdrawals,
  };
}

/**
 * Creates all season tournaments guaranteeing that across each individual week,
 * NO player (ATP or WTA) appears in more than one tournament.
 */
export function createSeasonTournaments(
  templates: TournamentTemplate[],
  year: number,
  allPlayers: Player[]
): Tournament[] {
  const weekMap = new Map<number, TournamentTemplate[]>();
  templates.forEach(t => {
    if (!weekMap.has(t.week)) {
      weekMap.set(t.week, []);
    }
    weekMap.get(t.week)!.push(t);
  });

  const tournaments: Tournament[] = [];
  const weeks = Array.from(weekMap.keys()).sort((a, b) => a - b);

  for (const w of weeks) {
    const weekTemplates = weekMap.get(w)!;
    const atpTemplates = weekTemplates.filter(t => t.tour === 'ATP');
    const wtaTemplates = weekTemplates.filter(t => t.tour === 'WTA');

    const atpAllocations = allocateTourPlayersForWeek(
      atpTemplates,
      allPlayers.filter(p => p.tour === 'ATP'),
      year
    );
    const wtaAllocations = allocateTourPlayersForWeek(
      wtaTemplates,
      allPlayers.filter(p => p.tour === 'WTA'),
      year
    );

    // Keep chronological tournament order within the week so tournaments are played strictly sequentially
    for (const tpl of weekTemplates) {
      const allocatedPlayers =
        (tpl.tour === 'ATP' ? atpAllocations.get(tpl) : wtaAllocations.get(tpl)) || [];
      tournaments.push(createTournamentDraw(tpl, year, allocatedPlayers));
    }
  }

  return tournaments;
}

/**
 * Accurate count of all completed matches across the entire season.
 */
export function countSeasonCompletedMatches(season: Season): number {
  if (!season || !Array.isArray(season.tournaments)) return 0;
  let count = 0;
  for (const t of season.tournaments) {
    if (Array.isArray(t.matches)) {
      for (const m of t.matches) {
        if (m && m.isCompleted) count++;
      }
    }
  }
  return count;
}

/**
 * Strict invariant enforcer:
 * 1. No player ever plays against themselves (p1.id !== p2.id && p1.name !== p2.name).
 * 2. No player appears in more than one tournament in the same week.
 * 3. Legitimate qualifiers [Q] are allowed in both their qualification match and their main draw slot.
 * 4. Completed matches are historical facts and NEVER mutated or altered!
 * Automatically repairs any corrupted unplayed matches/draws in-place and returns true if changes were made.
 */
export function deduplicateWeeklySeasonDraws(season: Season): boolean {
  if (!season || !Array.isArray(season.tournaments)) return false;

  let changesMade = false;
  const weekMap = new Map<number, Tournament[]>();
  for (const t of season.tournaments) {
    if (!weekMap.has(t.week)) weekMap.set(t.week, []);
    weekMap.get(t.week)!.push(t);
  }

  for (const [weekNum, tourns] of weekMap.entries()) {
    for (const tourType of ['ATP', 'WTA'] as TourType[]) {
      const tourTourns = tourns.filter(t => t.tour === tourType);
      if (tourTourns.length === 0) continue;

      const weekSeenNames = new Set<string>();
      const weekSeenIds = new Set<string>();

      let repairCounter = 1;
      const isPlaceholder = (p?: Player | null): boolean => {
        if (!p || !p.name) return true;
        const name = p.name.trim();
        return (
          name.length < 3 ||
          /(Игрок Тура|Игрок|Tour Player|Unknown|Кандидат|Квалификант|Candidate|Qualifier|player_unknown)/i.test(name) ||
          p.country === 'Тур' ||
          p.flag === '🎾' ||
          p.id === 'player_unknown'
        );
      };

      const getUniqueRepairPlayer = (context: string, surface: string): Player => {
        const seedStr = `rep_w${weekNum}_${context}_${repairCounter}`;
        const p = getRealTourQualifier(tourType, seedStr, repairCounter * 11, weekSeenNames);
        const uniqueId = `repaired_${tourType.toLowerCase()}_w${weekNum}_${p.id}_${repairCounter}`;
        repairCounter++;
        weekSeenNames.add(p.name.toLowerCase());
        weekSeenIds.add(uniqueId.toLowerCase());
        return {
          ...p,
          id: uniqueId,
          favSurface: surface,
        };
      };

      // Pass 1: Register all main-draw players from initial rounds (R32 or QF for 8-draw)
      for (const t of tourTourns) {
        if (Array.isArray(t.matches)) {
          for (let i = 0; i < t.matches.length; i++) {
            const m = t.matches[i];
            if (!m.player1 || !m.player2) continue;

            // Fix any placeholder player in player1 or player2
            if (isPlaceholder(m.player1)) {
              const oldId = m.player1.id;
              const freshP1 = getUniqueRepairPlayer(`main_placeholder_p1_${t.id}_${i}`, t.surface);
              m.player1 = freshP1;
              if (m.winnerId === oldId) m.winnerId = freshP1.id;
              if (t.winnerPlayerId === oldId) t.winnerPlayerId = freshP1.id;
              changesMade = true;
            }
            if (isPlaceholder(m.player2)) {
              const oldId = m.player2.id;
              const freshP2 = getUniqueRepairPlayer(`main_placeholder_p2_${t.id}_${i}`, t.surface);
              m.player2 = freshP2;
              if (m.winnerId === oldId) m.winnerId = freshP2.id;
              if (t.winnerPlayerId === oldId) t.winnerPlayerId = freshP2.id;
              changesMade = true;
            }

            const isInitialRound = m.roundName === 'R32' || (t.drawSize === 8 && m.roundName === 'QF');
            if (!isInitialRound) continue;

            // Never mutate completed matches - they are historical record
            if (m.isCompleted) {
              weekSeenNames.add(m.player1.name.toLowerCase());
              weekSeenIds.add(m.player1.id.toLowerCase());
              weekSeenNames.add(m.player2.name.toLowerCase());
              weekSeenIds.add(m.player2.id.toLowerCase());
              continue;
            }

            // Self match check in unplayed main draw match
            if (
              m.player1.id === m.player2.id ||
              m.player1.name.toLowerCase() === m.player2.name.toLowerCase()
            ) {
              const freshP2 = getUniqueRepairPlayer(`main_self_${t.id}_${i}`, t.surface);
              m.player2 = freshP2;
              changesMade = true;
            }

            if (m.player1) {
              const p1Name = m.player1.name.toLowerCase();
              // Qualifiers legitimately belong in the tournament's qualifying and main draw
              if (m.p1EntryType !== 'Q' && weekSeenNames.has(p1Name)) {
                const freshP1 = getUniqueRepairPlayer(`main_dup_p1_${t.id}_${i}`, t.surface);
                m.player1 = freshP1;
                changesMade = true;
              } else {
                weekSeenNames.add(p1Name);
                weekSeenIds.add(m.player1.id.toLowerCase());
              }
            }

            if (m.player2) {
              const p2Name = m.player2.name.toLowerCase();
              if (m.p2EntryType !== 'Q' && weekSeenNames.has(p2Name)) {
                const freshP2 = getUniqueRepairPlayer(`main_dup_p2_${t.id}_${i}`, t.surface);
                m.player2 = freshP2;
                changesMade = true;
              } else {
                weekSeenNames.add(p2Name);
                weekSeenIds.add(m.player2.id.toLowerCase());
              }
            }
          }
        }
      }

      // Pass 2: Repair Qualifying Matches
      for (const t of tourTourns) {
        // Collect names of qualifiers who advanced to this tournament's main draw
        const ownTournamentQualifierNames = new Set<string>();
        if (Array.isArray(t.matches)) {
          for (const m of t.matches) {
            if (m.p1EntryType === 'Q' && m.player1) {
              ownTournamentQualifierNames.add(m.player1.name.toLowerCase());
            }
            if (m.p2EntryType === 'Q' && m.player2) {
              ownTournamentQualifierNames.add(m.player2.name.toLowerCase());
            }
          }
        }

        if (Array.isArray(t.qualifyingMatches)) {
          for (let i = 0; i < t.qualifyingMatches.length; i++) {
            const m = t.qualifyingMatches[i];
            if (!m.player1 || !m.player2) continue;

            // Fix any placeholder player in qualification matches
            if (isPlaceholder(m.player1)) {
              const oldId = m.player1.id;
              const freshP1 = getUniqueRepairPlayer(`qm_placeholder_p1_${t.id}_${i}`, t.surface);
              m.player1 = freshP1;
              if (m.winnerId === oldId) m.winnerId = freshP1.id;
              changesMade = true;
            }
            if (isPlaceholder(m.player2)) {
              const oldId = m.player2.id;
              const freshP2 = getUniqueRepairPlayer(`qm_placeholder_p2_${t.id}_${i}`, t.surface);
              m.player2 = freshP2;
              if (m.winnerId === oldId) m.winnerId = freshP2.id;
              changesMade = true;
            }

            // Never mutate completed qualification matches
            if (m.isCompleted) {
              weekSeenNames.add(m.player1.name.toLowerCase());
              weekSeenIds.add(m.player1.id.toLowerCase());
              weekSeenNames.add(m.player2.name.toLowerCase());
              weekSeenIds.add(m.player2.id.toLowerCase());
              continue;
            }

            let p1Name = m.player1.name.toLowerCase();
            let p2Name = m.player2.name.toLowerCase();

            // Self-match check
            if (p1Name === p2Name || m.player1.id === m.player2.id) {
              const freshP2 = getUniqueRepairPlayer(`qm_self_${t.id}_${i}`, t.surface);
              m.player2 = freshP2;
              p2Name = freshP2.name.toLowerCase();
              changesMade = true;
            }

            // If player 1 is in another tournament in the same week (and not their own qualifier slot)
            if (weekSeenNames.has(p1Name) && !ownTournamentQualifierNames.has(p1Name)) {
              const freshP1 = getUniqueRepairPlayer(`qm_dup_p1_${t.id}_${i}`, t.surface);
              m.player1 = freshP1;
              p1Name = freshP1.name.toLowerCase();
              changesMade = true;
            } else {
              weekSeenNames.add(p1Name);
              weekSeenIds.add(m.player1.id.toLowerCase());
            }

            // If player 2 is in another tournament in the same week
            if (weekSeenNames.has(p2Name) && !ownTournamentQualifierNames.has(p2Name)) {
              const freshP2 = getUniqueRepairPlayer(`qm_dup_p2_${t.id}_${i}`, t.surface);
              m.player2 = freshP2;
              p2Name = freshP2.name.toLowerCase();
              changesMade = true;
            } else {
              weekSeenNames.add(p2Name);
              weekSeenIds.add(m.player2.id.toLowerCase());
            }
          }
        }

        // Pass 3: Ensure luckyLosersPool has distinct names and no placeholders
        if (Array.isArray(t.luckyLosersPool)) {
          const uniqueLL: Player[] = [];
          const seenLL = new Set<string>();
          for (let li = 0; li < t.luckyLosersPool.length; li++) {
            let p = t.luckyLosersPool[li];
            if (!p || isPlaceholder(p)) {
              p = getUniqueRepairPlayer(`ll_rep_${t.id}_${li}`, t.surface);
              changesMade = true;
            }
            if (!seenLL.has(p.name.toLowerCase())) {
              seenLL.add(p.name.toLowerCase());
              uniqueLL.push(p);
            } else {
              changesMade = true;
            }
          }
          t.luckyLosersPool = uniqueLL;
        }
      }
    }
  }

  return changesMade;
}

export function createInitialSeason(year = 2026, existingPlayers?: Player[]): Season {
  const players = existingPlayers && existingPlayers.length > 0 ? existingPlayers : ALL_INITIAL_PLAYERS;
  const tournaments = createSeasonTournaments(TOURNAMENT_CALENDAR_2026, year, players);

  const season: Season = {
    year,
    tournaments,
    currentTournamentIndex: 0,
    isCompleted: false,
    totalMatchesSimulated: 0,
  };
  deduplicateWeeklySeasonDraws(season);
  return season;
}

// Advances the bracket to the next round if all matches in current round are complete
export function advanceTournamentRound(tournament: Tournament): boolean {
  const roundOrder = ['R32', 'R16', 'QF', 'SF', 'F'];
  const curIdx = roundOrder.indexOf(tournament.currentRound);
  if (curIdx === -1 || curIdx === roundOrder.length - 1) {
    // Already in Final or unknown
    const finalMatch = tournament.matches.find(m => m.roundName === 'F');
    if (finalMatch && finalMatch.isCompleted && finalMatch.winnerId) {
      tournament.completed = true;
      tournament.winnerPlayerId = finalMatch.winnerId;
    }
    return false;
  }

  // Check if all matches in current round are completed
  const curMatches = tournament.matches.filter(m => m.roundName === tournament.currentRound);
  const allDone = curMatches.every(m => m.isCompleted && m.winnerId);
  if (!allDone) return false;

  const nextRound = roundOrder[curIdx + 1];
  const winnerEntries = curMatches.map(m => {
    const isP1Winner = m.winnerId === m.player1.id;
    return {
      player: isP1Winner ? m.player1 : m.player2,
      seed: isP1Winner ? m.p1Seed : m.p2Seed,
      entryType: isP1Winner ? m.p1EntryType : m.p2EntryType,
    };
  });

  // Pair up consecutive winners for the next round (0 vs 1, 2 vs 3, etc.)
  // Their seeds and entry types are preserved through all rounds
  for (let i = 0; i < winnerEntries.length; i += 2) {
    if (winnerEntries[i] && winnerEntries[i + 1]) {
      const match = createNewMatch(
        tournament.id,
        nextRound,
        winnerEntries[i].player,
        winnerEntries[i + 1].player,
        winnerEntries[i].seed,
        winnerEntries[i + 1].seed,
        winnerEntries[i].entryType,
        winnerEntries[i + 1].entryType
      );

      // Check for mid-tournament Walkover (W/O) due to severe injury or critical exhaustion
      const p1Inj = match.player1.injury;
      const p2Inj = match.player2.injury;
      const p1Crit = (match.player1.fatigue || 0) >= 95;
      const p2Crit = (match.player2.fatigue || 0) >= 95;

      if (p1Inj && p1Inj.severity === 'severe') {
        applyWalkover(match, 2, `${p1Inj.type} (тяжелая травма)`);
      } else if (p2Inj && p2Inj.severity === 'severe') {
        applyWalkover(match, 1, `${p2Inj.type} (тяжелая травма)`);
      } else if (p1Crit && Math.random() < 0.25) {
        applyWalkover(match, 2, 'Острое физическое переутомление');
      } else if (p2Crit && Math.random() < 0.25) {
        applyWalkover(match, 1, 'Острое физическое переутомление');
      }

      tournament.matches.push(match);
    }
  }

  tournament.currentRound = nextRound;
  return true;
}

// Updates rankings based on tournament results (separately for ATP and WTA)
export function processTournamentPoints(tournament: Tournament, allPlayers: Player[]): Player[] {
  const playerMap = new Map<string, Player>();
  allPlayers.forEach(p => {
    playerMap.set(p.id, {
      ...p,
      prevRank: p.rank,
      recentPointsGained: 0,
    });
  });

  // Ensure any qualifier or tournament player not in playerMap gets registered
  tournament.matches.forEach(m => {
    [m.player1, m.player2].forEach(p => {
      if (!playerMap.has(p.id)) {
        playerMap.set(p.id, {
          ...p,
          prevRank: p.rank,
          recentPointsGained: 0,
        });
      }
    });
  });

  // Weekly rest and fatigue recovery for players who didn't play in this tournament
  const tournamentPlayerIds = new Set<string>();
  tournament.matches.forEach(m => {
    tournamentPlayerIds.add(m.player1.id);
    tournamentPlayerIds.add(m.player2.id);
  });

  playerMap.forEach(pl => {
    if (!tournamentPlayerIds.has(pl.id)) {
      // Resting week: recovers fatigue
      pl.fatigue = Math.max(0, (pl.fatigue || 0) - 30);
    }
    // Injury healing progression week-by-week
    if (pl.injury) {
      pl.injury.weeksRemaining--;
      if (pl.injury.weeksRemaining <= 0) {
        pl.injury = null;
      }
    }
  });

  // Find how far each player reached in this tournament
  const playerResults = new Map<string, { round: string; wonTournament: boolean }>();

  tournament.matches.forEach(m => {
    if (m.isCompleted && m.winnerId) {
      const loser = m.winnerId === m.player1.id ? m.player2 : m.player1;
      const winner = m.winnerId === m.player1.id ? m.player1 : m.player2;

      // Loser exited in m.roundName
      if (!playerResults.has(loser.id)) {
        playerResults.set(loser.id, { round: m.roundName, wonTournament: false });
      }

      // If final, winner won the tournament
      if (m.roundName === 'F') {
        playerResults.set(winner.id, { round: 'W', wonTournament: true });
      }

      // Update H2H & Match stats
      const p1Obj = playerMap.get(m.player1.id);
      const p2Obj = playerMap.get(m.player2.id);
      if (p1Obj && p2Obj) {
        if (!p1Obj.h2h) p1Obj.h2h = {};
        if (!p2Obj.h2h) p2Obj.h2h = {};
        if (!p1Obj.h2h[p2Obj.id]) p1Obj.h2h[p2Obj.id] = { wins: 0, losses: 0 };
        if (!p2Obj.h2h[p1Obj.id]) p2Obj.h2h[p1Obj.id] = { wins: 0, losses: 0 };

        if (m.winnerId === p1Obj.id) {
          p1Obj.wins++;
          p2Obj.losses++;
          p1Obj.h2h[p2Obj.id].wins++;
          p2Obj.h2h[p1Obj.id].losses++;
        } else {
          p2Obj.wins++;
          p1Obj.losses++;
          p2Obj.h2h[p1Obj.id].wins++;
          p1Obj.h2h[p2Obj.id].losses++;
        }
      }
    }
  });

  // Award points
  playerResults.forEach((res, pId) => {
    const pl = playerMap.get(pId);
    if (pl) {
      const pts = getRoundPoints(tournament.category, res.round, res.wonTournament);
      pl.points += pts;
      pl.recentPointsGained = pts;
      pl.lastTournamentResult = res.wonTournament
        ? `🏆 Титул (${tournament.city}, +${pts})`
        : `${res.round} (${tournament.city}, +${pts})`;
      if (res.wonTournament) {
        pl.careerTitles++;
      }
    }
  });

  // Re-sort and assign new ranks dynamically and independently for ATP and WTA!
  const updatedPlayers = Array.from(playerMap.values());

  const atpPlayers = updatedPlayers.filter(p => p.tour === 'ATP');
  const wtaPlayers = updatedPlayers.filter(p => p.tour === 'WTA');

  atpPlayers.sort((a, b) => b.points - a.points);
  atpPlayers.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  wtaPlayers.sort((a, b) => b.points - a.points);
  wtaPlayers.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  // Record historical ranking and rating points snapshot for every player
  const isMajor = isMajorTournamentCategory(tournament.category);
  const nowSeasonPlayers = [...atpPlayers, ...wtaPlayers];

  nowSeasonPlayers.forEach(p => {
    if (p.initialPoints === undefined) {
      p.initialPoints = Math.max(0, p.points - (p.recentPointsGained || 0));
      p.initialRank = p.prevRank || p.rank;
    }
    if (!p.rankingHistory) {
      p.rankingHistory = [];
    }

    const snapshot: PlayerRankingSnapshot = {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentNameRu: tournament.nameRu,
      city: tournament.city,
      category: tournament.category,
      week: tournament.week,
      points: p.points,
      rank: p.rank,
      pointsGained: p.recentPointsGained || 0,
      result: p.lastTournamentResult,
      isMajor,
      date: tournament.dates,
    };

    const existingIdx = p.rankingHistory.findIndex(h => h.tournamentId === tournament.id);
    if (existingIdx >= 0) {
      p.rankingHistory[existingIdx] = snapshot;
    } else {
      p.rankingHistory.push(snapshot);
    }
  });

  return nowSeasonPlayers;
}

/**
 * Synchronizes upcoming season tournaments with the latest dynamic player rankings.
 * If an upcoming tournament has not started yet, it is dynamically re-seeded so that
 * the current #1 ranked player is Seed 1, #2 is Seed 2, etc., following official seeding rules.
 */
export function syncSeasonWithCurrentRankings(season: Season, updatedPlayers: Player[]): Season {
  const playerMap = new Map<string, Player>();
  updatedPlayers.forEach(p => playerMap.set(p.id, p));

  const updatedTournaments = season.tournaments.map((trn) => {
    // If tournament has completed, keep match history intact
    if (trn.completed) {
      return trn;
    }

    const hasStarted = trn.matches.some(m => m.isCompleted);
    if (hasStarted) {
      // Tournament in progress: keep bracket progression, update player info on pending matches
      const refreshedMatches = trn.matches.map(m => {
        const p1Latest = playerMap.get(m.player1.id);
        const p2Latest = playerMap.get(m.player2.id);
        return {
          ...m,
          player1: p1Latest ? { ...p1Latest } : m.player1,
          player2: p2Latest ? { ...p2Latest } : m.player2,
        };
      });
      return { ...trn, matches: refreshedMatches };
    }

    // Tournament has NOT started yet: refresh player info with latest ranking/stats while preserving draw integrity
    const refreshedMatches = trn.matches.map(m => {
      const p1Latest = playerMap.get(m.player1.id);
      const p2Latest = playerMap.get(m.player2.id);
      return {
        ...m,
        player1: p1Latest ? { ...p1Latest } : m.player1,
        player2: p2Latest ? { ...p2Latest } : m.player2,
      };
    });

    const refreshedQualMatches = (trn.qualifyingMatches || []).map(m => {
      const p1Latest = playerMap.get(m.player1.id);
      const p2Latest = playerMap.get(m.player2.id);
      return {
        ...m,
        player1: p1Latest ? { ...p1Latest } : m.player1,
        player2: p2Latest ? { ...p2Latest } : m.player2,
      };
    });

    const refreshedLL = (trn.luckyLosersPool || []).map(p => {
      const latest = playerMap.get(p.id);
      return latest ? { ...latest } : p;
    });

    return {
      ...trn,
      matches: refreshedMatches,
      qualifyingMatches: refreshedQualMatches,
      luckyLosersPool: refreshedLL,
    };
  });

  const syncedSeason: Season = {
    ...season,
    tournaments: updatedTournaments,
  };

  deduplicateWeeklySeasonDraws(syncedSeason);
  return syncedSeason;
}

// Calculate retirement chance for a player at the end of a season
export function calculateRetirementChance(player: Player): number {
  if (player.id === 'ksenia-morey') return 0; // Protagonist career is in the player's hands
  if (player.age < 36) return 0; // Первый возможный год выхода на пенсию — 36 лет

  // Базовый минимальный шанс в 36 лет: 2.0% (0.02)
  // Каждый дополнительный год старше 36 добавляет +1.5% - 2.0% (0.0175 в год)
  const yearsOver36 = player.age - 36;
  let chance = 0.02 + yearsOver36 * 0.0175;

  // Risk modifiers:
  // Persistent injury
  if (player.injury) {
    chance += 0.03;
  }
  // Severe fatigue
  if ((player.fatigue || 0) >= 50) {
    chance += 0.02;
  }
  // Veteran decline in rank: 38+ and outside top 50
  if (player.age >= 38 && player.rank > 50) {
    chance += 0.025;
  }

  // Cap at 65% for safety
  return Math.min(0.65, Math.max(0, chance));
}

// Pool of talented young debutants
const NEW_GEN_ATP_TALENTS = [
  { name: 'Артур Вермерен', nameEn: 'Arthur Vermeiren', country: 'Бельгия', flag: '🇧🇪', style: 'Базлайнер' as PlayerStyle, fav: 'Хард' },
  { name: 'Матео Берретта', nameEn: 'Matteo Berretta', country: 'Италия', flag: '🇮🇹', style: 'Мощный базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Милош Радович', nameEn: 'Milos Radovic', country: 'Сербия', flag: '🇷🇸', style: 'Универсал' as PlayerStyle, fav: 'Хард' },
  { name: 'Лукаш Новак', nameEn: 'Lukas Novak', country: 'Чехия', flag: '🇨🇿', style: 'Подача+сетка' as PlayerStyle, fav: 'Трава' },
  { name: 'Габриэль Дюбуа', nameEn: 'Gabriel Dubois', country: 'Франция', flag: '🇫🇷', style: 'Агрессивный базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Даниил Савельев', nameEn: 'Daniil Savelyev', country: 'Казахстан', flag: '🇰🇿', style: 'Базлайнер' as PlayerStyle, fav: 'Хард' },
  { name: 'Такуми Сато', nameEn: 'Takumi Sato', country: 'Япония', flag: '🇯🇵', style: 'Защитник' as PlayerStyle, fav: 'Хард' },
  { name: 'Диего Наварро', nameEn: 'Diego Navarro', country: 'Испания', flag: '🇪🇸', style: 'Мощный базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Эван Миллер', nameEn: 'Evan Miller', country: 'США', flag: '🇺🇸', style: 'Подача+сетка' as PlayerStyle, fav: 'Хард' },
  { name: 'Стефан Линдквист', nameEn: 'Stefan Lindqvist', country: 'Швеция', flag: '🇸🇪', style: 'Универсал' as PlayerStyle, fav: 'Хард' },
  { name: 'Оливер Кристиансен', nameEn: 'Oliver Christiansen', country: 'Дания', flag: '🇩🇰', style: 'Агрессивный базлайнер' as PlayerStyle, fav: 'Хард' },
  { name: 'Себастьян Моралес', nameEn: 'Sebastian Morales', country: 'Аргентина', flag: '🇦🇷', style: 'Базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Марко Бауэр', nameEn: 'Marco Bauer', country: 'Германия', flag: '🇩🇪', style: 'Подача+сетка' as PlayerStyle, fav: 'Трава' },
  { name: 'Лиам О\'Коннор', nameEn: 'Liam O\'Connor', country: 'Австралия', flag: '🇦🇺', style: 'Мощный базлайнер' as PlayerStyle, fav: 'Хард' },
];

const NEW_GEN_WTA_TALENTS = [
  { name: 'Алиса Ковалёва', nameEn: 'Alisa Kovaleva', country: 'Казахстан', flag: '🇰🇿', style: 'Агрессивный базлайнер' as PlayerStyle, fav: 'Хард' },
  { name: 'София Росси', nameEn: 'Sofia Rossi', country: 'Италия', flag: '🇮🇹', style: 'Базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Мари Вайс', nameEn: 'Marie Weiss', country: 'Германия', flag: '🇩🇪', style: 'Подача+сетка' as PlayerStyle, fav: 'Трава' },
  { name: 'Хлоя Лоран', nameEn: 'Chloe Laurent', country: 'Франция', flag: '🇫🇷', style: 'Универсал' as PlayerStyle, fav: 'Грунт' },
  { name: 'Эмма Линдстрём', nameEn: 'Emma Lindstrom', country: 'Швеция', flag: '🇸🇪', style: 'Мощный базлайнер' as PlayerStyle, fav: 'Хард' },
  { name: 'Мию Танака', nameEn: 'Miyu Tanaka', country: 'Япония', flag: '🇯🇵', style: 'Защитник' as PlayerStyle, fav: 'Хард' },
  { name: 'Карла Гомес', nameEn: 'Carla Gomez', country: 'Испания', flag: '🇪🇸', style: 'Базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Аманда Блейк', nameEn: 'Amanda Blake', country: 'США', flag: '🇺🇸', style: 'Подача+сетка' as PlayerStyle, fav: 'Хард' },
  { name: 'Зузана Черна', nameEn: 'Zuzana Cerna', country: 'Чехия', flag: '🇨🇿', style: 'Агрессивный базлайнер' as PlayerStyle, fav: 'Хард' },
  { name: 'Полина Романова', nameEn: 'Polina Romanova', country: 'Узбекистан', flag: '🇺🇿', style: 'Универсал' as PlayerStyle, fav: 'Хард' },
  { name: 'Кьяра Моретти', nameEn: 'Chiara Moretti', country: 'Италия', flag: '🇮🇹', style: 'Базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Камиль Блан', nameEn: 'Camille Blanc', country: 'Франция', flag: '🇫🇷', style: 'Агрессивный базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Ана Марин', nameEn: 'Ana Marin', country: 'Румыния', flag: '🇷🇴', style: 'Базлайнер' as PlayerStyle, fav: 'Грунт' },
  { name: 'Леа Хофер', nameEn: 'Lea Hofer', country: 'Швейцария', flag: '🇨🇭', style: 'Универсал' as PlayerStyle, fav: 'Хард' },
];

function generateNewGenTalent(
  tour: TourType,
  year: number,
  index: number,
  existingPlayers: Player[]
): Player {
  const pool = tour === 'ATP' ? NEW_GEN_ATP_TALENTS : NEW_GEN_WTA_TALENTS;
  const existingNames = new Set(existingPlayers.map(p => p.name.toLowerCase()));

  const candidate = pool.find(c => !existingNames.has(c.name.toLowerCase())) || (() => {
    const extraReal = getRealTourQualifier(tour, `${year}`, index, existingNames);
    return {
      name: extraReal.name,
      nameEn: extraReal.nameEn || extraReal.name,
      country: extraReal.country,
      flag: extraReal.flag,
      style: extraReal.style,
      fav: extraReal.favSurface,
    };
  })();

  const id = `newgen_${tour.toLowerCase()}_${year}_${candidate.nameEn.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
  const age = 18 + (index % 3); // 18-20 years old

  return {
    id,
    name: candidate.name,
    nameEn: candidate.nameEn,
    tour,
    country: candidate.country,
    flag: candidate.flag,
    age,
    rank: 64,
    prevRank: 64,
    points: 280 + Math.floor(Math.random() * 90),
    style: candidate.style,
    favSurface: candidate.fav,
    rallyBonus: 0,
    serveBonus: 0,
    stats: {
      serve: 2 + (index % 2),
      rally: 3,
      forehand: 3,
      backhand: 2 + (index % 2),
      stamina: 3 + (index % 2),
      mental: 2,
    },
    bio: `Молодой дебютант профессионального тура (${age} лет). Получил путевку в основу после успешных выступлений в юниорских турнирах.`,
    avatarColor: tour === 'ATP' ? '#0ea5e9' : '#f43f5e',
    careerTitles: 0,
    wins: 0,
    losses: 0,
    h2h: {},
    fatigue: 0,
    injury: null,
    peakRank: 64,
  };
}

export interface GenerateNextSeasonResult {
  season: Season;
  updatedPlayers: Player[];
  report: SeasonTransitionReport;
}

// Generate the next season schedule (2027, 2028, etc.) with player aging, retirement and new talents
export function generateNextSeason(
  currentSeason: Season,
  players: Player[]
): GenerateNextSeasonResult {
  const nextYear = currentSeason.year + 1;
  const retiredThisYear: RetiredPlayer[] = [];
  const newTalentsThisYear: Player[] = [];
  let agedPlayersCount = 0;
  let statChangesCount = 0;

  const survivingPlayers: Player[] = [];

  for (const p of players) {
    // Check for retirement (>= 36 years old, minimal rate starting at 36)
    const retireChance = calculateRetirementChance(p);
    const rollsRetirement = retireChance > 0 && Math.random() < retireChance;

    if (rollsRetirement) {
      retiredThisYear.push({
        id: p.id,
        name: p.name,
        nameEn: p.nameEn,
        tour: p.tour,
        country: p.country,
        flag: p.flag,
        retiredAtAge: p.age,
        retiredYear: currentSeason.year,
        careerTitles: p.careerTitles,
        wins: p.wins,
        losses: p.losses,
        rankAtRetirement: p.rank,
        peakRank: p.peakRank || p.rank,
        style: p.style,
        bio: p.bio,
      });
      continue;
    }

    // Player continues into next season
    agedPlayersCount++;
    const newAge = p.age + 1;
    const pointsNormalized = Math.round(p.points * 0.85); // 15% defending points decay

    const newStats: PlayerStats = { ...p.stats };

    // Physical aging curves
    if (newAge >= 32) {
      // Slower physical recovery / slight stamina decrease (20% chance)
      if (Math.random() < 0.20 && newStats.stamina > 2) {
        newStats.stamina -= 1;
        statChangesCount++;
      }
      // Experience boost to mental composure (15% chance)
      if (Math.random() < 0.15 && newStats.mental < 5) {
        newStats.mental += 1;
        statChangesCount++;
      }
    } else if (newAge <= 23 && p.id !== 'ksenia-morey') {
      // Youth development growth (25% chance)
      if (Math.random() < 0.25) {
        const boostable: (keyof PlayerStats)[] = ['serve', 'rally', 'forehand', 'stamina'];
        const chosen = boostable[Math.floor(Math.random() * boostable.length)];
        if (newStats[chosen] < 5) {
          newStats[chosen] += 1;
          statChangesCount++;
        }
      }
    }

    survivingPlayers.push({
      ...p,
      age: newAge,
      points: pointsNormalized,
      prevRank: p.rank,
      peakRank: Math.min(p.peakRank || p.rank, p.rank),
      stats: newStats,
      fatigue: 0, // fully rested in off-season
      injury: null, // fully healed during off-season
    });
  }

  // Replace retired players with fresh new-gen talents
  const retiredAtpCount = retiredThisYear.filter(r => r.tour === 'ATP').length;
  const retiredWtaCount = retiredThisYear.filter(r => r.tour === 'WTA').length;

  for (let i = 0; i < retiredAtpCount; i++) {
    const talent = generateNewGenTalent('ATP', nextYear, i + 1, players);
    newTalentsThisYear.push(talent);
    survivingPlayers.push(talent);
  }

  for (let i = 0; i < retiredWtaCount; i++) {
    const talent = generateNewGenTalent('WTA', nextYear, i + 1, players);
    newTalentsThisYear.push(talent);
    survivingPlayers.push(talent);
  }

  // Re-sort ATP and WTA rankings based on points
  const atp = survivingPlayers.filter(p => p.tour === 'ATP');
  const wta = survivingPlayers.filter(p => p.tour === 'WTA');

  atp.sort((a, b) => b.points - a.points);
  atp.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  wta.sort((a, b) => b.points - a.points);
  wta.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  const allEvolvedPlayers = [...atp, ...wta];

  const report: SeasonTransitionReport = {
    fromYear: currentSeason.year,
    toYear: nextYear,
    retiredPlayers: retiredThisYear,
    newTalents: newTalentsThisYear,
    agedPlayersCount,
    statChangesCount,
  };

  const newSeason = createInitialSeason(nextYear, allEvolvedPlayers);
  newSeason.retiredPlayersHistory = [
    ...(currentSeason.retiredPlayersHistory || []),
    ...retiredThisYear,
  ];
  newSeason.lastTransitionReport = report;

  return {
    season: newSeason,
    updatedPlayers: allEvolvedPlayers,
    report,
  };
}
