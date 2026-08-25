type TelemetryValue = string | number | boolean | null;
type TelemetryPayload = Record<string, TelemetryValue> & { type: string };

const PERFORMANCE_ENDPOINT = import.meta.env.VITE_PERFORMANCE_ENDPOINT as string | undefined;
const RELEASE = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'local';
const sentEvents = new Set<string>();
let initialized = false;

function compactError(error: unknown): { message: string; name: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack?.slice(0, 2000) };
  }
  return { message: String(error), name: 'UnknownError' };
}

function report(payload: TelemetryPayload, dedupeKey?: string): void {
  if (dedupeKey && sentEvents.has(dedupeKey)) return;
  if (dedupeKey) sentEvents.add(dedupeKey);

  const enriched = {
    ...payload,
    release: RELEASE,
    path: typeof window !== 'undefined' ? window.location.pathname : null,
    timestamp: new Date().toISOString(),
  };

  if (import.meta.env.DEV) console.info('[BoxLink telemetry]', enriched);
  if (!PERFORMANCE_ENDPOINT || typeof navigator === 'undefined') return;

  try {
    const body = JSON.stringify(enriched);
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(PERFORMANCE_ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(PERFORMANCE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Observabilidade nunca pode afetar a aplicação principal.
  }
}

export function reportClientError(error: unknown, context?: string): void {
  const normalized = compactError(error);
  report({
    type: 'client_error',
    error_name: normalized.name,
    error_message: normalized.message.slice(0, 500),
    error_stack: normalized.stack ?? null,
    context: context ?? null,
  });
}

export function reportRouteView(pathname: string): void {
  report({ type: 'route_view', route: pathname }, `route:${pathname}`);
}

export function reportVital(name: string, value: number, rating?: string): void {
  report({ type: 'web_vital', metric: name, value: Math.round(value * 100) / 100, rating: rating ?? null });
}

function observeVitals(): void {
  if (typeof PerformanceObserver === 'undefined') return;

  const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (entry) callback(entry);
      });
      observer.observe({ type, buffered: true });
    } catch {
      // O navegador pode não oferecer todos os tipos de entrada.
    }
  };

  observe('largest-contentful-paint', (entry) => reportVital('LCP', entry.startTime));
  observe('first-input', (entry) => {
    const firstInput = entry as PerformanceEventTiming;
    reportVital('FID', firstInput.processingStart - firstInput.startTime);
  });
  observe('layout-shift', (entry) => {
    const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
    if (!shift.hadRecentInput) reportVital('CLS', shift.value ?? 0);
  });
}

function reportNavigationTiming(): void {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!navigation) return;
  report({
    type: 'navigation_timing',
    dns_ms: Math.max(0, navigation.domainLookupEnd - navigation.domainLookupStart),
    connect_ms: Math.max(0, navigation.connectEnd - navigation.connectStart),
    ttfb_ms: Math.max(0, navigation.responseStart - navigation.requestStart),
    dom_interactive_ms: Math.max(0, navigation.domInteractive - navigation.startTime),
    dom_complete_ms: Math.max(0, navigation.domComplete - navigation.startTime),
    transfer_bytes: navigation.transferSize,
  }, `navigation:${navigation.startTime}`);
}

export function initObservability(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => reportClientError(event.error ?? event.message, 'window.error'));
  window.addEventListener('unhandledrejection', (event) => reportClientError(event.reason, 'unhandledrejection'));
  observeVitals();

  const onLoad = () => window.setTimeout(reportNavigationTiming, 0);
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
}
