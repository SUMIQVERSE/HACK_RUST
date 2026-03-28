import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router';
import { useApp, Issue } from '../context/AppContext';
import { useLang } from '../context/LanguageContext';
import { PortalHeader } from '../components/shared/PortalHeader';
import { StatusBadge, UrgencyBadge, CategoryBadge } from '../components/shared/StatusBadge';
import { BeforeAfterModal } from '../components/shared/BeforeAfterModal';
import { AssignedBadge } from '../components/shared/AssignedBadge';
import { DonationModal } from '../components/shared/DonationModal';

const STATES = ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Telangana', 'West Bengal', 'Uttar Pradesh', 'Madhya Pradesh'];
const CATEGORIES = [
  { value: 'road', label: '🛣️ Road', labelHi: '🛣️ सड़क' },
  { value: 'water', label: '💧 Water', labelHi: '💧 पानी' },
  { value: 'electricity', label: '⚡ Electricity', labelHi: '⚡ बिजली' },
  { value: 'sanitation', label: '🗑️ Sanitation', labelHi: '🗑️ स्वच्छता' },
];

const DEMO_CATEGORY_IMAGES: Record<string, string> = {
  road: 'https://images.unsplash.com/photo-1709934730506-fba12664d4e4?w=800&q=80',
  water: 'https://images.unsplash.com/photo-1639335875048-a14e75abc083?w=800&q=80',
  electricity: 'https://images.unsplash.com/photo-1640362790728-c2bd0dfa9f33?w=800&q=80',
  sanitation: 'https://images.unsplash.com/photo-1762805544399-7cdf748371e0?w=800&q=80',
};

const CHAT_MESSAGES = [
  { id: 1, sender: 'support', text: 'नमस्ते! मैं CIVICSETU सहायक हूँ। आपकी क्या सहायता कर सकता हूँ? / Hello! I am CIVICSETU assistant. How can I help you?', time: '10:00 AM' },
  { id: 2, sender: 'user', text: 'मेरी समस्या का क्या हुआ? / What happened to my issue?', time: '10:02 AM' },
  { id: 3, sender: 'support', text: 'आपकी समस्या "बोली के लिए खुला" चरण में है। एक ठेकेदार जल्द ही काम शुरू करेगा। / Your issue is in "Open for Bidding" stage. A contractor will start work soon.', time: '10:03 AM' },
  { id: 4, sender: 'user', text: 'कितने दिन लगेंगे? / How many days will it take?', time: '10:05 AM' },
  { id: 5, sender: 'support', text: 'आमतौर पर 7-14 कार्य दिवस लगते हैं। हम आपको हर अपडेट के बारे में सूचित करेंगे। / Typically 7-14 working days. We will notify you of every update.', time: '10:06 AM' },
];

type GeoPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
};

const normalizeDetectedState = (rawState: string) => {
  const trimmed = rawState.trim();
  if (!trimmed) return '';

  const match = STATES.find(state => {
    const expected = state.toLowerCase();
    const detected = trimmed.toLowerCase();
    return detected.includes(expected) || expected.includes(detected);
  });

  return match || trimmed;
};

const getDetectedCity = (address: Record<string, string | undefined>) => {
  return address.city || address.town || address.village || address.hamlet || address.county || '';
};

const getDetectedLandmark = (address: Record<string, string | undefined>, fallback: string) => {
  const parts = [address.road, address.suburb, address.neighbourhood].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return fallback;
};

