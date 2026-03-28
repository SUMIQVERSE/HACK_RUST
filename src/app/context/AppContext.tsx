import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type IssueCategory = 'water' | 'road' | 'electricity' | 'sanitation';
export type IssueStatus = 'open_for_bidding' | 'in_progress' | 'resolved';
export type UrgencyTag = 'High' | 'Medium' | 'Low';
export type UserRole = 'citizen' | 'authority' | 'contractor' | 'ngo';

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  trustCode?: string;
  company?: string;
  ngoName?: string;
  state?: string;
  city?: string;
  registrationId?: string;
  rating?: number;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  state: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  createdBy: string;
  assignedContractor: string | null;
  assignedNgo: string | null;
  beforeImage: string;
  afterImage: string | null;
  urgencyTag: UrgencyTag;
  upvotes: number;
  downvotes: number;
  isSuspicious: boolean;
  isDuplicate: boolean;
  contractorRating: number | null;
  createdAt: string;
}

export interface Bid {
  id: string;
  issueId: string;
  contractorId: string;
  contractorName: string;
  bidAmount: number;
  proposalNote: string;
  status: 'submitted' | 'selected' | 'rejected';
  createdAt: string;
}

export interface NgoRequest {
  id: string;
  issueId: string;
  ngoId: string;
  ngoName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Donation {
  id: string;
  ngoId: string;
  donorName: string;
  amount: number;
  message: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

const IMG_POTHOLE = 'https://images.unsplash.com/photo-1709934730506-fba12664d4e4?w=800&q=80';
const IMG_WATER_PIPE = 'https://images.unsplash.com/photo-1639335875048-a14e75abc083?w=800&q=80';
const IMG_STREETLIGHT = 'https://images.unsplash.com/photo-1640362790728-c2bd0dfa9f33?w=800&q=80';
const IMG_GARBAGE = 'https://images.unsplash.com/photo-1762805544399-7cdf748371e0?w=800&q=80';
const IMG_ROAD_AFTER = 'https://images.unsplash.com/photo-1645698406985-20f411b4937d?w=800&q=80';
const IMG_WATER_AFTER = 'https://images.unsplash.com/photo-1769263092692-8bdce7a125de?w=800&q=80';
const IMG_LIGHT_AFTER = 'https://images.unsplash.com/photo-1694408614727-0a05c1019777?w=800&q=80';

// Helper function to generate dates in 2026
const getDate2026 = (month: number, day: number, hour: number = 10, minute: number = 0) => {
  return new Date(2026, month - 1, day, hour, minute, 0).toISOString();
};

export const MOCK_USERS: AppUser[] = [
  { id: 'u1', fullName: 'Ramesh Kumar', email: 'ramesh@example.com', phone: '+91 98765 43210', role: 'citizen', trustCode: 'JM-CIT-2026-001', state: 'Delhi', city: 'New Delhi' },
  { id: 'u2', fullName: 'Priya Sharma', email: 'priya@dmc.gov.in', phone: '+91 11 2345 6789', role: 'authority', state: 'Delhi', city: 'New Delhi' },
  { id: 'u3', fullName: 'Suresh Patel', email: 'suresh@buildtech.com', phone: '+91 99001 12345', role: 'contractor', company: 'BuildTech Solutions Pvt. Ltd.', registrationId: 'CON-2026-BT-0042', rating: 4.3, state: 'Delhi', city: 'New Delhi' },
  { id: 'u4', fullName: 'Meena Joshi', email: 'meena@greenindia.org', phone: '+91 80 4567 8901', role: 'ngo', ngoName: 'Green India Foundation', registrationId: 'NGO-REG-2026-0077', rating: 4.7, state: 'Karnataka', city: 'Bangalore' },
];

const INITIAL_ISSUES: Issue[] = [
  { id: 'i1', title: 'Deep Pothole on MG Road', description: 'A large pothole near Connaught Place causing accidents. Multiple vehicles damaged. Requires urgent RCC repair.', category: 'road', status: 'resolved', state: 'Delhi', city: 'New Delhi', address: 'MG Road, near Connaught Place', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_POTHOLE, afterImage: IMG_ROAD_AFTER, urgencyTag: 'High', upvotes: 34, downvotes: 2, isSuspicious: false, isDuplicate: false, contractorRating: 4, createdAt: getDate2026(1, 15, 10, 0) },
  { id: 'i2', title: 'Garbage Pile at Dadar Market', description: 'Massive garbage accumulation near Dadar vegetable market causing health hazards and foul smell in the entire locality.', category: 'sanitation', status: 'resolved', state: 'Maharashtra', city: 'Mumbai', address: 'Near Dadar Vegetable Market, Dadar West', createdBy: 'u1', assignedContractor: null, assignedNgo: 'u4', beforeImage: IMG_GARBAGE, afterImage: IMG_WATER_AFTER, urgencyTag: 'High', upvotes: 28, downvotes: 1, isSuspicious: false, isDuplicate: false, contractorRating: 5, createdAt: getDate2026(1, 20, 8, 30) },
  { id: 'i3', title: 'Water Pipe Burst near Whitefield Metro', description: 'A major water supply pipe burst near Whitefield Metro Station causing waterlogging and supply disruption in 3 residential blocks.', category: 'water', status: 'resolved', state: 'Karnataka', city: 'Bangalore', address: 'Near Whitefield Metro Station, Whitefield', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_WATER_PIPE, afterImage: IMG_WATER_AFTER, urgencyTag: 'High', upvotes: 45, downvotes: 0, isSuspicious: false, isDuplicate: false, contractorRating: 4, createdAt: getDate2026(1, 25, 12, 0) },
  { id: 'i4', title: 'Broken Streetlight at Anna Nagar', description: 'Multiple streetlights non-functional on main Anna Nagar road for over 2 weeks creating serious security concerns at night.', category: 'electricity', status: 'resolved', state: 'Tamil Nadu', city: 'Chennai', address: '2nd Main Road, Anna Nagar West', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_STREETLIGHT, afterImage: IMG_LIGHT_AFTER, urgencyTag: 'Medium', upvotes: 19, downvotes: 1, isSuspicious: false, isDuplicate: false, contractorRating: 5, createdAt: getDate2026(2, 1, 9, 0) },
  { id: 'i5', title: 'Road Damage near Sabarmati School', description: 'Road surface near Sabarmati Primary School has severely deteriorated. Children face daily danger. Urgent repair needed.', category: 'road', status: 'resolved', state: 'Gujarat', city: 'Ahmedabad', address: 'Near Sabarmati Primary School, Sabarmati', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_POTHOLE, afterImage: IMG_ROAD_AFTER, urgencyTag: 'High', upvotes: 56, downvotes: 3, isSuspicious: false, isDuplicate: false, contractorRating: 5, createdAt: getDate2026(2, 10, 11, 0) },
  { id: 'i6', title: 'Large Pothole on NH-48 Expressway', description: 'Critical pothole on busy NH-48 highway within Pune city limits. Multiple accidents reported this month. Emergency repair required.', category: 'road', status: 'in_progress', state: 'Maharashtra', city: 'Pune', address: 'NH-48, near Hinjewadi Junction, Pune', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_POTHOLE, afterImage: null, urgencyTag: 'High', upvotes: 67, downvotes: 4, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(2, 15, 10, 30) },
  { id: 'i7', title: 'Water Supply Pipe Burst near Hospital', description: 'Main water supply line burst on the road adjacent to SMS Hospital. Water wastage and contamination risk extremely high.', category: 'water', status: 'in_progress', state: 'Rajasthan', city: 'Jaipur', address: 'Near SMS Hospital, Jaipur', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_WATER_PIPE, afterImage: null, urgencyTag: 'High', upvotes: 89, downvotes: 2, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(2, 20, 8, 0) },
  { id: 'i8', title: 'Garbage Dumping near Begumpet Hospital', description: 'Unauthorized garbage dump near Begumpet hospital. Biomedical waste mixed with regular garbage poses severe health risk.', category: 'sanitation', status: 'in_progress', state: 'Telangana', city: 'Hyderabad', address: 'Near Begumpet Hospital, Secunderabad', createdBy: 'u1', assignedContractor: null, assignedNgo: 'u4', beforeImage: IMG_GARBAGE, afterImage: null, urgencyTag: 'High', upvotes: 112, downvotes: 5, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(2, 22, 9, 15) },
  { id: 'i9', title: 'Street Light Failure at Howrah Crossing', description: 'All 12 streetlights at Howrah Bridge approach have failed simultaneously. Night traffic in complete darkness is extremely dangerous.', category: 'electricity', status: 'in_progress', state: 'West Bengal', city: 'Kolkata', address: 'Howrah Bridge Approach, Strand Road', createdBy: 'u1', assignedContractor: 'u3', assignedNgo: null, beforeImage: IMG_STREETLIGHT, afterImage: null, urgencyTag: 'High', upvotes: 78, downvotes: 3, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(2, 25, 7, 30) },
  { id: 'i10', title: 'Major Pothole near Rajiv Chowk Metro', description: 'Extremely deep pothole (30cm) near Rajiv Chowk Metro exit. Hundreds of commuters face it daily. High accident risk reported.', category: 'road', status: 'open_for_bidding', state: 'Delhi', city: 'New Delhi', address: 'Near Rajiv Chowk Metro Exit 5, Connaught Place', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_POTHOLE, afterImage: null, urgencyTag: 'High', upvotes: 145, downvotes: 2, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 1, 9, 0) },
  { id: 'i11', title: 'Drain Overflow near Dharavi Market', description: 'Main drainage pipe overflowed near Dharavi market creating sewage flooding. Health hazard for vendors and residents.', category: 'water', status: 'open_for_bidding', state: 'Maharashtra', city: 'Mumbai', address: 'Dharavi Main Road, near Dharavi Market', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_WATER_PIPE, afterImage: null, urgencyTag: 'Medium', upvotes: 93, downvotes: 7, isSuspicious: true, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 5, 11, 0) },
  { id: 'i12', title: 'Waste Accumulation at T. Nagar Market', description: 'Massive waste near T. Nagar textile market. Daily waste from hundreds of shops piling up. Municipal clearance irregular.', category: 'sanitation', status: 'open_for_bidding', state: 'Tamil Nadu', city: 'Chennai', address: 'T. Nagar Bus Stand road, T. Nagar', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_GARBAGE, afterImage: null, urgencyTag: 'Medium', upvotes: 71, downvotes: 4, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 8, 10, 0) },
  { id: 'i13', title: 'Broken Electricity Pole near BTM School', description: 'High tension electricity pole near BTM Layout school partially broken by storm. Live wires dangling near school footpath.', category: 'electricity', status: 'open_for_bidding', state: 'Karnataka', city: 'Bangalore', address: 'BTM Layout 2nd Stage, near BTM School', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_STREETLIGHT, afterImage: null, urgencyTag: 'High', upvotes: 203, downvotes: 1, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 10, 8, 0) },
  { id: 'i14', title: 'Pothole Causing Accidents on Highway', description: 'Series of large potholes on Pune-Mumbai highway within city limits. 3 accidents reported this week. Media coverage ongoing.', category: 'road', status: 'open_for_bidding', state: 'Maharashtra', city: 'Pune', address: 'Pune-Mumbai Highway, near Wakad Flyover', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_POTHOLE, afterImage: null, urgencyTag: 'High', upvotes: 187, downvotes: 3, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 12, 13, 0) },
  { id: 'i15', title: 'Sewage Leak near Government School', description: 'Underground sewage line cracked near Rajasthan Government School. Contaminated water seeping into school premises.', category: 'water', status: 'open_for_bidding', state: 'Rajasthan', city: 'Jaipur', address: 'Near Rajasthan Government School, Vaishali Nagar', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_WATER_PIPE, afterImage: null, urgencyTag: 'High', upvotes: 156, downvotes: 2, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 15, 10, 30) },
  { id: 'i16', title: 'Street Lamp Out near Safdarjung Hospital', description: 'All street lamps on 300m stretch near Safdarjung Hospital night entry have failed. Night staff and patients face safety issues.', category: 'electricity', status: 'open_for_bidding', state: 'Delhi', city: 'New Delhi', address: 'Safdarjung Hospital Road, South Extension', createdBy: 'u1', assignedContractor: null, assignedNgo: null, beforeImage: IMG_STREETLIGHT, afterImage: null, urgencyTag: 'High', upvotes: 134, downvotes: 4, isSuspicious: false, isDuplicate: false, contractorRating: null, createdAt: getDate2026(3, 18, 9, 0) },
];

