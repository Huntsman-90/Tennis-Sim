import { useState } from 'react';
import { Check, Copy, Trophy, X } from 'lucide-react';
import { GameLog, Match } from '../types';

interface MatchStatsCardModalProps {
  match: Match | null;
  onClose: () => void;
  onOpenPlayer?: (playerId: string) => void;
}

export function MatchStatsCardModal({ match, onClose, onOpenPlayer }: MatchStatsCardModalProps) {
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);
  const [orderDescending, setOrderDescending] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  if (!match) return null;

  const currentSet = match.sets[activeSetIndex] || match.sets[0];
  const games = currentSet ? [...currentSet.games] : [];
  const displayGames = orderDescending ? [...games].reverse() : games;

  // Format the exact text representation requested by the user
  const formatSetText = (setIndex: number): string => {
    const s = match.sets[setIndex];
    if (!s || !s.games || s.games.length === 0) return `S${setIndex + 1}\n(Нет данных по геймам)`;

    const gList = orderDescending ? [...s.games].reverse() : [...s.games];
    let out = `S${setIndex + 1}\n\n`;

    gList.forEach((g: GameLog) => {
      const p1Serve = g.server === 1 ? '🎾' : '  ';
      const p2Serve = g.server === 2 ? '🎾' : '  ';

      const p1Prog = g.p1Progression.length > 0 ? g.p1Progression.join(' ') : '0';
      const p2Prog = g.p2Progression.length > 0 ? g.p2Progression.join(' ') : '0';

      const p1Pad = g.p1GamesAtEnd.toString().padEnd(2);
      const p2Pad = g.p2GamesAtEnd.toString().padEnd(2);

      out += `${p1Pad} ${p1Serve} | ${p1Prog}\n`;
      out += `${p2Pad} ${p2Serve} | ${p2Prog}\n\n`;
    });

    return out.trimEnd();
  };

  const fullTextProtocol = match.sets.map((_, idx) => formatSetText(idx)).join('\n\n---\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullTextProtocol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const p1 = match.player1;
  const p2 = match.player2;
  const isP1Winner = match.winnerId === p1.id;
  const isP2Winner = match.winnerId === p2.id;

  return (
    <div
      id="match-stats-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Протокол и Карточка Игры
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                    p1.tour === 'ATP'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {p1.tour === 'ATP' ? 'ATP Tour' : 'WTA Tour'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {match.roundName}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Пошаговая история розыгрышей каждого гейма сета
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="copy-protocol-btn"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Скопировать протокол в буфер обмена"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
            <button
              id="close-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Players Banner */}
        <div className="grid grid-cols-2 p-4 bg-slate-950/60 border-b border-slate-800 gap-4 text-center">
          {/* Player 1 */}
          <div
            className={`p-3 rounded-xl border transition-colors cursor-pointer ${
              isP1Winner
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
            onClick={() => onOpenPlayer && onOpenPlayer(p1.id)}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              {match.p1Seed && (
                <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  [{match.p1Seed}]
                </span>
              )}
              <span className="text-xl">{p1.flag}</span>
              <span className="font-bold text-base text-white hover:underline">{p1.name}</span>
              {isP1Winner && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Победа</span>}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  p1.tour === 'ATP'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {p1.tour}
              </span>
              <span>#{p1.rank} • {p1.style}</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
              {match.sets.map(s => s.p1Games).join('  ')}
            </div>
          </div>

          {/* Player 2 */}
          <div
            className={`p-3 rounded-xl border transition-colors cursor-pointer ${
              isP2Winner
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
            onClick={() => onOpenPlayer && onOpenPlayer(p2.id)}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              {match.p2Seed && (
                <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  [{match.p2Seed}]
                </span>
              )}
              <span className="text-xl">{p2.flag}</span>
              <span className="font-bold text-base text-white hover:underline">{p2.name}</span>
              {isP2Winner && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Победа</span>}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  p2.tour === 'ATP'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {p2.tour}
              </span>
              <span>#{p2.rank} • {p2.style}</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
              {match.sets.map(s => s.p2Games).join('  ')}
            </div>
          </div>
        </div>

        {/* Set Tabs & Order Toggle */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Сеты:</span>
            {match.sets.map((s, idx) => (
              <button
                key={idx}
                id={`set-tab-${idx + 1}`}
                onClick={() => setActiveSetIndex(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                  activeSetIndex === idx
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                S{idx + 1} ({s.p1Games}:{s.p2Games})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrderDescending(!orderDescending)}
              className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              {orderDescending ? 'Порядок: от последнего к первому (как в правилах)' : 'Порядок: с первого гейма'}
            </button>
          </div>
        </div>

        {/* Protocol Visual Display (Exact format requested) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono shadow-inner">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs text-slate-400">
              <span className="text-emerald-400 font-bold tracking-wider">
                СЕТ {activeSetIndex + 1} ({p1.name} {currentSet.p1Games} : {currentSet.p2Games} {p2.name})
              </span>
              <span>🎾 = подающая сторона | числа справа = последовательность очков в гейме</span>
            </div>

            {displayGames.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                В этом сете еще не было завершенных геймов.
              </div>
            ) : (
              <div className="space-y-4">
                {displayGames.map((g, gIdx) => {
                  const p1Serve = g.server === 1;
                  const p2Serve = g.server === 2;
                  const p1WonGame = g.winner === 1;
                  const p2WonGame = g.winner === 2;

                  return (
                    <div
                      key={gIdx}
                      className={`p-2.5 rounded-lg border transition-all ${
                        g.isBreak
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Line 1: Player 1 */}
                      <div className="flex items-center text-sm sm:text-base leading-relaxed">
                        <div className="w-8 text-right font-bold text-white">
                          {g.p1GamesAtEnd}
                        </div>
                        <div className="w-8 text-center text-xs">
                          {p1Serve ? '🎾' : ''}
                        </div>
                        <div className="text-slate-600 px-2 select-none">|</div>
                        <div className="flex-1 flex flex-wrap gap-2 text-slate-300 font-medium tracking-wide">
                          {g.p1Progression.map((score, sIdx) => (
                            <span
                              key={sIdx}
                              className={`px-1 rounded ${
                                score === 'GAME'
                                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                                  : score === 'AD'
                                  ? 'bg-purple-500/30 text-purple-300 font-bold'
                                  : ''
                              }`}
                            >
                              {score}
                            </span>
                          ))}
                        </div>
                        {p1WonGame && (
                          <span className="text-xs text-emerald-400 font-sans font-semibold px-2">
                            {g.isBreak ? '⚡ Брейк!' : '✓ Гейм'}
                          </span>
                        )}
                      </div>

                      {/* Line 2: Player 2 */}
                      <div className="flex items-center text-sm sm:text-base leading-relaxed mt-1">
                        <div className="w-8 text-right font-bold text-white">
                          {g.p2GamesAtEnd}
                        </div>
                        <div className="w-8 text-center text-xs">
                          {p2Serve ? '🎾' : ''}
                        </div>
                        <div className="text-slate-600 px-2 select-none">|</div>
                        <div className="flex-1 flex flex-wrap gap-2 text-slate-300 font-medium tracking-wide">
                          {g.p2Progression.map((score, sIdx) => (
                            <span
                              key={sIdx}
                              className={`px-1 rounded ${
                                score === 'GAME'
                                  ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                                  : score === 'AD'
                                  ? 'bg-purple-500/30 text-purple-300 font-bold'
                                  : ''
                              }`}
                            >
                              {score}
                            </span>
                          ))}
                        </div>
                        {p2WonGame && (
                          <span className="text-xs text-emerald-400 font-sans font-semibold px-2">
                            {g.isBreak ? '⚡ Брейк!' : '✓ Гейм'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overall Match Statistics Table */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Статистика матча
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="font-mono text-emerald-400 w-12 text-right">{match.stats.aces[0]}</span>
                <span className="text-slate-400">Эйсы</span>
                <span className="font-mono text-emerald-400 w-12 text-left">{match.stats.aces[1]}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="font-mono text-rose-400 w-12 text-right">{match.stats.doubleFaults[0]}</span>
                <span className="text-slate-400">Двойные ошибки</span>
                <span className="font-mono text-rose-400 w-12 text-left">{match.stats.doubleFaults[1]}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="font-mono text-amber-400 w-12 text-right">{match.stats.winners[0]}</span>
                <span className="text-slate-400">Активно выигранные мячи (Виннеры)</span>
                <span className="font-mono text-amber-400 w-12 text-left">{match.stats.winners[1]}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="font-mono text-cyan-400 w-12 text-right">{match.stats.breakPointsWon[0]}</span>
                <span className="text-slate-400">Выигранные брейк-пойнты</span>
                <span className="font-mono text-cyan-400 w-12 text-left">{match.stats.breakPointsWon[1]}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-mono text-white w-12 text-right font-bold">{match.stats.totalPointsWon[0]}</span>
                <span className="text-slate-300 font-semibold">Всего выиграно очков</span>
                <span className="font-mono text-white w-12 text-left font-bold">{match.stats.totalPointsWon[1]}</span>
              </div>
            </div>
          </div>
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
