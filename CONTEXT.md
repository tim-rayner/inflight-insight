# Inflight Insight

Tracks a single real-world flight and plots its flown path on a map, using FlightRadar24 data.

## Language

**Flight Number**:
The user-facing identifier for a flight (e.g. "BA285"), typed into the search box and used to look up whether a flight is currently trackable.
_Avoid_: Callsign, Flight ID — these are distinct, FR24-resolved identifiers, not what the user types.

**Callsign**:
The operational identifier FR24 resolves for a given Flight Number (e.g. "BAW285"). Returned alongside a lookup result but not used for further lookups.
_Avoid_: Flight Number, FR24 ID

**FR24 ID**:
FlightRadar24's internal identifier for one specific flight instance (e.g. "391fdd79"). Required to fetch that flight's Track.
_Avoid_: Callsign, Flight Number

**Track**:
The ordered sequence of recorded positions (Track Points: lat/lon/altitude/speed/timestamp/etc.) for one flight instance, fetched by FR24 ID.

**Tracked Flight Number**:
The single Flight Number persisted in localStorage, representing the flight currently shown on the map. Restored and re-resolved automatically when the app loads. Singular — only one flight is tracked at a time.
_Avoid_: Last searched flight, search history
