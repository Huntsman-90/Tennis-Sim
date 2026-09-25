import React from 'react';
import { X, Trophy, Award, Zap, Shield, Activity } from 'lucide-react';
import { Player } from '../types';

interface PlayerProfileModalProps {
  player: Player | null;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  onClose,
}) => {
  if (!player) return null;

  const statList = [
    { label: 'Подача (Serve)', val: player.stats.serve, color: 'bg-amber-500' },
    { label: 'Форхенд (Forehand)', val: player.stats.forehand, color: 'bg-rose-500' },
    { label: 'Бэкхенд (Backhand)', val: player.stats.backhand, color: 'bg-sky-500' },
    { label: 'Скорость & Реакция (Speed)', val: player.stats.speed, color: 'bg-emerald-500' },
    { label: 'Выносливость (Stamina)', val: player.stats.stamina, color: 'bg-indigo-500' },
    { label: 'Психология (Mental)', val: player.stats.mental, color: 'bg-purple-500' },
    { label: 'Клатч / Важные очки (Clutch)', val: player.stats.clutch, color: 'bg-teal-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Player Header Card */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shadow-lg shrink-0">
            {player.flag}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                #{player.rank} в мире
              </span>
              <span className="text-xs font-bold text-slate-400">
                {player.tour} Тур
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              {player.nameRu}
            </h2>
            <p className="text-xs text-slate-400">
              {player.country} • {player.age} лет • {player.handedness === 'Right' ? 'Правша' : 'Левша'} ({player.backhandType === 'One-handed' ? 'Одноручный' : 'Двуручный'})
            </p>
          </div>
        </div>

        {/* Career Trophy Highlights */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
            <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <div className="text-lg font-black text-white">{player.careerTitles}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Всего титулов</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
            <Award className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <div className="text-lg font-black text-white">{player.grandSlams}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Шлемы (GS)</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
            <Zap className="w-4 h-4 text-sky-400 mx-auto mb-1" />
            <div className="text-lg font-black text-white">${(player.prizeMoney / 1000000).toFixed(1)}M</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Призовые</div>
          </div>
        </div>

        {/* Radar & Skill Bars */}
        <div className="space-y-4 mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Навыки и атрибуты игрока
          </h3>
          <div className="space-y-2.5">
            {statList.map((st, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{st.label}</span>
                  <span className="font-mono text-white font-bold">{st.val} / 99</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full ${st.color} rounded-full transition-all duration-500`}
                    style={{ width: `${(st.val / 99) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Surface Specialization */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Эффективность по покрытиям</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block mb-1">Хард</span>
              <span className="font-bold text-sky-400 font-mono">
                {Math.round(player.stats.hardAffinity * 100)}%
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block mb-1">Грунт</span>
              <span className="font-bold text-amber-500 font-mono">
                {Math.round(player.stats.clayAffinity * 100)}%
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block mb-1">Трава</span>
              <span className="font-bold text-emerald-400 font-mono">
                {Math.round(player.stats.grassAffinity * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
