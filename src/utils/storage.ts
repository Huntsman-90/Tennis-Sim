import { getRealTourQualifier } from '../data/realTourQualifiers';
import { deduplicateWeeklySeasonDraws } from '../engine/seasonManager';
import { rollDailyForm } from '../engine/tennisEngine';
import { Match, MatchStats, Player, SaveSlot, Season, Tournament } from '../types';

const DB_NAME = 'tennis_pro_tour_db';
const DB_VERSION = 2;
const STORE_NAME = 'game_storage';

export const STORAGE_KEY_SEASON = 'tennis_tour_season_state_v6';
export const STORAGE_KEY_SEASON_LEGACY = 'tennis_tour_season_state_v5';
export const STORAGE_KEY_PLAYERS = 'tennis_tour_players_state_v6';
export const STORAGE_KEY_PLAYERS_LEGACY = 'tennis_tour_players_state_v5';
export const STORAGE_KEY_SLOTS = 'tennis_tour_manual_slots_v6';
export const STORAGE_KEY_SLOTS_LEGACY = 'tennis_tour_manual_slots_v5';
export const STORAGE_KEY_AUTOSAVE_TIME = 'tennis_tour_autosave_time_v6';

function createEmptyStats(): MatchStats {
  return {
    aces: [0, 0],
    doubleFaults: [0, 0],
    winners: [0, 0],
    unforcedErrors: [0, 0],
    breakPointsWon: [0, 0],
    breakPointsTotal: [0, 0],
    totalPointsWon: [0, 0],
    firstServePercentage: [65, 65],
  };
}

const globalSanitizeUsedNames = new Set<string>();

/**
 * Automatically sanitizes any legacy placeholder player name (e.g. "Окленд Кандидат 5" or "Брисбен Квалификант 2")
 * into a genuine, authentic ATP/WTA professional tennis player.
 */
export function sanitizePlayer(player: Player, usedSet?: Set<string> | unknown): Player {
  if (!player) return player;
  const isSyntheticName = /(Кандидат|Квалификант|Candidate|Qualifier)/i.test(player.name);
  if (isSyntheticName) {
    const tour = player.tour || (player.id.toLowerCase().includes('atp') ? 'ATP' : 'WTA');
    let seedIdx = 0;
    for (let i = 0; i < player.id.length; i++) {
      seedIdx = (seedIdx * 31 + player.id.charCodeAt(i)) % 1000;
    }
    const tracking = usedSet instanceof Set ? (usedSet as Set<string>) : globalSanitizeUsedNames;
    const realCandidate = getRealTourQualifier(tour, player.id, Math.abs(seedIdx), tracking);
    player.name = realCandidate.name;
    player.nameEn = realCandidate.nameEn;
    player.country = realCandidate.country;
    player.flag = realCandidate.flag;
    player.age = realCandidate.age;
    player.rank = realCandidate.rank;
    player.style = realCandidate.style;
    if (realCandidate.bio) player.bio = realCandidate.bio;
  }
  return player;
}

function createFallbackPlayer(id: string): Player {
  return {
    id: id || 'player_unknown',
    name: 'Игрок Тура',
    tour: 'ATP',
    country: 'Тур',
    flag: '🎾',
    age: 24,
    rank: 100,
    prevRank: 100,
    points: 100,
    style: 'Базлайнер',
    favSurface: 'Хард',
    rallyBonus: 0,
    serveBonus: 0,
    stats: {
      serve: 3,
      rally: 3,
      forehand: 3,
      backhand: 3,
      stamina: 3,
      mental: 3,
    },
    avatarColor: '#0284c7',
    careerTitles: 0,
    wins: 0,
    losses: 0,
    h2h: {},
    fatigue: 0,
    injury: null,
  };
}

/**
 * Ensures all players from matches (including qualifiers) are present in the global players array.
 */
