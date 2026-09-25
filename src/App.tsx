import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { CalendarView } from './components/CalendarView';
import { MatchStatsCardModal } from './components/MatchStatsCardModal';
import { MatchViewer } from './components/MatchViewer';
import { ActiveTab, Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { PlayersDirectory } from './components/PlayersDirectory';
import { RankingsTable } from './components/RankingsTable';
import { SavesModal } from './components/SavesModal';
import { SeasonTransitionModal } from './components/SeasonTransitionModal';
import { TournamentBracket } from './components/TournamentBracket';
import { ALL_INITIAL_PLAYERS } from './data/players';
import {
  advanceTournamentRound,
  countSeasonCompletedMatches,
  createInitialSeason,
  deduplicateWeeklySeasonDraws,
  generateNextSeason,
  processTournamentPoints,
  syncSeasonWithCurrentRankings,
} from './engine/seasonManager';
import { Match, Player, SaveSlot, Season, SeasonTransitionReport, Tournament } from './types';
import {
  STORAGE_KEY_AUTOSAVE_TIME,
  STORAGE_KEY_PLAYERS,
  STORAGE_KEY_SEASON,
  STORAGE_KEY_SLOTS,
  cleanupStaleLocalStorage,
  deserializeSeason,
  getIDBItem,
  loadInitialGameStateSync,
  persistAllGameState,
  sanitizePlayer,
} from './utils/storage';

export default function App() {
  // Synchronous initialization from storage
  const initialData = useMemo(() => {
    const loaded = loadInitialGameStateSync(ALL_INITIAL_PLAYERS, p =>
      createInitialSeason(2026, p)
    );
    deduplicateWeeklySeasonDraws(loaded.season);
    return loaded;
  }, []);

  const [players, setPlayers] = useState<Player[]>(() => initialData.players);
  const [season, setSeason] = useState<Season>(() => initialData.season);
  const [slots, setSlots] = useState<(SaveSlot | null)[]>(() => initialData.slots);

  // Auto-save timestamp tracking (loaded from sync storage or 0)
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number>(() => initialData.lastAutoSaveTime || 0);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('tournament');

  // Specific tournament being viewed (null = default to season.currentTournamentIndex)
  const [viewingTournamentIndex, setViewingTournamentIndex] = useState<number | null>(null);

  // Saves modal open/close
  const [isSavesModalOpen, setIsSavesModalOpen] = useState<boolean>(false);

  // Season transition report modal
  const [transitionReport, setTransitionReport] = useState<SeasonTransitionReport | null>(null);

  // Auto-save feedback toast after match completion
  const [saveToast, setSaveToast] = useState<{ message: string; time: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSaveNotification = (message: string) => {
    const time = new Date().toLocaleTimeString('ru-RU');
    setSaveToast({ message, time });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setSaveToast(null);
    }, 3500);
  };

  // Guard against overwriting storage before initial hydration from IndexedDB completes
  const isHydratedRef = useRef<boolean>(false);

  // Hydrate from IndexedDB on mount if newer or richer data exists
  useEffect(() => {
    cleanupStaleLocalStorage();
    let isMounted = true;
    (async () => {
      try {
        const idbSeasonRaw = await getIDBItem<any>(STORAGE_KEY_SEASON);
        if (!isMounted || !idbSeasonRaw) return;

        const rawIdbPlayers = await getIDBItem<Player[]>(STORAGE_KEY_PLAYERS);
        const idbPlayers = rawIdbPlayers ? rawIdbPlayers.map(p => sanitizePlayer(p)) : players;
        const restoredSeason = deserializeSeason(idbSeasonRaw, idbPlayers);

        if (!restoredSeason || !restoredSeason.tournaments) return;

        // Guaranteed cleanup of any legacy self-matches or duplicate players in week/qualifying
        deduplicateWeeklySeasonDraws(restoredSeason);

        const hasAtp = restoredSeason.tournaments.some((t: Tournament) => t.tour === 'ATP');
        const hasWta = restoredSeason.tournaments.some((t: Tournament) => t.tour === 'WTA');
        if (hasAtp && hasWta) {
          const idbSlots = await getIDBItem<(SaveSlot | null)[]>(STORAGE_KEY_SLOTS);
          const idbTime = await getIDBItem<number>(STORAGE_KEY_AUTOSAVE_TIME);

          if (!isMounted) return;
          setSeason(current => {
            const currentMatches = countSeasonCompletedMatches(current);
            const restoredMatches = countSeasonCompletedMatches(restoredSeason);
            const currentSim = current.totalMatchesSimulated || 0;
            const restoredSim = restoredSeason.totalMatchesSimulated || 0;

            // Restore if IndexedDB has more completed matches, or higher simulation counter,
            // or if local state was an unplayed fallback, or if timestamp is newer
            if (
              restoredMatches > currentMatches ||
              restoredSim > currentSim ||
              (currentMatches === 0 && restoredMatches > 0) ||
              (!initialData.hasSavedData && restoredMatches >= currentMatches) ||
              ((idbTime || 0) > (initialData.lastAutoSaveTime || 0) && restoredMatches >= currentMatches)
            ) {
              return restoredSeason;
            }
            return current;
          });

          if (idbPlayers && idbPlayers.length >= 100) {
            setPlayers(idbPlayers);
          }
          if (idbSlots && Array.isArray(idbSlots)) {
            setSlots(
              idbSlots.map(s =>
                s
                  ? {
                      ...s,
                      seasonData: deserializeSeason(s.seasonData, s.playersData || idbPlayers),
                    }
                  : null
              )
            );
          }
          if (idbTime) {
            setLastAutoSaveTime(idbTime);
          }
        }
      } catch (err) {
        console.warn('Initial IndexedDB hydration note:', err);
      } finally {
        if (isMounted) {
          isHydratedRef.current = true;
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Immediate synchronous persistence helper after each match or simulation
  const persistGameProgressImmediately = (
    newSeason: Season,
    newPlayers: Player[],
    message?: string
  ) => {
    const now = Date.now();
    setLastAutoSaveTime(now);
    persistAllGameState(newSeason, newPlayers, slots);
    if (message) {
      triggerSaveNotification(message);
    }
  };

  // Active match being watched in spectator mode
  const [activeSpectatorMatch, setActiveSpectatorMatch] = useState<Match | null>(null);

  // Modals
  const [selectedMatchForCard, setSelectedMatchForCard] = useState<Match | null>(null);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<Player | null>(null);

  // Automatic durable save whenever season, players, or slots change (only after initial hydration has settled)
  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }
    persistAllGameState(season, players, slots);
    setLastAutoSaveTime(Date.now());
  }, [season, players, slots]);

  // Active tournament in view (either viewing specific tournament or currently active in season)
  const activeTournamentIndex = viewingTournamentIndex ?? season.currentTournamentIndex;
  const currentTournament: Tournament = useMemo(() => {
    return (
      season.tournaments[activeTournamentIndex] ||
      season.tournaments[season.currentTournamentIndex] ||
      season.tournaments[0]
    );
  }, [season, activeTournamentIndex]);

  // Collect all matches across all tournaments
  const allMatches: Match[] = useMemo(() => {
    const matches: Match[] = [];
    season.tournaments.forEach(t => {
      matches.push(...t.matches);
    });
    return matches;
  }, [season]);

  // Select an active match to watch in spectator mode
  const handleSelectMatchToWatch = (match: Match) => {
    setActiveSpectatorMatch(match);
    setActiveTab('match');
  };

  // If spectator tab is opened but no match is active, pick first pending match
  useEffect(() => {
    if (activeTab === 'match' && !activeSpectatorMatch) {
      const firstPending = currentTournament.matches.find(m => !m.isCompleted);
      if (firstPending) {
        setActiveSpectatorMatch(firstPending);
      } else if (currentTournament.matches.length > 0) {
        setActiveSpectatorMatch(currentTournament.matches[0]);
      }
    }
  }, [activeTab, activeSpectatorMatch, currentTournament]);

  // Handle completed match from spectator view
  const handleMatchCompleteFromViewer = (updatedMatch: Match) => {
    const targetIdx = activeTournamentIndex;
    let completedTrn: Tournament | null = null;

    const updatedTournaments = season.tournaments.map((trn, idx) => {
      if (idx !== targetIdx) return trn;
      const updatedMatches = trn.matches.map(m => (m.id === updatedMatch.id ? updatedMatch : m));
      const updated = { ...trn, matches: updatedMatches };
      advanceTournamentRound(updated);

      if (updated.completed) {
        completedTrn = updated;
      }

      return updated;
    });

    const totalSim = countSeasonCompletedMatches({
      ...season,
      tournaments: updatedTournaments,
    });
    const totalSimulated = Math.max(season.totalMatchesSimulated + 1, totalSim);

    if (completedTrn) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (err) {
        console.warn('Confetti effect bypassed:', err);
      }

      // Update player ranking points (ATP or WTA)
      const updatedPlayers = processTournamentPoints(completedTrn, players);
      setPlayers(updatedPlayers);

      // Re-seed upcoming unplayed tournaments with latest dynamic player rankings
      const syncedSeason = syncSeasonWithCurrentRankings({
        ...season,
        currentTournamentIndex: targetIdx,
        tournaments: updatedTournaments,
        totalMatchesSimulated: totalSimulated,
      }, updatedPlayers);
      setSeason(syncedSeason);
      setViewingTournamentIndex(null);

      // Save instantly to disk/localStorage after final match
      persistGameProgressImmediately(
        syncedSeason,
        updatedPlayers,
        `🏆 Турнир ${(completedTrn as Tournament).nameRu} завершён! Прогресс надёжно сохранён.`
      );
    } else {
      const nextSeason = {
        ...season,
        currentTournamentIndex: targetIdx,
        tournaments: updatedTournaments,
        totalMatchesSimulated: totalSimulated,
      };
      setSeason(nextSeason);
      setViewingTournamentIndex(null);

      // Save instantly to disk/localStorage after every single match
      persistGameProgressImmediately(
        nextSeason,
        players,
        `✓ Матч ${updatedMatch.player1.name} — ${updatedMatch.player2.name} сохранён!`
      );
    }
  };

  // Handle updates from tournament bracket (round sim, full sim)
  const handleTournamentUpdate = (updatedTournament: Tournament) => {
    const targetIdx = activeTournamentIndex;
    const updatedTournaments = season.tournaments.map((trn, idx) => {
      if (idx !== targetIdx) return trn;
      return updatedTournament;
    });

    const totalSim = countSeasonCompletedMatches({
      ...season,
      tournaments: updatedTournaments,
    });
    const totalSimulated = Math.max(season.totalMatchesSimulated, totalSim);

    if (updatedTournament.completed) {
      try {
        confetti({
          particleCount: 100,
          spread: 90,
          origin: { y: 0.6 },
        });
      } catch (err) {
        console.warn('Confetti effect bypassed:', err);
      }
      const updatedPlayers = processTournamentPoints(updatedTournament, players);
      setPlayers(updatedPlayers);

      // Re-seed upcoming unplayed tournaments with latest dynamic player rankings
      const syncedSeason = syncSeasonWithCurrentRankings({
        ...season,
        currentTournamentIndex: targetIdx,
        tournaments: updatedTournaments,
        totalMatchesSimulated: totalSimulated,
      }, updatedPlayers);
      setSeason(syncedSeason);
      setViewingTournamentIndex(null);

      // Save instantly after simulated tournament completes
      persistGameProgressImmediately(
        syncedSeason,
        updatedPlayers,
        `🏆 Турнир ${updatedTournament.nameRu} завершён и сохранён!`
      );
    } else {
      const completedCount = updatedTournament.matches.filter(m => m.isCompleted).length;
      const nextSeason = {
        ...season,
        currentTournamentIndex: targetIdx,
        tournaments: updatedTournaments,
        totalMatchesSimulated: totalSimulated,
      };
      setSeason(nextSeason);
      setViewingTournamentIndex(null);

      // Save instantly after match or round simulation
      persistGameProgressImmediately(
        nextSeason,
        players,
        `✓ Матч сохранён (сыграно ${completedCount} в турнире)`
      );
    }
  };

  // Set specific tournament as current active tournament in season
  const handleSetCurrentTournament = (index: number) => {
    if (index < 0 || index >= season.tournaments.length) return;

    // Find active week
    const curActive = season.tournaments[season.currentTournamentIndex];
    const activeWeek = (curActive && !curActive.completed)
      ? curActive.week
      : (season.tournaments.find(t => !t.completed)?.week ?? curActive?.week ?? 1);

    // Check if any tournament in active week is currently in progress (has played matches and is NOT completed)
    const tournamentInProgress = season.tournaments.find(
      t => t.week === activeWeek && !t.completed && (
        t.matches.some(m => m.isCompleted) || (t.qualifyingMatches?.some(m => m.isCompleted) ?? false)
      )
    );

    const targetTrn = season.tournaments[index];

    // If another tournament is in progress, only allow viewing the requested tournament
    if (tournamentInProgress && targetTrn && targetTrn.id !== tournamentInProgress.id) {
      triggerSaveNotification(`🔒 Сначала завершите текущий турнир: ${tournamentInProgress.tour} ${tournamentInProgress.nameRu}!`);
      setViewingTournamentIndex(index);
      setActiveSpectatorMatch(null);
      setActiveTab('tournament');
      return;
    }

    setViewingTournamentIndex(null);
    setSeason(prev => ({
      ...prev,
      currentTournamentIndex: index,
    }));
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');
    if (targetTrn) {
      triggerSaveNotification(`Выбран турнир: ${targetTrn.tour} ${targetTrn.nameRu}`);
    }
  };

  // Next tournament in season (with support for choosing specific tournament or smart week progression)
  const handleNextTournament = (targetIndex?: number) => {
    setViewingTournamentIndex(null);
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');

    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < season.tournaments.length) {
      setSeason(prev => ({
        ...prev,
        currentTournamentIndex: targetIndex,
      }));
      const selectedTrn = season.tournaments[targetIndex];
      if (selectedTrn) {
        triggerSaveNotification(`Выбран турнир: ${selectedTrn.tour} ${selectedTrn.nameRu}`);
      }
      return;
    }

    // Default smart progression:
    const currentTrn = season.tournaments[season.currentTournamentIndex];
    const currentWeek = currentTrn?.week;

    // 1. Look for any remaining uncompleted tournament in current week
    const nextInSameWeek = season.tournaments.findIndex(
      (t, idx) => t.week === currentWeek && !t.completed && idx !== season.currentTournamentIndex
    );
    if (nextInSameWeek !== -1) {
      setSeason(prev => ({
        ...prev,
        currentTournamentIndex: nextInSameWeek,
      }));
      return;
    }

    // 2. Look for first uncompleted tournament in whole season
    const firstUncompleted = season.tournaments.findIndex(t => !t.completed);
    if (firstUncompleted !== -1) {
      setSeason(prev => ({
        ...prev,
        currentTournamentIndex: firstUncompleted,
      }));
      return;
    }

    // 3. Whole season finished!
    handleGenerateNextSeason();
  };

  // User selects any tournament from bracket bar or calendar
  const handleSelectTournament = (idx: number) => {
    setViewingTournamentIndex(idx);
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');
  };

  // Generate new season (2027, 2028, etc.) with aging, retirement & debutants
  const handleGenerateNextSeason = () => {
    const { season: nextSeason, updatedPlayers, report } = generateNextSeason(season, players);
    setSeason(nextSeason);
    setPlayers(updatedPlayers);
    setTransitionReport(report);
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');
    persistGameProgressImmediately(nextSeason, updatedPlayers, `Стартовал сезон ${nextSeason.year}!`);
    confetti({
      particleCount: 150,
      spread: 120,
      origin: { y: 0.5 },
    });
  };

  // Open player profile modal
  const handleOpenPlayerModal = (playerId: string) => {
    const p = players.find(x => x.id === playerId);
    if (p) setSelectedPlayerForModal(p);
  };

  // Save Slot Operations
  const handleSaveToSlot = (slotNumber: number) => {
    const curTrn = currentTournament;
    const totalSim = countSeasonCompletedMatches(season);
    const simulatedCount = Math.max(season.totalMatchesSimulated, totalSim);
    const updatedSeason = { ...season, totalMatchesSimulated: simulatedCount };

    const newSlot: SaveSlot = {
      id: `slot_${slotNumber}_${Date.now()}`,
      slotNumber,
      name: `Слот #${slotNumber} — ${curTrn.tour} ${curTrn.nameRu}`,
      savedAt: Date.now(),
      seasonYear: season.year,
      seasonData: updatedSeason,
      playersData: players,
      currentTournamentName: curTrn.nameRu,
      currentTournamentTour: curTrn.tour,
      totalMatchesSimulated: simulatedCount,
    };

    const nextSlots = [...slots];
    nextSlots[slotNumber - 1] = newSlot;
    setSlots(nextSlots);
    persistAllGameState(updatedSeason, players, nextSlots);
    setLastAutoSaveTime(Date.now());
    triggerSaveNotification(`Слот #${slotNumber} успешно записан`);
  };

  const handleLoadFromSlot = (slot: SaveSlot) => {
    const loadedSeason = slot.seasonData;
    const loadedPlayers = slot.playersData || players;
    setSeason(loadedSeason);
    setPlayers(loadedPlayers);
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');
    persistAllGameState(loadedSeason, loadedPlayers, slots);
    setLastAutoSaveTime(Date.now());
    triggerSaveNotification(`Загружен прогресс из слота #${slot.slotNumber}`);
  };

  const handleDeleteSlot = (slotNumber: number) => {
    const nextSlots = [...slots];
    nextSlots[slotNumber - 1] = null;
    setSlots(nextSlots);
    persistAllGameState(season, players, nextSlots);
  };

  const handleImportSave = (newSeason: Season, newPlayers: Player[]) => {
    const restoredSeason = deserializeSeason(newSeason, newPlayers);
    setSeason(restoredSeason);
    setPlayers(newPlayers);
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');
    persistAllGameState(restoredSeason, newPlayers, slots);
    setLastAutoSaveTime(Date.now());
    triggerSaveNotification(`Сохранение успешно импортировано`);
  };

  const handleResetSeason = () => {
    const freshPlayers = ALL_INITIAL_PLAYERS.map(p => ({ ...p }));
    const freshSeason = createInitialSeason(2026, freshPlayers);
    setPlayers(freshPlayers);
    setSeason(freshSeason);
    setActiveSpectatorMatch(null);
    setActiveTab('tournament');
    persistAllGameState(freshSeason, freshPlayers, [null, null, null]);
    triggerSaveNotification(`Прогресс сброшен к началу сезона 2026`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-slate-950 w-full max-w-full overflow-x-hidden">
      
      {/* Navigation Header */}
      <Navbar
        currentTab={activeTab}
        onTabChange={setActiveTab}
        year={season.year}
        currentTournament={currentTournament}
        onOpenSaves={() => setIsSavesModalOpen(true)}
        lastAutoSaveTime={lastAutoSaveTime}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 overflow-x-hidden">
        {activeTab === 'tournament' && (
          <TournamentBracket
            tournament={currentTournament}
            season={season}
            onSelectTournament={handleSelectTournament}
            onSetCurrentTournament={handleSetCurrentTournament}
            onSelectMatchToWatch={handleSelectMatchToWatch}
            onSelectMatchCard={setSelectedMatchForCard}
            onSelectPlayer={handleOpenPlayerModal}
            onTournamentUpdate={handleTournamentUpdate}
            onNextTournament={handleNextTournament}
          />
        )}

        {activeTab === 'match' && (
          <div>
            {activeSpectatorMatch ? (
              <MatchViewer
                key={activeSpectatorMatch.id}
                match={activeSpectatorMatch}
                surface={currentTournament.surface}
                onMatchComplete={handleMatchCompleteFromViewer}
                onOpenCard={setSelectedMatchForCard}
                onOpenPlayer={handleOpenPlayerModal}
              />
            ) : (
              <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
                <p className="text-slate-400 text-sm">
                  Нет выбранного матча для просмотра. Выберите матч из сетки текущего турнира!
                </p>
                <button
                  onClick={() => setActiveTab('tournament')}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Перейти к сетке турнира
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rankings' && (
          <RankingsTable
            players={players}
            onSelectPlayer={handleOpenPlayerModal}
            initialTour={currentTournament.tour}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            season={season}
            onSelectTournament={handleSelectTournament}
            onSetCurrentTournament={handleSetCurrentTournament}
          />
        )}

        {activeTab === 'players' && (
          <PlayersDirectory
            players={players}
            season={season}
            allMatches={allMatches}
            onSelectPlayer={handleOpenPlayerModal}
            onGenerateNextSeason={handleGenerateNextSeason}
          />
        )}
      </main>

      {/* Match Protocol Card Modal (exact requested format S1, S2, etc.) */}
      <MatchStatsCardModal
        match={selectedMatchForCard}
        onClose={() => setSelectedMatchForCard(null)}
        onOpenPlayer={handleOpenPlayerModal}
      />

      {/* Player Profile Modal */}
      <PlayerProfileModal
        player={selectedPlayerForModal}
        allMatches={allMatches}
        allPlayers={players}
        season={season}
        onClose={() => setSelectedPlayerForModal(null)}
        onSelectMatch={setSelectedMatchForCard}
        onSelectPlayer={handleOpenPlayerModal}
      />

      {/* Saves & Autosaves Modal */}
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

      {/* Season Transition / Retirement & New Talents Modal */}
      <SeasonTransitionModal
        report={transitionReport}
        onClose={() => setTransitionReport(null)}
      />

      {/* Auto-save notification toast after match completion */}
      {saveToast && (
        <div
          id="auto-save-match-toast"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border border-emerald-500/40 text-white shadow-2xl shadow-emerald-500/10 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-sm">
            💾
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Сохранено после матча</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                {saveToast.time}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 max-w-xs truncate">
              {saveToast.message}
            </div>
          </div>
        </div>
      )}

      {/* Offline Connectivity Status Indicator */}
      <OfflineIndicator />

    </div>
  );
}
