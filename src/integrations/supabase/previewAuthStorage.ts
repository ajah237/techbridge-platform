// Safe preview auth storage broker with fallbacks for blocked third-party storage.

/** Storage accepted by Supabase's `auth.storage` option; `localStorage` and the editor broker both satisfy it. */
export interface PreviewAuthStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

type BrokerRequestType = 'lovable-preview-auth:get' | 'lovable-preview-auth:set' | 'lovable-preview-auth:remove';

interface BrokerRequest {
  type: BrokerRequestType;
  requestId: string;
  projectId: string;
  key: string;
  value?: string;
}

interface BrokerReply {
  ok: boolean;
  value: string | null;
}

const RESULT = 'lovable-preview-auth:result';

function readBrokerReply(data: unknown, requestId: string): BrokerReply | null {
  if (typeof data !== 'object' || data === null) return null;
  if (!('type' in data) || data.type !== RESULT) return null;
  if (!('requestId' in data) || data.requestId !== requestId) return null;
  return {
    ok: 'ok' in data && Boolean(data.ok),
    value: 'value' in data && typeof data.value === 'string' ? data.value : null,
  };
}

const memoryFallback = new Map<string, string>();

const readLocal = (key: string): string | null | undefined => {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? undefined;
  }
};

const writeLocal = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
};

const removeLocal = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore blocked storage */
  }
  memoryFallback.delete(key);
};

const safeLocalStorage: PreviewAuthStorage = {
  getItem: (key) => readLocal(key) ?? null,
  setItem: (key, value) => writeLocal(key, value),
  removeItem: (key) => removeLocal(key),
};

function safeReferrerOrigin(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : '';
  } catch {
    return '';
  }
}

/**
 * On a Lovable preview surface, broker the auth session to the editor over
 * postMessage so the project's preview surfaces share one login; else safeLocalStorage.
 */
export function brokeredPreviewStorage(): PreviewAuthStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = location.hostname;
  const PREVIEW_ZONES = ['lovableproject.com', 'lovableproject-dev.com', 'lovable.app', 'gpt-eng.com', 'gptengineer.run'];
  const onPreviewZone = PREVIEW_ZONES.some((z) => host === z || host.endsWith('.' + z));
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const projectId = onPreviewZone
    ? (new RegExp('^(?:id-preview(?:-[a-z0-9]+)?|project)--(' + UUID + ')(?:-dev)?(?=\\.|$)', 'i').exec(host)?.[1]
        ?? new RegExp('^live--(' + UUID + ')(?:-thr_[a-z0-9]+)?(?=\\.|$)', 'i').exec(host)?.[1]
        ?? new RegExp('^(' + UUID + ')(?=[.-])', 'i').exec(host)?.[1])
    : undefined;
  const parentWindow = window.parent as Window | null;
  const framed = parentWindow !== null && parentWindow !== window;
  if (!projectId || !framed) return safeLocalStorage;

  const dev = host.endsWith('.lovableproject-dev.com') || host.endsWith('.gpt-eng.com');
  const EDITOR = dev
    ? /^https:\/\/([a-z0-9-]+\.)*(lovable\.dev|gptengineer\.app)$|^http:\/\/localhost:3000$/
    : /^https:\/\/([a-z0-9-]+\.)*(lovable\.dev|gptengineer\.app)$/;
  const ancestorOrigins = location.ancestorOrigins as DOMStringList | undefined;
  const ancestor = ancestorOrigins?.[0] ?? safeReferrerOrigin();
  const editorOrigins = ancestor && EDITOR.test(ancestor)
    ? [ancestor]
    : (dev ? ['https://lovable.dev', 'http://localhost:3000'] : ['https://lovable.dev']);
  const TIMEOUT = 2000;
  const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const request = (type: BrokerRequestType, key: string, value?: string): Promise<BrokerReply | null> =>
    new Promise((resolve) => {
      const requestId = newId();
      let done = false;
      const finish = (reply: BrokerReply | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(reply);
      };
      const onMessage = (e: MessageEvent<unknown>) => {
        if (!editorOrigins.includes(e.origin)) return;
        const reply = readBrokerReply(e.data, requestId);
        if (reply) finish(reply);
      };
      window.addEventListener('message', onMessage);
      const timer = setTimeout(() => { finish(null); }, TIMEOUT);
      const msg: BrokerRequest = { type, requestId, projectId, key };
      if (value !== undefined) msg.value = value;
      for (const origin of editorOrigins) window.parent.postMessage(msg, origin);
    });

  let firstGet = true;
  const RETRY_DELAY = 250;

  return {
    getItem: async (key) => {
      const local = readLocal(key);
      let res = await request('lovable-preview-auth:get', key, local ?? undefined);
      if (!res && firstGet) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY));
        res = await request('lovable-preview-auth:get', key, local ?? undefined);
      }
      firstGet = false;
      if (res?.ok && res.value !== null) {
        if (res.value === '') {
          if (local !== undefined && readLocal(key) === local) removeLocal(key);
          return null;
        }
        if (local === null && readLocal(key) === null) {
          writeLocal(key, res.value);
        }
        return res.value;
      }
      return readLocal(key) ?? null;
    },
    setItem: (key, value) => {
      writeLocal(key, value);
      return request('lovable-preview-auth:set', key, value).then((res) => {
        if (res?.ok && res.value !== null && readLocal(key) === value) {
          if (res.value === '') removeLocal(key);
          else writeLocal(key, res.value);
        }
      });
    },
    removeItem: (key) => {
      const local = readLocal(key);
      removeLocal(key);
      return request('lovable-preview-auth:remove', key, local ?? undefined).then(() => {});
    },
  };
}
