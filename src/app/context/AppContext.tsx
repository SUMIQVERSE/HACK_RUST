import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type IssueCategory = 'water' | 'road' | 'electricity' | 'sanitation';
export type IssueStatus = 'open_for_bidding' | 'in_progress' | 'awaiting_citizen_verification' | 'resolved';
export type UrgencyTag = 'High' | 'Medium' | 'Low';
export type UserRole = 'citizen' | 'authority' | 'contractor' | 'ngo';
export type VoteType = 'upvote' | 'downvote';

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
  profilePic?: string;
}

export interface IssueReviewEvent {
  id: string;
  type: VoteType;
  createdAt: string;
}

export interface FlaggedReviewBatch {
  id: string;
  reviewIds: string[];
  windowStartedAt: string;
  windowEndedAt: string;
  reviewsInBatch: number;
  expectedDailyReviews: number;
  triggerThreshold: number;
  frozenScore: number;
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
  overallRatingScore: number;
  isRatingFrozen: boolean;
  flaggedReviewBatch: FlaggedReviewBatch | null;
  reviewEvents: IssueReviewEvent[];
  duplicateCount: number;
  isSuspicious: boolean;
  isDuplicate: boolean;
  contractorRating: number | null;
  currentPercent: number;
  initialBudget: number; // Authority's initial offer
  estimatedTimeline: number | null; // Completion days
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
  estimatedTimeline: number; // Days
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

export interface AddIssueResult {
  duplicateCount: number;
  issueId: string;
  merged: boolean;
}

const IMG_POTHOLE = 'https://images.unsplash.com/photo-1709934730506-fba12664d4e4?w=800&q=80';
const IMG_WATER_PIPE = 'https://images.unsplash.com/photo-1639335875048-a14e75abc083?w=800&q=80';
const IMG_STREETLIGHT = 'https://images.unsplash.com/photo-1640362790728-c2bd0dfa9f33?w=800&q=80';
const IMG_GARBAGE = 'https://images.unsplash.com/photo-1762805544399-7cdf748371e0?w=800&q=80';
const IMG_ROAD_AFTER = 'https://images.unsplash.com/photo-1645698406985-20f411b4937d?w=800&q=80';
const IMG_WATER_AFTER = 'https://images.unsplash.com/photo-1769263092692-8bdce7a125de?w=800&q=80';
const IMG_LIGHT_AFTER = 'https://images.unsplash.com/photo-1694408614727-0a05c1019777?w=800&q=80';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_SPIKE_MULTIPLIER = 10;
const MIN_REVIEW_SPIKE_COUNT = 20;
const DUPLICATE_CONTENT_THRESHOLD = 0.65;
const DUPLICATE_ADDRESS_THRESHOLD = 0.6;
const DUPLICATE_DISTANCE_THRESHOLD_KM = 0.35;

const roundToSingleDecimal = (value: number) => Math.round(value * 10) / 10;

const calculateIssueRatingScore = (upvotes: number, downvotes: number) => {
  const totalVotes = upvotes + downvotes;
  if (totalVotes === 0) return 0;
  return roundToSingleDecimal((upvotes / totalVotes) * 5);
};

type IssueSeed = Omit<Issue, 'overallRatingScore' | 'isRatingFrozen' | 'flaggedReviewBatch' | 'reviewEvents' | 'duplicateCount'> & {
  duplicateCount?: number;
};

const getProgressForStatus = (status: IssueStatus): number => {
  switch (status) {
    case 'open_for_bidding': return 40;
    case 'in_progress': return 60;
    case 'awaiting_citizen_verification': return 95;
    case 'resolved': return 100;
    default: return 0;
  }
};

const hydrateIssue = (issue: IssueSeed): Issue => ({
  ...issue,
  overallRatingScore: calculateIssueRatingScore(issue.upvotes, issue.downvotes),
  isRatingFrozen: false,
  flaggedReviewBatch: null,
  reviewEvents: [],
  duplicateCount: issue.duplicateCount ?? 1,
  isDuplicate: issue.isDuplicate || (issue.duplicateCount ?? 1) > 1,
  currentPercent: getProgressForStatus(issue.status),
  initialBudget: (issue as any).initialBudget ?? (Math.floor(Math.random() * 50) + 20) * 1000,
  estimatedTimeline: (issue as any).estimatedTimeline ?? null,
});

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const getTokenSet = (value: string) => new Set(normalizeText(value).split(' ').filter(token => token.length > 2));

const calculateTokenSimilarity = (left: string, right: string) => {
  const leftTokens = getTokenSet(left);
  const rightTokens = getTokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const toRadians = (value: number) => value * (Math.PI / 180);

const calculateDistanceKm = (firstLat: number, firstLng: number, secondLat: number, secondLng: number) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(secondLat - firstLat);
  const deltaLng = toRadians(secondLng - firstLng);
  const latA = toRadians(firstLat);
  const latB = toRadians(secondLat);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2) * Math.cos(latA) * Math.cos(latB);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const isSameIssueLocation = (existingIssue: Issue, incomingIssue: Issue) => {
  const sameState = normalizeText(existingIssue.state) === normalizeText(incomingIssue.state);
  const sameCity = normalizeText(existingIssue.city) === normalizeText(incomingIssue.city);
  if (!sameState || !sameCity) return false;

  const hasCoordinates =
    existingIssue.latitude !== undefined &&
    existingIssue.longitude !== undefined &&
    incomingIssue.latitude !== undefined &&
    incomingIssue.longitude !== undefined;

  if (hasCoordinates) {
    const distanceKm = calculateDistanceKm(
      existingIssue.latitude!,
      existingIssue.longitude!,
      incomingIssue.latitude!,
      incomingIssue.longitude!,
    );
    if (distanceKm <= DUPLICATE_DISTANCE_THRESHOLD_KM) return true;
  }

  const addressSimilarity = calculateTokenSimilarity(existingIssue.address, incomingIssue.address);
  return addressSimilarity >= DUPLICATE_ADDRESS_THRESHOLD;
};

const findDuplicateIssue = (issues: Issue[], incomingIssue: Issue) => {
  let bestMatch: { issue: Issue; similarity: number } | null = null;

  for (const issue of issues) {
    if (issue.status === 'resolved') continue;
    if (issue.category !== incomingIssue.category) continue;
    if (!isSameIssueLocation(issue, incomingIssue)) continue;

    const similarity = calculateTokenSimilarity(
      `${issue.title} ${issue.description}`,
      `${incomingIssue.title} ${incomingIssue.description}`,
    );

    if (similarity < DUPLICATE_CONTENT_THRESHOLD) continue;
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { issue, similarity };
    }
  }

