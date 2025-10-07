import { describe, it, expect } from 'vitest';
import { MESSAGES } from '../i18n/messages';

// Simple heuristic scan: collect hard-coded keys we know we use programmatically
// Dynamic lifecycle keys use pattern lifecycle_<op>_queued / _failed / _success
const REQUIRED_KEYS = [
  'app_error_title','reload_app','app_mounted','loading',
  'queued_feedback','duplicate_feedback','queued_ride_request','duplicate_ride_request','queued_location_ping','queued_action_processed',
  'realtime_connected','realtime_disconnected','invalid_ride_status_event','realtime_gap_detected',
  'ride_accept_success','ride_accept_failed','ride_decline_success','ride_decline_failed',
  'lifecycle_arrive_queued','lifecycle_start_queued','lifecycle_complete_queued',
  'lifecycle_arrive_failed','lifecycle_start_failed','lifecycle_complete_failed',
  'lifecycle_arrive_success','lifecycle_start_success','lifecycle_complete_success',
  'rate_limited_banner'
];

describe('i18n message catalog coverage', () => {
  it('contains all required keys', () => {
    const missing = REQUIRED_KEYS.filter(k => !Object.prototype.hasOwnProperty.call(MESSAGES, k));
    expect(missing).toEqual([]);
  });
});