export function collectAllSeasonPlayers(season: Season, existingPlayers: Player[]): Player[] {
  const pMap = new Map<string, Player>();
  existingPlayers.forEach(p => pMap.set(p.id, p));

  if (season && Array.isArray(season.tournaments)) {
    for (const t of season.tournaments) {
      if (Array.isArray(t.matches)) {
        for (const m of t.matches) {
          if (m.player1) {
            sanitizePlayer(m.player1);
            if (!pMap.has(m.player1.id)) pMap.set(m.player1.id, m.player1);
          }
          if (m.player2) {
            sanitizePlayer(m.player2);
            if (!pMap.has(m.player2.id)) pMap.set(m.player2.id, m.player2);
          }
        }
      }
      if (Array.isArray(t.qualifyingMatches)) {
        for (const qm of t.qualifyingMatches) {
          if (qm.player1) {
            sanitizePlayer(qm.player1);
            if (!pMap.has(qm.player1.id)) pMap.set(qm.player1.id, qm.player1);
          }
          if (qm.player2) {
            sanitizePlayer(qm.player2);
            if (!pMap.has(qm.player2.id)) pMap.set(qm.player2.id, qm.player2);
          }
        }
      }
      if (Array.isArray(t.luckyLosersPool)) {
        for (const ll of t.luckyLosersPool) {
          if (ll) {
            sanitizePlayer(ll);
            if (!pMap.has(ll.id)) pMap.set(ll.id, ll);
          }
        }
      }
    }
  }

  return Array.from(pMap.values());
}

/**
 * Compact serialization of a single Match object.
 * Unplayed matches take ~60 bytes.
 * Completed matches take ~250-400 bytes.
 */
export function serializeMatch(m: Match): any {
  if (!m.isCompleted) {
    return {
      i: m.id,
      t: m.tournamentId,
      r: m.roundName,
      p1: m.player1?.id,
      p2: m.player2?.id,
      s1: m.p1Seed,
      s2: m.p2Seed,
      et1: m.p1EntryType,
      et2: m.p2EntryType,
      df1: m.p1DailyForm?.roll,
      df2: m.p2DailyForm?.roll,
      wo: m.isWalkover ? 1 : undefined,
      c: 0,
    };
  }

  return {
    i: m.id,
    t: m.tournamentId,
    r: m.roundName,
    p1: m.player1?.id,
    p2: m.player2?.id,
    s1: m.p1Seed,
    s2: m.p2Seed,
    et1: m.p1EntryType,
    et2: m.p2EntryType,
    df1: m.p1DailyForm?.roll,
    df2: m.p2DailyForm?.roll,
    wo: m.isWalkover ? 1 : undefined,
    ret: m.isRetired ? 1 : undefined,
    rp: m.retiredPlayerId,
    rr: m.retirementReason,
    c: 1,
    w: m.winnerId,
    sc: m.scoreText,
    st: m.stats,
    sets: m.sets.map(s => ({
      i: s.setIndex,
      p1: s.p1Games,
      p2: s.p2Games,
      w: s.winner,
      g: s.games.map(g => ({
        i: g.gameIndex,
        s: g.server,
        w: g.winner,
        p1g: g.p1GamesAtEnd,
        p2g: g.p2GamesAtEnd,
        p1p: g.p1Progression,
        p2p: g.p2Progression,
        ib: g.isBreak ? 1 : 0,
        it: g.isTiebreak ? 1 : 0,
      })),
    })),
  };
}

/**
 * Deserializes a compact match back into a full Match object.
 */
