import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router';
import { Issue, useApp } from '../context/AppContext';
import { useLang, LANGUAGE_ACCEPT_LOCALES, LANGUAGE_SPEECH_LOCALES } from '../context/LanguageContext';
import { PortalHeader } from '../components/shared/PortalHeader';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../components/shared/StatusBadge';
import { BeforeAfterModal } from '../components/shared/BeforeAfterModal';
import { AssignedBadge } from '../components/shared/AssignedBadge';
import { DonationModal } from '../components/shared/DonationModal';
import { DuplicateBadge } from '../components/shared/DuplicateBadge';
import { WorkProgressBar } from '../components/shared/WorkProgressBar';
import { BrandLogo } from '../components/shared/BrandLogo';
import { getLocalizedCityName, getLocalizedIssueCopy, getLocalizedStateName } from '../utils/issueLocalization';

const STATES = ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Telangana', 'West Bengal', 'Uttar Pradesh', 'Madhya Pradesh'];
const CATEGORY_OPTIONS = [
  { value: 'road', emoji: '🛣️', key: 'category.road' },
  { value: 'water', emoji: '💧', key: 'category.water' },
  { value: 'electricity', emoji: '⚡', key: 'category.electricity' },
  { value: 'sanitation', emoji: '🗑️', key: 'category.sanitation' },
] as const;
const DEMO_IMAGES: Record<string, string> = {
  road: 'https://images.unsplash.com/photo-1709934730506-fba12664d4e4?w=800&q=80',
  water: 'https://images.unsplash.com/photo-1639335875048-a14e75abc083?w=800&q=80',
  electricity: 'https://images.unsplash.com/photo-1640362790728-c2bd0dfa9f33?w=800&q=80',
  sanitation: 'https://images.unsplash.com/photo-1762805544399-7cdf748371e0?w=800&q=80',
};
type TabKey = 'issues' | 'report' | 'chat' | 'profile';
type GeoPoint = { lat: number; lng: number; accuracy?: number };

const getDetectedCity = (address: Record<string, string | undefined>) => address.city || address.town || address.village || address.hamlet || address.county || '';
const getDetectedLandmark = (address: Record<string, string | undefined>, fallback: string) => {
  const parts = [address.road, address.suburb, address.neighbourhood].filter(Boolean);
  return parts.length ? parts.join(', ') : fallback;
};
const normalizeDetectedState = (raw: string) => STATES.find(state => {
  const expected = state.toLowerCase();
  const detected = raw.trim().toLowerCase();
  return detected.includes(expected) || expected.includes(detected);
}) || raw.trim();

