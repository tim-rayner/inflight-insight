"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Airplane,
  AirplaneTakeoff,
  ArrowsVertical,
  Broadcast,
  Compass,
  Gauge,
  MapPin,
  Path,
  Minus,
  Timer,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react";
import type { TrackPoint } from "@/app/actions/flightTrack";
import type { FlightSummaryRecord } from "@/lib/fr24/callsign";
import {
  compassDirection,
  formatDurationShort,
  formatSecondsAgo,
  trackDistanceNm,
  verticalRateStatus,
} from "@/lib/flightTracking/telemetry";

interface FlightTelemetryPanelProps {
  flightNumber: string;
  track: TrackPoint[];
  record: FlightSummaryRecord | null;
}

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function TelemetryField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 text-white/50">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] leading-tight text-white/50">{label}</div>
        <div className="truncate font-mono text-xs leading-tight text-white">{value}</div>
      </div>
    </div>
  );
}

export default function FlightTelemetryPanel({ flightNumber, track, record }: FlightTelemetryPanelProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const current = track[track.length - 1];
  const first = track[0];

  const departedIso = record?.datetime_takeoff ?? first.timestamp;
  const departedDate = new Date(departedIso);
  const elapsedMs = now - departedDate.getTime();
  const distanceNm = trackDistanceNm(track);
  const elapsedHours = elapsedMs / 3_600_000;
  const avgSpeedKt = elapsedHours > 0.01 ? distanceNm / elapsedHours : current.gspeed;

  const vertical = verticalRateStatus(current.vspeed);
  const VerticalIcon = vertical === "climbing" ? TrendUp : vertical === "descending" ? TrendDown : Minus;
  const verticalLabel =
    vertical === "level" ? "Level" : `${vertical === "climbing" ? "+" : ""}${NUMBER_FORMAT.format(current.vspeed)} ft/min`;

  const callsign = record?.callsign;
  const showCallsign = callsign && callsign.toUpperCase() !== flightNumber.toUpperCase();

  const route = record?.orig_icao && record?.dest_icao ? `${record.orig_icao} → ${record.dest_icao}` : null;

  const lastUpdateMs = now - new Date(current.timestamp).getTime();

  return (
    <div className="absolute bottom-4 left-4 z-10 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-black/70 p-3 text-sm text-white shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          <Airplane size={14} weight="fill" className="shrink-0 text-sky-400" />
          <span className="truncate">
            {flightNumber}
            {showCallsign ? ` · ${callsign}` : ""}
          </span>
        </div>
        {route && <span className="shrink-0 font-mono text-xs text-white/70">{route}</span>}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 max-[420px]:grid-cols-1">
        <TelemetryField
          icon={<Gauge size={13} />}
          label="Ground speed"
          value={`${NUMBER_FORMAT.format(current.gspeed)} kt`}
        />
        <TelemetryField
          icon={<ArrowsVertical size={13} />}
          label="Altitude"
          value={`${NUMBER_FORMAT.format(current.alt)} ft`}
        />
        <TelemetryField icon={<VerticalIcon size={13} />} label="Vertical rate" value={verticalLabel} />
        <TelemetryField
          icon={<Compass size={13} />}
          label="Heading"
          value={`${Math.round(current.track)}° ${compassDirection(current.track)}`}
        />
        <TelemetryField icon={<Timer size={13} />} label="Airborne" value={formatDurationShort(elapsedMs)} />
        <TelemetryField
          icon={<Path size={13} weight="bold" />}
          label="Distance flown"
          value={`${NUMBER_FORMAT.format(distanceNm)} nm`}
        />
        <TelemetryField icon={<AirplaneTakeoff size={13} />} label="Departed" value={TIME_FORMAT.format(departedDate)} />
        <TelemetryField
          icon={<Gauge size={13} />}
          label="Average speed"
          value={`${NUMBER_FORMAT.format(avgSpeedKt)} kt`}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/10 pt-1.5 font-mono text-[11px] text-white/50">
        <span className="flex items-center gap-1">
          <MapPin size={11} />
          {`${current.lat.toFixed(2)}°, ${current.lon.toFixed(2)}°`}
        </span>
        {current.squawk && <span>{`squawk ${current.squawk}`}</span>}
        <span className="flex items-center gap-1">
          <Broadcast size={11} />
          {`${current.source || "unknown"} · ${formatSecondsAgo(lastUpdateMs)}`}
        </span>
      </div>
    </div>
  );
}
