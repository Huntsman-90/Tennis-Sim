import React, { useRef } from 'react';
import { X, Save, Upload, Download, Trash2, RefreshCw, HardDrive } from 'lucide-react';
import { Player, SaveSlot, SeasonState } from '../types';
import { exportSaveToFile } from '../utils/storage';

interface SavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSeason: SeasonState;
  currentPlayers: Player[];
  slots: SaveSlot[];
  lastAutoSaveTime: number | null;
  onSaveToSlot: (slotId: number) => void;
  onLoadFromSlot: (slotId: number) => void;
  onDeleteSlot: (slotId: number) => void;
  onImportSave: (season: SeasonState, players: Player[]) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.season && parsed.players) {
          onImportSave(parsed.season, parsed.players);
          onClose();
        } else {
          alert('Неверный формат файла сохранения');
        }
      } catch {
        alert('Ошибка при чтении файла');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Управление сохранениями</h2>
            <p className="text-xs text-slate-400">Слоты сохранений, автосохранение и экспорт</p>
          </div>
        </div>

        {/* AutoSave Status Banner */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Автосохранение активно
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lastAutoSaveTime
                ? `Последнее сохранение: ${new Date(lastAutoSaveTime).toLocaleTimeString('ru-RU')}`
                : 'Сохраняется автоматически после завершения каждого матча'}
            </p>
          </div>
        </div>

        {/* 5 Save Slots */}
        <div className="space-y-3 mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Слоты сохранений (1–5)</h3>
          {[1, 2, 3, 4, 5].map((slotId) => {
            const existing = slots.find((s) => s.id === slotId);

            return (
              <div
                key={slotId}
                className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Слот #{slotId}</span>
                    {existing && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {existing.date}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {existing ? `${existing.name}` : 'Пустой слот'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSaveToSlot(slotId)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1 cursor-pointer border border-slate-700"
                    title="Сохранить в этот слот"
                  >
                    <Save className="w-3.5 h-3.5 text-sky-400" />
                    <span>Записать</span>
                  </button>

                  {existing && (
                    <>
                      <button
                        onClick={() => onLoadFromSlot(slotId)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition cursor-pointer"
                        title="Загрузить сохранение"
                      >
                        Загрузить
                      </button>

                      <button
                        onClick={() => onDeleteSlot(slotId)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                        title="Удалить слот"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* JSON Import & Export */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => exportSaveToFile(currentSeason, currentPlayers)}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Экспорт в JSON</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Импорт из JSON</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Reset Season */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">Начать сезон заново?</span>
          <button
            onClick={() => {
              if (confirm('Вы уверены, что хотите начать новый сезон 2026 года? Текущий прогресс будет сброшен.')) {
                onResetSeason();
                onClose();
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Сбросить сезон</span>
          </button>
        </div>
      </div>
    </div>
  );
};
