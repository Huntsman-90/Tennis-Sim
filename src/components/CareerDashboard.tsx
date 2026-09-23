import { useState } from 'react';
import { Award, Check, Copy, Flame, Heart, RefreshCw, Shield, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { Match, Player, Season } from '../types';

interface CareerDashboardProps {
  ksenia: Player;
  season: Season;
  allMatches: Match[];
  onOpenMatchCard: (match: Match) => void;
  onGenerateNextSeason: () => void;
}

export function CareerDashboard({
  ksenia,
  season,
  allMatches,
  onOpenMatchCard,
  onGenerateNextSeason,
}: CareerDashboardProps) {
  const [snapshotCopied, setSnapshotCopied] = useState<boolean>(false);

  // Filter Ksenia's matches
  const kseniaMatches = allMatches.filter(
    m => (m.player1.id === ksenia.id || m.player2.id === ksenia.id) && m.isCompleted
  ).reverse();

  const totalMatches = ksenia.wins + ksenia.losses;
  const winRate = totalMatches > 0 ? Math.round((ksenia.wins / totalMatches) * 100) : 0;

  // Generate tennis-state.md snapshot text matching masterprompt
  const generateSnapshotText = (): string => {
    const curTrn = season.tournaments[season.currentTournamentIndex];
    const lastMatch = kseniaMatches[0];
    const lastResultText = lastMatch
      ? `${lastMatch.roundName} (${lastMatch.winnerId === ksenia.id ? 'W' : 'L'} vs ${
          lastMatch.player1.id === ksenia.id ? lastMatch.player2.name : lastMatch.player1.name
        } [${lastMatch.scoreText}])`
      : 'Сезон только начинается';

    return `=== СНАПШОТ | WTA ${season.year} | ${curTrn?.nameRu || ''} ===
СЛЕДУЮЩИЙ МАТЧ: ${curTrn?.nameRu || 'Турнир'} — Раунд ${curTrn?.currentRound || 'R32'}

КАРЬЕРА КСЕНИИ МОРЕЙ:
  Рейтинг: #${ksenia.rank} WTA
  Очки: ${ksenia.points}
  Сезон ${season.year}: ${ksenia.wins}В ${ksenia.losses}П (Винрейт: ${winRate}%)
  Титулов: ${ksenia.careerTitles}
  Последний результат: ${lastResultText}

ХАРАКТЕРИСТИКИ:
  Подача: ⭐⭐ (бонус d20: -1)
  Розыгрыш: ⭐⭐⭐⭐ (бонус 2d6: +2)
  Форхенд: ⭐⭐⭐⭐ (+1 к атаке)
  Любимое покрытие: Грунт (+1 к розыгрышу)
=== КОНЕЦ СНАПШОТА ===`;
  };

  const handleCopySnapshot = () => {
    navigator.clipboard.writeText(generateSnapshotText());
    setSnapshotCopied(true);
    setTimeout(() => setSnapshotCopied(false), 2000);
  };

  const seasonCompleted = season.isCompleted || season.currentTournamentIndex >= season.tournaments.length - 1;

  return (
    <div id="career-dashboard-container" className="space-y-6">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-4xl border-2 border-white/20 shadow-xl shadow-blue-600/20">
              <span>{ksenia.flag}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {ksenia.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {ksenia.flag} {ksenia.country}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                {ksenia.bio}
              </p>
            </div>
          </div>

          {/* Quick Snapshot Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySnapshot}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Скопировать снапшот состояния для TENNIS-STATE.MD"
            >
              {snapshotCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {snapshotCopied ? 'Снапшот скопирован!' : 'Экспорт TENNIS-STATE'}
            </button>
          </div>
        </div>

        {/* Season Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Рейтинг WTA</div>
            <div className="text-2xl font-black text-sky-400 font-mono mt-0.5">#{ksenia.rank}</div>
            <div className="text-[10px] text-slate-500">Старт сезона: #98</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Очки WTA</div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">
              {ksenia.points.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">Цель: Топ-50 (1000+ очков)</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Баланс матчей</div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
              {ksenia.wins}В - {ksenia.losses}П
            </div>
            <div className="text-[10px] text-slate-500">Винрейт: {winRate}%</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">Титулы WTA</div>
            <div className="text-2xl font-black text-purple-400 font-mono mt-0.5">
              🏆 {ksenia.careerTitles}
            </div>
            <div className="text-[10px] text-slate-500">Цель-2026: 1-й титул</div>
          </div>
        </div>
      </div>

      {/* New Season Generator Card (2027, 2028, 2029...) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white text-base">
              Генерация Нового Сезона ({season.year + 1})
            </h3>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            По правилам проекта: при завершении или в любой момент можно сгенерировать расписание нового года ({season.year + 1}, {season.year + 2}...). Рейтинги и очки теннисисток переходят с учетом защиты очков!
          </p>
        </div>

        <button
          id="generate-next-season-btn"
          onClick={onGenerateNextSeason}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-4 h-4" />
          Сгенерировать сезон {season.year + 1}
        </button>
      </div>

      {/* Tactical & Physical Attributes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Тактический Профиль Ксении
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Стиль: Базлайнер</span>
                <p className="text-[11px] text-slate-500">Терпение, чтение игры, длинные розыгрыши</p>
              </div>
              <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                +2 к розыгрышу (2d6)
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Любимое покрытие: Грунт 🔴</span>
                <p className="text-[11px] text-slate-500">Глиняные корты дают время для контрударов</p>
              </div>
              <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                +1 на грунте
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Слабая подача: d20 (-1)</span>
                <p className="text-[11px] text-slate-500">Средняя скорость, компенсируется стабильностью</p>
              </div>
              <span className="font-mono font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                -1 к броску подачи
              </span>
            </div>
          </div>
        </div>

        {/* State & Moral status */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            Форма и Психологическое Состояние
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Физическая форма</span>
                <p className="text-[11px] text-slate-500">Готовность к длинным 3-сетовым битвам</p>
              </div>
              <span className="font-mono font-bold text-emerald-400">100% (Отличная)</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Моральный дух</span>
                <p className="text-[11px] text-slate-500">Хладнокровие на тай-брейках и брейк-пойнтах</p>
              </div>
              <span className="font-mono font-bold text-sky-400">Высокий ⭐⭐⭐</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Тренировочная база</span>
                <p className="text-[11px] text-slate-500">Зима: Анталья (Академия Муратоглу) • Лето: Париж</p>
              </div>
              <span className="font-semibold text-slate-300">Анталья / Париж</span>
            </div>
          </div>
        </div>
      </div>

      {/* Match History for Ksenia */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Сыгранные матчи Ксении ({kseniaMatches.length})
        </h3>

        {kseniaMatches.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Ксения ещё не сыграла ни одного матча в этом сезоне. Откройте вкладку «Турнир» и начните матч Канберры!
          </div>
        ) : (
          <div className="space-y-2">
            {kseniaMatches.map((m, idx) => {
              const won = m.winnerId === ksenia.id;
              const opponent = m.player1.id === ksenia.id ? m.player2 : m.player1;

              return (
                <div
                  key={idx}
                  onClick={() => onOpenMatchCard(m)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
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
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{m.roundName}</span>
                        <span>vs {opponent.flag} {opponent.name}</span>
                        <span className="text-[10px] text-slate-400">#{opponent.rank}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Счёт: <span className="font-mono text-slate-200 font-semibold">{m.scoreText}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-medium text-emerald-400 underline">
                    Протокол сетов
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
