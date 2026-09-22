'use client';

import { useEffect } from 'react';
import { analyticsPreference } from '@/app/prototype/account-api';

const USER_KEY = 'shadow16-anonymous-user';
const SESSION_KEY = 'shadow16-anonymous-session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
// This candidate has no production analytics host. Account analytics remains
// opt-in and additionally requires the empty-by-default ENV site identifier.
const TRACKED_HOSTS = new Set<string>();

function randomId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function readOrCreateUser() {
  try {
    const existing = localStorage.getItem(USER_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(USER_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

function readOrCreateSession(now: number) {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const existing = raw
      ? (JSON.parse(raw) as { id?: string; lastSeen?: number })
      : null;
    const id =
      existing?.id &&
      existing.lastSeen &&
      now - existing.lastSeen <= SESSION_TIMEOUT_MS
        ? existing.id
        : randomId();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }));
    return id;
  } catch {
    return randomId();
  }
}

function pageName(pathname: string) {
  if (pathname === '/') return 'home';
  if (pathname === '/quiz' || pathname === '/quiz/') return 'quiz';
  if (pathname.startsWith('/result/')) return 'result';
  return null;
}

function track(uid: string, sid: string, event: string, page: string) {
  const query = new URLSearchParams({ eid: randomId(), uid, sid, event, page });
  void fetch(`/__track?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
  }).catch(() => undefined);
}

export function AnalyticsBeacon() {
  useEffect(() => {
    if (!analyticsPreference()) return;
    if (!TRACKED_HOSTS.has(window.location.hostname)) return;
    const page = pageName(window.location.pathname);
    if (!page) return;

    const now = Date.now();
    const uid = readOrCreateUser();
    const sid = readOrCreateSession(now);
    track(uid, sid, 'pageview', page);
    if (page === 'quiz') track(uid, sid, 'test_start', page);
    if (page === 'result') track(uid, sid, 'test_complete', page);
  }, []);

  return null;
}
