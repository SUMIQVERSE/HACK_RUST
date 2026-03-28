import { Issue } from '../context/AppContext';

export interface StateQualityRating {
  state: string;
  totalIssues: number;
  resolvedIssues: number;
  unresolvedIssues: number;
  awaitingVerificationIssues: number;
  suspiciousIssues: number;
  averageRating: number;
  resolutionRate: number;
  trustRate: number;
  qualityScore: number;
  qualityBand: 'Excellent' | 'Strong' | 'Fair' | 'Needs Attention';
}

const roundToSingleDecimal = (value: number) => Math.round(value * 10) / 10;

const getQualityBand = (qualityScore: number): StateQualityRating['qualityBand'] => {
  if (qualityScore >= 85) return 'Excellent';
  if (qualityScore >= 70) return 'Strong';
  if (qualityScore >= 55) return 'Fair';
  return 'Needs Attention';
};

export function getStateQualityRatings(issues: Issue[]): StateQualityRating[] {
  const issuesByState = issues.reduce<Record<string, Issue[]>>((groups, issue) => {
    if (!groups[issue.state]) {
      groups[issue.state] = [];
    }
    groups[issue.state].push(issue);
    return groups;
  }, {});

  return Object.entries(issuesByState)
    .map(([state, stateIssues]) => {
      const totalIssues = stateIssues.length;
      const resolvedIssues = stateIssues.filter(issue => issue.status === 'resolved').length;
      const awaitingVerificationIssues = stateIssues.filter(issue => issue.status === 'awaiting_citizen_verification').length;
      const unresolvedIssues = totalIssues - resolvedIssues;
      const suspiciousIssues = stateIssues.filter(issue => issue.isSuspicious).length;
      const ratingSource = stateIssues.filter(issue => issue.status === 'resolved');
      const ratingPool = ratingSource.length > 0 ? ratingSource : stateIssues;
      const averageRating =
        ratingPool.length === 0
          ? 0
          : ratingPool.reduce((sum, issue) => sum + (issue.contractorRating ?? issue.overallRatingScore ?? 0), 0) / ratingPool.length;

      const resolutionRate = totalIssues === 0 ? 0 : resolvedIssues / totalIssues;
      const trustRate = totalIssues === 0 ? 1 : Math.max(0, 1 - suspiciousIssues / totalIssues);
      const waitingPenalty = totalIssues === 0 ? 0 : awaitingVerificationIssues / totalIssues;
      const satisfactionScore = Math.min(1, Math.max(0, averageRating / 5));
      const weightedBaseScore =
        resolutionRate * 0.5 +
        satisfactionScore * 0.25 +
        trustRate * 0.15 +
        (1 - waitingPenalty) * 0.1;
      const sampleConfidence = Math.min(1, totalIssues / 4);
      const qualityScore = roundToSingleDecimal(weightedBaseScore * 100 * sampleConfidence + 50 * (1 - sampleConfidence));

      return {
        state,
        totalIssues,
        resolvedIssues,
        unresolvedIssues,
        awaitingVerificationIssues,
        suspiciousIssues,
        averageRating: roundToSingleDecimal(averageRating),
        resolutionRate: roundToSingleDecimal(resolutionRate * 100),
        trustRate: roundToSingleDecimal(trustRate * 100),
        qualityScore,
        qualityBand: getQualityBand(qualityScore),
      };
    })
    .sort((left, right) => right.qualityScore - left.qualityScore || right.averageRating - left.averageRating || right.resolvedIssues - left.resolvedIssues);
}
