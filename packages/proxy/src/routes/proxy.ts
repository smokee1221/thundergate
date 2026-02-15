import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { evaluate } from '@thundergate/engine'
import type { RequestContext } from '@thundergate/engine'
import { getActiveRules } from '../services/rule-cache.js'
import { writeAuditLog } from '../services/audit.js'
import { forwardRequest } from '../services/forwarder.js'
import { enqueue } from '../services/queue.js'
import { holdManager } from '../services/connection-hold.js'

/**
 * Catch-all proxy route.
 *
 * Flow:
 * 1. Extract target URL from X-Target-URL header
 * 2. Build RequestContext for the engine
 * 3. Evaluate against active rules
 * 4. Route based on decision:
 *    - ALLOW → forward to target, log, return response
 *    - BLOCK → return 403, log
 *    - FLAG_FOR_REVIEW → enqueue to HITL, hold connection, wait for decision
 *    - MODIFY → placeholder (treated as ALLOW for MVP)
 *
 * Agents can send X-Firewall-Mode: async to get an immediate 202
 * instead of holding the connection for FLAG_FOR_REVIEW decisions.
 */
export const proxyRoute: FastifyPluginAsync = async (server) => {
  server.all('/proxy/*', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now()

    // 1. Extract target URL
    const targetUrl = request.headers['x-target-url']
    if (!targetUrl || typeof targetUrl !== 'string') {
      reply.code(400).send({
        error: {
          code: 'MISSING_TARGET_URL',
          message: 'X-Target-URL header is required',
        },
      })
      return
    }

    // 2. Build the proxy path — strip /proxy prefix
    const proxyPath = (request.url as string).replace(/^\/proxy/, '')
    const fullTargetUrl = `${targetUrl.replace(/\/$/, '')}${proxyPath}`

    // 3. Build RequestContext for engine
    const requestHeaders: Record<string, string | string[] | undefined> = {}
    for (const [key, value] of Object.entries(request.headers)) {
      requestHeaders[key] = value
    }

    const engineRequest: RequestContext = {
      method: request.method,
      url: fullTargetUrl,
      headers: requestHeaders,
      body: request.body as unknown,
    }

    // 4. Evaluate against rules
    const rules = await getActiveRules()
    const evaluation = evaluate(engineRequest, rules)

    const agentId = request.agentId!
    const primaryRuleId =
      evaluation.matchedRules.length > 0
        ? evaluation.matchedRules[0]!.rule.id
        : undefined

    // 5. Route based on decision
    if (evaluation.decision === 'BLOCK') {
      const latencyMs = Date.now() - startTime

      // Write audit log asynchronously — don't block the response
      writeAuditLog({
        agentId,
        ruleId: primaryRuleId,
        requestMethod: request.method,
        requestUrl: fullTargetUrl,
        requestHeaders: requestHeaders as Record<string, unknown>,
        requestPayload: request.body as unknown,
        riskScore: evaluation.riskScore,
        engineDecision: 'BLOCK',
        finalPayload: request.body ?? {},
        latencyMs,
      }).catch((err) => request.log.error(err, 'Failed to write audit log'))

      reply.code(403).send({
        error: {
          code: 'BLOCKED_BY_RULE',
          message: 'Request blocked by firewall rule',
          ruleId: primaryRuleId,
          riskScore: evaluation.riskScore,
          reasons: evaluation.reasons,
        },
      })
      return
    }

    if (evaluation.decision === 'FLAG_FOR_REVIEW') {
      const latencyMs = Date.now() - startTime

      // Write audit log for the flagged request
      const auditId = await writeAuditLog({
        agentId,
        ruleId: primaryRuleId,
        requestMethod: request.method,
        requestUrl: fullTargetUrl,
        requestHeaders: requestHeaders as Record<string, unknown>,
        requestPayload: request.body as unknown,
        riskScore: evaluation.riskScore,
        engineDecision: 'FLAG_FOR_REVIEW',
        finalPayload: request.body ?? {},
        latencyMs,
      })

      // Enqueue to HITL queue
      const queueId = await enqueue(auditId)

      request.log.info(
        { queueId, auditId, riskScore: evaluation.riskScore },
        'Request queued for human review',
      )

      // Async mode: agent opts out of connection hold
      const firewallMode = request.headers['x-firewall-mode']
      if (firewallMode === 'async') {
        reply.code(202).send({
          status: 'QUEUED_FOR_REVIEW',
          queueId,
          auditLogId: auditId,
          riskScore: evaluation.riskScore,
          reasons: evaluation.reasons,
          message: 'Request flagged for human review',
        })
        return
      }

      // Hold connection and wait for operator decision
      const resolution = await holdManager.hold(queueId)

      if (resolution.status === 'APPROVED') {
        try {
          const forwardHeaders: Record<string, string | undefined> = {}
          for (const [key, value] of Object.entries(request.headers)) {
            forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value
          }
          const response = await forwardRequest({
            method: request.method,
            url: fullTargetUrl,
            headers: forwardHeaders,
            body: request.body as unknown,
          })
          reply.code(response.status).send(response.body)
        } catch {
          reply.code(502).send({
            error: {
              code: 'TARGET_UNREACHABLE',
              message: 'Failed to reach target API after approval',
            },
          })
        }
        return
      }

      if (resolution.status === 'MODIFIED') {
        const payload = resolution.modifiedPayload ?? request.body
        try {
          const forwardHeaders: Record<string, string | undefined> = {}
          for (const [key, value] of Object.entries(request.headers)) {
            forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value
          }
          const response = await forwardRequest({
            method: request.method,
            url: fullTargetUrl,
            headers: forwardHeaders,
            body: payload as unknown,
          })
          reply.code(response.status).send(response.body)
        } catch {
          reply.code(502).send({
            error: {
              code: 'TARGET_UNREACHABLE',
              message: 'Failed to reach target API after modification',
            },
          })
        }
        return
      }

      if (resolution.status === 'REJECTED' || resolution.status === 'EXPIRED') {
        reply.code(403).send({
          error: {
            code: 'REJECTED_BY_OPERATOR',
            message:
              resolution.status === 'EXPIRED'
                ? 'Request expired without operator decision'
                : 'Request rejected by human operator',
            queueId,
          },
        })
        return
      }

      // TIMEOUT or SHUTDOWN
      reply.code(408).send({
        error: {
          code: 'REVIEW_TIMEOUT',
          message: 'Request timed out waiting for human review',
          queueId,
        },
      })
      return
    }

    // ALLOW (and MODIFY — treated as ALLOW for MVP)
    try {
      const forwardHeaders: Record<string, string | undefined> = {}
      for (const [key, value] of Object.entries(request.headers)) {
        forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value
      }

      const response = await forwardRequest({
        method: request.method,
        url: fullTargetUrl,
        headers: forwardHeaders,
        body: request.body as unknown,
      })

      const latencyMs = Date.now() - startTime

      // Write audit log asynchronously
      writeAuditLog({
        agentId,
        ruleId: primaryRuleId,
        requestMethod: request.method,
        requestUrl: fullTargetUrl,
        requestHeaders: requestHeaders as Record<string, unknown>,
        requestPayload: request.body as unknown,
        riskScore: evaluation.riskScore,
        engineDecision: evaluation.decision,
        finalPayload: request.body ?? {},
        responseStatus: response.status,
        responseBody: response.body,
        latencyMs,
      }).catch((err) => request.log.error(err, 'Failed to write audit log'))

      reply.code(response.status).send(response.body)
    } catch (err) {
      const latencyMs = Date.now() - startTime

      writeAuditLog({
        agentId,
        ruleId: primaryRuleId,
        requestMethod: request.method,
        requestUrl: fullTargetUrl,
        requestHeaders: requestHeaders as Record<string, unknown>,
        requestPayload: request.body as unknown,
        riskScore: evaluation.riskScore,
        engineDecision: evaluation.decision,
        finalPayload: request.body ?? {},
        responseStatus: 502,
        latencyMs,
      }).catch((logErr) =>
        request.log.error(logErr, 'Failed to write audit log'),
      )

      reply.code(502).send({
        error: {
          code: 'TARGET_UNREACHABLE',
          message: 'Failed to reach target API',
        },
      })
    }
  })
}
