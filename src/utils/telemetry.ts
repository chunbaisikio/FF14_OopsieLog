import { useAppStore } from '../store';

// This is the URL to your deployed Cloudflare Worker.
// It should be injected via environment variables.
const TELEMETRY_ENDPOINT = import.meta.env.VITE_TELEMETRY_ENDPOINT;

/**
 * Sends a telemetry event to the Cloudflare Worker if the user has consented.
 */
export async function sendTelemetryEvent(payload: {
  action: string;
  bossId?: string;
  mechanicId?: string;
  totalPulls?: number;
  mistakeCount?: number;
}) {
  const store = useAppStore.getState();
  
  if (!store.telemetryConsent || !TELEMETRY_ENDPOINT) {
    return; // Do nothing if user hasn't opted in or endpoint is not configured
  }

  // Prevent sending PII - filter out undefined fields
  const safePayload = {
    action: payload.action,
    bossId: payload.bossId || 'unknown',
    mechanicId: payload.mechanicId || '',
    totalPulls: payload.totalPulls || 0,
    mistakeCount: payload.mistakeCount || 0,
  };

  try {
    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Uses keepalive so it sends even if the user navigates away
      keepalive: true,
      body: JSON.stringify(safePayload),
    });
  } catch (err) {
    // Silently fail, telemetry shouldn't interrupt UX
    console.warn('Telemetry failed to send:', err);
  }
}
