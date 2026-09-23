import { Award, ChevronRight, Flame, Globe, HeartHandshake, Shield, Sparkles, Trophy, UserCheck, X, Zap } from 'lucide-react';
import { SeasonTransitionReport } from '../types';

interface SeasonTransitionModalProps {
  report: SeasonTransitionReport | null;
  onClose: () => void;
}

export function SeasonTransitionModal({ report, onClose }: SeasonTransitionModalProps) {
  if (!report) return null;

  return (
    <div
      id="season-transition-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-purple-500/40 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header Banner */}
        <div className="relative p-6 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border-b border-purple-500/20">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Межсезонье • Переход поколений</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Старт Сезона {report.toYear}!</span>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {report.fromYear} ➔ {report.toYear}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Рейтинговые очки пересчитаны с защитой 85%, все игроки повзрослели на 1 год, усталость сброшена, а травмы залечены.
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-200">
          
          {/* 1. Retired Players / Hall of Fame */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-rose-400" />
                <span>Завершили карьеру ({report.retiredPlayers.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">Ветераны 36+ лет</span>
            </div>

            {report.retiredPlayers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.retiredPlayers.map(p => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/20 hover:border-rose-500/40 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{p.flag}</span>
                          <span className="font-bold text-sm text-white">{p.name}</span>
                        </div>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                          p.tour === 'ATP' ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {p.tour}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Завершил в <strong className="text-slate-200">{p.retiredAtAge} лет</strong> • {p.country} • {p.style}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 font-mono">
                      <span className="flex items-center gap-1 text-amber-300">
                        <Trophy className="w-3.5 h-3.5" />
                        {p.careerTitles} {p.careerTitles === 1 ? 'титул' : p.careerTitles >= 2 && p.careerTitles <= 4 ? 'титула' : 'титулов'}
                      </span>
                      <span className="text-slate-400">
                        Пик: <strong className="text-sky-400">#{p.peakRank || p.rankAtRetirement}</strong>
                      </span>
                      <span className="text-slate-400">
                        {p.wins}В - {p.losses}П
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Все действующие ветераны тура (36+ лет) решили продолжить выступления и провести еще один сезон!</span>
              </div>
            )}
          </div>

          {/* 2. New Talents / Debutants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Новые таланты в туре ({report.newTalents.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">Дебютанты 18–20 лет</span>
            </div>

            {report.newTalents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.newTalents.map(p => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/20 hover:border-amber-500/40 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{p.flag}</span>
                          <span className="font-bold text-sm text-white">{p.name}</span>
                        </div>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                          p.tour === 'ATP' ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {p.tour}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Дебютант <strong className="text-amber-300">{p.age} лет</strong> • {p.country} • {p.style}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 font-mono">
                      <span className="text-sky-300">
                        Старт: #{p.rank}
                      </span>
                      <span className="text-amber-300">
                        {p.points} очков
                      </span>
                      <span className="text-slate-400 font-sans">
                        Любимое: {p.favSurface}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400">
                Состав тура стабилен: новых дебютантов не потребовалось.
              </div>
            )}
          </div>

          {/* 3. Physical State & Evolution Summary */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400">Возраст</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                +{report.agedPlayersCount} игроков
              </div>
              <div className="text-[10px] text-slate-500">Стали на 1 год старше</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400">Динамика навыков</div>
              <div className="text-base font-bold text-purple-400 mt-0.5">
                {report.statChangesCount} изменений
              </div>
              <div className="text-[10px] text-slate-500">Опыт ветеранов / рост юных</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400">Здоровье и отдых</div>
              <div className="text-base font-bold text-sky-400 mt-0.5">
                100% готовность
              </div>
              <div className="text-[10px] text-slate-500">Усталость 0%, травмы залечены</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            id="close-season-transition-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Вперёд в Сезон {report.toYear}!</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
