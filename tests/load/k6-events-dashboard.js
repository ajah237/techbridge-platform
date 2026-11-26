// k6 load test for TechBridge — events listing, event detail, leaderboard, mentors.
// Run against the PUBLISHED URL (anon traffic only — no auth flows).
//
// Install:  https://k6.io/docs/get-started/installation/
// Run:      BASE_URL=https://techbridgehub.lovable.app k6 run tests/load/k6-events-dashboard.js
// Smoke:    k6 run --vus 1 --iterations 5 tests/load/k6-events-dashboard.js
// Heavy:    k6 run --vus 50 --duration 5m tests/load/k6-events-dashboard.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://techbridgehub.lovable.app';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://rmtusfikecejennwrkxr.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdHVzZmlrZWNlamVubndya3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDI4MjcsImV4cCI6MjA5MDMxODgyN30.MsOFzqEyrZkcSVf4_qjaIV0mnDuWbpxZuEThPcLwyB0';

const eventsApi = new Trend('events_api_ms', true);
const leaderboardApi = new Trend('leaderboard_rpc_ms', true);

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 25 },
        { duration: '2m',  target: 25 },
        { duration: '30s', target: 0  },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    events_api_ms:     ['p(95)<800'],
    leaderboard_rpc_ms:['p(95)<800'],
  },
};

const sbHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export default function () {
  group('public pages', () => {
    const pages = ['/', '/events', '/leaderboard', '/mentors', '/blog'];
    for (const p of pages) {
      const r = http.get(`${BASE_URL}${p}`, { tags: { page: p } });
      check(r, { [`${p} 200`]: (res) => res.status === 200 });
    }
  });

  group('events list api', () => {
    const r = http.get(
      `${SUPABASE_URL}/rest/v1/events?select=*&status=in.(published,ongoing)&order=start_date.asc`,
      { headers: sbHeaders },
    );
    eventsApi.add(r.timings.duration);
    check(r, { 'events 200': (res) => res.status === 200 });

    const events = r.json();
    if (Array.isArray(events) && events.length) {
      const slug = events[Math.floor(Math.random() * events.length)].slug;
      const d = http.get(`${BASE_URL}/events/${slug}`);
      check(d, { 'event detail 200': (res) => res.status === 200 });
    }
  });

  group('leaderboard rpc', () => {
    const r = http.post(
      `${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`,
      JSON.stringify({ limit_n: 50 }),
      { headers: sbHeaders },
    );
    leaderboardApi.add(r.timings.duration);
    check(r, { 'leaderboard 200': (res) => res.status === 200 });
  });

  group('blog list api', () => {
    const r = http.get(
      `${SUPABASE_URL}/rest/v1/blog_posts?select=id,slug,title,published_at,cover_image_url&status=eq.published&order=published_at.desc&limit=20`,
      { headers: sbHeaders },
    );
    check(r, { 'blog 200': (res) => res.status === 200 });
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return { stdout: JSON.stringify(data.metrics, null, 2) };
}