const INITIAL_BIDS: Bid[] = [
  { id: 'b1', issueId: 'i1', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 50000, proposalNote: 'Will repair using M30 grade concrete with proper drainage. 5-day completion guarantee.', status: 'selected', createdAt: getDate2026(1, 16, 10, 0) },
  { id: 'b2', issueId: 'i5', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 65000, proposalNote: 'Full road resurfacing with hot mix asphalt. 7-day project timeline with school hours restriction.', status: 'selected', createdAt: getDate2026(2, 11, 9, 0) },
  { id: 'b3', issueId: 'i6', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 75000, proposalNote: 'Full road patch repair with hot mix asphalt. Will complete within 3 days with reflective traffic cones.', status: 'selected', createdAt: getDate2026(2, 17, 11, 0) },
  { id: 'b4', issueId: 'i10', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 120000, proposalNote: 'Comprehensive pothole & surface repair covering 200sqm. RCC filling with 30-day warranty.', status: 'submitted', createdAt: getDate2026(3, 2, 10, 0) },
  { id: 'b5', issueId: 'i14', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 90000, proposalNote: 'Emergency pothole repair team deployed. Using bituminous macadam with quick-set material.', status: 'submitted', createdAt: getDate2026(3, 13, 9, 0) },
];

const INITIAL_NGO_REQUESTS: NgoRequest[] = [
  { id: 'nr1', issueId: 'i2', ngoId: 'u4', ngoName: 'Green India Foundation', status: 'approved', createdAt: getDate2026(1, 21, 9, 0) },
  { id: 'nr2', issueId: 'i8', ngoId: 'u4', ngoName: 'Green India Foundation', status: 'approved', createdAt: getDate2026(2, 23, 8, 0) },
  { id: 'nr3', issueId: 'i12', ngoId: 'u4', ngoName: 'Green India Foundation', status: 'pending', createdAt: getDate2026(3, 9, 11, 0) },
  { id: 'nr4', issueId: 'i15', ngoId: 'u4', ngoName: 'Green India Foundation', status: 'pending', createdAt: getDate2026(3, 16, 10, 0) },
];

