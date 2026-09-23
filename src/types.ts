export type Surface = 'Хард' | 'Грунт' | 'Трава' | 'Грунт (закр.)' | 'Хард (закр.)';

export type TourType = 'ATP' | 'WTA';

export type TournamentCategory =
  | 'Grand Slam'
  | 'ATP Finals'
  | 'ATP Masters 1000'
  | 'ATP 500'
  | 'ATP 250'
  | 'WTA Finals'
  | 'WTA 1000'
  | 'WTA 500'
  | 'WTA 250'
  | 'WTA 125';

export type PlayerStyle = 'Базлайнер' | 'Мощный базлайнер' | 'Агрессивный базлайнер' | 'Подача+сетка' | 'Универсал' | 'Защитник';

export interface PlayerStats {
  serve: number;       // 1-5
  rally: number;       // 1-5
  forehand: number;    // 1-5
  backhand: number;    // 1-5
  stamina: number;     // 1-5
  mental: number;      // 1-5
}

export type InjurySeverity = 'light' | 'moderate' | 'severe';

export interface PlayerInjury {
  type: string; // e.g. "Мышечный спазм бедра", "Растяжение голеностопа", "Травма плеча"
  severity: InjurySeverity;
  weeksRemaining: number;
  description: string;
}

export type TournamentEntryType = 'SEED' | 'DA' | 'Q' | 'LL' | 'WC';

export interface DailyForm {
  roll: number; // 1 to 6
  label: string; // e.g. 'На кураже! 🔥', 'На подъёме 📈', 'Обычная форма ⚖️', 'Рабочий тонус 👍', 'Тяжёлый старт 📉', 'Спад / Не в духе ❄️'
  modifier: number; // 1 = -1, 2 = -0.5, 3 = 0, 4 = 0, 5 = +0.5, 6 = +1
  description: string;
}

export interface PlayerRankingSnapshot {
  tournamentId: string;
  tournamentName: string;
  tournamentNameRu: string;
  city: string;
  category: TournamentCategory;
  week: number;
  points: number;
  rank: number;
  pointsGained: number;
  result?: string;
  isMajor: boolean;
  date?: string;
}

export interface Player {
  id: string;
  name: string;
  nameEn?: string;
  tour: TourType;
  country: string;
  flag: string;
  age: number;
  rank: number;
  prevRank: number;
  points: number;
  initialPoints?: number;
  initialRank?: number;
  style: PlayerStyle;
  favSurface: string;
  rallyBonus: number;
  serveBonus: number;
  stats: PlayerStats;
  bio?: string;
  avatarColor: string;
  careerTitles: number;
  wins: number;
  losses: number;
  h2h: Record<string, { wins: number; losses: number }>;
  recentPointsGained?: number;
  lastTournamentResult?: string;
  fatigue?: number; // 0-100% (0: свежий, 100: полное истощение)
  injury?: PlayerInjury | null;
  peakRank?: number;
  rankingHistory?: PlayerRankingSnapshot[];
}

export interface RetiredPlayer {
  id: string;
  name: string;
  nameEn?: string;
  tour: TourType;
  country: string;
  flag: string;
  retiredAtAge: number;
  retiredYear: number;
  careerTitles: number;
  wins: number;
  losses: number;
  rankAtRetirement: number;
  peakRank?: number;
  style: PlayerStyle;
  bio?: string;
}

export interface SeasonTransitionReport {
  fromYear: number;
  toYear: number;
  retiredPlayers: RetiredPlayer[];
  newTalents: Player[];
  agedPlayersCount: number;
  statChangesCount: number;
}

export interface PointHistory {
  server: 1 | 2;
  p1Score: string; // '0', '15', '30', '40', 'AD'
  p2Score: string; // '0', '15', '30', '40', 'AD'
  p1PointsWon: number;
  p2PointsWon: number;
  pointWinner: 1 | 2;
  serveRoll: number;
  serveType: 'ace' | 'double_fault' | 'weak' | 'neutral' | 'good' | 'power';
  p1RallyRoll?: number;
  p2RallyRoll?: number;
  p1RallyTotal?: number;
  p2RallyTotal?: number;
  isWinnerShot?: boolean;
  commentary: string;
}

export interface GameLog {
  gameIndex: number;
  setIndex: number;
  server: 1 | 2; // 1 = player1, 2 = player2
  winner: 1 | 2;
  p1GamesAtEnd: number;
  p2GamesAtEnd: number;
  p1Progression: string[]; // e.g. ['15', '30', '40']
  p2Progression: string[]; // e.g. ['0', '0', '0']
  points: PointHistory[];
  isBreak: boolean;
  isTiebreak?: boolean;
}

export interface SetLog {
  setIndex: number;
  p1Games: number;
  p2Games: number;
  games: GameLog[];
  winner: 1 | 2;
}

export interface MatchStats {
  aces: [number, number];
  doubleFaults: [number, number];
  winners: [number, number];
  unforcedErrors: [number, number];
  breakPointsWon: [number, number];
  breakPointsTotal: [number, number];
  totalPointsWon: [number, number];
  firstServePercentage: [number, number];
}

export interface TournamentWithdrawal {
  originalPlayerId: string;
  originalPlayerName: string;
  originalPlayerFlag: string;
  reason: string;
  replacementPlayerId: string;
  replacementPlayerName: string;
  replacementPlayerFlag: string;
  type: 'LL' | 'ALT';
  roundName: string;
  withdrawnAt?: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  roundName: string; // 'R32' | 'R16' | 'QF' | 'SF' | 'F' | 'Q1' | 'Q-Final'
  player1: Player;
  player2: Player;
  p1Seed?: number;
  p2Seed?: number;
  p1EntryType?: TournamentEntryType;
  p2EntryType?: TournamentEntryType;
  p1DailyForm?: DailyForm;
  p2DailyForm?: DailyForm;
  winnerId?: string;
  sets: SetLog[];
  currentSetIndex: number;
  currentGame?: GameLog;
  currentPointIndexInGame?: number;
  isCompleted: boolean;
  scoreText: string; // e.g. "6:3, 4:6, 7:5" or "6:4, 2:1 (отказ)" or "W/O (травма)"
  isWalkover?: boolean;
  isRetired?: boolean;
  retiredPlayerId?: string;
  retirementReason?: string;
  stats: MatchStats;
  narrativeHistory: string[];
  createdAt: number;
}

export interface Tournament {
  id: string;
  name: string;
  nameRu: string;
  tour: TourType;
  city: string;
  country: string;
  flag: string;
  surface: Surface;
  category: TournamentCategory;
  drawSize: number; // 32, 64, 128
  pointsWinner: number;
  week: number;
  month: string;
  dates: string;
  completed: boolean;
  winnerPlayerId?: string;
  matches: Match[];
  currentRound: string;
  qualifyingMatches?: Match[];
  qualifyingCompleted?: boolean;
  luckyLosersPool?: Player[];
  withdrawals?: TournamentWithdrawal[];
}

export interface Season {
  year: number;
  tournaments: Tournament[];
  currentTournamentIndex: number;
  isCompleted: boolean;
  totalMatchesSimulated: number;
  retiredPlayersHistory?: RetiredPlayer[];
  lastTransitionReport?: SeasonTransitionReport;
}

export interface SaveSlot {
  id: string;
  slotNumber: number;
  name: string;
  savedAt: number;
  seasonYear: number;
  currentTournamentName: string;
  currentTournamentTour: TourType;
  totalMatchesSimulated: number;
  seasonData: Season;
  playersData: Player[];
}