  return bestMatch?.issue ?? null;
};

const getReviewSpikeMetrics = (
  issue: Issue,
  nextReviewEvents: IssueReviewEvent[],
  nextUpvotes: number,
  nextDownvotes: number,
  referenceTime: string,
) => {
  const referenceMs = new Date(referenceTime).getTime();
  const recentReviewEvents = nextReviewEvents.filter(review => referenceMs - new Date(review.createdAt).getTime() <= HOUR_MS);
  const recentReviewCount = recentReviewEvents.length;
  const totalReviews = nextUpvotes + nextDownvotes;
  const issueAgeMs = Math.max(referenceMs - new Date(issue.createdAt).getTime(), DAY_MS);
  const historicalAgeDays = Math.max((issueAgeMs - HOUR_MS) / DAY_MS, 1);
  const historicalReviewCount = Math.max(totalReviews - recentReviewCount, 0);
  const expectedDailyReviews = historicalReviewCount / historicalAgeDays;
  const triggerThreshold = Math.max(MIN_REVIEW_SPIKE_COUNT, Math.ceil(Math.max(expectedDailyReviews, 1) * REVIEW_SPIKE_MULTIPLIER));

  return {
    recentReviewEvents,
    recentReviewCount,
    expectedDailyReviews: roundToSingleDecimal(expectedDailyReviews),
    triggerThreshold,
    shouldFreeze: recentReviewCount >= triggerThreshold,
  };
};