const INITIAL_DONATIONS: Donation[] = [
  { id: 'd1', ngoId: 'u4', donorName: 'Anonymous', amount: 25000, message: 'Keep up the great work for our community!', createdAt: getDate2026(2, 1, 10, 0) },
  { id: 'd2', ngoId: 'u4', donorName: 'Ratan Patel', amount: 50000, message: 'Proud to support Green India Foundation.', createdAt: getDate2026(2, 10, 14, 0) },
  { id: 'd3', ngoId: 'u4', donorName: 'Sunita Devi', amount: 10000, message: 'Please clean up my neighborhood too.', createdAt: getDate2026(2, 20, 9, 0) },
  { id: 'd4', ngoId: 'u4', donorName: 'Infosys CSR Fund', amount: 100000, message: 'Corporate social responsibility for urban civic improvement.', createdAt: getDate2026(3, 1, 11, 0) },
  { id: 'd5', ngoId: 'u4', donorName: 'Mahesh Gupta', amount: 15000, message: 'In memory of my father, who always cared for cleanliness.', createdAt: getDate2026(3, 10, 16, 0) },
];

const INITIAL_COMMENTS: Comment[] = [
  { id: 'c1', issueId: 'i10', userId: 'u1', userName: 'Ramesh Kumar', content: 'I hit my scooter in this pothole yesterday. Please fix immediately!', createdAt: getDate2026(3, 2, 8, 0) },
  { id: 'c2', issueId: 'i10', userId: 'u2', userName: 'Authority Office', content: 'We have noted this issue and sent it for bidding today.', createdAt: getDate2026(3, 2, 11, 0) },
  { id: 'c3', issueId: 'i13', userId: 'u1', userName: 'Ramesh Kumar', content: 'This is extremely dangerous! Children pass by every day. URGENT!', createdAt: getDate2026(3, 10, 9, 0) },
  { id: 'c4', issueId: 'i13', userId: 'u2', userName: 'Authority Office', content: 'Safety barrier placed immediately. Repair team dispatched.', createdAt: getDate2026(3, 10, 14, 0) },
];

