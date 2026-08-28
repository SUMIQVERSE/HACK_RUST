import React from 'react';
import { useLang } from '../../context/LanguageContext';

interface Checkpoint {
  key: string;
  percent: number;
}

const CHECKPOINTS: Checkpoint[] = [
  { key: 'progress.reported', percent: 10 },
  { key: 'progress.verified', percent: 20 },
  { key: 'progress.budget', percent: 30 },
  { key: 'progress.tendering', percent: 40 },
  { key: 'progress.assigned', percent: 50 },
  { key: 'progress.survey', percent: 60 },
  { key: 'progress.excavation', percent: 70 },
  { key: 'progress.execution', percent: 85 },
  { key: 'progress.audit', percent: 95 },
  { key: 'progress.resolved', percent: 100 },
];

export function WorkProgressBar({ currentPercent }: { currentPercent: number }) {
  const { t } = useLang();

  return (
    <div className="w-full flex flex-col gap-0 py-2">
      <div className="relative pl-8">
        {/* Background Vertical Line */}
        <div className="absolute left-[11px] top-4 bottom-4 w-[2px] bg-gray-200" />
        
        {/* Active Vertical Line */}
        <div 
          className="absolute left-[11px] top-4 w-[2px] transition-all duration-1000 ease-in-out"
          style={{ 
            height: `${Math.min(currentPercent, 100) * 0.9}%`, // Scaling line to match steps
            maxHeight: 'calc(100% - 32px)',
            background: 'linear-gradient(180deg, #E8821C, #F59E0B)',
            boxShadow: '0 0 8px rgba(232, 130, 28, 0.4)'
          }}
        />

        {/* Checkpoints */}
        <div className="flex flex-col gap-6">
          {CHECKPOINTS.map((cp, idx) => {
            const isCompleted = currentPercent >= cp.percent;
            const isCurrent = isCompleted && (idx === CHECKPOINTS.length - 1 || currentPercent < CHECKPOINTS[idx + 1].percent);

            return (
              <div key={cp.key} className="relative flex items-center group">
                {/* Dot Container */}
                <div className="absolute -left-8 flex items-center justify-center w-[24px]">
                    <div 
                    className={`w-4 h-4 rounded-full border-2 z-10 transition-all duration-500 bg-white flex items-center justify-center ${
                      isCompleted 
                        ? 'border-[#E8821C] shadow-md' 
                        : 'border-gray-200'
                    }`}
                    >
                    {isCompleted && (
                        <div className={`w-2 h-2 rounded-full transform transition-transform duration-500 ${isCurrent ? 'animate-pulse scale-110' : ''}`} style={{ background: '#E8821C' }} />
                    )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-col">
                  <span 
                    className={`text-sm transition-all duration-300 ${
                        isCompleted 
                        ? 'text-[#0B1C2D] font-bold opacity-100' 
                        : 'text-gray-400 font-medium opacity-60'
                    }`}
                  >
                    {t(cp.key)}
                  </span>
                  
                  {isCurrent && (
                    <span 
                        className="text-[10px] font-bold px-1.5 py-0.5 mt-1 rounded text-white self-start"
                        style={{ background: '#0B1C2D' }}
                    >
                        {currentPercent}% {t('common.online')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
