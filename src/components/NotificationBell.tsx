import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Check, Zap, Target } from 'lucide-react';
import { useAppState } from '@/store/useAppState';

export const NotificationBell: React.FC = () => {
  const { activityLog, markActivitiesRead } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = activityLog.filter(a => !a.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markActivitiesRead();
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button 
        onClick={handleToggle}
        className="p-1 sm:p-2 bg-trench-black border-2 border-trench-sandbag rounded relative hover:bg-trench-mud transition-colors"
        title="ACTIVITY LOG"
      >
        <Bell size={18} className="text-trench-gasmask" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-jeet-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-trench-black">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-trench-black border-4 border-trench-sandbag rounded shadow-2xl z-[9999]">
          <div className="bg-trench-mud border-b-2 border-trench-sandbag p-2 flex justify-between items-center">
            <span className="font-staatliches tracking-wider text-moon-gold text-lg">ACTIVITY LOG</span>
            <Check size={16} className="text-trench-gasmask" />
          </div>
          
          <div className="max-h-80 overflow-y-auto scrollbar">
            {activityLog.length === 0 ? (
              <div className="p-6 text-center text-trench-gasmask font-mono text-xs uppercase font-bold">
                No recent activity on your frequency.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-trench-sandbag">
                {activityLog.map((activity) => (
                  <div key={activity.id} className={`p-3 transition-colors ${!activity.read ? 'bg-trench-mud/50' : ''} hover:bg-trench-mud`}>
                    <Link href={activity.link || '#'} className="block cursor-pointer">
                      <div className="flex items-start gap-2">
                        <div className="mt-1">
                          {activity.type === 'win' ? (
                            <Zap size={16} className="text-moon-gold" />
                          ) : (
                            <Target size={16} className="text-neon-moon" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-staatliches tracking-wide text-white text-sm">{activity.title}</h4>
                          <p className="font-mono text-[10px] text-trench-gasmask font-bold leading-snug mt-0.5">
                            {activity.message}
                          </p>
                          <span className="font-mono text-[9px] text-trench-gasmask/70 mt-1 block">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
