import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Issue } from '../context/AppContext';
import { useLang } from '../context/LanguageContext';
import { PortalHeader } from '../components/shared/PortalHeader';
import { BrandLogo } from '../components/shared/BrandLogo';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../components/shared/StatusBadge';
import { BeforeAfterModal } from '../components/shared/BeforeAfterModal';
import { AssignedBadge } from '../components/shared/AssignedBadge';
import { DuplicateBadge } from '../components/shared/DuplicateBadge';
import { getLocalizedIssueCopy, getLocalizedStateName } from '../utils/issueLocalization';
import { getStateQualityRatings } from '../utils/stateQuality';
import { WorkProgressBar } from '../components/shared/WorkProgressBar';

export default function AuthorityPortal() {
  const navigate = useNavigate();
  const { currentUser, issues, bids, ngoRequests, updateIssueStatus, selectBid, updateNgoRequest, submitResolutionProof } = useApp();
  const { language, t } = useLang();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'issues' | 'bidding' | 'ngo'>('dashboard');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [beforeAfterIssue, setBeforeAfterIssue] = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [afterImageUrl, setAfterImageUrl] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => { if (!currentUser) navigate('/'); }, [currentUser, navigate]);
  useEffect(() => { setAfterImageUrl(selectedIssue?.afterImage || ''); }, [selectedIssue]);

  const resolved = issues.filter(i => i.status === 'resolved').length;
  const inProgress = issues.filter(i => i.status === 'in_progress').length;
  const awaitingVerification = issues.filter(i => i.status === 'awaiting_citizen_verification').length;
  const openBidding = issues.filter(i => i.status === 'open_for_bidding').length;
  const highUrgency = issues.filter(i => i.urgencyTag === 'High' && i.status !== 'resolved').length;
  const suspicious = issues.filter(i => i.isSuspicious).length;

  const allStates = [...new Set(issues.map(i => i.state))];
  const stateQualityRatings = getStateQualityRatings(issues);
  const topStateQualityRatings = stateQualityRatings.slice(0, 5);
  const filteredIssues = issues.filter(i => {
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
  });

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const urgOrder = { High: 0, Medium: 1, Low: 2 };
    return urgOrder[a.urgencyTag] - urgOrder[b.urgencyTag];
  });
  const localizedSelectedIssue = selectedIssue ? getLocalizedIssueCopy(selectedIssue, language) : null;

  const handleSelectBid = (bidId: string, issueId: string, contractorId: string) => {
    selectBid(bidId, issueId, contractorId);
    setSelectedIssue(null);
  };

  const handleSubmitProof = (issueId: string) => {
    if (!afterImageUrl.trim()) {
      alert(t('authority.proof.required'));
      return;
    }
    submitResolutionProof(issueId, afterImageUrl.trim());
    setSelectedIssue(null);
    setAfterImageUrl('');
  };

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { key: 'issues', label: 'All Issues', emoji: '📋' },
    { key: 'bidding', label: 'Contractor Bids', emoji: '🔨' },
    { key: 'ngo', label: 'NGO Requests', emoji: '🤝' },
  ];

  if (!currentUser) return null;

  const kpiCards = [
    { label: t('authority.kpi.resolved'), value: resolved, icon: '✅', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
    { label: t('authority.kpi.inProgress'), value: inProgress, icon: '⚙️', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
    { label: t('authority.kpi.awaiting'), value: awaitingVerification, icon: '🟠', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
    { label: t('authority.kpi.openBidding'), value: openBidding, icon: '🔍', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    { label: `🔴 ${t('authority.kpi.highUrgency')}`, value: highUrgency, icon: '⚠️', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
    { label: t('authority.kpi.suspicious'), value: suspicious, icon: '🚨', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
    { label: t('authority.kpi.total'), value: issues.length, icon: <BrandLogo size="sm" />, bg: '#F8FAFC', text: '#0B1C2D', border: '#E2E8F0' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: "'Poppins', sans-serif" }}>
      <PortalHeader title={t('authority.title')} subtitle={t('authority.subtitle')} onProfileClick={() => setProfileOpen(true)} />

      {/* Tab Bar */}
      <div className="sticky top-14 z-30 shadow-sm" style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm whitespace-nowrap transition-all"
              style={{ color: activeTab === tab.key ? '#0B1C2D' : '#6B7280', borderBottom: activeTab === tab.key ? '3px solid #E8821C' : '3px solid transparent', fontWeight: activeTab === tab.key ? 600 : 400, background: 'transparent' }}>
              <span>{tab.emoji}</span> {t(`authority.tab.${tab.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="mb-6">
              <h2 style={{ color: '#0B1C2D', fontWeight: 700 }}>{t('authority.dashboard.title')}</h2>
              <p className="text-gray-500 text-sm">{t('authority.dashboard.desc')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {kpiCards.map(card => (
                <div key={card.label} className="rounded-2xl p-4 text-center shadow-sm" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
                  <div className="text-2xl mb-1">{card.icon}</div>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: card.text, lineHeight: 1 }}>{card.value}</p>
                  <p style={{ fontSize: '0.7rem', color: card.text, opacity: 0.8, marginTop: 4 }}>{card.label}</p>
                </div>
              ))}
            </div>

            {/* Suspicious Issues Alert */}
            {suspicious > 0 && (
              <div className="mb-6 p-4 rounded-2xl" style={{ background: '#FEF2F2', border: '2px solid #FECACA' }}>
                <h3 className="mb-3" style={{ color: '#991B1B', fontWeight: 600 }}>🚨 {t('authority.alert.suspicious', { count: suspicious })}</h3>
                {issues.filter(i => i.isSuspicious).map(issue => (
                  <div key={issue.id} className="flex items-center justify-between p-3 bg-white rounded-xl mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm" style={{ fontWeight: 500 }}>{getLocalizedIssueCopy(issue, language).title}</p>
                        <DuplicateBadge count={issue.duplicateCount} />
                      </div>
                      <p className="text-xs text-gray-500">{getLocalizedIssueCopy(issue, language).city} | 👎 {issue.downvotes} downvotes — May be incorrectly categorized</p>
                    </div>
                    <button onClick={() => setSelectedIssue(issue)}
                      className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: '#991B1B' }}>
                      {t('authority.table.action')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-6 bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <h3 style={{ color: '#0B1C2D', fontWeight: 600 }}>{t('authority.rankings.title')}</h3>
                  <p className="text-gray-500 text-sm">{t('authority.rankings.desc')}</p>
                </div>
                {topStateQualityRatings[0] && (
                  <div className="px-4 py-2 rounded-2xl text-sm" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', fontWeight: 600 }}>
                    {t('authority.rankings.best', { state: getLocalizedStateName(topStateQualityRatings[0].state, language), score: topStateQualityRatings[0].qualityScore })}
                  </div>
                )}
              </div>
              <div className="grid gap-3">
                {topStateQualityRatings.map((rating, index) => (
                  <div key={rating.state} className="rounded-2xl p-4" style={{ background: index === 0 ? '#F8FAFC' : '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm text-white" style={{ background: index === 0 ? '#15803D' : '#0B1C2D', fontWeight: 700 }}>
                          #{index + 1}
                        </div>
                        <div>
                          <p style={{ color: '#0B1C2D', fontWeight: 600 }}>{getLocalizedStateName(rating.state, language)}</p>
                          <p className="text-xs text-gray-500">{rating.resolvedIssues}/{rating.totalIssues} issues resolved • Avg rating {rating.averageRating}/5</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p style={{ color: '#0B1C2D', fontWeight: 700 }}>{rating.qualityScore}/100</p>
                        <p className="text-xs" style={{ color: rating.qualityBand === 'Excellent' ? '#15803D' : rating.qualityBand === 'Strong' ? '#1D4ED8' : rating.qualityBand === 'Fair' ? '#B45309' : '#991B1B' }}>
                          {rating.qualityBand}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                      <div className="h-full rounded-full" style={{ width: `${rating.qualityScore}%`, background: rating.qualityScore >= 85 ? '#15803D' : rating.qualityScore >= 70 ? '#2563EB' : rating.qualityScore >= 55 ? '#D97706' : '#DC2626' }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                      <span>Resolution rate: {rating.resolutionRate}%</span>
                      <span>Trust score: {rating.trustRate}%</span>
                      <span>Awaiting verify: {rating.awaitingVerificationIssues}</span>
                      <span>Suspicious: {rating.suspiciousIssues}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent High Urgency */}
            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid #E2E8F0' }}>
              <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>🔴 {t('authority.highPriority.title')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                      {['image', 'issue', 'category', 'location', 'status', 'urgency', 'action'].map(h => (
                        <th key={h} className="pb-3 text-left pr-4 text-xs text-gray-500" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t(`authority.table.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issues.filter(i => i.urgencyTag === 'High').slice(0, 6).map(issue => (
                      <tr key={issue.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td className="py-3 pr-4">
                          <img src={issue.beforeImage} alt="" className="w-12 h-10 rounded-lg object-cover" />
                        </td>
                        <td className="py-3 pr-4" style={{ maxWidth: 200 }}>
                          <div className="flex items-center gap-2">
                            <p className="truncate" style={{ fontWeight: 500 }}>{getLocalizedIssueCopy(issue, language).title}</p>
                            <DuplicateBadge count={issue.duplicateCount} />
                          </div>
                        </td>
                        <td className="py-3 pr-4"><CategoryBadge category={issue.category} /></td>
                        <td className="py-3 pr-4 text-xs text-gray-500">{getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state}</td>
                        <td className="py-3 pr-4"><StatusBadge status={issue.status} /></td>
                        <td className="py-3 pr-4"><UrgencyBadge urgency={issue.urgencyTag} /></td>
                        <td className="py-3">
                          <button onClick={() => setSelectedIssue(issue)}
                            className="px-3 py-1.5 rounded-lg text-xs text-white transition-all hover:opacity-90"
                            style={{ background: '#0B1C2D' }}>
                            {t('citizen.issues.viewDetails')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ALL ISSUES */}
        {activeTab === 'issues' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-5">
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">{t('common.allStatuses')}</option>
                <option value="unresolved">{t('common.unresolved')}</option>
                <option value="open_for_bidding">{t('status.open_for_bidding')}</option>
                <option value="in_progress">{t('status.in_progress')}</option>
                <option value="awaiting_citizen_verification">{t('status.awaiting_citizen_verification')}</option>
                <option value="resolved">{t('status.resolved')}</option>
              </select>
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
              <div className="ml-auto text-sm text-gray-500 self-center">{t('common.issueCount', { count: sortedIssues.length })}</div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['image', 'issue', 'category', 'location', 'status', 'urgency', 'votes', 'action'].map(h => (
                        <th key={h} className="py-3 px-4 text-left text-xs text-gray-500" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t(`authority.table.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIssues.map(issue => (
                      <tr key={issue.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td className="py-3 px-4">
                          <img src={issue.beforeImage} alt="" className="w-14 h-11 rounded-xl object-cover" />
                        </td>
                        <td className="py-3 px-4" style={{ maxWidth: 200 }}>
                          <div className="flex items-center gap-2">
                            <p className="truncate" style={{ fontWeight: 500, color: '#0B1C2D' }}>{getLocalizedIssueCopy(issue, language).title}</p>
                            <DuplicateBadge count={issue.duplicateCount} />
                          </div>
                          {issue.isSuspicious && <span className="text-xs text-red-600">⚠️ Suspicious</span>}
                        </td>
                        <td className="py-3 px-4"><CategoryBadge category={issue.category} /></td>
                        <td className="py-3 px-4 text-xs text-gray-500">{getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state}</td>
                        <td className="py-3 px-4"><StatusBadge status={issue.status} /></td>
                        <td className="py-3 px-4"><UrgencyBadge urgency={issue.urgencyTag} /></td>
                        <td className="py-3 px-4 text-xs">
                          <span className="text-green-600">👍 {issue.upvotes}</span>
                          <span className="mx-1 text-gray-300">|</span>
                          <span className="text-red-500">👎 {issue.downvotes}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button onClick={() => setSelectedIssue(issue)}
                              className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: '#0B1C2D' }}>
                              Details
                            </button>
                            <button onClick={() => setBeforeAfterIssue(issue)}
                              className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                              B/A
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* BIDDING */}
        {activeTab === 'bidding' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl mb-2" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <p className="text-sm" style={{ color: '#92400E' }}>ℹ️ {t('authority.bidding.info')}</p>
            </div>
            {issues.filter(i => i.status === 'open_for_bidding' || bids.some(b => b.issueId === i.id)).map(issue => {
              const issueBids = bids.filter(b => b.issueId === issue.id);
              return (
                <div key={issue.id} className="bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid #E2E8F0' }}>
                  <div className="flex flex-wrap gap-3 items-start mb-4">
                    <img src={issue.beforeImage} alt="" className="w-20 h-16 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-1.5">
                        <StatusBadge status={issue.status} />
                        <UrgencyBadge urgency={issue.urgencyTag} />
                        <CategoryBadge category={issue.category} />
                      </div>
                      <div className="flex items-center gap-2">
                        <h3 className="truncate" style={{ color: '#0B1C2D', fontWeight: 600 }}>{getLocalizedIssueCopy(issue, language).title}</h3>
                        <DuplicateBadge count={issue.duplicateCount} />
                      </div>
                      <p className="text-gray-500 text-xs">📍 {getLocalizedIssueCopy(issue, language).address}, {getLocalizedIssueCopy(issue, language).city}</p>
                    </div>
                  </div>

                  {issueBids.length === 0 ? (
                    <div className="p-4 rounded-xl text-center" style={{ background: '#F8FAFC', color: '#9CA3AF', fontSize: '0.85rem' }}>
                      {t('authority.bidding.noBids')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500" style={{ fontWeight: 500 }}>{t('authority.bidding.bidsReceived', { count: issueBids.length })}</p>
                      {issueBids.map(bid => (
                        <div key={bid.id} className="p-4 rounded-xl" style={{ background: bid.status === 'selected' ? '#F0FDF4' : '#F8FAFC', border: bid.status === 'selected' ? '2px solid #BBF7D0' : '1px solid #E2E8F0' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm" style={{ fontWeight: 600, color: '#0B1C2D' }}>🏗️ {bid.contractorName}</span>
                                {bid.status === 'selected' && <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#BBF7D0', color: '#15803D', fontWeight: 600 }}>✅ SELECTED</span>}
                                {bid.status === 'rejected' && <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>Rejected</span>}
                              </div>
                              <p className="text-xl" style={{ fontWeight: 700, color: '#0B1C2D' }}>₹{bid.bidAmount.toLocaleString('en-IN')}</p>
                              <p className="text-gray-600 text-sm mt-1">{bid.proposalNote}</p>
                              <p className="text-gray-400 text-xs mt-1">Submitted: {new Date(bid.createdAt).toLocaleDateString('en-IN')}</p>
                            </div>
                            {issue.status === 'open_for_bidding' && bid.status === 'submitted' && (
                              <button onClick={() => handleSelectBid(bid.id, issue.id, bid.contractorId)}
                                className="px-4 py-2 rounded-xl text-sm text-white flex-shrink-0 hover:opacity-90 transition-all"
                                style={{ background: '#15803D' }}>
                                ✅ {t('authority.bidding.selectBid')}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* NGO REQUESTS */}
        {activeTab === 'ngo' && (
          <div className="space-y-4">
            {ngoRequests.length === 0 && <div className="text-center py-16 text-gray-400">{t('authority.ngo.noRequests')}</div>}
            {ngoRequests.map(req => {
              const issue = issues.find(i => i.id === req.issueId);
              if (!issue) return null;
              return (
                <div key={req.id} className="bg-white rounded-2xl shadow-sm p-5" style={{ border: req.status === 'pending' ? '2px solid #FDE68A' : '1px solid #E2E8F0' }}>
                  <div className="flex flex-wrap gap-3 items-start">
                    <img src={issue.beforeImage} alt="" className="w-20 h-16 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-1.5">
                        <CategoryBadge category={issue.category} />
                        <StatusBadge status={issue.status} />
                         {req.status === 'pending' && (
                           <span className="px-2 py-1 rounded-full text-xs" style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A', fontWeight: 600 }}>⏳ {t('authority.ngo.pending')}</span>
                         )}
                         {req.status === 'approved' && (
                           <span className="px-2 py-1 rounded-full text-xs" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', fontWeight: 600 }}>✅ {t('status.approved')}</span>
                         )}
                         {req.status === 'rejected' && (
                           <span className="px-2 py-1 rounded-full text-xs" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontWeight: 600 }}>❌ {t('status.rejected')}</span>
                         )}
                      </div>
                      <div className="flex items-center gap-2">
                        <h3 style={{ fontWeight: 600, color: '#0B1C2D' }}>{getLocalizedIssueCopy(issue, language).title}</h3>
                        <DuplicateBadge count={issue.duplicateCount} />
                      </div>
                      <p className="text-gray-500 text-sm">🏢 NGO: <strong>{req.ngoName}</strong></p>
                      <p className="text-gray-500 text-xs">📍 {getLocalizedIssueCopy(issue, language).city}, {getLocalizedIssueCopy(issue, language).state} | 📅 {new Date(req.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => updateNgoRequest(req.id, req.ngoId, req.issueId, 'approved')}
                            className="px-4 py-2 rounded-xl text-sm text-white hover:opacity-90" style={{ background: '#15803D' }}>
                            ✅ {t('button.approve')}
                          </button>
                          <button onClick={() => updateNgoRequest(req.id, req.ngoId, req.issueId, 'rejected')}
                            className="px-4 py-2 rounded-xl text-sm text-white hover:opacity-90" style={{ background: '#DC2626' }}>
                            ❌ {t('button.reject')}
                          </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedIssue(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ background: '#0B1C2D' }}>
              <h3 className="text-white" style={{ fontWeight: 700 }}>{t('common.details')}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <p className="text-xs text-gray-500 mb-1">{t('beforeAfter.before')} ({t('citizen.role')})</p>
                   <img src={selectedIssue.beforeImage} alt={t('beforeAfter.before')} className="w-full rounded-xl object-cover" style={{ height: 160 }} />
                 </div>
                 <div>
                  <p className="text-xs text-gray-500 mb-1">{t('beforeAfter.afterResolved')}</p>
                   {selectedIssue.afterImage ? (
                       <img src={selectedIssue.afterImage} alt={t('beforeAfter.afterResolved')} className="w-full rounded-xl object-cover" style={{ height: 160 }} />
                   ) : (
                     <div className="w-full rounded-xl flex items-center justify-center text-gray-400 text-sm" style={{ height: 160, background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
                       {t('common.noAfterImage')}
                     </div>
                   )}
                 </div>
              </div>

              {/* Progress Tracking */}
              <div className="bg-white p-4 rounded-xl shadow-inner" style={{ border: '1px solid #E2E8F0' }}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  📈 {t('progress.title')}
                </p>
                <WorkProgressBar currentPercent={selectedIssue.currentPercent} />
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedIssue.status} />
                <UrgencyBadge urgency={selectedIssue.urgencyTag} />
                <CategoryBadge category={selectedIssue.category} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <h2 style={{ color: '#0B1C2D', fontWeight: 700 }}>{localizedSelectedIssue?.title}</h2>
                <DuplicateBadge count={selectedIssue.duplicateCount} />
              </div>
              <p className="text-gray-600 text-sm">{localizedSelectedIssue?.description}</p>
              <p className="text-gray-500 text-sm">📍 {localizedSelectedIssue?.address}, {localizedSelectedIssue?.city}, {localizedSelectedIssue?.state}</p>

              {/* Status Controls */}
              <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-sm mb-3" style={{ fontWeight: 600, color: '#0B1C2D' }}>Update Status</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(['open_for_bidding', 'in_progress'] as const).map(s => (
                    <button key={s}
                      onClick={() => selectedIssue.status !== s && updateIssueStatus(selectedIssue.id, s)}
                      className="px-3 py-1.5 rounded-full text-xs transition-all"
                      style={{
                        background: selectedIssue.status === s ? '#0B1C2D' : '#F1F5F9',
                        color: selectedIssue.status === s ? 'white' : '#6B7280',
                        fontWeight: selectedIssue.status === s ? 600 : 400,
                      }}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                 {selectedIssue.status === 'awaiting_citizen_verification' && (
                   <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FED7AA' }}>
                     {t('authority.proof.notice')}
                   </div>
                 )}

                 {(selectedIssue.status === 'in_progress' || selectedIssue.status === 'awaiting_citizen_verification') && (
                   <div className="space-y-2">
                     <p className="text-xs text-gray-500">{t('authority.proof.required')}</p>
                     <input
                       className="w-full px-3 py-2 rounded-xl border-2 text-sm outline-none"
                       style={{ borderColor: '#E2E8F0', background: 'white' }}
                       placeholder="https://..."
                       value={afterImageUrl}
                       onChange={e => setAfterImageUrl(e.target.value)}
                     />
                     <button onClick={() => handleSubmitProof(selectedIssue.id)}
                       className="w-full py-2.5 rounded-xl text-sm text-white hover:opacity-90"
                       style={{ background: '#15803D' }}>
                       ✅ {t('status.resolved')}
                     </button>
                   </div>
                 )}
              </div>

              {/* Assigned Contractor/NGO */}
              <AssignedBadge contractorId={selectedIssue.assignedContractor} ngoId={selectedIssue.assignedNgo} />
            </div>
          </div>
        </div>
      )}

      {beforeAfterIssue && <BeforeAfterModal issue={beforeAfterIssue} onClose={() => setBeforeAfterIssue(null)} />}

      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative overflow-hidden">
            <BrandLogo size="lg" className="absolute -top-6 -right-6 opacity-5 rotate-12" />
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#0B1C2D', fontWeight: 700 }}>{t('common.profile')}</h3>
              <button onClick={() => setProfileOpen(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="text-center mb-4">
              <div className="flex justify-center mb-3">
                <BrandLogo size="md" />
              </div>
              <p style={{ fontWeight: 700, color: '#0B1C2D' }}>{currentUser.fullName}</p>
              <p className="text-sm text-gray-500">{currentUser.email}</p>
              <p className="text-xs text-gray-400 mt-1">{t('authority.role.verified')}</p>
            </div>
            <div className="mt-3 px-4 py-2 rounded-xl" style={{ background: '#EFF6FF' }}>
              <p className="text-xs text-blue-600">{t('authority.profile.role')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
