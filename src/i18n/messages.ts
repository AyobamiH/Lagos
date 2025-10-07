// Central message catalog (P1 internationalization groundwork)
// Keys are stable identifiers; values are default English strings.
export const MESSAGES: Record<string,string> = {
  // Auth / session
  session_expired: 'Session expired',
  offline: 'You are offline',
  rate_limited: 'Rate limited. Please wait',
  reload_app: 'Reload Application',

  // Ride lifecycle
  lifecycle_arrive_success: 'Arrived',
  lifecycle_start_success: 'Started trip',
  lifecycle_complete_success: 'Completed',
  lifecycle_arrive_queued: 'Lifecycle arrive queued',
  lifecycle_start_queued: 'Lifecycle start queued',
  lifecycle_complete_queued: 'Lifecycle complete queued',

  // Queue
  queued_feedback: 'Queued feedback (offline / limited)',
  duplicate_feedback: 'Duplicate feedback already queued',
  queued_ride_request: 'Queued ride request (offline / limited)',
  duplicate_ride_request: 'Duplicate ride request already queued',
  queued_location_ping: 'Queued location ping',
  queued_action_processed: 'Queued action processed',
  queued_action_dropped: 'Queued action dropped',

  lifecycle_immutable_state: 'Ride no longer mutable',
  concurrent_update_retry: 'Concurrent update detected. Please retry',
  conflict_version: 'Item changed elsewhere – refreshed.',
  payment_method_required: 'Payment method required before continuing',
  expired_quote: 'Quote expired – recalculating',
  quote_mismatch: 'Quote mismatch – fetching new one',
  quote_replay_detected: 'Quote already used – request a fresh quote',

  // Driver offers
  invalid_offer_payload: 'Ignored invalid offer payload',
  invalid_ride_status_event: 'Invalid ride status event ignored',

  // Errors generic
  invalid_coords: 'Invalid coordinates',
  not_authenticated: 'Not authenticated',

  // Realtime
  realtime_connected: 'Realtime connected',
  realtime_disconnected: 'Realtime disconnected - fallback polling active',
  realtime_gap_detected: 'Realtime gap detected',

  // Driver lifecycle actions (additional states)
  lifecycle_arrive_failed: 'Arrive failed',
  lifecycle_start_failed: 'Start failed',
  lifecycle_complete_failed: 'Complete failed',
  lifecycle_arrive_inflight: 'Arriving...',
  lifecycle_start_inflight: 'Starting trip...',
  lifecycle_complete_inflight: 'Completing trip...',

  // Driver acceptance
  ride_accept_success: 'Ride accepted',
  ride_accept_failed: 'Ride accept failed',
  ride_decline_success: 'Ride declined',
  ride_decline_failed: 'Ride decline failed',

  // Rate limit / banners
  rate_limited_banner: 'Rate limited',

  // App / generic UI
  app_error_title: 'Application Error',
  app_mounted: 'App mounted',
  loading: 'Loading...',
};

export function t(key: string, fallback?: string) {
  return MESSAGES[key] || fallback || key;
}