export default function CitizenPortal() {
  const navigate = useNavigate();
  const { currentUser, issues, voteOnIssue, addIssue, rateContractor, verifyIssueResolution, comments, bids, updateUserProfile } = useApp();
  const { language, t } = useLang();
  const [activeTab, setActiveTab] = useState<TabKey>('issues');
  const [beforeAfterIssue, setBeforeAfterIssue] = useState<Issue | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [votedIssues, setVotedIssues] = useState<Set<string>>(new Set());
  const [donationNgoId, setDonationNgoId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [formData, setFormData] = useState({ title: '', category: '', description: '', state: '', city: '', address: '', imagePreview: '' });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<GeoPoint | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'ready' | 'error'>('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [messages, setMessages] = useState([{ id: 1, sender: 'support', text: 'Hello! I am the CIVICSETU assistant.', time: '10:00 AM' }]);
  const [newMessage, setNewMessage] = useState('');
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const autoLocationRequestedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!currentUser) navigate('/'); }, [currentUser, navigate]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (activeTab === 'report' && !autoLocationRequestedRef.current) { autoLocationRequestedRef.current = true; detectCurrentLocation(true); } }, [activeTab]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); mapRef.current?.remove(); }, []);
  useEffect(() => {
    if (activeTab !== 'report' || !detectedLocation || !mapContainerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }
    if (!markerRef.current) markerRef.current = L.circleMarker([detectedLocation.lat, detectedLocation.lng], { radius: 10, color: '#0B1C2D', fillColor: '#E8821C', fillOpacity: 0.95, weight: 3 }).addTo(mapRef.current);
    else markerRef.current.setLatLng([detectedLocation.lat, detectedLocation.lng]);
    mapRef.current.setView([detectedLocation.lat, detectedLocation.lng], 16);
    window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
  }, [activeTab, detectedLocation]);

  const myIssues = issues.filter(issue => issue.createdBy === currentUser?.id);
  const issueDetails = selectedIssue ? issues.find(issue => issue.id === selectedIssue.id) ?? selectedIssue : null;
  const localizedIssueDetails = issueDetails ? getLocalizedIssueCopy(issueDetails, language) : null;
  const issueComments = comments.filter(comment => comment.issueId === issueDetails?.id);
  const categories = CATEGORY_OPTIONS.map(option => ({ ...option, label: `${option.emoji} ${t(option.key)}` }));
  const stateOptions = formData.state && !STATES.includes(formData.state) ? [formData.state, ...STATES] : STATES;
  const filteredIssues = myIssues.filter(issue => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'unresolved') {
        if (issue.status === 'resolved') return false;
      } else if (issue.status !== filterStatus) {
        return false;
      }
    }
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    return true;
  });

  const DEFAULT_AVATARS = [
    { id: 'male', url: '/assets/avatars/male.png', label: 'Male' },
    { id: 'female', url: '/assets/avatars/female.png', label: 'Female' },
  ];

  const handleAvatarSelect = (url: string) => {
    updateUserProfile(url);
    setShowAvatarSelection(false);
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateUserProfile(reader.result as string);
        setShowAvatarSelection(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const detectCurrentLocation = (automatic = false) => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage(t('citizen.location.noBrowser'));
      return;
    }
    setLocationStatus('detecting');
    setLocationMessage(t(automatic ? 'citizen.location.detectingAuto' : 'citizen.location.detectingManual'));
    navigator.geolocation.getCurrentPosition(async position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      setDetectedLocation(point);
      setLocationStatus('ready');
      setLocationMessage(t('citizen.location.captured'));
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': LANGUAGE_ACCEPT_LOCALES[language] } });
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        const address = (data.address ?? {}) as Record<string, string | undefined>;
        setFormData(previous => ({ ...previous, state: previous.state || normalizeDetectedState(address.state ?? ''), city: previous.city || getDetectedCity(address), address: previous.address || getDetectedLandmark(address, data.display_name || '') }));
        setLocationMessage(t('citizen.location.updated'));
      } catch {
        setLocationMessage(t('citizen.location.lookupFallback'));
      }
    }, error => {
      setLocationStatus('error');
      setLocationMessage(error.code === error.PERMISSION_DENIED ? t('citizen.location.permissionDenied') : error.code === error.TIMEOUT ? t('citizen.location.timeout') : t('citizen.location.genericError'));
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const startVoiceRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceStatus('error');
      return;
    }
    const recognition = new SR();
    recognition.lang = LANGUAGE_SPEECH_LOCALES[language];
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsRecording(true);
    setVoiceStatus('recording');
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(time => time + 1), 1000);
    recognition.onresult = (event: any) => {
      setFormData(previous => ({ ...previous, description: event.results[0][0].transcript }));
      setIsRecording(false);
      setVoiceStatus('success');
      if (timerRef.current) clearInterval(timerRef.current);
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setVoiceStatus('error');
      if (timerRef.current) clearInterval(timerRef.current);
    };
    recognition.onend = () => {
      if (voiceStatus === 'recording') setVoiceStatus('processing');
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopVoiceRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setVoiceStatus('processing');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.category || !formData.description || !formData.state || !formData.city) {
      alert(t('citizen.alert.requiredFields'));
      return;
    }
    const result = addIssue({ id: 'new-' + Date.now(), title: formData.title || `${t(`category.${formData.category}`)} issue in ${formData.city}`, description: formData.description, category: formData.category as Issue['category'], status: 'open_for_bidding', state: formData.state, city: formData.city, address: formData.address || formData.city, latitude: detectedLocation?.lat, longitude: detectedLocation?.lng, createdBy: currentUser?.id || 'u1', assignedContractor: null, assignedNgo: null, beforeImage: formData.imagePreview || DEMO_IMAGES[formData.category] || DEMO_IMAGES.road, afterImage: null, urgencyTag: 'Medium', upvotes: 1, downvotes: 0, overallRatingScore: 5, isRatingFrozen: false, flaggedReviewBatch: null, reviewEvents: [], duplicateCount: 1, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: new Date().toISOString() });
    setFormData({ title: '', category: '', description: '', state: '', city: '', address: '', imagePreview: '' });
    setUploadedFile(null);
    setDetectedLocation(null);
    setLocationStatus('idle');
    setLocationMessage('');
    autoLocationRequestedRef.current = false;
    setVoiceStatus('idle');
    setActiveTab('issues');
    alert(result.merged ? t('citizen.alert.duplicateMerged', { count: result.duplicateCount }) : t('citizen.alert.submitted'));
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setMessages(previous => [...previous, { id: previous.length + 1, sender: 'user', text: newMessage, time }]);
    setNewMessage('');
    window.setTimeout(() => setMessages(previous => [...previous, { id: previous.length + 1, sender: 'support', text: 'Message received. Our team will respond within 24 hours.', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }]), 1000);
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: "'Poppins', 'Mukta', sans-serif" }}>
      <PortalHeader title={t('citizen.title')} subtitle={`${getLocalizedCityName(currentUser.city, language)}, ${getLocalizedStateName(currentUser.state, language)}`} onProfileClick={() => setActiveTab('profile')} />
      <div className="sticky top-14 z-30 bg-white shadow-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-4xl mx-auto flex overflow-x-auto">
          {([
            { key: 'issues', label: t('citizen.tab.issues') },
            { key: 'report', label: t('citizen.tab.report') },
            { key: 'chat', label: t('citizen.tab.chat') },
            { key: 'profile', label: t('citizen.tab.profile') },
          ] as { key: TabKey; label: string }[]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="px-5 py-3.5 text-sm whitespace-nowrap" style={{ color: activeTab === tab.key ? '#0B1C2D' : '#6B7280', borderBottom: activeTab === tab.key ? '3px solid #E8821C' : '3px solid transparent', fontWeight: activeTab === tab.key ? 600 : 400 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'issues' && <div className="grid gap-4">
          <div className="flex flex-wrap gap-3">
            <select className="px-3 py-2 rounded-xl border-2 text-sm" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={filterStatus} onChange={event => setFilterStatus(event.target.value)}>
              <option value="all">{t('common.allStatuses')}</option>
              <option value="open_for_bidding">{t('status.open_for_bidding')}</option>
              <option value="in_progress">{t('status.in_progress')}</option>
              <option value="awaiting_citizen_verification">{t('status.awaiting_citizen_verification')}</option>
              <option value="resolved">{t('status.resolved')}</option>
              <option value="unresolved">{t('common.unresolved')}</option>
            </select>
            <select className="px-3 py-2 rounded-xl border-2 text-sm" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={filterCategory} onChange={event => setFilterCategory(event.target.value)}>
              <option value="all">{t('common.allCategories')}</option>
              {categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="ml-auto text-sm text-gray-500 self-center">{t('common.issueCount', { count: filteredIssues.length })}</span>
          </div>
          {filteredIssues.length === 0 && <div className="text-center py-16 text-gray-400">{t('citizen.issues.noIssues')}</div>}
          {filteredIssues.map(issue => {
            const localizedIssue = getLocalizedIssueCopy(issue, language);
            return (
            <div key={issue.id} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: issue.isRatingFrozen ? '2px solid #F59E0B' : '1px solid #E2E8F0' }}>
              <div className="flex gap-4">
                <img src={issue.beforeImage} alt={localizedIssue.title} className="w-24 h-20 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2"><StatusBadge status={issue.status} /><UrgencyBadge urgency={issue.urgencyTag} /><CategoryBadge category={issue.category} /></div>
                  <div className="flex items-center gap-2 mb-1"><h3 className="truncate" style={{ fontWeight: 600, color: '#0B1C2D' }}>{localizedIssue.title}</h3><DuplicateBadge count={issue.duplicateCount} /></div>
                  <p className="text-gray-500 text-xs mb-2">{t('common.location')}: {localizedIssue.address}, {localizedIssue.city}, {localizedIssue.state}</p>
                  <p className="text-gray-600 text-sm line-clamp-1">{localizedIssue.description}</p>
                </div>
              </div>
              {issue.isSuspicious && <p className="text-xs mt-3" style={{ color: '#991B1B' }}>{t('citizen.suspicious')}</p>}
              {issue.isRatingFrozen && issue.flaggedReviewBatch && <p className="text-xs mt-2" style={{ color: '#9A3412' }}>{t('citizen.issues.summaryFrozen', { score: issue.overallRatingScore.toFixed(1), count: issue.flaggedReviewBatch.reviewsInBatch })}</p>}
              <div className="flex flex-wrap gap-2 mt-4">
                <button onClick={() => !votedIssues.has(issue.id) && (voteOnIssue(issue.id, 'upvote'), setVotedIssues(previous => new Set([...previous, issue.id])))} className="px-3 py-1.5 rounded-full text-xs" style={{ background: '#F0FDF4', color: '#15803D' }}>{t('common.up')} {issue.upvotes}</button>
                <button onClick={() => !votedIssues.has(issue.id) && (voteOnIssue(issue.id, 'downvote'), setVotedIssues(previous => new Set([...previous, issue.id])))} className="px-3 py-1.5 rounded-full text-xs" style={{ background: '#FEF2F2', color: '#991B1B' }}>{t('common.down')} {issue.downvotes}</button>
                <button onClick={() => setBeforeAfterIssue(issue)} className="px-3 py-1.5 rounded-full text-xs" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{t('beforeAfter.title')}</button>
                <button onClick={() => setSelectedIssue(issue)} className="ml-auto px-3 py-1.5 rounded-full text-xs text-white" style={{ background: '#0B1C2D' }}>{t('citizen.issues.viewDetails')}</button>
              </div>
              {issue.status === 'resolved' && issue.assignedContractor && <div className="mt-4"><p className="text-sm mb-2" style={{ color: '#15803D', fontWeight: 500 }}>{t('citizen.rate.label')}</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map(star => <button key={star} onClick={() => rateContractor(issue.id, star)} className="text-xl" style={{ color: issue.contractorRating && issue.contractorRating >= star ? '#F59E0B' : '#D1D5DB' }}>★</button>)}</div></div>}
            </div>
          );})}
        </div>}
        {activeTab === 'report' && <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 grid gap-4" style={{ border: '1px solid #E2E8F0' }}>
          <h2 style={{ color: '#0B1C2D', fontWeight: 700 }}>{t('citizen.report.title')}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setVoiceMode(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: !voiceMode ? '#0B1C2D' : '#F1F5F9', color: !voiceMode ? 'white' : '#6B7280' }}>{t('citizen.report.typeMode')}</button>
            <button type="button" onClick={() => setVoiceMode(true)} className="px-4 py-2 rounded-xl text-sm" style={{ background: voiceMode ? '#0B1C2D' : '#F1F5F9', color: voiceMode ? 'white' : '#6B7280' }}>{t('citizen.report.voiceMode')}</button>
          </div>
          {voiceMode && <div className="rounded-2xl p-4" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
            <p className="text-sm mb-3" style={{ color: '#0369A1' }}>{t('citizen.report.voiceHelp')}</p>
            {isRecording && <p className="text-sm" style={{ color: '#EF4444' }}>{t('citizen.report.recording')} {recordingTime}s</p>}
            {voiceStatus === 'processing' && <p className="text-sm text-blue-600">{t('citizen.report.processing')}</p>}
            {voiceStatus === 'success' && <p className="text-sm text-green-600">{t('citizen.report.voiceConverted')}</p>}
            {voiceStatus === 'error' && <p className="text-sm text-red-600">{t('citizen.report.voiceFailed')}</p>}
            <button type="button" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} className="mt-3 px-5 py-2.5 rounded-xl text-white" style={{ background: isRecording ? '#EF4444' : '#0B1C2D' }}>{isRecording ? t('citizen.report.stopRecord') : t('citizen.report.startRecord')}</button>
          </div>}
          <input className="px-4 py-2.5 rounded-xl border-2" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={formData.title} onChange={event => setFormData(previous => ({ ...previous, title: event.target.value }))} placeholder={t('citizen.report.issueTitle')} />
          <select className="px-4 py-2.5 rounded-xl border-2" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={formData.category} onChange={event => setFormData(previous => ({ ...previous, category: event.target.value }))} required><option value="">{t('select.category')}</option>{categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <textarea className="px-4 py-2.5 rounded-xl border-2" style={{ borderColor: '#E2E8F0', background: '#F8FAFC', resize: 'none' }} rows={4} value={formData.description} onChange={event => setFormData(previous => ({ ...previous, description: event.target.value }))} placeholder={t('citizen.report.descriptionPlaceholder')} required />
          {voiceMode && voiceStatus === 'success' && <p className="text-xs" style={{ color: '#059669' }}>{t('citizen.report.voiceAutofill')}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select className="px-4 py-2.5 rounded-xl border-2" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={formData.state} onChange={event => setFormData(previous => ({ ...previous, state: event.target.value }))} required><option value="">{t('select.state')}</option>{stateOptions.map(state => <option key={state} value={state}>{getLocalizedStateName(state, language)}</option>)}</select>
            <input className="px-4 py-2.5 rounded-xl border-2" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={formData.city} onChange={event => setFormData(previous => ({ ...previous, city: event.target.value }))} placeholder={t('citizen.report.city')} required />
            <input className="px-4 py-2.5 rounded-xl border-2" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }} value={formData.address} onChange={event => setFormData(previous => ({ ...previous, address: event.target.value }))} placeholder={t('citizen.report.landmark')} />
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm" style={{ color: '#0B1C2D', fontWeight: 600 }}>{t('citizen.report.autoLocation')}</p><p className="text-xs text-gray-500">{t('citizen.report.autoLocationHelp')}</p></div>
              <button type="button" onClick={() => detectCurrentLocation()} disabled={locationStatus === 'detecting'} className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-60" style={{ background: '#0B1C2D' }}>{locationStatus === 'detecting' ? t('citizen.report.detectingLocation') : detectedLocation ? t('citizen.report.refreshLocation') : t('citizen.report.useCurrentLocation')}</button>
            </div>
            {locationMessage && <p className="text-sm mt-3" style={{ color: locationStatus === 'error' ? '#B91C1C' : '#0F766E' }}>{locationMessage}</p>}
            <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #CBD5E1', background: '#E2E8F0' }}>{detectedLocation ? <div ref={mapContainerRef} style={{ width: '100%', height: 220 }} /> : <div className="h-56 flex items-center justify-center px-6 text-center text-sm text-gray-500">{t('citizen.report.mapPlaceholder')}</div>}</div>
            {detectedLocation && <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span>Lat {detectedLocation.lat.toFixed(5)}, Lng {detectedLocation.lng.toFixed(5)}</span><span>{detectedLocation.accuracy ? t('citizen.report.mapAccuracy', { meters: Math.round(detectedLocation.accuracy) }) : t('citizen.report.mapReady')}</span></div>}
            <p className="text-xs mt-2 text-gray-500">{t('citizen.report.mapFooter')}</p>
          </div>
          <div className="rounded-2xl p-4 border-2 border-dashed text-center" style={{ borderColor: '#CBD5E1', background: '#F8FAFC' }}>
            {formData.imagePreview ? <div><img src={formData.imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg mb-2 object-cover" /><p className="text-xs text-green-600">{t('citizen.report.imageUploaded', { name: uploadedFile?.name || 'Captured' })}</p></div> : <p className="text-sm text-gray-500 mb-3">{t('citizen.report.imageHelp')}</p>}
            <label className="cursor-pointer inline-block px-4 py-2 rounded-xl text-sm text-white" style={{ background: '#0B1C2D' }}>{formData.imagePreview ? t('citizen.report.changeImage') : t('citizen.report.chooseImage')}<input type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (!file) return; setUploadedFile(file); setFormData(previous => ({ ...previous, imagePreview: URL.createObjectURL(file) })); }} /></label>
            {!formData.imagePreview && formData.category && <button type="button" onClick={() => setFormData(previous => ({ ...previous, imagePreview: DEMO_IMAGES[previous.category] }))} className="ml-2 px-4 py-2 rounded-xl text-sm" style={{ background: '#F1F5F9', color: '#374151' }}>{t('citizen.report.sampleImage')}</button>}
          </div>
          <button type="submit" className="py-3.5 rounded-xl text-white" style={{ background: '#0B1C2D', fontWeight: 600 }}>{t('citizen.report.submit')}</button>
        </form>}
        {activeTab === 'chat' && <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0', height: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div className="px-4 py-3" style={{ background: '#0B1C2D' }}><p className="text-white" style={{ fontWeight: 600 }}>{t('citizen.chat.support')}</p><span className="text-green-300 text-xs">{t('common.online')}</span></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#ECE5DD' }}>
            {messages.map(message => (
              <div key={message.id} className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.sender === 'support' && <BrandLogo size="sm" className="flex-shrink-0 mt-1" />}
                <div className="max-w-xs sm:max-w-md rounded-2xl px-4 py-2.5 shadow-sm" style={{ background: message.sender === 'user' ? '#DCF8C6' : '#FFFFFF' }}>
                  <p className="text-sm">{message.text}</p>
                  <p className="text-right text-xs mt-1 text-gray-400">{message.time}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="p-3 flex gap-2" style={{ background: '#F0F0F0' }}><input className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none" style={{ background: 'white', border: '1px solid #E2E8F0' }} value={newMessage} onChange={event => setNewMessage(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendMessage()} placeholder={t('citizen.chat.placeholder')} /><button onClick={sendMessage} className="w-10 h-10 rounded-full text-white" style={{ background: '#25D366' }}>➤</button></div>
        </div>}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-sm p-8 relative overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            <BrandLogo size="xl" className="absolute -top-6 -right-6 opacity-5 rotate-12" />
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center gap-4 flex-shrink-0">
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => setShowAvatarSelection(!showAvatarSelection)}
                >
                  <div className="w-32 h-32 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center">
                    {currentUser.profilePic ? (
                      <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <span className="text-5xl">👤</span>
                        <p className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Choose Photo</p>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-[10px] font-bold uppercase tracking-widest text-center px-2">{t('common.changePhoto')}</span>
                  </div>
                </div>

                {showAvatarSelection && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4 w-48 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 z-10">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('common.selectDefault')}</p>
                    <div className="flex gap-3 justify-center">
                      {DEFAULT_AVATARS.map(avatar => (
                        <button 
                          key={avatar.id}
                          onClick={() => handleAvatarSelect(avatar.url)}
                          className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden hover:scale-110 transition-transform focus:ring-2 focus:ring-slate-400"
                        >
                          <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 pt-3">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        📁 {t('common.uploadCustom')}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleCustomUpload} 
                        className="hidden" 
                        accept="image/*" 
                      />
                    </div>
                    <button 
                      onClick={() => setShowAvatarSelection(false)}
                      className="w-full py-1 text-[9px] font-bold uppercase text-slate-400 hover:text-slate-600"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 w-full">
                <div className="mb-6">
                  <h2 className="text-2xl" style={{ color: '#0B1C2D', fontWeight: 700 }}>{currentUser.fullName}</h2>
                  <p className="text-gray-500 font-medium">{currentUser.email}</p>
                  <p className="text-sm text-gray-400 mt-1">{currentUser.phone}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: t('citizen.profile.trustCode'), value: currentUser.trustCode || 'N/A', icon: '💎' },
                    { label: t('citizen.profile.location'), value: `${getLocalizedCityName(currentUser.city, language)}, ${getLocalizedStateName(currentUser.state, language)}`, icon: '📍' },
                    { label: t('citizen.profile.role'), value: t('citizen.profile.verifiedCitizen'), icon: '🛡️' },
                    { label: t('citizen.profile.issues'), value: myIssues.length.toString(), icon: '📋' }
                  ].map(item => (
                    <div key={item.label} className="p-4 rounded-xl flex items-center gap-4 transition-all hover:shadow-md" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <span className="text-2xl opacity-80">{item.icon}</span>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</p>
                        <p style={{ fontWeight: 600, color: '#0B1C2D' }}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8">
              <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>{t('citizen.summary.title')}</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t('citizen.summary.total'), count: myIssues.length },
                  { label: t('citizen.summary.resolved'), count: myIssues.filter(issue => issue.status === 'resolved').length },
                  { label: t('citizen.summary.active'), count: myIssues.filter(issue => issue.status !== 'resolved').length }
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl text-center" style={{ background: '#EFF6FF' }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0B1C2D' }}>{item.count}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {beforeAfterIssue && <BeforeAfterModal issue={beforeAfterIssue} onClose={() => setBeforeAfterIssue(null)} />}
      {localizedIssueDetails && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedIssue(null)}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}><div className="flex items-center justify-between p-5" style={{ background: '#0B1C2D' }}><h3 className="text-white" style={{ fontWeight: 700 }}>{t('citizen.issues.viewDetails')}</h3><button onClick={() => setSelectedIssue(null)} className="text-white text-2xl">×</button></div><div className="p-5 space-y-4"><img src={localizedIssueDetails.beforeImage} alt={localizedIssueDetails.title} className="w-full rounded-xl object-cover" style={{ height: 200 }} /><div className="flex flex-wrap gap-2"><StatusBadge status={localizedIssueDetails.status} /><UrgencyBadge urgency={localizedIssueDetails.urgencyTag} /><CategoryBadge category={localizedIssueDetails.category} /></div><div className="flex items-center gap-2"><h2 style={{ color: '#0B1C2D', fontWeight: 700 }}>{localizedIssueDetails.title}</h2><DuplicateBadge count={localizedIssueDetails.duplicateCount} /></div>

<div className="bg-white p-4 rounded-2xl shadow-inner mb-6" style={{ border: '1px solid #E2E8F0' }}>
  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
    📊 {t('progress.title')}
  </p>
  <WorkProgressBar currentPercent={localizedIssueDetails.currentPercent} />
</div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              🏦 {t('budget.transparency.title')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase font-bold leading-none mb-1">{t('budget.allocation')}</p>
                <p className="text-xs font-bold text-slate-700">₹{localizedIssueDetails.initialBudget.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                <p className="text-[9px] text-orange-400 uppercase font-bold leading-none mb-1">{t('budget.accepted')}</p>
                <p className="text-xs font-bold text-orange-700">
                  {(() => {
                    const selectedBid = bids.find(b => b.issueId === localizedIssueDetails.id && b.status === 'selected');
                    return selectedBid ? `₹${selectedBid.bidAmount.toLocaleString('en-IN')}` : '---';
                  })()}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-[9px] text-blue-400 uppercase font-bold leading-none mb-1">{t('budget.timeline')}</p>
                <p className="text-xs font-bold text-blue-700">
                  {localizedIssueDetails.estimatedTimeline ? t('budget.days', { count: localizedIssueDetails.estimatedTimeline }) : 'TBD'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <p className="text-gray-400 text-xs">{t('common.location')}</p>
              <p style={{ fontWeight: 500 }}>{localizedIssueDetails.city}, {localizedIssueDetails.state}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <p className="text-gray-400 text-xs">{t('common.reportedOn')}</p>
              <p style={{ fontWeight: 500 }}>{new Date(localizedIssueDetails.createdAt).toLocaleDateString('en-IN')}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <p className="text-gray-400 text-xs">{t('common.address')}</p>
              <p style={{ fontWeight: 500, fontSize: '0.8rem' }}>{localizedIssueDetails.address}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: localizedIssueDetails.isRatingFrozen ? '#FFF7ED' : '#FFFBEB' }}>
              <p className="text-gray-400 text-xs">{t('citizen.details.communityRating')}</p>
              <p style={{ fontWeight: 600, color: localizedIssueDetails.isRatingFrozen ? '#9A3412' : '#B45309' }}>⭐ {localizedIssueDetails.overallRatingScore.toFixed(1)}/5 {localizedIssueDetails.isRatingFrozen ? t('citizen.details.frozen') : ''}</p>
            </div>
          </div>

          <p className="text-gray-600 text-sm mb-4">{localizedIssueDetails.description}</p>
{localizedIssueDetails.isRatingFrozen && localizedIssueDetails.flaggedReviewBatch && <div className="p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}><p className="text-sm" style={{ color: '#9A3412', fontWeight: 600 }}>{t('citizen.details.freezeInfo', { count: localizedIssueDetails.flaggedReviewBatch.reviewsInBatch, expected: localizedIssueDetails.flaggedReviewBatch.expectedDailyReviews.toFixed(1) })}</p><p className="text-xs mt-2" style={{ color: '#C2410C' }}>{t('citizen.details.freezeTrustedScore', { score: localizedIssueDetails.flaggedReviewBatch.frozenScore.toFixed(1) })}</p></div>}{localizedIssueDetails.afterImage && <div><div className="flex items-center justify-between mb-2"><p style={{ fontWeight: 600, color: '#0B1C2D' }}>{t('citizen.details.resolutionProof')}</p><button onClick={() => setBeforeAfterIssue(issueDetails)} className="px-3 py-1.5 rounded-full text-xs" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{t('citizen.details.reviewBeforeAfter')}</button></div><img src={localizedIssueDetails.afterImage} alt="Resolution proof" className="w-full rounded-xl object-cover" style={{ height: 180 }} /></div>}{localizedIssueDetails.status === 'awaiting_citizen_verification' && <div className="p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}><p className="text-sm mb-3" style={{ color: '#9A3412', fontWeight: 600 }}>{t('citizen.details.authorityProofNotice')}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={() => { verifyIssueResolution(localizedIssueDetails.id, true); setSelectedIssue(null); alert(t('citizen.alert.verified')); }} className="py-3 rounded-xl text-sm text-white" style={{ background: '#15803D', fontWeight: 600 }}>{t('citizen.details.verifyClose')}</button><button onClick={() => { verifyIssueResolution(localizedIssueDetails.id, false); setSelectedIssue(null); alert(t('citizen.alert.needsWork')); }} className="py-3 rounded-xl text-sm text-white" style={{ background: '#B45309', fontWeight: 600 }}>{t('citizen.details.notSolvedYet')}</button></div></div>}<div><p className="mb-2" style={{ fontWeight: 600, color: '#0B1C2D' }}>{t('common.comments')}</p>{issueComments.map(comment => <div key={comment.id} className="mb-2 p-3 rounded-xl" style={{ background: '#F8FAFC' }}><p className="text-xs text-gray-500 mb-1">{comment.userName} • {new Date(comment.createdAt).toLocaleDateString('en-IN')}</p><p className="text-sm">{comment.content}</p></div>)}{issueComments.length === 0 && <p className="text-gray-400 text-sm">{t('common.noComments')}</p>}</div></div><AssignedBadge contractorId={localizedIssueDetails.assignedContractor} ngoId={localizedIssueDetails.assignedNgo} />{localizedIssueDetails.assignedNgo && <div className="px-5 pb-5"><button onClick={() => setDonationNgoId(localizedIssueDetails.assignedNgo)} className="w-full py-3 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontWeight: 600 }}>{t('citizen.donate')}</button></div>}</div></div>}
      {donationNgoId && <DonationModal ngoId={donationNgoId} onClose={() => setDonationNgoId(null)} />}
    </div>
  );
}
