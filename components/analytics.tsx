'use client';
import { Analytics } from '@vercel/analytics/react';
import { privateAnalyticsEvent } from '@/lib/analytics-privacy';
export function PrivateAnalytics() {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' ? (
    <Analytics debug={false} beforeSend={privateAnalyticsEvent} />
  ) : null;
}
