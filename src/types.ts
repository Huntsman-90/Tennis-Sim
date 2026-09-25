export type TourType = 'ATP' | 'WTA';

export type SurfaceType = 'Hard' | 'Clay' | 'Grass' | 'Indoor Hard' | 'Indoor Clay';

export type TournamentCategory = 'Grand Slam' | 'Masters 1000' | 'WTA 1000' | 'ATP 500' | 'WTA 500' | 'ATP 250' | 'WTA 250' | 'ATP Finals' | 'WTA Finals';

export interface PlayerStats {
  serve: number;       // 50-99
  forehand: number;    // 50-99
  backhand: number;    // 50-99
  speed: number;       // 50-99
  stamina: number;     // 50-99
  mental: number;      // 50-99
  clutch: number;      // 50-99
  hardAffinity: number; // 0.8 - 1.2
  clayAffinity: number;
  grassAffinity: number;
}

export interface Player {
  id: string;
  name: string;
  nameRu: string;
  country: string;
  flag: string;
  age: number;
  tour: TourType;
  rank: number;
  previousRank: number;
  points: number;
  previousPoints: number;
  titles: number;
  careerTitles: number;
  grandSlams: number;
  matchesWon: number;
  matchesLost: number;
  prizeMoney: number;
  form: number; // 0.8 to 1.2
  energy: number; // 0 to 100
  avatar?: string;
  handedness: 'Right' | 'Left';
  backhandType: 'One-handed' | 'Two-handed';
  stats: PlayerStats;
  retired?: boolean;
}

export interface MatchScore {
  sets: Array<[number, number]>;
  tiebreaks?: Array<[number, number] | null>;
  winnerId: string;
  durationMinutes: number;
  stats?: MatchDetailedStats;
}

export interface MatchDetailedStats {
  aces: [number, number];
  doubleFaults: [number, number];
  firstServePercentage: [number, number];
  firstServePointsWon: [number, number];
  secondServePointsWon: [number, number];
  breakPointsConverted: [number, number];
  breakPointsTotal: [number, number];
  winners: [number, number];
  unforcedErrors: [number, number];
  totalPointsWon: [number, number];
  fastestServeKmH: [number, number];
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number; // 0 = R128/R64, ..., final round = Finals
  roundName: string;
  player1Id: string | null;
  player2Id: string | null;
  seed1?: number;
  seed2?: number;
  isCompleted: boolean;
  score?: MatchScore;
  liveScore?: {
    currentSet: number;
    sets: Array<[number, number]>;
    currentGame: [number, number]; // 0=0, 1=15, 2=30, 3=40, 4=AD
    currentPointDisplay: [string, string];
    server: 1 | 2;
    inTiebreak: boolean;
    tiebreakScore?: [number, number];
    pointLog: string[];
    lastPointOutcome?: string;
  };
  winnerId?: string;
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
}

export interface Tournament {
  id: string;
  name: string;
  nameRu: string;
  city: string;
  country: string;
  flag: string;
  tour: TourType;
  category: TournamentCategory;
  surface: SurfaceType;
  week: number;
  drawSize: number;
  setsToWin: 2 | 3; // Best of 3 or Best of 5 (Men's Grand Slams)
  pointsWinner: number;
  pointsFinalist: number;
  pointsSemi: number;
  pointsQuarter: number;
  pointsR16: number;
  pointsR32: number;
  pointsR64: number;
  pointsR128: number;
  prizeMoneyPool: number;
  isCompleted: boolean;
  currentRound: number;
  matches: Match[];
  championId?: string;
  runnerUpId?: string;
}

export interface SeasonState {
  year: number;
  currentTournamentIndex: number;
  tournaments: Tournament[];
  completedTournaments: string[];
  history: {
    year: number;
    champions: Array<{
      tournamentId: string;
      tournamentName: string;
      winnerId: string;
      winnerName: string;
      tour: TourType;
    }>;
    yearEndNo1: {
      atp: { id: string; name: string };
      wta: { id: string; name: string };
    };
  }[];
}

export interface SaveSlot {
  id: number;
  name: string;
  date: string;
  season: SeasonState;
  players: Player[];
  timestamp: number;
}
