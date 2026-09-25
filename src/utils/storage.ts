import { Player, SaveSlot, SeasonState } from '../types';

const SAVE_PREFIX = 'tennis_season_slot_';
const AUTOSAVE_KEY = 'tennis_season_autosave';
const AUTOSAVE_TIMESTAMP_KEY = 'tennis_season_autosave_ts';

export function getSaveSlots(): SaveSlot[] {
  const slots: SaveSlot[] = [];
  for (let i = 1; i <= 5; i++) {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${i}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SaveSlot;
        slots.push(parsed);
      } catch (e) {
        console.error('Error parsing save slot', i, e);
      }
    }
  }
  return slots;
}

export function saveToSlot(slotId: number, name: string, season: SeasonState, players: Player[]): void {
  const slotData: SaveSlot = {
    id: slotId,
    name: name || `Сохранение #${slotId} (${season.year} г.)`,
    date: new Date().toLocaleString('ru-RU'),
    season,
    players,
    timestamp: Date.now(),
  };
  localStorage.setItem(`${SAVE_PREFIX}${slotId}`, JSON.stringify(slotData));
}

export function loadFromSlot(slotId: number): { season: SeasonState; players: Player[] } | null {
  const raw = localStorage.getItem(`${SAVE_PREFIX}${slotId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveSlot;
    return { season: parsed.season, players: parsed.players };
  } catch {
    return null;
  }
}

export function deleteSlot(slotId: number): void {
  localStorage.removeItem(`${SAVE_PREFIX}${slotId}`);
}

export function autoSaveCurrentState(season: SeasonState, players: Player[]): void {
  try {
    const data = {
      season,
      players,
      timestamp: Date.now(),
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    localStorage.setItem(AUTOSAVE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.error('AutoSave failed', e);
  }
}

export function loadAutoSave(): { season: SeasonState; players: Player[]; timestamp: number } | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function getLastAutoSaveTime(): number | null {
  const raw = localStorage.getItem(AUTOSAVE_TIMESTAMP_KEY);
  return raw ? parseInt(raw, 10) : null;
}

export function exportSaveToFile(season: SeasonState, players: Player[]): void {
  const exportData = {
    app: 'Tennis_ATP_WTA_Tour_Simulator',
    version: '1.0',
    timestamp: Date.now(),
    date: new Date().toISOString(),
    season,
    players,
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Tennis_Season_${season.year}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
