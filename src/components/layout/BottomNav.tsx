import React from 'react';
import { Home, Flame, Plus, User, Trophy, Sparkles } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'feed' | 'discovery' | 'best-dynamos' | 'landing' | 'profile' | 'admin' | 'settings';
  onSelectTab: (tab: 'feed' | 'discovery' | 'best-dynamos' | 'landing' | 'profile' | 'settings') => void;
  onOpenCreateModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreateModal,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#21272E] bg-[#0E1216]/95 backdrop-blur-lg sm:hidden pb-safe">
      <div className="flex h-14 items-center justify-around px-2">
        <button
          id="nav-tab-feed"
          onClick={() => onSelectTab('feed')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition ${
            currentTab === 'feed' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Inicio</span>
        </button>

        <button
          id="nav-tab-discovery"
          onClick={() => onSelectTab('discovery')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition ${
            currentTab === 'discovery' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span>Descubrir</span>
        </button>

        {/* Central Action: Create Dynamo */}
        <button
          id="btn-bottom-create"
          onClick={onOpenCreateModal}
          className="flex -translate-y-2.5 h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-black shadow-lg shadow-amber-500/20 active:scale-95 transition-transform shrink-0"
          title="Crear Dynamo"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        <button
          id="nav-tab-best-dynamos"
          onClick={() => onSelectTab('best-dynamos')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition ${
            currentTab === 'best-dynamos' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span>Best</span>
        </button>

        <button
          id="nav-tab-profile"
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition ${
            currentTab === 'profile' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Perfil</span>
        </button>
      </div>
    </nav>
  );
};
