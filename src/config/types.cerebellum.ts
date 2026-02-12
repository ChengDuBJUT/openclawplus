export type CerebellumThresholdsConfig = {
  maxEstimatedTime?: number;
  maxComplexity?: number;
  minConfidence?: number;
};

export type CerebellumStatsConfig = {
  enabled?: boolean;
  logPath?: string;
};

export type CerebellumOpenClawConfig = {
  enabled?: boolean;
  provider?: string;
  model?: string;
  baseUrl?: string;
  thresholds?: CerebellumThresholdsConfig;
  forceCerebellumFor?: string[];
  forceCerebrumFor?: string[];
  stats?: CerebellumStatsConfig;
};
