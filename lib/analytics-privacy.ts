import type { BeforeSendEvent } from '@vercel/analytics/react';
export function privateAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/^\/(fill|review)\/[^/]+/, '/$1/session');
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