export function deserializeMatch(sm: any, playerMap: Map<string, Player>): Match {
  // If already full legacy match object
  if (sm.id && sm.player1 && typeof sm.player1 === 'object') {
    sanitizePlayer(sm.player1);
    sanitizePlayer(sm.player2);
    return sm as Match;
  }

  const p1 = sanitizePlayer(playerMap.get(sm.p1) || createFallbackPlayer(sm.p1));
  const p2 = sanitizePlayer(playerMap.get(sm.p2) || createFallbackPlayer(sm.p2));

  const p1DailyForm = sm.df1 ? rollDailyForm(p1, sm.df1) : rollDailyForm(p1);
  const p2DailyForm = sm.df2 ? rollDailyForm(p2, sm.df2) : rollDailyForm(p2);

  if (sm.c === 0) {
    return {
      id: sm.i,
      tournamentId: sm.t,
      roundName: sm.r,
      player1: p1,
      player2: p2,
      p1Seed: sm.s1,
      p2Seed: sm.s2,
      p1EntryType: sm.et1,
      p2EntryType: sm.et2,
      p1DailyForm,
      p2DailyForm,
      isWalkover: sm.wo === 1,
      sets: [{ setIndex: 1, p1Games: 0, p2Games: 0, games: [], winner: undefined }],
      currentSetIndex: 0,
      isCompleted: false,
      scoreText: '',
      stats: createEmptyStats(),
      narrativeHistory: [],
      createdAt: Date.now(),
    };
  }

  const restoredSets = (sm.sets || []).map((s: any) => ({
    setIndex: s.i,
    p1Games: s.p1,
    p2Games: s.p2,
    winner: s.w,
    games: (s.g || []).map((g: any) => ({
      gameIndex: g.i,
      setIndex: s.i,
      server: g.s,
      winner: g.w,
      p1GamesAtEnd: g.p1g,
      p2GamesAtEnd: g.p2g,
      p1Progression: g.p1p || [],
      p2Progression: g.p2p || [],
      points: [],
      isBreak: g.ib === 1,
      isTiebreak: g.it === 1,
    })),
  }));

  return {
    id: sm.i,
    tournamentId: sm.t,
    roundName: sm.r,
    player1: p1,
    player2: p2,
    p1Seed: sm.s1,
    p2Seed: sm.s2,
    p1EntryType: sm.et1,
    p2EntryType: sm.et2,
    p1DailyForm,
    p2DailyForm,
    isCompleted: true,
    winnerId: sm.w,
    scoreText: sm.sc || '',
    isWalkover: sm.wo === 1,
    isRetired: sm.ret === 1,
    retiredPlayerId: sm.rp,
    retirementReason: sm.rr,
    stats: sm.st || createEmptyStats(),
    currentSetIndex: Math.max(0, restoredSets.length - 1),
    sets: restoredSets,
    narrativeHistory: [],
    createdAt: Date.now(),
  };
}

/**
 * Ultra-compact serialization of an entire season (~400-500 KB total).
 */
export function serializeSeason(season: Season): any {
  if (!season || !Array.isArray(season.tournaments)) {
    return season;
  }

  return {
    _v: 6,
    year: season.year,
    currentTournamentIndex: season.currentTournamentIndex,
    isCompleted: season.isCompleted,
    totalMatchesSimulated: season.totalMatchesSimulated || 0,
    retiredPlayersHistory: season.retiredPlayersHistory || [],
    lastTransitionReport: season.lastTransitionReport,
    tournaments: season.tournaments.map(t => ({
      id: t.id,
      name: t.name,
      nameRu: t.nameRu,
      tour: t.tour,
      city: t.city,
      country: t.country,
      flag: t.flag,
      surface: t.surface,
      category: t.category,
      drawSize: t.drawSize,
      pointsWinner: t.pointsWinner,
      week: t.week,
      month: t.month,
      dates: t.dates,
      completed: t.completed,
      winnerPlayerId: t.winnerPlayerId,
      currentRound: t.currentRound,
      matches: (t.matches || []).map(serializeMatch),
      qm: (t.qualifyingMatches || []).map(serializeMatch),
      llp: (t.luckyLosersPool || []).map(p => p.id),
      wd: t.withdrawals,
    })),
  };
}

/**
 * Deserializes an ultra-compact season back into full Season format.
 */
