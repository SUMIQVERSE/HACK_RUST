import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Issue, NgoRequest, Donation } from '../context/AppContext';
import { useLang } from '../context/LanguageContext';
import { PortalHeader } from '../components/shared/PortalHeader';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../components/shared/StatusBadge';
import { BeforeAfterModal } from '../components/shared/BeforeAfterModal';
import { AssignedBadge } from '../components/shared/AssignedBadge';
import { DuplicateBadge } from '../components/shared/DuplicateBadge';
import { WorkProgressBar } from '../components/shared/WorkProgressBar';
import { BrandLogo } from '../components/shared/BrandLogo';
import { getLocalizedIssueCopy, getLocalizedStateName } from '../utils/issueLocalization';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getStateQualityRatings } from '../utils/stateQuality';

const COLORS = ['#0B1C2D', '#E8821C', '#22C55E', '#3B82F6', '#EF4444', '#8B5CF6'];

export default function NGOPortal() {
  const navigate = useNavigate();
  const { currentUser, issues, ngoRequests, donations, addNgoRequest, addDonation } = useApp();
  const { language, t } = useLang();
  const [activeTab, setActiveTab] = useState<'issues' | 'requests' | 'analytics' | 'donations'>('issues');
  const [filterState, setFilterState] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [beforeAfterIssue, setBeforeAfterIssue] = useState<Issue | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [donationModal, setDonationModal] = useState(false);
  const [donationForm, setDonationForm] = useState({ name: '', amount: '', message: '', card: '4111 1111 1111 1111', expiry: '12/27', cvv: '***' });
  const [donationSuccess, setDonationSuccess] = useState(false);

  useEffect(() => { if (!currentUser) navigate('/'); }, [currentUser, navigate]);

  const myRequests = ngoRequests.filter(r => r.ngoId === currentUser?.id);
  const requestedIssueIds = new Set(myRequests.map(r => r.issueId));
  const allStates = [...new Set(issues.map(i => i.state))];

  const unresolvedIssues = issues.filter(i => {
    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'unresolved') {
        if (i.status === 'resolved') return false;
      } else if (i.status !== filterStatus) {
        return false;
      }
    }
    if (filterState !== 'all' && i.state !== filterState) return false;
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    return true;
  }).sort((a, b) => {
    const o = { High: 0, Medium: 1, Low: 2 };
    return o[a.urgencyTag] - o[b.urgencyTag];
  });

  const myDonations = donations.filter(d => d.ngoId === currentUser?.id);
  const totalDonations = myDonations.reduce((sum, d) => sum + d.amount, 0);

  const handleRaiseRequest = (issueId: string) => {
    if (!currentUser) return;
    if (requestedIssueIds.has(issueId)) { alert(t('ngo.request.duplicate')); return; }
    const newReq: NgoRequest = {
      id: 'nr-' + Date.now(),
      issueId,
      ngoId: currentUser.id,
      ngoName: currentUser.ngoName || currentUser.fullName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    addNgoRequest(newReq);
    alert(t('ngo.request.success'));
  };

  const handleDonation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !donationForm.name || !donationForm.amount) return;
    const d: Donation = {
      id: 'don-' + Date.now(),
      ngoId: currentUser.id,
      donorName: donationForm.name,
      amount: parseFloat(donationForm.amount),
      message: donationForm.message || 'Supporting civic improvement.',
      createdAt: new Date().toISOString(),
    };
    addDonation(d);
    setDonationSuccess(true);
    setDonationForm({ name: '', amount: '', message: '', card: '4111 1111 1111 1111', expiry: '12/27', cvv: '***' });
    setTimeout(() => { setDonationSuccess(false); setDonationModal(false); }, 2500);
  };

  // Analytics data
  const catData = [
    { name: t('category.road'), value: issues.filter(i => i.category === 'road').length, color: '#0B1C2D' },
    { name: t('category.water'), value: issues.filter(i => i.category === 'water').length, color: '#3B82F6' },
    { name: t('category.electricity'), value: issues.filter(i => i.category === 'electricity').length, color: '#F59E0B' },
    { name: t('category.sanitation'), value: issues.filter(i => i.category === 'sanitation').length, color: '#22C55E' },
  ];

  const stateQualityRatings = getStateQualityRatings(issues);
  const stateData = stateQualityRatings.map(rating => ({
    state: getLocalizedStateName(rating.state, language).substring(0, 10),
    quality: rating.qualityScore,
    resolved: rating.resolvedIssues,
  }));

  const urgencyData = [
    { name: t('urgency.high'), value: issues.filter(i => i.urgencyTag === 'High' && i.status !== 'resolved').length, color: '#EF4444' },
    { name: t('urgency.medium'), value: issues.filter(i => i.urgencyTag === 'Medium' && i.status !== 'resolved').length, color: '#F59E0B' },
    { name: t('urgency.low'), value: issues.filter(i => i.urgencyTag === 'Low' && i.status !== 'resolved').length, color: '#22C55E' },
  ];

  const tabs = [
    { key: 'issues', label: t('ngo.tab.issues'), emoji: '📋' },
    { key: 'requests', label: t('ngo.tab.requests'), emoji: '📝' },
    { key: 'analytics', label: t('ngo.tab.analytics'), emoji: '📊' },
    { key: 'donations', label: t('ngo.tab.donations'), emoji: '💰' },
  ];

  if (!currentUser) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: "'Poppins', sans-serif" }}>
      <PortalHeader title={t('ngo.title')} subtitle={currentUser.ngoName || 'NGO'} onProfileClick={() => setProfileOpen(true)} />

      {/* Tab Bar */}
      <div className="sticky top-14 z-30 shadow-sm" style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm whitespace-nowrap transition-all"
              style={{ color: activeTab === tab.key ? '#0B1C2D' : '#6B7280', borderBottom: activeTab === tab.key ? '3px solid #E8821C' : '3px solid transparent', fontWeight: activeTab === tab.key ? 600 : 400, background: 'transparent' }}>
              <span>{tab.emoji}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* UNRESOLVED ISSUES */}
        {activeTab === 'issues' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-5">
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                value={filterState} onChange={e => setFilterState(e.target.value)}>
                <option value="all">{t('select.state')}</option>
                {allStates.map(s => <option key={s} value={s}>{getLocalizedStateName(s, language)}</option>)}
              </select>
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="all">{t('common.allCategories')}</option>
                <option value="road">🛣️ {t('category.road')}</option>
                <option value="water">💧 {t('category.water')}</option>
                <option value="electricity">⚡ {t('category.electricity')}</option>
                <option value="sanitation">🗑️ {t('category.sanitation')}</option>
              </select>
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">{t('common.allStatuses')}</option>
                <option value="awaiting_citizen_verification">{t('status.awaiting_citizen_verification')}</option>
                <option value="unresolved">⚠️ {t('common.unresolved')}</option>
                <option value="resolved">✅ {t('status.resolved')}</option>
              </select>
              <div className="ml-auto text-sm text-gray-500 self-center">{t('common.issueCount', { count: unresolvedIssues.length })}</div>
            </div>

            <div className="grid gap-4">
              {unresolvedIssues.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="flex justify-center mb-4 opacity-30">
                    <BrandLogo size="lg" />
                  </div>
                  <p className="text-gray-400">{t('ngo.issues.noIssues')}</p>
                </div>
              )}
              {unresolvedIssues.map(issue => {
                const hasRequest = requestedIssueIds.has(issue.id);
                const myReq = myRequests.find(r => r.issueId === issue.id);
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
                        <div className="flex items-center gap-2">
                          <h3 style={{ color: '#0B1C2D', fontWeight: 600, fontSize: '0.95rem' }}>{getLocalizedIssueCopy(issue, language).title}</h3>
                          <DuplicateBadge count={issue.duplicateCount} />
                        </div>
                        <p className="text-gray-500 text-xs">📍 {getLocalizedIssueCopy(issue, language).address}, {getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state}</p>
                        
                        {/* Progress Bar */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
                          <WorkProgressBar currentPercent={issue.currentPercent} />
                        </div>

                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">{getLocalizedIssueCopy(issue, language).description}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-4 flex items-center gap-3">
                      <span className="text-xs text-gray-500">👍 {issue.upvotes} | 📅 {new Date(issue.createdAt).toLocaleDateString('en-IN')}</span>
                      <button onClick={() => setBeforeAfterIssue(issue)}
                        className="px-3 py-1.5 rounded-full text-xs" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                        🔍 {t('beforeAfter.title')}
                      </button>
                      {hasRequest ? (
                        <span className={`ml-auto px-3 py-1.5 rounded-full text-xs font-medium`} style={{
                          background: myReq?.status === 'approved' ? '#F0FDF4' : myReq?.status === 'rejected' ? '#FEF2F2' : '#FEF9C3',
                          color: myReq?.status === 'approved' ? '#15803D' : myReq?.status === 'rejected' ? '#991B1B' : '#92400E',
                        }}>
                          {myReq?.status === 'approved' ? `✅ ${t('status.approved')}` : myReq?.status === 'rejected' ? `❌ ${t('status.rejected')}` : `⏳ ${t('ngo.request.pending')}`}
                        </span>
                      ) : (
                        <button onClick={() => handleRaiseRequest(issue.id)}
                          className="ml-auto px-4 py-1.5 rounded-full text-sm text-white hover:opacity-90 transition-all"
                          style={{ background: '#0B1C2D', fontWeight: 500 }}>
                          🤝 {t('ngo.request.raise')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MY REQUESTS */}
        {activeTab === 'requests' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: t('ngo.request.kpi.total'), value: myRequests.length, color: '#0B1C2D', bg: '#F8FAFC' },
                { label: t('status.approved'), value: myRequests.filter(r => r.status === 'approved').length, color: '#15803D', bg: '#F0FDF4' },
                { label: t('ngo.request.pending'), value: myRequests.filter(r => r.status === 'pending').length, color: '#B45309', bg: '#FFFBEB' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center shadow-sm" style={{ background: s.bg }}>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: '0.7rem', color: s.color, opacity: 0.8 }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {myRequests.length === 0 && <div className="text-center py-16 text-gray-400">{t('ngo.request.noRequests')}</div>}
              {myRequests.map(req => {
                const issue = issues.find(i => i.id === req.issueId);
                if (!issue) return null;
                return (
                  <div key={req.id} className="bg-white rounded-2xl shadow-sm p-5" style={{ border: req.status === 'pending' ? '2px solid #FDE68A' : '1px solid #E2E8F0' }}>
                    <div className="flex gap-3">
                      <img src={issue.beforeImage} alt="" className="w-20 h-16 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-1.5">
                          <CategoryBadge category={issue.category} />
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium`} style={{
                            background: req.status === 'approved' ? '#F0FDF4' : req.status === 'rejected' ? '#FEF2F2' : '#FEF9C3',
                            color: req.status === 'approved' ? '#15803D' : req.status === 'rejected' ? '#991B1B' : '#92400E',
                            border: `1px solid ${req.status === 'approved' ? '#BBF7D0' : req.status === 'rejected' ? '#FECACA' : '#FDE68A'}`,
                          }}>
                            {req.status === 'approved' ? `✅ ${t('status.approved')}` : req.status === 'rejected' ? `❌ ${t('status.rejected')}` : `⏳ ${t('ngo.request.pending')}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                        <p style={{ fontWeight: 600, color: '#0B1C2D' }}>{getLocalizedIssueCopy(issue, language).title}</p>
                          <DuplicateBadge count={issue.duplicateCount} />
                        </div>
                        <p className="text-gray-500 text-xs">📍 {getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state}</p>
                        <p className="text-gray-400 text-xs mt-1">{t('ngo.request.at')}: {new Date(req.createdAt).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: t('authority.kpi.total'), value: issues.length, icon: '📌', bg: '#EFF6FF', text: '#1D4ED8' },
                { label: t('common.unresolved'), value: issues.filter(i => i.status !== 'resolved').length, icon: '⚠️', bg: '#FEF2F2', text: '#991B1B' },
                { label: t('authority.kpi.resolved'), value: issues.filter(i => i.status === 'resolved').length, icon: '✅', bg: '#F0FDF4', text: '#15803D' },
                { label: t('ngo.analytics.participation'), value: ngoRequests.filter(r => r.status === 'approved').length, icon: '🤝', bg: '#FFF7ED', text: '#C2410C' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center shadow-sm" style={{ background: s.bg }}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: s.text, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: '0.7rem', color: s.text, opacity: 0.8, marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Distribution */}
              <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>📊 {t('ngo.analytics.catDist')}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                      {catData.map((entry) => <Cell key={`cat-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, t('ngo.analytics.issues')]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {catData.map(c => (
                    <span key={c.name} className="flex items-center gap-1 text-xs">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: c.color }} />
                      {c.name} ({c.value})
                    </span>
                  ))}
                </div>
              </div>

              {/* Urgency Distribution */}
              <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>🚨 {t('ngo.analytics.urgDist')}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={urgencyData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                      {urgencyData.map((entry) => <Cell key={`urgency-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, t('ngo.analytics.issues')]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2">
                  {urgencyData.map(u => (
                    <span key={u.name} className="flex items-center gap-1 text-xs">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: u.color }} />
                      {u.name}: {u.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* State Analytics */}
            <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
              <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>🗺️ {t('ngo.analytics.stateAnalytics')}</h3>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <p className="text-sm text-gray-500">{t('ngo.analytics.stateDesc')}</p>
                {stateQualityRatings[0] && <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', fontWeight: 600 }}>
                  {t('ngo.analytics.topState')}: {getLocalizedStateName(stateQualityRatings[0].state, language)} ({stateQualityRatings[0].qualityScore}/100)
                </div>}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stateData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quality" name={t('ngo.analytics.quality')} fill="#0B1C2D" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name={t('ngo.analytics.resolvedCount')} fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid gap-3 mt-4">
                {stateQualityRatings.slice(0, 5).map((rating, index) => (
                  <div key={rating.state} className="rounded-2xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm text-white" style={{ background: index === 0 ? '#15803D' : '#0B1C2D', fontWeight: 700 }}>
                          #{index + 1}
                        </div>
                        <div>
                          <p style={{ color: '#0B1C2D', fontWeight: 600 }}>{getLocalizedStateName(rating.state, language)}</p>
                          <p className="text-xs text-gray-500">{rating.resolvedIssues}/{rating.totalIssues} {t('ngo.analytics.resolvedShort')} • {t('ngo.analytics.ratingShort')} {rating.averageRating}/5 • {t('ngo.analytics.trustShort')} {rating.trustRate}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p style={{ color: '#0B1C2D', fontWeight: 700 }}>{rating.qualityScore}/100</p>
                        <p className="text-xs" style={{ color: rating.qualityBand === 'Excellent' ? '#15803D' : rating.qualityBand === 'Strong' ? '#1D4ED8' : rating.qualityBand === 'Fair' ? '#B45309' : '#991B1B' }}>
                          {rating.qualityBand}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NGO Participation */}
            <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
              <h3 className="mb-3" style={{ color: '#0B1C2D', fontWeight: 600 }}>🤝 {t('ngo.analytics.participation')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t('ngo.analytics.reqRaised'), value: ngoRequests.length },
                  { label: t('status.approved'), value: ngoRequests.filter(r => r.status === 'approved').length },
                  { label: t('ngo.request.pending'), value: ngoRequests.filter(r => r.status === 'pending').length },
                  { label: t('status.rejected'), value: ngoRequests.filter(r => r.status === 'rejected').length },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: '#F8FAFC' }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B1C2D' }}>{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DONATIONS */}
        {activeTab === 'donations' && (
          <div className="space-y-5">
            {/* Total Donations Card */}
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'linear-gradient(135deg, #0B1C2D, #1E3A5F)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">{t('ngo.donations.total')}</p>
                  <p className="text-white" style={{ fontSize: '2.5rem', fontWeight: 800 }}>₹{totalDonations.toLocaleString('en-IN')}</p>
                  <p className="text-blue-300 text-sm">{myDonations.length} {t('ngo.donations.contributions')}</p>
                  <p className="text-blue-400 text-xs mt-2">💡 {t('ngo.donations.tip')}</p>
                </div>
                <div className="text-6xl opacity-20">💰</div>
              </div>
            </div>

            {/* Donation History */}
            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid #E2E8F0' }}>
              <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>📜 {t('ngo.donations.history')}</h3>
              <div className="space-y-3">
                {myDonations.map(d => (
                  <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: '#FFF7ED' }}>💳</div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontWeight: 600, color: '#0B1C2D', fontSize: '0.9rem' }}>{d.donorName}</p>
                      <p className="text-gray-500 text-xs line-clamp-1">{d.message}</p>
                      <p className="text-gray-400 text-xs">{new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <p style={{ fontWeight: 700, color: '#15803D', fontSize: '1.1rem', flexShrink: 0 }}>₹{d.amount.toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {beforeAfterIssue && <BeforeAfterModal issue={beforeAfterIssue} onClose={() => setBeforeAfterIssue(null)} />}

      {/* Donation Modal */}
      {donationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDonationModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ background: '#0B1C2D' }}>
              <div>
                <h3 className="text-white" style={{ fontWeight: 700 }}>💰 {t('ngo.donationModal.title')}</h3>
                <p className="text-blue-300 text-xs">{t('ngo.donationModal.demo')}</p>
              </div>
              <button onClick={() => setDonationModal(false)} className="text-white text-2xl">×</button>
            </div>
            <div className="p-5">
              {donationSuccess ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎉</div>
                  <h3 style={{ color: '#15803D', fontWeight: 700 }}>{t('ngo.donationModal.success')}</h3>
                  <p className="text-gray-500 text-sm mt-2">{t('ngo.donationModal.successMsg', { name: currentUser.ngoName })}</p>
                </div>
              ) : (
                <form onSubmit={handleDonation} className="space-y-4">
                  <div className="p-3 rounded-xl text-xs text-center" style={{ background: '#FFF7ED', color: '#92400E', border: '1px solid #FED7AA' }}>
                    ⚠️ {t('ngo.donationModal.demoNotice')}
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ fontWeight: 500 }}>{t('ngo.donationModal.donor')}</label>
                    <input required className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                      placeholder={t('ngo.donationModal.donorPlaceholder')} value={donationForm.name} onChange={e => setDonationForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ fontWeight: 500 }}>{t('ngo.donationModal.amountLabel')}</label>
                    <div className="flex gap-2 mb-2">
                      {[500, 1000, 5000, 10000].map(amt => (
                        <button key={amt} type="button" onClick={() => setDonationForm(p => ({ ...p, amount: amt.toString() }))}
                          className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: donationForm.amount === amt.toString() ? '#0B1C2D' : '#F1F5F9', color: donationForm.amount === amt.toString() ? 'white' : '#374151', fontWeight: 500 }}>
                          ₹{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <input required type="number" min="1" className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                      placeholder={t('ngo.donationModal.customPlaceholder')} value={donationForm.amount} onChange={e => setDonationForm(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ fontWeight: 500 }}>{t('ngo.donationModal.card')}</label>
                    <input readOnly className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F0F0F0', fontFamily: 'monospace', color: '#6B7280' }}
                      value={donationForm.card} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1.5" style={{ fontWeight: 500 }}>{t('ngo.donationModal.expiry')}</label>
                      <input readOnly className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F0F0F0', color: '#6B7280' }} value={donationForm.expiry} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1.5" style={{ fontWeight: 500 }}>{t('ngo.donationModal.cvv')}</label>
                      <input readOnly className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F0F0F0', color: '#6B7280' }} value={donationForm.cvv} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ fontWeight: 500 }}>{t('ngo.donationModal.message')}</label>
                    <input className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                      placeholder={t('ngo.donationModal.messagePlaceholder')} value={donationForm.message} onChange={e => setDonationForm(p => ({ ...p, message: e.target.value }))} />
                  </div>
                  <button type="submit" className="w-full py-3.5 rounded-xl text-white hover:opacity-90 transition-all" style={{ background: '#0B1C2D', fontWeight: 600 }}>
                    💰 {t('ngo.donationModal.submit', { amount: donationForm.amount ? parseInt(donationForm.amount).toLocaleString('en-IN') : '0' })}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setProfileOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#0B1C2D', fontWeight: 700 }}>{t('ngo.profile.title')}</h3>
              <button onClick={() => setProfileOpen(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="text-center mb-4">
              <div className="flex justify-center mb-3">
                <BrandLogo size="md" />
              </div>
              <p style={{ fontWeight: 700, color: '#0B1C2D' }}>{currentUser.ngoName}</p>
              <p className="text-sm text-gray-500">{currentUser.fullName}</p>
              <p className="text-xs text-gray-400">{currentUser.email}</p>
              <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'monospace' }}>{currentUser.registrationId}</p>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: '#F0FDF4' }}>
              <p className="text-sm text-green-700">⭐ {t('ngo.profile.rating')}: {currentUser.rating}/5.0</p>
              <p className="text-xs text-green-600 mt-1">{t('ngo.donations.received')}: ₹{totalDonations.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
