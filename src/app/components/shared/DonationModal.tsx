import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LanguageContext';
import { BrandLogo } from './BrandLogo';

interface DonationModalProps {
  ngoId: string;
  onClose: () => void;
}

export function DonationModal({ ngoId, onClose }: DonationModalProps) {
  const { users, donations, addDonation, currentUser } = useApp();
  const { t } = useLang();
  const ngo = users.find(u => u.id === ngoId);
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [donationComplete, setDonationComplete] = useState(false);

  if (!ngo) return null;

  const ngoDonations = donations.filter(d => d.ngoId === ngoId);
  const totalDonations = ngoDonations.reduce((sum, d) => sum + d.amount, 0);

  const handleDonate = () => {
    const donationAmount = amount || parseInt(customAmount, 10) || 0;
    if (donationAmount < 100) {
      alert(t('donation.minAmountError'));
      return;
    }

    addDonation({
      id: 'd' + Date.now(),
      ngoId,
      donorName: currentUser?.fullName || 'Anonymous',
      amount: donationAmount,
      message: message || 'Thank you for your great work!',
      createdAt: new Date().toISOString(),
    });

    setDonationComplete(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <BrandLogo size="md" className="border-2 border-white border-opacity-30" />
              <div>
                <p className="text-white" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{ngo.ngoName}</p>
                <p className="text-green-100 text-xs">{t('donation.verifiedNgo')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white text-2xl opacity-80 hover:opacity-100">×</button>
          </div>
        </div>

        {!donationComplete ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-xs text-gray-500 mb-1">{t('donation.totalReceived')}</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#15803D' }}>Rs {totalDonations.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('common.donorCount', { count: ngoDonations.length })}</p>
            </div>

            <div>
              <p className="mb-3" style={{ fontWeight: 600, color: '#0B1C2D' }}>{t('donation.selectAmount')}</p>
              <div className="grid grid-cols-3 gap-3">
                {[100, 500, 1000].map(optionAmount => (
                  <button
                    key={optionAmount}
                    onClick={() => {
                      setAmount(optionAmount);
                      setCustomAmount('');
                    }}
                    className="py-3 rounded-xl text-center transition-all"
                    style={{
                      background: amount === optionAmount ? '#10B981' : '#F3F4F6',
                      color: amount === optionAmount ? 'white' : '#374151',
                      border: amount === optionAmount ? '2px solid #10B981' : '2px solid #E5E7EB',
                      fontWeight: amount === optionAmount ? 600 : 400,
                    }}
                  >
                    Rs {optionAmount}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>{t('donation.customAmount')}</label>
              <input
                type="number"
                className="w-full px-4 py-3 rounded-xl border-2 outline-none"
                style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                placeholder={t('donation.customAmountPlaceholder')}
                value={customAmount}
                onChange={event => {
                  setCustomAmount(event.target.value);
                  setAmount(null);
                }}
                min="100"
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: '#374151', fontWeight: 500 }}>{t('donation.messageOptional')}</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border-2 outline-none"
                style={{ borderColor: '#E2E8F0', background: '#F8FAFC', resize: 'none' }}
                rows={2}
                placeholder={t('donation.messagePlaceholder')}
                value={message}
                onChange={event => setMessage(event.target.value)}
              />
            </div>

            <div className="p-3 rounded-xl text-xs" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#92400E' }}>
              {t('donation.demoInfo')}
            </div>

            <button
              onClick={handleDonate}
              className="w-full py-3.5 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#10B981', fontWeight: 600, fontSize: '1rem' }}
            >
              💚 {t('donation.donateNow')}
            </button>
          </div>
        ) : (
          <div className="p-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto" style={{ background: '#F0FDF4' }}>
              ✓
            </div>
            <div>
              <h3 className="mb-2" style={{ color: '#0B1C2D', fontWeight: 700, fontSize: '1.2rem' }}>{t('donation.thankYou')}</h3>
              <p className="text-gray-600">
                {t('donation.recordedAmount', { amount: (amount || parseInt(customAmount, 10)).toLocaleString('en-IN') })}
              </p>
              <p className="text-sm text-gray-500 mt-2">{t('donation.footer')}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl transition-all"
              style={{ background: '#F3F4F6', color: '#374151', fontWeight: 500 }}
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