const createReviewEventId = () => `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

const ISSUE_SEEDS: IssueSeed[] = [
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

const INITIAL_ISSUES: Issue[] = ISSUE_SEEDS.map(hydrateIssue);

const INITIAL_BIDS: Bid[] = [
  { id: 'b1', issueId: 'i1', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 50000, proposalNote: 'Will repair using M30 grade concrete with proper drainage. 5-day completion guarantee.', status: 'selected', estimatedTimeline: 5, createdAt: getDate2026(1, 16, 10, 0) },
  { id: 'b2', issueId: 'i5', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 65000, proposalNote: 'Full road resurfacing with hot mix asphalt. 7-day project timeline with school hours restriction.', status: 'selected', estimatedTimeline: 7, createdAt: getDate2026(2, 11, 9, 0) },
  { id: 'b3', issueId: 'i6', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 75000, proposalNote: 'Full road patch repair with hot mix asphalt. Will complete within 3 days with reflective traffic cones.', status: 'selected', estimatedTimeline: 3, createdAt: getDate2026(2, 17, 11, 0) },
  { id: 'b4', issueId: 'i10', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 120000, proposalNote: 'Comprehensive pothole & surface repair covering 200sqm. RCC filling with 30-day warranty.', status: 'submitted', estimatedTimeline: 10, createdAt: getDate2026(3, 2, 10, 0) },
  { id: 'b5', issueId: 'i14', contractorId: 'u3', contractorName: 'BuildTech Solutions', bidAmount: 90000, proposalNote: 'Emergency pothole repair team deployed. Using bituminous macadam with quick-set material.', status: 'submitted', estimatedTimeline: 4, createdAt: getDate2026(3, 13, 9, 0) },
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
  addIssue: (issue: Issue) => AddIssueResult;
  updateIssueStatus: (issueId: string, status: IssueStatus) => void;
  updateAfterImage: (issueId: string, imageUrl: string) => void;
  submitResolutionProof: (issueId: string, imageUrl: string) => void;
  verifyIssueResolution: (issueId: string, isVerified: boolean) => void;
  addBid: (bid: Bid) => void;
  selectBid: (bidId: string, issueId: string, contractorId: string) => void;
  addNgoRequest: (request: NgoRequest) => void;
  updateNgoRequest: (requestId: string, ngoId: string, issueId: string, status: 'approved' | 'rejected') => void;
  voteOnIssue: (issueId: string, voteType: VoteType) => void;
  reviewFlaggedBatch: (issueId: string, decision: 'approve' | 'reject') => void;
  addComment: (comment: Comment) => void;
  addDonation: (donation: Donation) => void;
  rateContractor: (issueId: string, rating: number) => void;
  updateUserProfile: (profilePic: string) => void;
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

  const addIssue = useCallback((issue: Issue) => {
    let result: AddIssueResult = {
      duplicateCount: issue.duplicateCount,
      issueId: issue.id,
      merged: false,
    };

    setIssues(prev => {
      const duplicateIssue = findDuplicateIssue(prev, issue);
      if (!duplicateIssue) {
        result = {
          duplicateCount: issue.duplicateCount,
          issueId: issue.id,
          merged: false,
        };
        return [issue, ...prev];
      }

      const nextDuplicateCount = duplicateIssue.duplicateCount + 1;
      result = {
        duplicateCount: nextDuplicateCount,
        issueId: duplicateIssue.id,
        merged: true,
      };

      return prev.map(existingIssue => {
        if (existingIssue.id !== duplicateIssue.id) return existingIssue;
        return {
          ...existingIssue,
          address: existingIssue.address.length >= issue.address.length ? existingIssue.address : issue.address,
          latitude: existingIssue.latitude ?? issue.latitude,
          longitude: existingIssue.longitude ?? issue.longitude,
          duplicateCount: nextDuplicateCount,
          isDuplicate: true,
        };
      });
    });

    return result;
  }, []);

  const updateIssueStatus = useCallback((issueId: string, status: IssueStatus) => {
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      if (status === 'resolved' && i.status !== 'awaiting_citizen_verification') return i;
      if (status === 'awaiting_citizen_verification' && !i.afterImage) return i;
      return { ...i, status, currentPercent: getProgressForStatus(status) };
    }));
  }, []);

  const updateAfterImage = useCallback((issueId: string, imageUrl: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, afterImage: imageUrl } : i));
  }, []);

  const submitResolutionProof = useCallback((issueId: string, imageUrl: string) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, afterImage: imageUrl, status: 'awaiting_citizen_verification', currentPercent: 95 } : i));
  }, []);

  const verifyIssueResolution = useCallback((issueId: string, isVerified: boolean) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: isVerified ? 'resolved' : 'in_progress', currentPercent: isVerified ? 100 : 85 } : i));
  }, []);

  const addBid = useCallback((bid: Bid) => { setBids(prev => [bid, ...prev]); }, []);

  const selectBid = useCallback((bidId: string, issueId: string, contractorId: string) => {
    const selectedBid = bids.find(b => b.id === bidId);
    setBids(prev => prev.map(b => b.issueId === issueId ? { ...b, status: b.id === bidId ? 'selected' : 'rejected' } : b));
    setIssues(prev => prev.map(i => i.id === issueId ? { 
      ...i, 
      status: 'in_progress', 
      assignedContractor: contractorId, 
      currentPercent: 50,
      estimatedTimeline: selectedBid?.estimatedTimeline || null
    } : i));
  }, [bids]);

  const addNgoRequest = useCallback((request: NgoRequest) => { setNgoRequests(prev => [request, ...prev]); }, []);

  const updateNgoRequest = useCallback((requestId: string, ngoId: string, issueId: string, status: 'approved' | 'rejected') => {
    setNgoRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
    if (status === 'approved') {
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, assignedNgo: ngoId, status: 'in_progress' } : i));
    }
  }, []);

  const voteOnIssue = useCallback((issueId: string, voteType: VoteType) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id !== issueId) return issue;

      const createdAt = new Date().toISOString();
      const reviewEvent: IssueReviewEvent = {
        id: createReviewEventId(),
        type: voteType,
        createdAt,
      };
      const nextUpvotes = voteType === 'upvote' ? issue.upvotes + 1 : issue.upvotes;
      const nextDownvotes = voteType === 'downvote' ? issue.downvotes + 1 : issue.downvotes;
      const nextReviewEvents = [...issue.reviewEvents, reviewEvent];
      const nextIsSuspicious = nextDownvotes >= 6;

      if (issue.isRatingFrozen && issue.flaggedReviewBatch) {
        const reviewIds = issue.flaggedReviewBatch.reviewIds.includes(reviewEvent.id)
          ? issue.flaggedReviewBatch.reviewIds
          : [...issue.flaggedReviewBatch.reviewIds, reviewEvent.id];

        return {
          ...issue,
          upvotes: nextUpvotes,
          downvotes: nextDownvotes,
          isSuspicious: nextIsSuspicious,
          reviewEvents: nextReviewEvents,
          flaggedReviewBatch: {
            ...issue.flaggedReviewBatch,
            reviewIds,
            reviewsInBatch: reviewIds.length,
            windowEndedAt: createdAt,
          },
        };
      }

      const spikeMetrics = getReviewSpikeMetrics(issue, nextReviewEvents, nextUpvotes, nextDownvotes, createdAt);
      if (spikeMetrics.shouldFreeze) {
        return {
          ...issue,
          upvotes: nextUpvotes,
          downvotes: nextDownvotes,
          isSuspicious: nextIsSuspicious,
          isRatingFrozen: true,
          reviewEvents: nextReviewEvents,
          flaggedReviewBatch: {
            id: `batch-${issue.id}-${Date.now()}`,
            reviewIds: spikeMetrics.recentReviewEvents.map(review => review.id),
            windowStartedAt: spikeMetrics.recentReviewEvents[0]?.createdAt || createdAt,
            windowEndedAt: createdAt,
            reviewsInBatch: spikeMetrics.recentReviewCount,
            expectedDailyReviews: spikeMetrics.expectedDailyReviews,
            triggerThreshold: spikeMetrics.triggerThreshold,
            frozenScore: issue.overallRatingScore,
          },
        };
      }

      return {
        ...issue,
        upvotes: nextUpvotes,
        downvotes: nextDownvotes,
        isSuspicious: nextIsSuspicious,
        reviewEvents: nextReviewEvents,
        overallRatingScore: calculateIssueRatingScore(nextUpvotes, nextDownvotes),
      };
    }));
  }, []);

  const reviewFlaggedBatch = useCallback((issueId: string, decision: 'approve' | 'reject') => {
    setIssues(prev => prev.map(issue => {
      if (issue.id !== issueId || !issue.flaggedReviewBatch) return issue;

      if (decision === 'approve') {
        return {
          ...issue,
          isRatingFrozen: false,
          overallRatingScore: calculateIssueRatingScore(issue.upvotes, issue.downvotes),
          flaggedReviewBatch: null,
        };
      }

      const flaggedReviewIds = new Set(issue.flaggedReviewBatch.reviewIds);
      const rejectedReviews = issue.reviewEvents.filter(review => flaggedReviewIds.has(review.id));
      const remainingReviewEvents = issue.reviewEvents.filter(review => !flaggedReviewIds.has(review.id));
      const rejectedUpvotes = rejectedReviews.filter(review => review.type === 'upvote').length;
      const rejectedDownvotes = rejectedReviews.filter(review => review.type === 'downvote').length;
      const nextUpvotes = Math.max(0, issue.upvotes - rejectedUpvotes);
      const nextDownvotes = Math.max(0, issue.downvotes - rejectedDownvotes);

      return {
        ...issue,
        upvotes: nextUpvotes,
        downvotes: nextDownvotes,
        isSuspicious: nextDownvotes >= 6,
        overallRatingScore: calculateIssueRatingScore(nextUpvotes, nextDownvotes),
        isRatingFrozen: false,
        flaggedReviewBatch: null,
        reviewEvents: remainingReviewEvents,
      };
    }));
  }, []);

  const addComment = useCallback((comment: Comment) => { setComments(prev => [...prev, comment]); }, []);
  const addDonation = useCallback((donation: Donation) => { setDonations(prev => [donation, ...prev]); }, []);
  const rateContractor = useCallback((issueId: string, rating: number) => {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, contractorRating: rating } : i));
  }, []);
  
  const updateUserProfile = useCallback((profilePic: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, profilePic };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  }, [currentUser]);

  return (
    <AppContext.Provider value={{ users, issues, bids, ngoRequests, donations, comments, currentUser, setCurrentUser, addIssue, updateIssueStatus, updateAfterImage, submitResolutionProof, verifyIssueResolution, addBid, selectBid, addNgoRequest, updateNgoRequest, voteOnIssue, reviewFlaggedBatch, addComment, addDonation, rateContractor, updateUserProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
