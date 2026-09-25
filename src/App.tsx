import { useEffect, useState } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { TournamentBracket } from './components/TournamentBracket';
import { MatchViewer } from './components/MatchViewer';
import { RankingsTable } from './components/RankingsTable';
import { CalendarView } from './components/CalendarView';
import { PlayersDirectory } from './components/PlayersDirectory';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { SavesModal } from './components/SavesModal';
import { SeasonTransitionModal } from './components/SeasonTransitionModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Match, MatchScore, Player, SaveSlot, SeasonState } from './types';
import { getInitialPlayers } from './data/players';
import {
  advanceTournamentMatch,
  finalizeTournamentAndDistributePoints,
  initializeNewSeason,
  repairSeasonState,
  simulateEntireTournament,
} from './engine/seasonManager';
import { simulateFullMatch } from './engine/tennisEngine';
import {
  autoSaveCurrentState,
  deleteSlot,
  getLastAutoSaveTime,
  getSaveSlots,
  loadAutoSave,
  loadFromSlot,
  saveToSlot,
} from './utils/storage';

export function App() {
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = loadAutoSave();
    if (saved && saved.players && saved.players.length > 0) {
      return saved.players;
    }
    return getInitialPlayers();
  });

  const [season, setSeason] = useState<SeasonState>(() => {
    const saved = loadAutoSave();
    const initPlayers = (saved && saved.players && saved.players.length > 0) ? saved.players : getInitialPlayers();
    if (saved && saved.season && saved.season.tournaments?.length > 0) {
      return repairSeasonState(saved.season, initPlayers);
    }
    return initializeNewSeason(initPlayers, 2026);
  });

  const [currentTab, setCurrentTab] = useState<ActiveTab>('tournament');
  const [activeMatchToWatch, setActiveMatchToWatch] = useState<Match | null>(null);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<Player | null>(null);
  const [isSavesModalOpen, setIsSavesModalOpen] = useState<boolean>(false);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number | null>(getLastAutoSaveTime());
  const [saveToast, setSaveToast] = useState<{ message: string; time: string } | null>(null);
  const [transitionReport, setTransitionReport] = useState<{
    year: number;
    nextYear: number;
    atpChampion: Player | null;
    wtaChampion: Player | null;
  } | null>(null);

  // Refresh slots
  const reloadSlots = () => {
    setSlots(getSaveSlots());
    setLastAutoSaveTime(getLastAutoSaveTime());
  };

  useEffect(() => {
    reloadSlots();
  }, []);

  const showSaveToast = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString('ru-RU');
    setSaveToast({ message: msg, time: timeStr });
    setTimeout(() => {
      setSaveToast(null);
    }, 2800);
  };

  // Trigger autosave on meaningful state updates
  const triggerAutoSave = (newSeason: SeasonState, newPlayers: Player[]) => {
    autoSaveCurrentState(newSeason, newPlayers);
    const now = Date.now();
    setLastAutoSaveTime(now);
    showSaveToast('Матч завершен и сохранен');
    reloadSlots();
  };

  const currentTournament = season.tournaments[season.currentTournamentIndex] || season.tournaments[0];

  // Match finished in interactive MatchViewer
  const handleMatchFinishedFromViewer = (matchId: string, winnerId: string, score: MatchScore) => {
    const updatedTournaments = [...season.tournaments];
    const currTourn = updatedTournaments[season.currentTournamentIndex];
    const targetMatch = currTourn.matches.find((m) => m.id === matchId);
    if (targetMatch) {
      targetMatch.score = score;
    }

    const { updatedTournament, updatedPlayers } = advanceTournamentMatch(
      currTourn,
      matchId,
      winnerId,
      players
    );

    let finalPlayers = updatedPlayers;
    if (updatedTournament.isCompleted) {
      finalPlayers = finalizeTournamentAndDistributePoints(updatedTournament, updatedPlayers);
    }

    updatedTournaments[season.currentTournamentIndex] = updatedTournament;
    const newSeasonState: SeasonState = {
      ...season,
      tournaments: updatedTournaments,
    };

    setSeason(newSeasonState);
    setPlayers(finalPlayers);
    triggerAutoSave(newSeasonState, finalPlayers);
  };

  // Instant simulate 1 single match
  const handleSimulateSingleMatch = (match: Match) => {
    if (!match.player1Id || !match.player2Id) return;
    const p1 = players.find((p) => p.id === match.player1Id);
    const p2 = players.find((p) => p.id === match.player2Id);
    if (!p1 || !p2) return;

    const sim = simulateFullMatch(p1, p2, currentTournament.surface, currentTournament.setsToWin);
    const updatedTournaments = [...season.tournaments];
    const currTourn = updatedTournaments[season.currentTournamentIndex];
    const targetMatch = currTourn.matches.find((m) => m.id === match.id);
    if (targetMatch) {
      targetMatch.score = sim.score;
    }

    const { updatedTournament, updatedPlayers } = advanceTournamentMatch(
      currTourn,
      match.id,
      sim.winnerId,
      players
    );

    let finalPlayers = updatedPlayers;
    if (updatedTournament.isCompleted) {
      finalPlayers = finalizeTournamentAndDistributePoints(updatedTournament, updatedPlayers);
    }

    updatedTournaments[season.currentTournamentIndex] = updatedTournament;
    const newSeason: SeasonState = {
      ...season,
      tournaments: updatedTournaments,
    };

    setSeason(newSeason);
    setPlayers(finalPlayers);
    triggerAutoSave(newSeason, finalPlayers);
  };

  // Simulate current unplayed round of tournament
  const handleSimulateCurrentRound = () => {
    let currTourn = { ...currentTournament };
    let currPlayers = [...players];
    const updatedTournaments = [...season.tournaments];

    // Find the lowest round with uncompleted matches
    const uncompleted = currTourn.matches.filter((m) => !m.isCompleted);
    if (uncompleted.length === 0) return;

    const roundToSimulate = Math.min(...uncompleted.map((m) => m.round));
    const roundMatches = currTourn.matches.filter((m) => m.round === roundToSimulate && !m.isCompleted);

    for (const m of roundMatches) {
      if (m.player1Id && m.player2Id) {
        const p1 = currPlayers.find((p) => p.id === m.player1Id);
        const p2 = currPlayers.find((p) => p.id === m.player2Id);
        if (p1 && p2) {
          const sim = simulateFullMatch(p1, p2, currTourn.surface, currTourn.setsToWin);
          m.score = sim.score;
          const adv = advanceTournamentMatch(currTourn, m.id, sim.winnerId, currPlayers);
          currTourn = adv.updatedTournament;
          currPlayers = adv.updatedPlayers;
        }
      }
    }

    if (currTourn.isCompleted) {
      currPlayers = finalizeTournamentAndDistributePoints(currTourn, currPlayers);
    }

    updatedTournaments[season.currentTournamentIndex] = currTourn;
    const newSeason: SeasonState = {
      ...season,
      tournaments: updatedTournaments,
    };

    setSeason(newSeason);
    setPlayers(currPlayers);
    triggerAutoSave(newSeason, currPlayers);
  };

  // Simulate entire current tournament
  const handleSimulateEntireTournament = () => {
    const { completedTournament, updatedPlayers } = simulateEntireTournament(
      currentTournament,
      players
    );

    const updatedTournaments = [...season.tournaments];
    updatedTournaments[season.currentTournamentIndex] = completedTournament;

    const newSeason: SeasonState = {
      ...season,
      tournaments: updatedTournaments,
    };

    setSeason(newSeason);
    setPlayers(updatedPlayers);
    triggerAutoSave(newSeason, updatedPlayers);
  };

  // Next tournament in calendar
  const handleNextTournament = () => {
    const nextIdx = season.currentTournamentIndex + 1;
    if (nextIdx < season.tournaments.length) {
      setSeason({
        ...season,
        currentTournamentIndex: nextIdx,
      });
      setCurrentTab('tournament');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Season completed! Show Year-End transition modal
      const atpNo1 = players.find((p) => p.tour === 'ATP' && p.rank === 1) || null;
      const wtaNo1 = players.find((p) => p.tour === 'WTA' && p.rank === 1) || null;

      setTransitionReport({
        year: season.year,
        nextYear: season.year + 1,
        atpChampion: atpNo1,
        wtaChampion: wtaNo1,
      });
    }
  };

  // Advance to next season year
  const handleStartNextSeasonYear = () => {
    if (!transitionReport) return;
    const nextYear = transitionReport.nextYear;
    setTransitionReport(null);

    // Evolve players: age + 1, slight rating growth or decline
    const evolvedPlayers = players.map((p) => {
      const isYoung = p.age < 23;
      const isVeteran = p.age > 33;
      const delta = isYoung ? 1 : isVeteran ? -1 : 0;

      return {
        ...p,
        age: p.age + 1,
        stats: {
          ...p.stats,
          serve: Math.min(99, Math.max(50, p.stats.serve + delta)),
          forehand: Math.min(99, Math.max(50, p.stats.forehand + delta)),
          backhand: Math.min(99, Math.max(50, p.stats.backhand + delta)),
          speed: Math.min(99, Math.max(50, p.stats.speed + (isVeteran ? -2 : delta))),
        },
      };
    });

    const newSeason = initializeNewSeason(evolvedPlayers, nextYear);
    setSeason(newSeason);
    setPlayers(evolvedPlayers);
    triggerAutoSave(newSeason, evolvedPlayers);
    setCurrentTab('tournament');
  };

  // Save Slots handlers
  const handleSaveToSlot = (slotId: number) => {
    saveToSlot(slotId, `Турнир: ${currentTournament.nameRu}`, season, players);
    reloadSlots();
    showSaveToast(`Сохранено в Слот #${slotId}`);
  };

  const handleLoadFromSlot = (slotId: number) => {
    const loaded = loadFromSlot(slotId);
    if (loaded) {
      const repaired = repairSeasonState(loaded.season, loaded.players);
      setSeason(repaired);
      setPlayers(loaded.players);
      setIsSavesModalOpen(false);
      showSaveToast(`Загружен Слот #${slotId}`);
    }
  };

  const handleDeleteSlot = (slotId: number) => {
    deleteSlot(slotId);
    reloadSlots();
  };

  const handleImportSave = (impSeason: SeasonState, impPlayers: Player[]) => {
    const repaired = repairSeasonState(impSeason, impPlayers);
    setSeason(repaired);
    setPlayers(impPlayers);
    triggerAutoSave(repaired, impPlayers);
    showSaveToast('Сохранение успешно импортировано');
  };

  const handleResetSeason = () => {
    const initialP = getInitialPlayers();
    const newS = initializeNewSeason(initialP, 2026);
    setPlayers(initialP);
    setSeason(newS);
    triggerAutoSave(newS, initialP);
    showSaveToast('Сезон сброшен к началу 2026 года');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      {/* Global Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'match') setActiveMatchToWatch(null);
        }}
        year={season.year}
        currentTournament={currentTournament}
        onOpenSaves={() => setIsSavesModalOpen(true)}
        lastAutoSaveTime={lastAutoSaveTime}
      />

      {/* Main Container View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'tournament' && (
          <TournamentBracket
            tournament={currentTournament}
            players={players}
            onSelectMatchToWatch={(match) => {
              setActiveMatchToWatch(match);
              setCurrentTab('match');
            }}
            onSimulateMatch={handleSimulateSingleMatch}
            onSimulateCurrentRound={handleSimulateCurrentRound}
            onSimulateEntireTournament={handleSimulateEntireTournament}
            onNextTournament={handleNextTournament}
          />
        )}

        {currentTab === 'match' && (
          <div>
            {activeMatchToWatch && activeMatchToWatch.player1Id && activeMatchToWatch.player2Id ? (
              <MatchViewer
                match={activeMatchToWatch}
                player1={players.find((p) => p.id === activeMatchToWatch.player1Id)!}
                player2={players.find((p) => p.id === activeMatchToWatch.player2Id)!}
                surface={currentTournament.surface}
                setsToWin={currentTournament.setsToWin}
                onMatchFinished={handleMatchFinishedFromViewer}
                onBackToBracket={() => setCurrentTab('tournament')}
              />
            ) : (
              <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 max-w-lg mx-auto">
                <div className="text-4xl mb-3">🎾</div>
                <h3 className="text-lg font-bold text-white mb-2">Матч не выбран</h3>
                <p className="text-xs text-slate-400 mb-6">
                  Перейдите во вкладку «Сетка» и нажмите кнопку «Зритель» на любом доступном матче для просмотра в режиме реального времени.
                </p>
                <button
                  onClick={() => setCurrentTab('tournament')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Перейти к сетке турнира
                </button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'rankings' && (
          <RankingsTable
            players={players}
            onSelectPlayer={(p) => setSelectedPlayerForModal(p)}
          />
        )}

        {currentTab === 'calendar' && (
          <CalendarView
            tournaments={season.tournaments}
            currentTournamentIndex={season.currentTournamentIndex}
            players={players}
            onSelectTournament={(idx) => {
              setSeason({ ...season, currentTournamentIndex: idx });
              setCurrentTab('tournament');
            }}
          />
        )}

        {currentTab === 'players' && (
          <PlayersDirectory
            players={players}
            onSelectPlayer={(p) => setSelectedPlayerForModal(p)}
          />
        )}
      </main>

      {/* Player Profile Detail Modal */}
      <PlayerProfileModal
        player={selectedPlayerForModal}
        onClose={() => setSelectedPlayerForModal(null)}
      />

      {/* Saves / Slots Modal */}
      <SavesModal
        isOpen={isSavesModalOpen}
        onClose={() => setIsSavesModalOpen(false)}
        currentSeason={season}
        currentPlayers={players}
        slots={slots}
        lastAutoSaveTime={lastAutoSaveTime}
        onSaveToSlot={handleSaveToSlot}
        onLoadFromSlot={handleLoadFromSlot}
        onDeleteSlot={handleDeleteSlot}
        onImportSave={handleImportSave}
        onResetSeason={handleResetSeason}
      />

      {/* Season Transition Modal */}
      <SeasonTransitionModal
        report={transitionReport}
        onClose={handleStartNextSeasonYear}
      />

      {/* Auto-save Toast notification */}
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 border border-emerald-500/40 text-white shadow-2xl backdrop-blur-md animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <div className="text-xs">
            <span className="font-bold text-emerald-400">{saveToast.message}</span>
            <span className="text-slate-400 ml-1.5 font-mono text-[10px]">[{saveToast.time}]</span>
          </div>
        </div>
      )}

      {/* Offline Connectivity Status Indicator Banner */}
      <OfflineIndicator />
    </div>
  );
}

export default App;
