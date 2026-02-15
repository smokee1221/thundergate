export interface RequestContext {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
}

export type RuleAction = 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface RuleConditions {
  url_pattern?: string
  methods?: string[]
  payload_patterns?: string[]
  header_patterns?: Record<string, string>
  agent_ids?: string[]
  risk_score_threshold?: number
}

export interface Rule {
  id: string
  name: string
  priority: number
  conditions: RuleConditions
  action: RuleAction
  severity: Severity
  enabled: boolean
}

export interface MatchResult {
  matched: boolean
  rule: Rule
  reasons: string[]
}

export interface EvaluationResult {
  decision: RuleAction
  riskScore: number
  matchedRules: MatchResult[]
  reasons: string[]
}
