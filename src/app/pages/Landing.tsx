import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, MOCK_USERS } from '../context/AppContext';
import { useLang, Language, LANGUAGE_OPTIONS } from '../context/LanguageContext';
import { DonationModal } from '../components/shared/DonationModal';
import { BrandLogo } from '../components/shared/BrandLogo';

const INDIA_GATE_BG = 'https://images.unsplash.com/photo-1766405532163-e38c3033f862?w=1920&q=80';

const loginCards = [
  { role: 'citizen' as const, emoji: '👤', path: '/citizen', descriptionKey: 'landing.desc.citizen' },
  { role: 'authority' as const, emoji: '👨🏻‍💼', path: '/authority', descriptionKey: 'landing.desc.authority' },
  { role: 'contractor' as const, emoji: '👨🏻‍🔧', path: '/contractor', descriptionKey: 'landing.desc.contractor' },
  { role: 'ngo' as const, emoji: '👥', path: '/ngo', descriptionKey: 'landing.desc.ngo' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const { language, setLanguage, t } = useLang();
  const [loginModal, setLoginModal] = useState<{ role: string; path: string } | null>(null);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [donationNgoId, setDonationNgoId] = useState<string | null>(null);

  const roleNames: Record<string, string> = {
    citizen: t('landing.login.citizen'),
    authority: t('landing.login.authority'),
    contractor: t('landing.login.contractor'),
    ngo: t('landing.login.ngo'),
  };

  const stats = [
    { label: t('landing.stats.resolved'), value: '1,200+' },
    { label: t('landing.stats.states'), value: '25+' },
    { label: t('landing.stats.ngos'), value: '230+' },
    { label: t('landing.stats.contractors'), value: '350+' },
  ];

  const handleCardClick = (card: typeof loginCards[number]) => {
    const user = MOCK_USERS.find(entry => entry.role === card.role)!;
    setLoginName(user.fullName);
    setLoginEmail(user.email);
    setLoginModal({ role: card.role, path: card.path });
  };

  const handleLogin = () => {
    if (!loginModal) return;
    const user = MOCK_USERS.find(entry => entry.role === loginModal.role)!;
    setCurrentUser(user);
    navigate(loginModal.path);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Poppins', 'Mukta', sans-serif" }}>
      <div
        className="relative flex-1 flex flex-col"
        style={{
          backgroundImage: `url(${INDIA_GATE_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(11,28,45,0.88) 0%, rgba(11,28,45,0.75) 40%, rgba(11,28,45,0.92) 100%)' }} />

        <header className="relative z-10 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" showText={true} />
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center mr-4">
              <button
                onClick={() => setDonationNgoId('u4')}
                className="px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95"
                style={{
                  background: '#E8821C',
                  color: 'white',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(232, 130, 28, 0.3)',
                }}
              >
                💰 {t('landing.donate')}
              </button>
            </div>

            {LANGUAGE_OPTIONS.map(option => (
              <button
                key={option.code}
                onClick={() => setLanguage(option.code as Language)}
                className="px-3 py-1 rounded-full text-sm transition-all"
                style={{
                  background: language === option.code ? '#E8821C' : 'rgba(255,255,255,0.15)',
                  color: 'white',
                  border: language === option.code ? '2px solid #E8821C' : '2px solid rgba(255,255,255,0.3)',
                  fontWeight: language === option.code ? 600 : 400,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="text-center mb-4">
            <div
              className="inline-block px-5 py-2 rounded-full mb-6"
              style={{ background: 'rgba(232,130,28,0.25)', border: '1px solid rgba(232,130,28,0.6)', color: '#FFB366' }}
            >
              <span className="text-sm">🇮🇳 {t('landing.hero.badge')}</span>
            </div>
            <div className="mb-6 flex justify-center">
              <BrandLogo size="xl" className="shadow-2xl border-4 border-white border-opacity-20" />
            </div>
            <p className="text-blue-100 max-w-xl mx-auto" style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              {t('app.tagline')}
            </p>
          </div>

          <div className="flex gap-6 mb-10 mt-4 flex-wrap justify-center">
            {stats.map(stat => (
              <div key={stat.label} className="text-center px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <div className="text-white" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFB366' }}>{stat.value}</div>
                <div className="text-blue-200 text-xs mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl px-4">
            {loginCards.map(card => (
              <button
                key={card.role}
                onClick={() => handleCardClick(card)}
                className="group relative flex flex-col items-center p-6 rounded-2xl text-center transition-all duration-300 cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                  minHeight: 180,
                }}
                onMouseEnter={event => {
                  const node = event.currentTarget;
                  node.style.background = 'rgba(232,130,28,0.2)';
                  node.style.border = '1px solid rgba(232,130,28,0.6)';
                  node.style.transform = 'translateY(-4px)';
                  node.style.boxShadow = '0 20px 40px rgba(232,130,28,0.2)';
                }}
                onMouseLeave={event => {
                  const node = event.currentTarget;
                  node.style.background = 'rgba(255,255,255,0.06)';
                  node.style.border = '1px solid rgba(255,255,255,0.15)';
                  node.style.transform = 'translateY(0)';
                  node.style.boxShadow = 'none';
                }}
              >
                <span className="text-4xl mb-3 block">{card.emoji}</span>
                <h3 className="text-white mb-2" style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {roleNames[card.role]}
                </h3>
                <p className="text-blue-200 mb-4" style={{ fontSize: '0.75rem', opacity: 0.8, lineHeight: 1.5 }}>
                  {t(card.descriptionKey)}
                </p>
                <span className="px-4 py-1.5 rounded-full text-sm transition-all" style={{ background: '#E8821C', color: 'white', fontWeight: 500 }}>
                  {t('landing.login.enter')} →
                </span>
              </button>
            ))}
          </div>
        </main>

        <footer className="relative z-10 text-center py-6 flex flex-col items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <BrandLogo size="sm" showText={true} className="opacity-80 hover:opacity-100" />
          <p className="text-blue-200 text-sm tracking-widest uppercase" style={{ opacity: 0.7 }}>
            {t('landing.footer')}
          </p>
        </footer>
      </div>

      {loginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setLoginModal(null)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" style={{ fontFamily: "'Poppins', sans-serif" }} onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <BrandLogo size="md" showText={true} className="brightness-0" />
              </div>
              <div className="text-5xl mb-3">{loginCards.find(card => card.role === loginModal.role)?.emoji}</div>
              <h2 className="text-2xl" style={{ color: '#0B1C2D', fontWeight: 700 }}>
                {roleNames[loginModal.role]}
              </h2>
              <p className="text-gray-500 text-sm mt-1">{t('landing.modal.demo')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#0B1C2D', fontWeight: 500 }}>{t('landing.modal.fullName')}</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border-2 outline-none transition-all"
                  style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
                  value={loginName}
                  onChange={event => setLoginName(event.target.value)}
                  placeholder={t('landing.modal.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#0B1C2D', fontWeight: 500 }}>{t('landing.modal.email')}</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border-2 outline-none transition-all"
                  style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
                  value={loginEmail}
                  onChange={event => setLoginEmail(event.target.value)}
                  placeholder={t('landing.modal.emailPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#0B1C2D', fontWeight: 500 }}>{t('landing.modal.password')}</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl border-2 outline-none"
                  style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
                  defaultValue="demo1234"
                  placeholder={t('landing.modal.passwordPlaceholder')}
                />
              </div>

              <div className="p-3 rounded-xl text-sm" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#92400E' }}>
                🔐 {t('landing.modal.demoInfo')}
              </div>

              <button
                onClick={handleLogin}
                className="w-full py-3 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: '#0B1C2D', fontWeight: 600, fontSize: '1rem' }}
              >
                {t('landing.modal.login')} →
              </button>
              <button onClick={() => setLoginModal(null)} className="w-full py-2 rounded-xl text-gray-500 text-sm hover:bg-gray-50">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {donationNgoId && <DonationModal ngoId={donationNgoId} onClose={() => setDonationNgoId(null)} />}
    </div>
  );
}
