/**
 * k6 Load Testing Script — Mission Control Baseline
 *
 * Usage:
 *   k6 run scripts/load-test.js
 *   k6 run --vus 20 --duration 60s scripts/load-test.js
 *   K6_BASE_URL=http://production:4000 k6 run scripts/load-test.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency', true);
const apiLatency = new Trend('api_latency', true);

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.MC_API_TOKEN || '';

const defaultHeaders = AUTH_TOKEN
  ? { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' };

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Ramp up to 5 VUs
    { duration: '30s', target: 10 },   // Hold at 10 VUs
    { duration: '10s', target: 20 },   // Spike to 20 VUs
    { duration: '20s', target: 10 },   // Back to 10 VUs
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95th < 500ms, 99th < 1s
    errors: ['rate<0.05'],                            // Error rate < 5%
    health_latency: ['p(95)<100'],                    // Health check < 100ms p95
  },
};

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      'health status 200': (r) => r.status === 200,
      'health body has status': (r) => {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('List Agents', () => {
    const res = http.get(`${BASE_URL}/api/agents`, { headers: defaultHeaders });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'agents status 200': (r) => r.status === 200,
      'agents returns array': (r) => Array.isArray(JSON.parse(r.body)),
    });
    errorRate.add(!ok);
  });

  sleep(0.3);

  group('List Tasks', () => {
    const res = http.get(`${BASE_URL}/api/tasks`, { headers: defaultHeaders });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'tasks status 200': (r) => r.status === 200,
      'tasks returns array': (r) => Array.isArray(JSON.parse(r.body)),
    });
    errorRate.add(!ok);
  });

  sleep(0.3);

  group('List Workspaces', () => {
    const res = http.get(`${BASE_URL}/api/workspaces`, { headers: defaultHeaders });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'workspaces status 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Metrics Overview', () => {
    const res = http.get(`${BASE_URL}/api/metrics/overview`, { headers: defaultHeaders });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'metrics status 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Events Polling', () => {
    const res = http.get(`${BASE_URL}/api/events`, { headers: defaultHeaders });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'events status 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: data.metrics.http_reqs?.values?.count || 0,
    avgDuration: data.metrics.http_req_duration?.values?.avg?.toFixed(2) || '0',
    p95Duration: data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || '0',
    p99Duration: data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || '0',
    errorRate: ((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2) + '%',
    healthP95: data.metrics.health_latency?.values?.['p(95)']?.toFixed(2) || '0',
  };

  console.log('\n=== MISSION CONTROL LOAD TEST SUMMARY ===');
  console.log(`Requests:    ${summary.totalRequests}`);
  console.log(`Avg Latency: ${summary.avgDuration}ms`);
  console.log(`P95 Latency: ${summary.p95Duration}ms`);
  console.log(`P99 Latency: ${summary.p99Duration}ms`);
  console.log(`Error Rate:  ${summary.errorRate}`);
  console.log(`Health P95:  ${summary.healthP95}ms`);
  console.log('==========================================\n');

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
