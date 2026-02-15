#!/usr/bin/env node

/**
 * Load test for the Thundergate proxy.
 *
 * Prerequisites:
 *   - Proxy running on localhost:3001
 *   - At least one active agent registered with a known API key
 *   - A target API accessible (or use the proxy health endpoint)
 *
 * Usage:
 *   node scripts/load-test.mjs [--api-key <key>] [--duration <seconds>] [--connections <n>]
 *
 * Targets: 500 req/s sustained for ALLOW path.
 */

import autocannon from 'autocannon'

const PROXY_URL = process.env.TG_PROXY_URL ?? 'http://localhost:3001'
const API_KEY = process.argv.includes('--api-key')
  ? process.argv[process.argv.indexOf('--api-key') + 1]
  : process.env.TG_LOAD_TEST_API_KEY ?? 'test-key'
const DURATION = process.argv.includes('--duration')
  ? parseInt(process.argv[process.argv.indexOf('--duration') + 1])
  : 10
const CONNECTIONS = process.argv.includes('--connections')
  ? parseInt(process.argv[process.argv.indexOf('--connections') + 1])
  : 100

console.log('=== Thundergate Load Test ===')
console.log(`Target:       ${PROXY_URL}`)
console.log(`Duration:     ${DURATION}s`)
console.log(`Connections:  ${CONNECTIONS}`)
console.log('')

// Test 1: Health endpoint (baseline)
console.log('--- Test 1: Health endpoint (baseline) ---')
const healthResult = await autocannon({
  url: `${PROXY_URL}/health`,
  connections: CONNECTIONS,
  duration: DURATION,
})
console.log(autocannon.printResult(healthResult))
console.log('')

// Test 2: Proxy ALLOW path (requires valid API key + target)
console.log('--- Test 2: Proxy ALLOW path ---')
const proxyResult = await autocannon({
  url: `${PROXY_URL}/proxy/test`,
  connections: CONNECTIONS,
  duration: DURATION,
  headers: {
    'X-Agent-Key': API_KEY,
    'X-Target-URL': `${PROXY_URL}`, // Forward to self (health endpoint)
    'Content-Type': 'application/json',
  },
  method: 'POST',
  body: JSON.stringify({ test: true, message: 'load test payload' }),
})
console.log(autocannon.printResult(proxyResult))
console.log('')

// Summary
console.log('=== Summary ===')
console.log(`Health endpoint:  ${healthResult.requests.average} req/s avg`)
console.log(`Proxy ALLOW path: ${proxyResult.requests.average} req/s avg`)
console.log(`Target: 500 req/s`)
console.log(
  `Status: ${proxyResult.requests.average >= 500 ? '✅ PASS' : '⚠️  Below target (may need tuning)'}`,
)
