import React from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { useLang, LANGUAGE_OPTIONS } from '../../context/LanguageContext';
import { BrandLogo } from './BrandLogo';

interface PortalHeaderProps {
  title: string;
  subtitle?: string;
  onProfileClick?: () => void;
}

export function PortalHeader({ title, subtitle, onProfileClick }: PortalHeaderProps) {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();
  const { language, setLanguage, t } = useLang();

  const roleEmojis: Record<string, string> = {
    citizen: '👤',
    authority: '👨🏻‍💼',
    contractor: '👨🏻‍🔧',
    ngo: '👥',
  };

  const handleLogout = () => {
    setCurrentUser(null);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ background: '#0B1C2D' }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-90 transition-all">
            <BrandLogo size="sm" showText={true} />
          </button>
          <div className="w-px h-6 bg-white opacity-20 mx-1" />
          <div>
            <p className="text-white" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</p>
            {subtitle && <p className="text-blue-300" style={{ fontSize: '0.7rem' }}>{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            {LANGUAGE_OPTIONS.map(option => (
              <button
                key={option.code}
                onClick={() => setLanguage(option.code)}
                className="px-2 py-0.5 rounded-full text-xs transition-all"
                style={{
                  background: language === option.code ? '#E8821C' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: language === option.code ? '1.5px solid #E8821C' : '1.5px solid rgba(255,255,255,0.2)',
                  fontWeight: language === option.code ? 600 : 400,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {currentUser && (
            <button
              onClick={onProfileClick}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <span className="text-lg">{roleEmojis[currentUser.role] || '👤'}</span>
              <span className="text-white text-sm hidden sm:block">{currentUser.fullName.split(' ')[0]}</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl text-sm transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
