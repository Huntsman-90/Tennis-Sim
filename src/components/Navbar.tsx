import { Calendar, Eye, Trophy, Users, Zap, HardDrive } from 'lucide-react';
import { Tournament } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveTab = 'tournament' | 'match' | 'rankings' | 'calendar' | 'players';

interface NavbarProps {
  currentTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  year: number;
  currentTournament: Tournament;
  onOpenSaves: () => void;
  lastAutoSaveTime?: number;
}

export function Navbar({
  currentTab,
  onTabChange,
  year,
  currentTournament,
  onOpenSaves,
  lastAutoSaveTime,
}: NavbarProps) {
  const isAtp = currentTournament.tour === 'ATP';

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-4">
          
          {/* Logo & Tour Title */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-lg shadow-sky-500/20 shrink-0 flex items-center justify-center bg-slate-900 border border-sky-500/30">
              <img
                src="/app-logo.png"
                alt="ATP & WTA Tour Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-white text-xs sm:text-base md:text-lg tracking-tight">
                  <span className="hidden sm:inline">ATP &amp; WTA Tour</span>
                  <span className="sm:hidden">ATP &amp; WTA</span>
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {year}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden lg:block">
                Зрительский режим • Чередующиеся турниры ATP & WTA
              </p>
            </div>
          </div>

          {/* Current tournament pill */}
          <div className="hidden xl:flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                  isAtp
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {currentTournament.tour}
              </span>
              <span>{currentTournament.flag}</span>
              <span className="font-semibold text-white truncate max-w-[160px]">
                {currentTournament.nameRu}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{currentTournament.surface}</span>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            
            <nav className="flex items-center gap-0.5 sm:gap-1.5">
              <button
                id="tab-tournament"
                onClick={() => onTabChange('tournament')}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  currentTab === 'tournament'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Сетка турнира"
              >
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Сетка</span>
              </button>

              <button
                id="tab-match"
                onClick={() => onTabChange('match')}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  currentTab === 'match'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Зрительский режим"
              >
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline sm:inline">Зритель</span>
              </button>

              <button
                id="tab-rankings"
                onClick={() => onTabChange('rankings')}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  currentTab === 'rankings'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Рейтинги ATP и WTA"
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                <span className="hidden sm:inline">Рейтинги</span>
              </button>

              <button
                id="tab-calendar"
                onClick={() => onTabChange('calendar')}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  currentTab === 'calendar'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Календарь сезона"
              >
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden md:inline">Календарь</span>
              </button>

              <button
                id="tab-players"
                onClick={() => onTabChange('players')}
                className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  currentTab === 'players'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title="Список игроков"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Игроки</span>
              </button>
            </nav>

            {/* In-app PWA Install Button */}
            <PWAInstallButton />

            {/* Quick Saves Button */}
            <button
              id="btn-open-saves"
              onClick={onOpenSaves}
              className="ml-0.5 sm:ml-2 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
              title={
                lastAutoSaveTime && lastAutoSaveTime > 0
                  ? `Автосохранение активно: сохранено после матча в ${new Date(lastAutoSaveTime).toLocaleTimeString('ru-RU')}`
                  : 'Автосохранение активно: сохраняется после каждого матча'
              }
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline font-medium">Сохранения</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
}
