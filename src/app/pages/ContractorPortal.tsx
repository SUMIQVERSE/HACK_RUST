import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Issue, Bid } from '../context/AppContext';
import { useLang } from '../context/LanguageContext';
import { PortalHeader } from '../components/shared/PortalHeader';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../components/shared/StatusBadge';
import { BeforeAfterModal } from '../components/shared/BeforeAfterModal';
import { AssignedBadge } from '../components/shared/AssignedBadge';
import { DonationModal } from '../components/shared/DonationModal';
import { DuplicateBadge } from '../components/shared/DuplicateBadge';
import { WorkProgressBar } from '../components/shared/WorkProgressBar';
import { BrandLogo } from '../components/shared/BrandLogo';
import { getLocalizedIssueCopy } from '../utils/issueLocalization';

const AFTER_IMAGES = {
  road: 'https://images.unsplash.com/photo-1645698406985-20f411b4937d?w=800&q=80',
  water: 'https://images.unsplash.com/photo-1769263092692-8bdce7a125de?w=800&q=80',
  electricity: 'https://images.unsplash.com/photo-1694408614727-0a05c1019777?w=800&q=80',
  sanitation: 'https://images.unsplash.com/photo-1769263092692-8bdce7a125de?w=800&q=80',
};

export default function ContractorPortal() {
  const navigate = useNavigate();
  const { currentUser, issues, bids, addBid, updateAfterImage } = useApp();
  const { language, t } = useLang();
  const [activeTab, setActiveTab] = useState<'bids' | 'projects' | 'profile'>('bids');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [beforeAfterIssue, setBeforeAfterIssue] = useState<Issue | null>(null);
  const [bidForm, setBidForm] = useState({ amount: '', note: '' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [myBidIssues, setMyBidIssues] = useState<Set<string>>(new Set(bids.filter(b => b.contractorId === currentUser?.id).map(b => b.issueId)));
  const [afterImgInput, setAfterImgInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [donationNgoId, setDonationNgoId] = useState<string | null>(null);

  useEffect(() => { if (!currentUser) navigate('/'); }, [currentUser, navigate]);
  useEffect(() => {
    setMyBidIssues(new Set(bids.filter(b => b.contractorId === currentUser?.id).map(b => b.issueId)));
  }, [bids, currentUser]);

  const openBiddingIssues = issues.filter(i => i.status === 'open_for_bidding');
  const myProjects = issues.filter(i => i.assignedContractor === currentUser?.id);
  const filteredProjects = myProjects.filter(i => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'unresolved') return i.status !== 'resolved';
    return i.status === filterStatus;
  });
  const myBids = bids.filter(b => b.contractorId === currentUser?.id);
  const selectedBidsCount = myBids.filter(b => b.status === 'selected').length;
  const earnings = myBids.filter(b => b.status === 'selected').reduce((sum, b) => sum + b.bidAmount, 0);
  const projectsCompleted = myProjects.filter(p => p.status === 'resolved').length;
  const projectsPending = myProjects.filter(p => p.status === 'in_progress' || p.status === 'awaiting_citizen_verification').length;
  const projectsLeft = myBids.filter(b => b.status === 'submitted').length;

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !bidForm.amount || !currentUser) return;
    const newBid: Bid = {
      id: 'bid-' + Date.now(),
      issueId: selectedIssue.id,
      contractorId: currentUser.id,
      contractorName: currentUser.company || currentUser.fullName,
      bidAmount: parseFloat(bidForm.amount),
      proposalNote: bidForm.note,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };
    addBid(newBid);
    setBidForm({ amount: '', note: '' });
    setSelectedIssue(null);
    alert(t('contractor.bids.success'));
  };

  const handleUploadAfterImage = (issue: Issue) => {
    const imgUrl = afterImgInput.trim() || AFTER_IMAGES[issue.category];
    updateAfterImage(issue.id, imgUrl);
    setAfterImgInput('');
    alert(t('contractor.projects.uploadSuccess'));
  };

  const tabs = [
    { key: 'bids', label: t('contractor.tab.bids'), emoji: '🔍' },
    { key: 'projects', label: t('contractor.tab.projects'), emoji: '📦' },
    { key: 'profile', label: t('contractor.tab.profile'), emoji: '👨🏻‍🔧' },
  ];

  if (!currentUser) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: "'Poppins', sans-serif" }}>
      <PortalHeader title={t('contractor.title')} subtitle={currentUser.company || 'Contractor'} onProfileClick={() => setProfileOpen(true)} />

      {/* Tab Bar */}
      <div className="sticky top-14 z-30 shadow-sm" style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-5xl mx-auto flex">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm whitespace-nowrap transition-all"
              style={{ color: activeTab === tab.key ? '#0B1C2D' : '#6B7280', borderBottom: activeTab === tab.key ? '3px solid #E8821C' : '3px solid transparent', fontWeight: activeTab === tab.key ? 600 : 400, background: 'transparent' }}>
              <span>{tab.emoji}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* OPEN BIDS */}
        {activeTab === 'bids' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: t('contractor.bids.kpi.opportunities'), value: openBiddingIssues.length, icon: '🔍', bg: '#EFF6FF', text: '#1D4ED8' },
                { label: t('contractor.bids.kpi.active'), value: myBids.filter(b => b.status === 'submitted').length, icon: '📝', bg: '#FFFBEB', text: '#B45309' },
                { label: t('contractor.bids.kpi.selected'), value: selectedBidsCount, icon: '✅', bg: '#F0FDF4', text: '#15803D' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center shadow-sm" style={{ background: s.bg, border: `1px solid ${s.text}20` }}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: s.text }}>{s.value}</p>
                  <p style={{ fontSize: '0.7rem', color: s.text, opacity: 0.8 }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl mb-4" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <p className="text-sm" style={{ color: '#92400E' }}>ℹ️ {t('contractor.bids.info')}</p>
            </div>

            <div className="grid gap-4">
              {openBiddingIssues.map(issue => {
                const hasBid = myBidIssues.has(issue.id);
                const myBid = myBids.find(b => b.issueId === issue.id);
                return (
                  <div key={issue.id} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    <div className="flex gap-4 p-4">
                      <img src={issue.beforeImage} alt="" className="w-24 h-20 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <StatusBadge status={issue.status} />
                          <UrgencyBadge urgency={issue.urgencyTag} />
                          <CategoryBadge category={issue.category} />
                        </div>
                        <div className="mb-1 flex items-center gap-2">
                          <h3 style={{ color: '#0B1C2D', fontWeight: 600 }}>{getLocalizedIssueCopy(issue, language).title}</h3>
                          <DuplicateBadge count={issue.duplicateCount} />
                        </div>
                        <p className="text-gray-500 text-xs mb-1">📍 {getLocalizedIssueCopy(issue, language).address}, {getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state}</p>
                        <p className="text-gray-600 text-sm line-clamp-2">{getLocalizedIssueCopy(issue, language).description}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-4 flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>👍 {issue.upvotes}</span>
                        <span>📅 {new Date(issue.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      {hasBid ? (
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-xs text-green-600">✅ {t('contractor.bids.submitted')}: ₹{myBid?.bidAmount.toLocaleString('en-IN')}</span>
                        </div>
                      ) : (
                        <button onClick={() => setSelectedIssue(issue)}
                          className="ml-auto px-4 py-2 rounded-xl text-sm text-white hover:opacity-90 transition-all"
                          style={{ background: '#0B1C2D' }}>
                          💰 {t('contractor.bids.submit')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {openBiddingIssues.length === 0 && <div className="text-center py-16 text-gray-400">{t('contractor.bids.noOpportunities')}</div>}
            </div>
          </div>
        )}

        {/* MY PROJECTS */}
        {activeTab === 'projects' && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: t('contractor.projects.earnings'), value: `₹${earnings.toLocaleString('en-IN')}`, icon: '💰', bg: '#F0FDF4', text: '#15803D' },
                { label: t('contractor.projects.completion'), value: selectedBidsCount, icon: '🏆', bg: '#EFF6FF', text: '#1D4ED8' },
                { label: t('contractor.projects.left'), value: projectsLeft, icon: '📉', bg: '#FDF2F2', text: '#B91C1C' },
                { label: t('contractor.projects.completed'), value: projectsCompleted, icon: '✅', bg: '#F0FDF4', text: '#166534' },
                { label: t('contractor.projects.pending'), value: projectsPending, icon: '⏳', bg: '#FFFBEB', text: '#92400E' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 shadow-sm text-center" style={{ background: s.bg }}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, color: s.text }}>{s.value}</p>
                  <p style={{ fontSize: '0.65rem', color: s.text, fontWeight: 600, textTransform: 'uppercase', tracking: '0.05em', opacity: 0.8 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-3 mb-5">
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">{t('common.allStatuses')}</option>
                <option value="open_for_bidding">{t('status.open_for_bidding')}</option>
                <option value="in_progress">{t('status.in_progress')}</option>
                <option value="awaiting_citizen_verification">{t('status.awaiting_citizen_verification')}</option>
                <option value="resolved">{t('status.resolved')}</option>
                <option value="unresolved">{t('common.unresolved')}</option>
              </select>
              <div className="ml-auto text-sm text-gray-500 self-center">{t('common.issueCount', { count: filteredProjects.length })}</div>
            </div>

            <div className="grid gap-4">
              {myProjects.length === 0 && <div className="text-center py-16 text-gray-400">{t('contractor.projects.noProjects')}</div>}
              {filteredProjects.map(issue => {
                const myBid = myBids.find(b => b.issueId === issue.id && b.status === 'selected');
                return (
                  <div key={issue.id} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    <div className="p-5">
                      <div className="flex gap-4 mb-4">
                        <img src={issue.beforeImage} alt="" className="w-20 h-16 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-2 mb-1.5">
                            <StatusBadge status={issue.status} />
                            <CategoryBadge category={issue.category} />
                          </div>
                          <div className="flex items-center gap-2">
                            <h3 style={{ color: '#0B1C2D', fontWeight: 600 }}>{getLocalizedIssueCopy(issue, language).title}</h3>
                            <DuplicateBadge count={issue.duplicateCount} />
                          </div>
                          <p className="text-gray-500 text-xs">📍 {getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state}</p>
                          {myBid && <p className="text-green-600 text-sm mt-1" style={{ fontWeight: 600 }}>💰 {t('contractor.projects.contractValue', { amount: myBid.bidAmount.toLocaleString('en-IN') })}</p>}
                        </div>
                      </div>

                      {/* Work Progress Vertical Stepper */}
                      <div className="mb-6 p-4 bg-gray-50 rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">🛠️ {t('progress.title')}</p>
                        <WorkProgressBar currentPercent={issue.currentPercent} />
                      </div>

                      {/* Before/After Images */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">📸 {t('beforeAfter.before')}</p>
                          <img src={issue.beforeImage} alt="Before" className="w-full rounded-xl object-cover" style={{ height: 120 }} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">✅ {t('beforeAfter.afterResolved')}</p>
                          {issue.afterImage ? (
                            <img src={issue.afterImage} alt="After" className="w-full rounded-xl object-cover" style={{ height: 120 }} />
                          ) : (
                            <div className="w-full rounded-xl flex items-center justify-center" style={{ height: 120, background: '#F8FAFC', border: '2px dashed #CBD5E1' }}>
                              <p className="text-gray-400 text-xs text-center px-2">{t('common.noAfterImage')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload After Image */}
                      {issue.status === 'in_progress' && (
                        <div className="p-4 rounded-xl" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                          <p className="text-sm mb-2" style={{ color: '#0369A1', fontWeight: 500 }}>📤 {t('contractor.projects.uploadProof')}</p>
                          <div className="flex gap-2">
                            <input
                              className="flex-1 px-3 py-2 rounded-xl border-2 text-sm outline-none"
                              style={{ borderColor: '#BAE6FD', background: 'white' }}
                              placeholder={t('contractor.projects.uploadPlaceholder')}
                              value={afterImgInput}
                              onChange={e => setAfterImgInput(e.target.value)}
                            />
                            <button onClick={() => handleUploadAfterImage(issue)}
                              className="px-4 py-2 rounded-xl text-sm text-white flex-shrink-0 hover:opacity-90"
                              style={{ background: '#0369A1' }}>
                              📤 {t('common.upload')}
                            </button>
                          </div>
                          <p className="text-xs text-blue-400 mt-1">{t('contractor.projects.uploadHelp')}</p>
                        </div>
                      )}

                      {issue.status === 'awaiting_citizen_verification' && (
                        <div className="p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                          <p className="text-sm" style={{ color: '#9A3412', fontWeight: 500 }}>
                            {t('contractor.projects.verifyNotice')}
                          </p>
                        </div>
                      )}

                      {/* Rating */}
                      {issue.contractorRating && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                          <p className="text-sm text-yellow-700">⭐ {t('contractor.projects.rating', { stars: Array(issue.contractorRating).fill('★').join(''), rating: issue.contractorRating })}</p>
                        </div>
                      )}
                    </div>

                    {/* Assigned Badge */}
                    <AssignedBadge contractorId={issue.assignedContractor} ngoId={issue.assignedNgo} />

                    {/* Donation Button for NGO */}
                    {issue.assignedNgo && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => setDonationNgoId(issue.assignedNgo)}
                          className="w-full py-2 rounded-xl text-sm transition-all hover:opacity-80"
                          style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', fontWeight: 500 }}>
                          💚 {t('contractor.projects.viewNgo')}
                        </button>
                      </div>
                    )}

                    <div className="px-4 pb-4">
                      <button onClick={() => setBeforeAfterIssue(issue)}
                        className="w-full py-2 rounded-xl text-sm transition-all hover:opacity-80"
                        style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                        🔍 {t('contractor.projects.viewBeforeAfter')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-sm p-8 relative overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            <BrandLogo size="xl" className="absolute -top-6 -right-6 opacity-5 rotate-12" />
            <div className="space-y-3">
              {[
                { label: t('contractor.profile.company'), value: currentUser.company || 'N/A', icon: '🏗️' },
                { label: t('contractor.profile.regId'), value: currentUser.registrationId || 'N/A', icon: '📋', mono: true },
                { label: t('common.email'), value: currentUser.email, icon: '📧' },
                { label: t('common.phone'), value: currentUser.phone, icon: '📱' },
                { label: t('common.location'), value: `${currentUser.city}, ${currentUser.state}`, icon: '📍' },
                { label: t('contractor.profile.rating'), value: `${currentUser.rating}/5.0 ⭐`, icon: '⭐' },
              ].map(item => (
                <div key={item.label} className="flex gap-3 p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p style={{ fontWeight: 500, color: '#0B1C2D', fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bid Submission Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedIssue(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ background: '#0B1C2D' }}>
              <h3 className="text-white" style={{ fontWeight: 700 }}>{t('contractor.bidModal.title')}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-white text-2xl">×</button>
            </div>
            <div className="p-5">
              <div className="flex gap-3 mb-4 p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                <img src={selectedIssue.beforeImage} alt="" className="w-16 h-14 rounded-lg object-cover flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p style={{ fontWeight: 600, color: '#0B1C2D', fontSize: '0.9rem' }}>{getLocalizedIssueCopy(selectedIssue, language).title}</p>
                    <DuplicateBadge count={selectedIssue.duplicateCount} />
                  </div>
                  <p className="text-gray-500 text-xs">📍 {getLocalizedIssueCopy(selectedIssue, language).city}, {getLocalizedIssueCopy(selectedIssue, language).state}</p>
                  <div className="flex gap-1 mt-1"><CategoryBadge category={selectedIssue.category} /></div>
                </div>
              </div>
              <form onSubmit={handleSubmitBid} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ fontWeight: 500, color: '#374151' }}>{t('contractor.bidModal.amount')}</label>
                  <input type="number" required min="1000"
                    className="w-full px-4 py-2.5 rounded-xl border-2 outline-none text-lg"
                    style={{ borderColor: '#E2E8F0', background: '#F8FAFC', fontWeight: 600 }}
                    placeholder="e.g. 75000"
                    value={bidForm.amount}
                    onChange={e => setBidForm(p => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ fontWeight: 500, color: '#374151' }}>{t('contractor.bidModal.note')}</label>
                  <textarea rows={3} required
                    className="w-full px-4 py-2.5 rounded-xl border-2 outline-none"
                    style={{ borderColor: '#E2E8F0', background: '#F8FAFC', resize: 'none' }}
                    placeholder={t('contractor.bidModal.notePlaceholder')}
                    value={bidForm.note}
                    onChange={e => setBidForm(p => ({ ...p, note: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSelectedIssue(null)}
                    className="py-3 rounded-xl text-sm" style={{ background: '#F1F5F9', color: '#374151' }}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit"
                    className="py-3 rounded-xl text-sm text-white hover:opacity-90"
                    style={{ background: '#0B1C2D', fontWeight: 600 }}>
                    🚀 {t('contractor.bids.submit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {beforeAfterIssue && <BeforeAfterModal issue={beforeAfterIssue} onClose={() => setBeforeAfterIssue(null)} />}

      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setProfileOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#0B1C2D', fontWeight: 700 }}>{t('contractor.profile.title')}</h3>
              <button onClick={() => setProfileOpen(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <BrandLogo size="md" />
              </div>
              <p style={{ fontWeight: 600, color: '#0B1C2D' }}>{currentUser.fullName}</p>
              <p className="text-sm text-gray-500">{currentUser.company}</p>
              <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'monospace' }}>{currentUser.registrationId}</p>
              <div className="mt-3 px-4 py-2 rounded-xl" style={{ background: '#FFFBEB' }}>
                <p className="text-sm text-yellow-700">⭐ {t('contractor.profile.rating')}: {currentUser.rating}/5.0</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {donationNgoId && <DonationModal ngoId={donationNgoId} onClose={() => setDonationNgoId(null)} />}
    </div>
  );
}
