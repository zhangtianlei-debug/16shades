import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AccountError,
  accountRequest,
  readAccount,
  watchAccountChanges,
} from './account-api.ts';

const accountPayload = {
  user: null,
  saved: null,
  csrfToken: 'csrf-test',
  config: {
    analyticsEnabled: false,
    baiduSiteId: '',
    version: 'test',
  },
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('a stale session response cannot replace a newer authentication state', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const requests = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem() {} },
  });
  globalThis.fetch = () => new Promise((resolve) => requests.push({ resolve }));
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
  });

  const firstSession = readAccount();
  assert.strictEqual(readAccount(), firstSession);
  assert.equal(requests.length, 1);

  const logout = accountRequest('/api/auth/logout', {});
  assert.equal(requests.length, 2);
  requests[1].resolve(jsonResponse(accountPayload));
  await logout;

  requests[0].resolve(jsonResponse(accountPayload));
  await assert.rejects(
    firstSession,
    (error) => error instanceof AccountError && error.code === 'SESSION_STALE',
  );

  const refreshed = readAccount();
  assert.equal(requests.length, 3);
  requests[2].resolve(jsonResponse(accountPayload));
  await refreshed;
});

test('returning to a tab rejects a pre-switch session when storage events are unavailable', async (t) => {
  const originalFetch = globalThis.fetch;
  const descriptors = Object.fromEntries(
    ['window', 'document', 'localStorage'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const page = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: new EventTarget(),
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: page,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage unavailable');
    },
  });
  const requests = [];
  globalThis.fetch = () => new Promise((resolve) => requests.push({ resolve }));
  let refreshed;
  const unwatch = watchAccountChanges((reason) => {
    assert.equal(reason, 'visible');
    refreshed = readAccount();
  });
  t.after(() => {
    unwatch();
    globalThis.fetch = originalFetch;
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });

  const older = readAccount();
  const stale = assert.rejects(
    older,
    (error) => error instanceof AccountError && error.code === 'SESSION_STALE',
  );
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests.length, 1, 'hidden pages do not refresh');
  page.visibilityState = 'visible';
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests.length, 2, 'returning starts a fresh request');
  assert.notStrictEqual(refreshed, older);
  requests[1].resolve(
    jsonResponse({
      ...accountPayload,
      user: { id: 'new-account', username: 'new-user' },
    }),
  );
  assert.equal((await refreshed).user.id, 'new-account');
  requests[0].resolve(
    jsonResponse({
      ...accountPayload,
      user: { id: 'old-account', username: 'old-user' },
    }),
  );
  await stale;
});

test('returning during registration preserves success and rejects reads made with the old cookie', async (t) => {
  const originalFetch = globalThis.fetch;
  const descriptors = Object.fromEntries(
    ['window', 'document', 'localStorage'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  for (const [name, value] of Object.entries({
    window: new EventTarget(),
    document: page,
  })) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage unavailable');
    },
  });
  const requests = [];
  globalThis.fetch = (url, options) =>
    new Promise((resolve) => requests.push({ url, options, resolve }));
  let sessionDuringRegistration;
  const unwatch = watchAccountChanges(() => {
    sessionDuringRegistration = readAccount();
  });
  t.after(() => {
    unwatch();
    globalThis.fetch = originalFetch;
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });

  const registration = accountRequest('/api/auth/register', {
    username: 'test-only',
  });
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests.length, 2);
  const staleSession = assert.rejects(
    sessionDuringRegistration,
    (error) => error instanceof AccountError && error.code === 'SESSION_STALE',
  );
  requests[0].resolve(
    jsonResponse({
      ...accountPayload,
      csrfToken: 'new-account-csrf',
      user: { id: 'registered-account', username: 'test-only' },
    }),
  );
  assert.equal((await registration).user.id, 'registered-account');
  requests[1].resolve(
    jsonResponse({ ...accountPayload, csrfToken: 'old-guest-csrf' }),
  );
  await staleSession;

  const save = accountRequest('/api/results/latest', { test: true }, 'PUT');
  assert.equal(requests[2].options.headers['X-CSRF-Token'], 'new-account-csrf');
  requests[2].resolve(jsonResponse({ saved: null }));
  await save;
});
