export interface StatSummary {
  key: string;
  label: string;
  value: string;
  /** Percent change vs. previous period; sign decides the trend arrow. */
  change: number;
  footnote: string;
}

export interface ActivityPoint {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  attendance: number;
  logins: number;
}

export interface DashboardData {
  stats: StatSummary[];
  activity: ActivityPoint[];
}