interface AppContextType {
  users: AppUser[];
  issues: Issue[];
  bids: Bid[];
  ngoRequests: NgoRequest[];
  donations: Donation[];
  comments: Comment[];
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  addIssue: (issue: Issue) => void;
  updateIssueStatus: (issueId: string, status: IssueStatus) => void;
  updateAfterImage: (issueId: string, imageUrl: string) => void;
  addBid: (bid: Bid) => void;
  selectBid: (bidId: string, issueId: string, contractorId: string) => void;
  addNgoRequest: (request: NgoRequest) => void;
  updateNgoRequest: (requestId: string, ngoId: string, issueId: string, status: 'approved' | 'rejected') => void;
  voteOnIssue: (issueId: string, voteType: 'upvote' | 'downvote') => void;
  addComment: (comment: Comment) => void;
  addDonation: (donation: Donation) => void;
  rateContractor: (issueId: string, rating: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [users] = useState<AppUser[]>(MOCK_USERS);
  const [issues, setIssues] = useState<Issue[]>(INITIAL_ISSUES);
  const [bids, setBids] = useState<Bid[]>(INITIAL_BIDS);
  const [ngoRequests, setNgoRequests] = useState<NgoRequest[]>(INITIAL_NGO_REQUESTS);
  const [donations, setDonations] = useState<Donation[]>(INITIAL_DONATIONS);
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const addIssue = useCallback((issue: Issue) => { setIssues(prev => [issue, ...prev]); }, []);
  const updateIssueStatus = useCallback((issueId: string, status: IssueStatus) => { setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status } : i)); }, []);
  const updateAfterImage = useCallback((issueId: string, imageUrl: string) => { setIssues(prev => prev.map(i => i.id === issueId ? { ...i, afterImage: imageUrl } : i)); }, []);
  const addBid = useCallback((bid: Bid) => { setBids(prev => [bid, ...prev]); }, []);

  const selectBid = useCallback((bidId: string, issueId: string, contractorId: string) => {
    setBids(prev => prev.map(b => b.issueId === issueId ? { ...b, status: b.id === bidId ? 'selected' : 'rejected' } : b));
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'in_progress', assignedContractor: contractorId } : i));
  }, []);

  const addNgoRequest = useCallback((request: NgoRequest) => { setNgoRequests(prev => [request, ...prev]); }, []);

  const updateNgoRequest = useCallback((requestId: string, ngoId: string, issueId: string, status: 'approved' | 'rejected') => {
    setNgoRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
    if (status === 'approved') {
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, assignedNgo: ngoId, status: 'in_progress' } : i));
    }
  }, []);

  const voteOnIssue = useCallback((issueId: string, voteType: 'upvote' | 'downvote') => {
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      const updated = { ...i, upvotes: voteType === 'upvote' ? i.upvotes + 1 : i.upvotes, downvotes: voteType === 'downvote' ? i.downvotes + 1 : i.downvotes };
      updated.isSuspicious = updated.downvotes >= 6;
      return updated;
    }));
  }, []);

  const addComment = useCallback((comment: Comment) => { setComments(prev => [...prev, comment]); }, []);
  const addDonation = useCallback((donation: Donation) => { setDonations(prev => [donation, ...prev]); }, []);
  const rateContractor = useCallback((issueId: string, rating: number) => { setIssues(prev => prev.map(i => i.id === issueId ? { ...i, contractorRating: rating } : i)); }, []);

  return (
    <AppContext.Provider value={{ users, issues, bids, ngoRequests, donations, comments, currentUser, setCurrentUser, addIssue, updateIssueStatus, updateAfterImage, addBid, selectBid, addNgoRequest, updateNgoRequest, voteOnIssue, addComment, addDonation, rateContractor }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
