import React, { useState } from 'react';
import { Player, SaveSlot, Season } from '../types';
import { Download, Upload, Trash2, CheckCircle2, RotateCcw, X, HardDrive, Clock, Trophy } from 'lucide-react';
import { optimizeSeasonForStorage } from '../utils/storage';

interface SavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSeason: Season;
  currentPlayers: Player[];
  slots: (SaveSlot | null)[];
  lastAutoSaveTime: number;
  onSaveToSlot: (slotNumber: number) => void;
  onLoadFromSlot: (slot: SaveSlot) => void;
  onDeleteSlot: (slotNumber: number) => void;
  onImportSave: (season: Season, players: Player[]) => void;
  onResetSeason: () => void;
}

export const SavesModal: React.FC<SavesModalProps> = ({
  isOpen,
  onClose,
  currentSeason,
  currentPlayers,
  slots,
  lastAutoSaveTime,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSlot,
  onImportSave,
  onResetSeason,
}) => {
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => setActiveNotification(null), 3500);
  };

  const handleExport = () => {
    const exportData = {
      version: 2,
      savedAt: Date.now(),
      season: optimizeSeasonForStorage(currentSeason),
      players: currentPlayers,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tennis_tour_save_season_${currentSeason.year}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showFeedback('Файл сохранения (.json) успешно скачан!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        if (raw.season && raw.players && Array.isArray(raw.season.tournaments)) {
          onImportSave(raw.season, raw.players);
          showFeedback('Сохранение успешно импортировано!');
        } else {
          alert('Некорректный формат файла сохранения.');
        }
      } catch (err) {
        alert('Ошибка при чтении файла сохранения.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentTournament = currentSeason.tournaments[currentSeason.currentTournamentIndex] || currentSeason.tournaments[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Управление Сохранениями</h2>
              <p className="text-xs text-slate-400">Автосохранение, ручные слоты и экспорт прогресса туров ATP / WTA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {activeNotification && (
          <div className="bg-emerald-500/15 border-y border-emerald-500/30 px-6 py-2.5 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>{activeNotification}</span>
          </div>
        )}

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Autosave Status Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Автосохранение активно</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                    после каждого матча
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Последнее автосохранение: {lastAutoSaveTime > 0 ? new Date(lastAutoSaveTime).toLocaleTimeString('ru-RU') : 'при любом завершённом матче'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50 self-start sm:self-auto">
              Сезон {currentSeason.year} • Турнир {currentSeason.currentTournamentIndex + 1}/{currentSeason.tournaments.length}
            </div>
          </div>

          {/* Manual Slots Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Ручные Слоты Сохранений</h3>
              <span className="text-xs text-slate-500">3 независимых слота</span>
            </div>

            <div className="grid gap-3">
              {[1, 2, 3].map((slotNumber) => {
                const slot = slots[slotNumber - 1];

                return (
                  <div
                    key={slotNumber}
                    className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-700/60 font-bold text-xs flex items-center justify-center text-slate-300 shrink-0">
                        №{slotNumber}
                      </div>
                      <div>
                        {slot ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{slot.name}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  slot.currentTournamentTour === 'ATP'
                                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {slot.currentTournamentTour}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Trophy className="w-3 h-3 text-amber-400" />
                                {slot.currentTournamentName}
                              </span>
                              <span>•</span>
                              <span>Матчей: {slot.totalMatchesSimulated}</span>
                              <span>•</span>
                              <span>{new Date(slot.savedAt).toLocaleString('ru-RU')}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-slate-400">Свободный слот</div>
                            <div className="text-xs text-slate-500">Нет сохраненных данных</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {slot ? (
                        <>
                          <button
                            onClick={() => {
                              onLoadFromSlot(slot);
                              showFeedback(`Слот №${slotNumber} загружен!`);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                          >
                            Загрузить
                          </button>
                          <button
                            onClick={() => {
                              onSaveToSlot(slotNumber);
                              showFeedback(`Слот №${slotNumber} перезаписан!`);
                            }}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                          >
                            Перезаписать
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Удалить сохранение в слоте №${slotNumber}?`)) {
                                onDeleteSlot(slotNumber);
                                showFeedback(`Слот №${slotNumber} очищен.`);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Удалить сохранение"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            onSaveToSlot(slotNumber);
                            showFeedback(`Сохранено в слот №${slotNumber}!`);
                          }}
                          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        >
                          Сохранить сюда
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Import / Export File Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Резервное Копирование (Файлы JSON)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 p-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-white text-xs font-semibold transition-colors group"
              >
                <Download className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                <span>Скачать файл сохранения (.json)</span>
              </button>

              <label className="flex items-center justify-center gap-2 p-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-white text-xs font-semibold transition-colors cursor-pointer group">
                <Upload className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Загрузить файл сохранения (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>
            </div>
          </div>

          {/* Reset Season Danger Zone */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30">
              <div>
                <div className="text-xs font-bold text-rose-400 uppercase tracking-wide">Сброс Прогресса</div>
                <div className="text-xs text-slate-400">Начать сезон 2026 заново с базовыми очками ATP и WTA</div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Вы действительно хотите сбросить текущий прогресс и начать сезон 2026 заново?')) {
                    onResetSeason();
                    showFeedback('Сезон сброшен к начальному состоянию.');
                  }
                }}
                className="px-3.5 py-1.5 bg-rose-900/50 hover:bg-rose-800/60 text-rose-200 border border-rose-700/50 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сбросить сезон</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
