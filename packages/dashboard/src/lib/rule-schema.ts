import { z } from 'zod'

/**
 * Validates that a string is a valid regex pattern.
 */
function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

export const ruleConditionsSchema = z.object({
  url_pattern: z.string().optional(),
  methods: z
    .array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']))
    .optional(),
  payload_patterns: z
    .array(
      z.string().refine(isValidRegex, {
        message: 'Invalid regex pattern',
      }),
    )
    .optional(),
  header_patterns: z.record(z.string()).optional(),
  agent_ids: z.array(z.string().uuid()).optional(),
  risk_score_threshold: z.number().min(0).max(100).optional(),
})

export const ruleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less'),
  description: z.string().max(1000).optional().or(z.literal('')),
  priority: z
    .number({ invalid_type_error: 'Priority must be a number' })
    .int('Priority must be an integer')
    .min(1, 'Priority must be at least 1')
    .max(10000, 'Priority must be 10000 or less'),
  action: z.enum(['ALLOW', 'BLOCK', 'FLAG_FOR_REVIEW', 'MODIFY']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  enabled: z.boolean(),
  conditions: ruleConditionsSchema,
})

export type RuleFormData = z.infer<typeof ruleFormSchema>
export type RuleConditions = z.infer<typeof ruleConditionsSchema>