export default function CitizenPortal() {
  const navigate = useNavigate();
  const { currentUser, issues, voteOnIssue, addIssue, rateContractor, addComment, comments, users, addDonation, donations } = useApp();
  const { t, language } = useLang();
  const [activeTab, setActiveTab] = useState<'issues' | 'report' | 'chat' | 'profile'>('issues');
  const [beforeAfterIssue, setBeforeAfterIssue] = useState<Issue | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [profileOpen, setProfileOpen] = useState(false);
  const [votedIssues, setVotedIssues] = useState<Set<string>>(new Set());
  const [donationNgoId, setDonationNgoId] = useState<string | null>(null);

  // Report form
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [formData, setFormData] = useState({ title: '', category: '', description: '', state: '', city: '', address: '', imagePreview: '' });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapMarkerRef = useRef<L.CircleMarker | null>(null);
  const autoLocationRequestedRef = useRef(false);
  const [detectedLocation, setDetectedLocation] = useState<GeoPoint | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'ready' | 'error'>('idle');
  const [locationMessage, setLocationMessage] = useState('');

  // Chat
  const [chatMessages, setChatMessages] = useState(CHAT_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const detectCurrentLocation = (isAutomatic = false) => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Location services are not available in this browser. Please enter the address manually.');
      return;
    }

    setLocationStatus('detecting');
    setLocationMessage(isAutomatic ? 'Trying to detect your current location...' : 'Detecting your current location...');

    navigator.geolocation.getCurrentPosition(
      async position => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setDetectedLocation(nextLocation);
        setLocationStatus('ready');
        setLocationMessage('Current location captured. Updating nearby address details...');

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${nextLocation.lat}&lon=${nextLocation.lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': language === 'hi' ? 'hi,en' : 'en',
              },
            },
          );

          if (!response.ok) {
            throw new Error('Reverse geocoding failed');
          }

          const data = await response.json();
          const address = (data.address ?? {}) as Record<string, string | undefined>;
          const detectedState = normalizeDetectedState(address.state ?? '');
          const detectedCity = getDetectedCity(address);
          const detectedLandmark = getDetectedLandmark(address, data.display_name || '');

          setFormData(prev => ({
            ...prev,
            state: prev.state || detectedState,
            city: prev.city || detectedCity,
            address: prev.address || detectedLandmark,
          }));

          setLocationMessage('Current location captured and the address fields were updated. You can still edit them.');
        } catch (error) {
          setFormData(prev => ({
            ...prev,
            address: prev.address || `Lat ${nextLocation.lat.toFixed(5)}, Lng ${nextLocation.lng.toFixed(5)}`,
          }));
          setLocationMessage('Current location captured. Address lookup is unavailable, so you can complete the text fields manually.');
        }
      },
      error => {
        let message = 'Unable to detect your current location. Please enter the address manually.';

        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location access was blocked. Please allow location access and try again.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location detection timed out. Please try again in an open area or with a stronger signal.';
        }

        setLocationStatus('error');
        setLocationMessage(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  useEffect(() => {
    if (!currentUser) navigate('/');
  }, [currentUser, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (activeTab !== 'report' || autoLocationRequestedRef.current) return;
    autoLocationRequestedRef.current = true;
    detectCurrentLocation(true);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'report' || !mapRef.current) return;
    mapRef.current.remove();
    mapRef.current = null;
    mapMarkerRef.current = null;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'report' || !detectedLocation || !mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }

    if (!mapMarkerRef.current) {
      mapMarkerRef.current = L.circleMarker([detectedLocation.lat, detectedLocation.lng], {
        radius: 10,
        color: '#0B1C2D',
        fillColor: '#E8821C',
        fillOpacity: 0.95,
        weight: 3,
      }).addTo(mapRef.current);
    } else {
      mapMarkerRef.current.setLatLng([detectedLocation.lat, detectedLocation.lng]);
    }

    mapRef.current.setView([detectedLocation.lat, detectedLocation.lng], 16);
    window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
  }, [activeTab, detectedLocation]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mapRef.current?.remove();
    };
  }, []);

  const myIssues = issues;
  const filteredIssues = myIssues.filter(i => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'unresolved') {
        if (i.status === 'resolved') return false;
      } else if (i.status !== filterStatus) {
        return false;
      }
    }
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    return true;
  });

  const handleVote = (issueId: string, type: 'upvote' | 'downvote') => {
    if (votedIssues.has(issueId)) return;
    voteOnIssue(issueId, type);
    setVotedIssues(prev => new Set([...prev, issueId]));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, imagePreview: url }));
  };

  const startVoiceRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceStatus('error');
      return;
    }
    const rec = new SR();
    rec.lang = language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : language === 'mr' ? 'mr-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setIsRecording(true);
    setVoiceStatus('recording');
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setFormData(prev => ({ ...prev, description: transcript }));
      setIsRecording(false);
      setVoiceStatus('success');
      clearInterval(timerRef.current!);
    };
    rec.onerror = () => {
      setIsRecording(false);
      setVoiceStatus('error');
      clearInterval(timerRef.current!);
    };
    rec.onend = () => {
      if (voiceStatus === 'recording') setVoiceStatus('processing');
      setIsRecording(false);
      clearInterval(timerRef.current!);
    };
    rec.start();
    recognitionRef.current = rec;
  };

  const stopVoiceRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current!);
    setVoiceStatus('processing');
  };

  const handleSubmitIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.description || !formData.state || !formData.city) {
      alert('Please fill all required fields.');
      return;
    }
    const imgUrl = formData.imagePreview || DEMO_CATEGORY_IMAGES[formData.category] || DEMO_CATEGORY_IMAGES.road;
    const newIssue: Issue = {
      id: 'new-' + Date.now(),
      title: formData.title || `${formData.category} issue in ${formData.city}`,
      description: formData.description,
      category: formData.category as any,
      status: 'open_for_bidding',
      state: formData.state,
      city: formData.city,
      address: formData.address || formData.city,
      latitude: detectedLocation?.lat,
      longitude: detectedLocation?.lng,
      createdBy: currentUser?.id || 'u1',
      assignedContractor: null,
      assignedNgo: null,
      beforeImage: imgUrl,
      afterImage: null,
      urgencyTag: 'Medium',
      upvotes: 1,
      downvotes: 0,
      isSuspicious: false,
      isDuplicate: false,
      contractorRating: null,
      createdAt: new Date().toISOString(),
    };
    addIssue(newIssue);
    setFormData({ title: '', category: '', description: '', state: '', city: '', address: '', imagePreview: '' });
    setUploadedFile(null);
    setDetectedLocation(null);
    setLocationStatus('idle');
    setLocationMessage('');
    autoLocationRequestedRef.current = false;
    setVoiceStatus('idle');
    setActiveTab('issues');
    alert('✅ Issue submitted successfully! It will appear in the dashboard shortly.');
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const userMsg = { id: chatMessages.length + 1, sender: 'user', text: newMessage, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, userMsg]);
    setNewMessage('');
    setTimeout(() => {
      const autoReply = { id: chatMessages.length + 2, sender: 'support', text: 'आपका संदेश प्राप्त हुआ। हमारी टीम 24 घंटे में जवाब देगी। / Message received. Our team will respond within 24 hours.', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
      setChatMessages(prev => [...prev, autoReply]);
    }, 1500);
  };

  const inputStyle = { borderColor: '#E2E8F0', background: '#F8FAFC', fontFamily: "'Mukta', sans-serif" };
  const stateOptions = formData.state && !STATES.includes(formData.state) ? [formData.state, ...STATES] : STATES;

  const tabs = [
    { key: 'issues', label: t('citizen.tab.issues'), emoji: '📋' },
    { key: 'report', label: t('citizen.tab.report'), emoji: '➕' },
    { key: 'chat', label: t('citizen.tab.chat'), emoji: '💬' },
    { key: 'profile', label: t('citizen.tab.profile'), emoji: '👤' },
  ];

  if (!currentUser) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: "'Poppins', 'Mukta', sans-serif" }}>
      <PortalHeader title={t('citizen.title')} subtitle={currentUser.city + ', ' + currentUser.state} onProfileClick={() => setProfileOpen(true)} />

      {/* Tab Bar */}
      <div className="sticky top-14 z-30 shadow-sm" style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-4xl mx-auto flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm whitespace-nowrap transition-all"
              style={{
                color: activeTab === tab.key ? '#0B1C2D' : '#6B7280',
                borderBottom: activeTab === tab.key ? '3px solid #E8821C' : '3px solid transparent',
                fontWeight: activeTab === tab.key ? 600 : 400,
                background: 'transparent',
              }}
            >
              <span>{tab.emoji}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* MY ISSUES TAB */}
        {activeTab === 'issues' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-5">
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={inputStyle}
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="open_for_bidding">{t('citizen.status.open')}</option>
                <option value="in_progress">{t('citizen.status.progress')}</option>
                <option value="resolved">{t('citizen.status.resolved')}</option>
                <option value="unresolved">{t('citizen.status.unresolved')}</option>
              </select>
              <select className="px-3 py-2 rounded-xl text-sm border-2 outline-none" style={inputStyle}
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="ml-auto text-sm text-gray-500 self-center">{filteredIssues.length} issues</div>
            </div>

            <div className="grid gap-4">
              {filteredIssues.length === 0 && (
                <div className="text-center py-16 text-gray-400">{t('citizen.issues.noIssues')}</div>
              )}
              {filteredIssues.map(issue => (
                <div key={issue.id} className="bg-white rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md" style={{ border: issue.isSuspicious ? '2px solid #FCA5A5' : '1px solid #E2E8F0' }}>
                  {issue.isSuspicious && (
                    <div className="px-4 py-2 text-xs" style={{ background: '#FEF2F2', color: '#991B1B' }}>
                      ⚠️ {t('citizen.suspicious')} — Authority notified
                    </div>
                  )}
                  <div className="flex gap-4 p-4">
                    <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 100, height: 80 }}>
                      <img src={issue.beforeImage} alt={issue.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <StatusBadge status={issue.status} />
                        <UrgencyBadge urgency={issue.urgencyTag} />
                        <CategoryBadge category={issue.category} />
                      </div>
                      <h3 className="mb-1 truncate" style={{ color: '#0B1C2D', fontWeight: 600, fontSize: '0.95rem' }}>{issue.title}</h3>
                      <p className="text-gray-500 text-xs mb-2">📍 {issue.address}, {issue.city}, {issue.state}</p>
                      <p className="text-gray-600 text-sm line-clamp-1">{issue.description}</p>
                    </div>
                  </div>

                  <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
                    {/* Votes */}
                    <button onClick={() => handleVote(issue.id, 'upvote')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                      style={{ background: votedIssues.has(issue.id) ? '#DCFCE7' : '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                      👍 {issue.upvotes}
                    </button>
                    <button onClick={() => handleVote(issue.id, 'downvote')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                      style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                      👎 {issue.downvotes}
                    </button>

                    <button onClick={() => setBeforeAfterIssue(issue)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                      style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                      🔍 {t('citizen.beforeAfter')}
                    </button>

                    <button onClick={() => setSelectedIssue(issue)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80 ml-auto"
                      style={{ background: '#0B1C2D', color: 'white' }}>
                      {t('citizen.issues.viewDetails')} →
                    </button>
                  </div>

                  {/* Rating for resolved issues */}
                  {issue.status === 'resolved' && issue.assignedContractor && (
                    <div className="px-4 pb-4">
                      <div className="p-3 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <p className="text-sm mb-2" style={{ color: '#15803D', fontWeight: 500 }}>⭐ {t('citizen.rate.label')}</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={star} onClick={() => rateContractor(issue.id, star)}
                              className="text-xl hover:scale-110 transition-transform"
                              style={{ color: issue.contractorRating && issue.contractorRating >= star ? '#F59E0B' : '#D1D5DB' }}>
                              ★
                            </button>
                          ))}
                          {issue.contractorRating && <span className="text-sm text-gray-500 ml-2 self-center">{issue.contractorRating}/5</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REPORT ISSUE TAB */}
        {activeTab === 'report' && (
          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #E2E8F0' }}>
            <h2 className="mb-2" style={{ color: '#0B1C2D', fontWeight: 700 }}>{t('citizen.report.title')}</h2>
            <p className="text-sm text-gray-500 mb-6">Fill in all details for accurate resolution tracking.</p>

            {/* Voice/Type Toggle */}
            <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: '#F1F5F9', width: 'fit-content' }}>
              <button onClick={() => setVoiceMode(false)}
                className="px-4 py-2 rounded-lg text-sm transition-all"
                style={{ background: !voiceMode ? '#0B1C2D' : 'transparent', color: !voiceMode ? 'white' : '#6B7280', fontWeight: 500 }}>
                ⌨️ {t('citizen.report.typeMode')}
              </button>
              <button onClick={() => setVoiceMode(true)}
                className="px-4 py-2 rounded-lg text-sm transition-all"
                style={{ background: voiceMode ? '#0B1C2D' : 'transparent', color: voiceMode ? 'white' : '#6B7280', fontWeight: 500 }}>
                🎤 {t('citizen.report.voiceMode')}
              </button>
            </div>

            {voiceMode && (
              <div className="p-5 rounded-2xl mb-6" style={{ background: '#F0F9FF', border: '2px solid #BAE6FD' }}>
                <p className="text-sm mb-4" style={{ color: '#0369A1' }}>🎤 {t('citizen.report.voiceHelp')}</p>
                <div className="flex flex-col items-center gap-4">
                  {isRecording && (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
                      <span className="text-sm" style={{ color: '#EF4444' }}>{t('citizen.report.recording')} {recordingTime}s / 60s</span>
                    </div>
                  )}
                  {voiceStatus === 'processing' && <div className="text-sm text-blue-600">⏳ {t('citizen.report.processing')}</div>}
                  {voiceStatus === 'success' && <div className="text-sm text-green-600">✅ {t('citizen.report.voiceConverted')}</div>}
                  {voiceStatus === 'error' && <div className="text-sm text-red-600">❌ {t('citizen.report.voiceFailed')}</div>}

                  <div className="flex gap-3">
                    {!isRecording ? (
                      <button onClick={startVoiceRecording}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white transition-all hover:opacity-90"
                        style={{ background: '#0B1C2D' }}>
                        🎤 {t('citizen.report.startRecord')}
                      </button>
                    ) : (
                      <button onClick={stopVoiceRecording}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white transition-all"
                        style={{ background: '#EF4444' }}>
                        ⏹ {t('citizen.report.stopRecord')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.issueTitle')}</label>
                  <input className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={inputStyle}
                    value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Deep pothole on Main Road" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.category')} *</label>
                  <select className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={inputStyle}
                    value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} required>
                    <option value="">{t('select.category')}</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{language === 'hi' ? c.labelHi : c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.description')} *</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" rows={3}
                  style={{ borderColor: '#E2E8F0', background: '#F8FAFC', fontFamily: "'Mukta', sans-serif", resize: 'none' as const }}
                  value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder={language === 'hi' ? 'समस्या का विवरण दें...' : 'Describe the issue in detail...'}
                  required />
                {voiceMode && voiceStatus === 'success' && (
                  <p className="text-xs mt-1" style={{ color: '#059669' }}>✨ Auto-filled from voice input — you can edit this text</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.state')} *</label>
                  <select className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={inputStyle}
                    value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} required>
                    <option value="">{t('select.state')}</option>
                    {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.city')} *</label>
                  <input className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={inputStyle}
                    value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                    placeholder="City name" required />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.landmark')}</label>
                  <input className="w-full px-4 py-2.5 rounded-xl border-2 outline-none" style={inputStyle}
                    value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    placeholder="Street / Landmark" />
                </div>
              </div>

              <div className="rounded-2xl p-4 sm:p-5" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm" style={{ color: '#0B1C2D', fontWeight: 600 }}>Auto location</p>
                    <p className="text-xs mt-1 text-gray-500">
                      Use your current location to preview the issue spot on the map and prefill nearby address details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => detectCurrentLocation()}
                    disabled={locationStatus === 'detecting'}
                    className="px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: '#0B1C2D', color: 'white', fontWeight: 500 }}
                  >
                    {locationStatus === 'detecting' ? 'Detecting location...' : detectedLocation ? 'Refresh location' : 'Use current location'}
                  </button>
                </div>

                {locationMessage && (
                  <p
                    className="text-sm mt-3"
                    style={{ color: locationStatus === 'error' ? '#B91C1C' : '#0F766E' }}
                  >
                    {locationMessage}
                  </p>
                )}

                <div
                  className="mt-4 rounded-2xl overflow-hidden"
                  style={{ border: '1px solid #CBD5E1', background: '#E2E8F0' }}
                >
                  {detectedLocation ? (
                    <div ref={mapContainerRef} style={{ width: '100%', height: 240 }} />
                  ) : (
                    <div className="h-60 flex items-center justify-center px-6 text-center text-sm text-gray-500">
                      Allow location access to preview your issue on OpenStreetMap.
                    </div>
                  )}
                </div>

                {detectedLocation && (
                  <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Lat {detectedLocation.lat.toFixed(5)}, Lng {detectedLocation.lng.toFixed(5)}</span>
                    {detectedLocation.accuracy ? <span>Approx. accuracy: {Math.round(detectedLocation.accuracy)} m</span> : <span>OpenStreetMap preview ready</span>}
                  </div>
                )}

                <p className="text-xs mt-2 text-gray-500">
                  Map tiles by OpenStreetMap. You can still edit the state, city, and landmark fields manually.
                </p>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#374151', fontWeight: 500 }}>{t('citizen.report.image')} *</label>
                <div className="border-2 border-dashed rounded-xl p-4 text-center transition-all" style={{ borderColor: '#CBD5E1', background: '#F8FAFC' }}>
                  {formData.imagePreview ? (
                    <div>
                      <img src={formData.imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg mb-2 object-cover" />
                      <p className="text-xs text-green-600">✅ Image uploaded: {uploadedFile?.name || 'Captured'}</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="text-3xl mb-2">📷</div>
                      <p className="text-gray-500 text-sm mb-3">Upload a clear photo of the issue</p>
                    </div>
                  )}
                  <label className="cursor-pointer inline-block px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                    style={{ background: '#0B1C2D', color: 'white' }}>
                    {formData.imagePreview ? '🔄 Change Image' : '📷 Choose Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  {!formData.imagePreview && formData.category && (
                    <button type="button" onClick={() => setFormData(p => ({ ...p, imagePreview: DEMO_CATEGORY_IMAGES[p.category] }))}
                      className="ml-2 px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                      style={{ background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0' }}>
                      Use Sample Image
                    </button>
                  )}
                </div>
              </div>

              <button type="submit"
                className="w-full py-3.5 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: '#0B1C2D', fontWeight: 600, fontSize: '1rem' }}>
                🚀 {t('citizen.report.submit')}
              </button>
            </form>
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0', height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#0B1C2D' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: '#E8821C' }}>🏛</div>
              <div>
                <p className="text-white" style={{ fontWeight: 600, fontSize: '0.9rem' }}>CIVICSETU Support</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-300 text-xs">Online</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#ECE5DD' }}>
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-xs sm:max-w-md rounded-2xl px-4 py-2.5 shadow-sm"
                    style={{
                      background: msg.sender === 'user' ? '#DCF8C6' : '#FFFFFF',
                      borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    }}>
                    <p className="text-sm" style={{ color: '#1a1a1a', lineHeight: 1.5 }}>{msg.text}</p>
                    <p className="text-right text-xs mt-1" style={{ color: '#9CA3AF' }}>{msg.time} {msg.sender === 'user' ? '✓✓' : ''}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 flex items-center gap-2" style={{ background: '#F0F0F0', borderTop: '1px solid #E2E8F0' }}>
              <button className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500">📎</button>
              <input
                className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
                style={{ background: 'white', border: '1px solid #E2E8F0' }}
                placeholder={t('citizen.chat.placeholder')}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90"
                style={{ background: '#25D366' }}>
                ➤
              </button>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="grid gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: '#EFF6FF', border: '3px solid #BFDBFE' }}>👤</div>
                <div>
                  <h2 style={{ color: '#0B1C2D', fontWeight: 700 }}>{currentUser.fullName}</h2>
                  <p className="text-gray-500 text-sm">{currentUser.email}</p>
                  <p className="text-gray-400 text-xs">{currentUser.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: t('citizen.profile.trustCode'), value: currentUser.trustCode || 'N/A', icon: '🔐', highlight: true },
                  { label: 'Location', value: `${currentUser.city}, ${currentUser.state}`, icon: '📍' },
                  { label: 'Role', value: 'Verified Citizen', icon: '✅' },
                  { label: t('citizen.profile.issues'), value: issues.filter(i => i.createdBy === currentUser.id).length.toString(), icon: '📋' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl" style={{ background: item.highlight ? '#FFF7ED' : '#F8FAFC', border: item.highlight ? '2px solid #FED7AA' : '1px solid #E2E8F0' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{item.icon}</span>
                      <span className="text-xs text-gray-500">{item.label}</span>
                    </div>
                    <p style={{ color: item.highlight ? '#C2410C' : '#0B1C2D', fontWeight: item.highlight ? 700 : 600, fontFamily: item.highlight ? 'monospace' : 'inherit', fontSize: item.highlight ? '1rem' : '0.9rem' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid #E2E8F0' }}>
              <h3 className="mb-4" style={{ color: '#0B1C2D', fontWeight: 600 }}>Issue Summary</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total', count: issues.length, color: '#0B1C2D', bg: '#EFF6FF' },
                  { label: 'Resolved', count: issues.filter(i => i.status === 'resolved').length, color: '#15803D', bg: '#F0FDF4' },
                  { label: 'Open', count: issues.filter(i => i.status === 'open_for_bidding').length, color: '#1D4ED8', bg: '#EFF6FF' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl text-center" style={{ background: s.bg }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.count}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {beforeAfterIssue && <BeforeAfterModal issue={beforeAfterIssue} onClose={() => setBeforeAfterIssue(null)} />}

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-5" style={{ background: '#0B1C2D' }}>
              <h3 className="text-white" style={{ fontWeight: 700 }}>{t('citizen.issues.viewDetails')}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <img src={selectedIssue.beforeImage} alt="Issue" className="w-full rounded-xl object-cover" style={{ height: 200 }} />
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedIssue.status} />
                <UrgencyBadge urgency={selectedIssue.urgencyTag} />
                <CategoryBadge category={selectedIssue.category} />
              </div>
              <h2 style={{ color: '#0B1C2D', fontWeight: 700 }}>{selectedIssue.title}</h2>
              <p className="text-gray-600 text-sm">{selectedIssue.description}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                  <p className="text-gray-400 text-xs">Location</p>
                  <p style={{ fontWeight: 500 }}>{selectedIssue.city}, {selectedIssue.state}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                  <p className="text-gray-400 text-xs">Reported On</p>
                  <p style={{ fontWeight: 500 }}>{new Date(selectedIssue.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                  <p className="text-gray-400 text-xs">Votes</p>
                  <p style={{ fontWeight: 500 }}>👍 {selectedIssue.upvotes} / 👎 {selectedIssue.downvotes}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                  <p className="text-gray-400 text-xs">Address</p>
                  <p style={{ fontWeight: 500, fontSize: '0.8rem' }}>{selectedIssue.address}</p>
                </div>
              </div>

              {/* Comments */}
              <div>
                <p className="mb-2" style={{ fontWeight: 600, color: '#0B1C2D' }}>💬 Comments</p>
                {comments.filter(c => c.issueId === selectedIssue.id).map(c => (
                  <div key={c.id} className="mb-2 p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
                    <p className="text-xs text-gray-500 mb-1">{c.userName} • {new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
                    <p className="text-sm">{c.content}</p>
                  </div>
                ))}
                {comments.filter(c => c.issueId === selectedIssue.id).length === 0 && (
                  <p className="text-gray-400 text-sm">No comments yet.</p>
                )}
              </div>
            </div>

            {/* Assigned Contractor/NGO */}
            <AssignedBadge contractorId={selectedIssue.assignedContractor} ngoId={selectedIssue.assignedNgo} />

            {/* Donate to NGO Button */}
            {selectedIssue.assignedNgo && (
              <div className="px-5 pb-5">
                <button
                  onClick={() => setDonationNgoId(selectedIssue.assignedNgo)}
                  className="w-full py-3 rounded-xl text-white transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontWeight: 600 }}
                >
                  💚 {t('citizen.donate')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Donation Modal */}
      {donationNgoId && <DonationModal ngoId={donationNgoId} onClose={() => setDonationNgoId(null)} />}
    </div>
  );
}