export function deserializeSeason(data: any, players: Player[]): Season {
  if (!data) return data;

  // If already standard uncompacted format
  if (!data._v && data.tournaments && data.tournaments[0]?.matches?.[0]?.player1?.name) {
    const s = data as Season;
    deduplicateWeeklySeasonDraws(s);
    return s;
  }

  const playerMap = new Map<string, Player>();
  players.forEach(p => playerMap.set(p.id, p));

  const season: Season = {
    year: data.year || 2026,
    currentTournamentIndex: data.currentTournamentIndex || 0,
    isCompleted: !!data.isCompleted,
    totalMatchesSimulated: data.totalMatchesSimulated || 0,
    retiredPlayersHistory: data.retiredPlayersHistory || [],
    lastTransitionReport: data.lastTransitionReport,
    tournaments: (data.tournaments || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      nameRu: t.nameRu,
      tour: t.tour,
      city: t.city,
      country: t.country,
      flag: t.flag,
      surface: t.surface,
      category: t.category,
      drawSize: t.drawSize,
      pointsWinner: t.pointsWinner,
      week: t.week,
      month: t.month,
      dates: t.dates,
      completed: !!t.completed,
      winnerPlayerId: t.winnerPlayerId,
      currentRound: t.currentRound || 'Финал',
      matches: (t.matches || []).map((m: any) => deserializeMatch(m, playerMap)),
      qualifyingMatches: (t.qm || []).map((m: any) => deserializeMatch(m, playerMap)),
      luckyLosersPool: (t.llp || []).map((id: string) => sanitizePlayer(playerMap.get(id) || createFallbackPlayer(id))),
      withdrawals: t.wd || [],
      qualifyingCompleted: t.qm && t.qm.length > 0,
    })),
  };

  deduplicateWeeklySeasonDraws(season);
  return season;
}

/**
 * Backward compatibility alias for any existing imports.
 */
export function optimizeSeasonForStorage(season: Season): any {
  return serializeSeason(season);
}

// ============================================================================
// IndexedDB Engine (Native Promise Wrapper)
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          reject(req.error || new Error('Failed to open IndexedDB'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  return dbPromise;
}

export async function setIDBItem<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IDB] Could not write key "${key}":`, err);
  }
}

export async function getIDBItem<T>(key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IDB] Could not read key "${key}":`, err);
    return null;
  }
}

// Clean up stale or bloated legacy keys to keep storage clean
export function cleanupStaleLocalStorage(): void {
  try {
    const legacyPrefixes = [
      'tennis_tour_season_state_v1',
      'tennis_tour_season_state_v2',
      'tennis_tour_season_state_v3',
      'tennis_tour_season_state_v4',
      'tennis_tour_season_state_v5',
      'tennis_tour_players_state_v1',
      'tennis_tour_players_state_v2',
      'tennis_tour_players_state_v3',
      'tennis_tour_players_state_v4',
      'tennis_tour_players_state_v5',
      'tennis_tour_slots_v1',
      'tennis_tour_slots_v2',
      'tennis_tour_manual_slots_v5',
    ];
    for (const key of legacyPrefixes) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore error in restricted modes
  }
}

/**
 * Robustly saves game state:
 * 1. Serializes season into an ultra-compact payload (~400-500 KB).
 * 2. Synchronously saves Season, Players, and AutoSave timestamp to localStorage.
 * 3. Safely stores manual slots in localStorage (or lightweight headers if quota is tight).
 * 4. Asynchronously writes full authoritative state to IndexedDB (virtually unlimited quota).
 */
