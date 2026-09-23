import { useState } from 'react';
import { Activity, AlertCircle, Award, ChevronRight, Clock, Flame, Globe, HeartHandshake, HeartPulse, Sparkles, Swords, TrendingUp, Trophy, X, Zap } from 'lucide-react';
import { calculateRetirementChance } from '../engine/seasonManager';
import { Match, Player, Season } from '../types';
import { PlayerRatingChart } from './PlayerRatingChart';

interface PlayerProfileModalProps {
  player: Player | null;
  allMatches: Match[];
  allPlayers: Player[];
  season?: Season;
  onClose: () => void;
  onSelectMatch: (match: Match) => void;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerProfileModal({
  player,
  allMatches,
  allPlayers,
  season,
  onClose,
  onSelectMatch,
  onSelectPlayer,
}: PlayerProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'matches' | 'stats' | 'h2h' | 'rating'>('rating');

  if (!player) return null;

  // Find all matches featuring this player
  const playerMatches = allMatches.filter(
    m => (m.player1.id === player.id || m.player2.id === player.id) && m.isCompleted
  ).reverse();

  // Find H2H players
  const h2hEntries = Object.entries(player.h2h || {});

  const isKsenia = player.id === 'ksenia-morey';

  return (
    <div
      id="player-profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Profile Hero */}
        <div className="relative p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl font-bold border-2 border-white/20 shadow-lg shrink-0"
              style={{ backgroundColor: player.avatarColor || '#3b82f6' }}
            >
              <span>{player.flag}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {player.name}
                </h2>
                {isKsenia && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ⭐ Главная Героиня
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {player.country} • {player.age} лет • {player.style}
              </p>

              <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                <button
                  onClick={() => setActiveTab('rating')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    activeTab === 'rating'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
                  }`}
                  title="Открыть график рейтинга сезона"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs font-medium">Рейтинг:</span>
                  <span className="text-xs font-bold text-sky-400">#{player.rank} {player.tour}</span>
                  <TrendingUp className="w-3 h-3 text-emerald-400 ml-0.5" />
                </button>

                <button
                  onClick={() => setActiveTab('rating')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 transition-colors cursor-pointer"
                  title="Открыть историю очков"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-slate-300">Очки:</span>
                  <span className="text-xs font-bold text-amber-400">{player.points.toLocaleString()}</span>
                </button>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-slate-300">Титулы:</span>
                  <span className="text-xs font-bold text-emerald-400">{player.careerTitles}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs font-medium text-slate-300">В/П:</span>
                  <span className="text-xs font-bold text-rose-400">{player.wins}В - {player.losses}П</span>
                </div>
              </div>

              {/* Physical Condition & Injuries Bar */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 flex-1">
                  <Activity className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Усталость:</span>
                  <div className="flex-1 max-w-[140px] bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (player.fatigue || 0) > 75
                          ? 'bg-rose-500'
                          : (player.fatigue || 0) > 45
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, player.fatigue || 0)}%` }}
                    />
                  </div>
                  <span className={`font-mono font-bold ${
                    (player.fatigue || 0) > 75
                      ? 'text-rose-400'
                      : (player.fatigue || 0) > 45
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {player.fatigue || 0}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {player.injury ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{player.injury.type} ({player.injury.severity})</span>
                      <span className="text-rose-400 font-mono">({player.injury.weeksRemaining} нед.)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                      <HeartPulse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Без травм (здоров)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Career Stage & Aging / Retirement Indicator */}
              {player.age >= 30 ? (
                <div className="mt-2.5 px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <span className="font-bold text-purple-300">Статус: Ветеран тура ({player.age} лет)</span>
                      <p className="text-[11px] text-slate-400">
                        {isKsenia ? 'Главная героиня — завершение карьеры только по решению игрока.' : 'С каждым годом после 30 возрастает вероятность ухода на пенсию.'}
                      </p>
                    </div>
                  </div>
                  {!isKsenia && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Риск пенсии в конце года:</div>
                      <div className={`text-xs font-mono font-bold ${
                        calculateRetirementChance(player) >= 0.15 ? 'text-rose-400' : 'text-amber-400'
                      }`}>
                        ~{(calculateRetirementChance(player) * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              ) : player.age <= 22 ? (
                <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-300">Статус: Молодой талант ({player.age} лет)</span>
                      <p className="text-[11px] text-slate-400">
                        Высокий потенциал роста: каждый межсезонный период может принести прогресс характеристик.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {player.bio && (
            <p className="mt-4 text-xs leading-relaxed text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              {player.bio}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950 px-5 gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('rating')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'rating'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>График Рейтинга</span>
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'matches'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            История Матчей ({playerMatches.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'stats'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Характеристики и Бонусы
          </button>
          <button
            onClick={() => setActiveTab('h2h')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'h2h'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Личные Встречи (H2H)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'rating' && (
            <PlayerRatingChart
              player={player}
              season={season}
              allPlayers={allPlayers}
              allMatches={allMatches}
            />
          )}
          {activeTab === 'matches' && (
            <div>
              {playerMatches.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  В этом сезоне еще не сыграно матчей. Начните симуляцию или просмотр турниров!
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-400 mb-2">
                    Нажмите на любой результат игры для открытия подробной карточки сета и протокола:
                  </p>
                  {playerMatches.map((m, idx) => {
                    const isP1 = m.player1.id === player.id;
                    const opponent = isP1 ? m.player2 : m.player1;
                    const won = m.winnerId === player.id;

                    return (
                      <div
                        key={idx}
                        id={`player-match-item-${idx}`}
                        onClick={() => onSelectMatch(m)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          won
                            ? 'bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-950/30'
                            : 'bg-rose-950/20 border-rose-500/30 hover:bg-rose-950/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              won ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {won ? 'В' : 'П'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-medium">{m.roundName}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-xs font-semibold text-white">vs {opponent.flag} {opponent.name}</span>
                              <span className="text-[10px] text-slate-400">#{opponent.rank}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Счет: <span className="font-mono text-slate-200 font-semibold">{m.scoreText}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 group-hover:underline">
                            Карточка игры
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Любимое покрытие</div>
                  <div className="text-base font-bold text-white mt-1 flex items-center gap-2">
                    {player.favSurface}
                    {player.favSurface === 'Грунт' && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">+1 к розыгрышу</span>}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Бонус подачи (d20)</div>
                  <div className={`text-base font-bold mt-1 ${player.serveBonus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {player.serveBonus >= 0 ? `+${player.serveBonus}` : player.serveBonus} к броску подачи
                  </div>
                </div>
              </div>

              {/* Skills breakdown */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Характеристики теннисиста
                </h3>

                {[
                  { label: 'Подача', value: player.stats?.serve || 3, desc: 'Шанс на эйс / двойную' },
                  { label: 'Розыгрыш', value: player.stats?.rally || 4, desc: 'Стабильность на задней линии' },
                  { label: 'Форхенд', value: player.stats?.forehand || 4, desc: 'Атака справа' },
                  { label: 'Бэкхенд', value: player.stats?.backhand || 3, desc: 'Удар слева' },
                  { label: 'Выносливость', value: player.stats?.stamina || 4, desc: 'Сохранение сил в 3-м сете' },
                  { label: 'Ментальность', value: player.stats?.mental || 3, desc: 'Хладнокровие на брейк-пойнтах' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="w-32">
                      <span className="font-semibold text-slate-200">{item.label}</span>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </div>
                    <div className="flex-1 max-w-xs mx-4 bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${(item.value / 5) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-300 w-8 text-right">
                      {'⭐'.repeat(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'h2h' && (
            <div>
              {h2hEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Пока нет зарегистрированных личных встреч в туре.
                </div>
              ) : (
                <div className="space-y-2">
                  {h2hEntries.map(([oppId, record], idx) => {
                    const opp = allPlayers.find(p => p.id === oppId);
                    if (!opp) return null;
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => onSelectPlayer(opp.id)}
                        >
                          <span className="text-xl">{opp.flag}</span>
                          <div>
                            <div className="font-bold text-sm text-white hover:underline">
                              {opp.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              #{opp.rank} {opp.tour} • {opp.style}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-mono text-base font-bold text-emerald-400">{record.wins}</span>
                            <span className="text-slate-500 mx-1">:</span>
                            <span className="font-mono text-base font-bold text-rose-400">{record.losses}</span>
                          </div>
                          <button
                            onClick={() => onSelectPlayer(opp.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="Открыть профиль игрока"
                          >
                            <Swords className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
