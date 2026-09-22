import type { TrackPoint } from "@/features/flight-track/lib/getFlightTrack";

// The plane's last known location on a Track: the most recently recorded
// Track Point. Distinct from the map marker, which dead-reckons forward
// from this checkpoint between polls.
export function currentTrackPoint(track: TrackPoint[]): TrackPoint | undefined {
  return track.at(-1);
}