export async function persistAllGameState(
  season: Season,
  players: Player[],
  slots?: (SaveSlot | null)[]
): Promise<void> {
  const allPlayers = collectAllSeasonPlayers(season, players);
  const compactSeason = serializeSeason(season);
  const now = Date.now();

  const compactSlots = slots
    ? slots.map(s => {
        if (!s) return null;
        return {
          ...s,
          seasonData: serializeSeason(s.seasonData),
        };
      })
    : undefined;

  // 1. Synchronous localStorage save
  try {
    // Save primary season state first
    localStorage.setItem(STORAGE_KEY_SEASON, JSON.stringify(compactSeason));
    localStorage.setItem(STORAGE_KEY_AUTOSAVE_TIME, String(now));
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(allPlayers));

    if (compactSlots) {
      try {
        localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(compactSlots));
      } catch (slotErr) {
        // If 3 full slots exceed localStorage quota, save lightweight summary in localStorage
        // Full slots are always safely saved in IndexedDB!
        const lightSlots = compactSlots.map(s => {
          if (!s) return null;
          const { seasonData, playersData, ...rest } = s;
          return rest;
        });
        localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(lightSlots));
      }
    }
  } catch (lsErr) {
    console.warn('[Storage] localStorage save note:', lsErr);
    cleanupStaleLocalStorage();
    try {
      localStorage.setItem(STORAGE_KEY_SEASON, JSON.stringify(compactSeason));
      localStorage.setItem(STORAGE_KEY_AUTOSAVE_TIME, String(now));
    } catch {
      // IndexedDB will hold the authoritative state
    }
  }

  // 2. IndexedDB (Authoritative durable persistence)
  try {
    await setIDBItem(STORAGE_KEY_SEASON, compactSeason);
    await setIDBItem(STORAGE_KEY_PLAYERS, allPlayers);
    await setIDBItem(STORAGE_KEY_AUTOSAVE_TIME, now);
    if (compactSlots) {
      await setIDBItem(STORAGE_KEY_SLOTS, compactSlots);
    }
  } catch (idbErr) {
    console.warn('[Storage] IndexedDB save note:', idbErr);
  }
}

/**
 * Synchronously loads game state on component initialization.
 */
export function loadInitialGameStateSync(
  fallbackPlayers: Player[],
  createSeasonFallback: (players: Player[]) => Season
): {
  players: Player[];
  season: Season;
  slots: (SaveSlot | null)[];
  hasSavedData: boolean;
  lastAutoSaveTime: number;
} {
  let loadedPlayers = fallbackPlayers;
  let hasSavedData = false;
  let loadedAutoSaveTime = 0;

  // 0. Auto-save timestamp
  try {
    const rawTime = localStorage.getItem(STORAGE_KEY_AUTOSAVE_TIME);
    if (rawTime) {
      loadedAutoSaveTime = Number(rawTime) || 0;
    }
  } catch {
    // fallback
  }

  // 1. Players
  try {
    const rawPlayers =
      localStorage.getItem(STORAGE_KEY_PLAYERS) ||
      localStorage.getItem(STORAGE_KEY_PLAYERS_LEGACY);
    if (rawPlayers) {
      const parsed = JSON.parse(rawPlayers);
      if (Array.isArray(parsed) && parsed.length >= 100) {
        loadedPlayers = parsed.map(sanitizePlayer);
        hasSavedData = true;
      }
    }
  } catch {
    // fallback
  }

  // 2. Season
  let loadedSeason: Season;
  try {
    const rawSeason =
      localStorage.getItem(STORAGE_KEY_SEASON) ||
      localStorage.getItem(STORAGE_KEY_SEASON_LEGACY);
    if (rawSeason) {
      const parsed = JSON.parse(rawSeason);
      const deserialized = deserializeSeason(parsed, loadedPlayers);
      if (
        deserialized &&
        Array.isArray(deserialized.tournaments) &&
        deserialized.tournaments.length > 0
      ) {
        loadedSeason = deserialized;
        hasSavedData = true;
      } else {
        loadedSeason = createSeasonFallback(loadedPlayers);
      }
    } else {
      loadedSeason = createSeasonFallback(loadedPlayers);
    }
  } catch {
    loadedSeason = createSeasonFallback(loadedPlayers);
  }

  // 3. Slots
  let loadedSlots: (SaveSlot | null)[] = [null, null, null];
  try {
    const rawSlots =
      localStorage.getItem(STORAGE_KEY_SLOTS) ||
      localStorage.getItem(STORAGE_KEY_SLOTS_LEGACY);
    if (rawSlots) {
      const parsed = JSON.parse(rawSlots);
      if (Array.isArray(parsed)) {
        loadedSlots = parsed.map((s: any) => {
          if (!s) return null;
          return {
            ...s,
            seasonData: deserializeSeason(s.seasonData, s.playersData || loadedPlayers),
          };
        });
      }
    }
  } catch {
    // fallback
  }

  return {
    players: loadedPlayers,
    season: loadedSeason,
    slots: loadedSlots,
    hasSavedData,
    lastAutoSaveTime: loadedAutoSaveTime,
  };
}
