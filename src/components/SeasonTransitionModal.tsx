import React from 'react';
import { Trophy, ArrowRight, Award } from 'lucide-react';
import { Player, TourType } from '../types';

interface TransitionReport {
  year: number;
  nextYear: number;
  atpChampion: Player | null;
  wtaChampion: Player | null;
}

interface SeasonTransitionModalProps {
  report: TransitionReport | null;
  onClose: () => void;
}

export const SeasonTransitionModal: React.FC<SeasonTransitionModalProps> = ({
  report,
  onClose,
}) => {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-3xl">
          🏆
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white">Сезон {report.year} завершен!</h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-6">
          Подведение итогов теннисного года и коронация первых ракеток мира
        </p>

        {/* Champions Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-left">
          {report.atpChampion && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-sky-500/30">
              <span className="text-[10px] font-black uppercase text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                #1 ATP в {report.year} году
              </span>
              <div className="flex items-center gap-2.5 mt-2">
                <span className="text-2xl">{report.atpChampion.flag}</span>
                <div>
                  <div className="font-extrabold text-white text-sm">
                    {report.atpChampion.nameRu}
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    {report.atpChampion.points} очков
                  </div>
                </div>
              </div>
            </div>
          )}

          {report.wtaChampion && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-rose-500/30">
              <span className="text-[10px] font-black uppercase text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                #1 WTA в {report.year} году
              </span>
              <div className="flex items-center gap-2.5 mt-2">
                <span className="text-2xl">{report.wtaChampion.flag}</span>
                <div>
                  <div className="font-extrabold text-white text-sm">
                    {report.wtaChampion.nameRu}
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    {report.wtaChampion.points} очков
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <span>Начать сезон {report.nextYear} года</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
