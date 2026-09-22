"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AirplaneIcon,
  AirplaneTakeoffIcon,
  ArrowsVerticalIcon,
  BroadcastIcon,
  CompassIcon,
  GaugeIcon,
  MapPinIcon,
  PathIcon,
  MinusIcon,
  TimerIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import { useFlight } from "@/features/flight-telemetry/component/FlightWrapper";
import { liveFlightMetrics } from "@/features/flight-telemetry/lib/deriveFlightTelemetry";
import {
  compassDirection,
  formatDurationShort,
  formatSecondsAgo,
} from "@/features/flight-telemetry/lib/telemetry";

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

export default function FlightTelemetryPanel() {
  const telemetry = useFlight();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!telemetry) return null;

  const { airborneMs, lastUpdateMs, averageSpeedKt } = liveFlightMetrics(telemetry, nowMs);

  const VerticalIcon =
    telemetry.verticalRate === "climbing"
      ? TrendUpIcon
      : telemetry.verticalRate === "descending"
        ? TrendDownIcon
        : MinusIcon;
  const verticalLabel =
    telemetry.verticalRate === "level"
      ? "Level"
      : `${telemetry.verticalRate === "climbing" ? "+" : ""}${NUMBER_FORMAT.format(telemetry.verticalSpeedFtPerMin)} ft/min`;

  const departedDate = new Date(telemetry.departedIso);

  return (
    <div className="absolute bottom-4 left-4 z-10 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-black/70 p-3 text-sm text-white shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          <AirplaneIcon size={14} weight="fill" className="shrink-0 text-sky-400" />
          <span className="truncate">
            {telemetry.flightNumber}
            {telemetry.showCallsign ? ` · ${telemetry.callsign}` : ""}
          </span>
        </div>
        {telemetry.route && <span className="shrink-0 font-mono text-xs text-white/70">{telemetry.route}</span>}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 max-[420px]:grid-cols-1">
        <TelemetryField
          icon={<GaugeIcon size={13} />}
          label="Ground speed"
          value={`${NUMBER_FORMAT.format(telemetry.groundSpeedKt)} kt`}
        />
        <TelemetryField
          icon={<ArrowsVerticalIcon size={13} />}
          label="Altitude"
          value={`${NUMBER_FORMAT.format(telemetry.altitudeFt)} ft`}
        />
        <TelemetryField icon={<VerticalIcon size={13} />} label="Vertical rate" value={verticalLabel} />
        <TelemetryField
          icon={<CompassIcon size={13} />}
          label="Heading"
          value={`${Math.round(telemetry.headingDegrees)}° ${compassDirection(telemetry.headingDegrees)}`}
        />
        <TelemetryField icon={<TimerIcon size={13} />} label="Airborne" value={formatDurationShort(airborneMs)} />
        <TelemetryField
          icon={<PathIcon size={13} weight="bold" />}
          label="Distance flown"
          value={`${NUMBER_FORMAT.format(telemetry.distanceFlownNm)} nm`}
        />
        <TelemetryField icon={<AirplaneTakeoffIcon size={13} />} label="Departed" value={TIME_FORMAT.format(departedDate)} />
        <TelemetryField
          icon={<GaugeIcon size={13} />}
          label="Average speed"
          value={`${NUMBER_FORMAT.format(averageSpeedKt)} kt`}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/10 pt-1.5 font-mono text-[11px] text-white/50">
        <span className="flex items-center gap-1">
          <MapPinIcon size={11} />
          {`${telemetry.location.lat.toFixed(2)}°, ${telemetry.location.lng.toFixed(2)}°`}
        </span>
        {telemetry.squawk && <span>{`squawk ${telemetry.squawk}`}</span>}
        <span className="flex items-center gap-1">
          <BroadcastIcon size={11} />
          {`${telemetry.source} · ${formatSecondsAgo(lastUpdateMs)}`}
        </span>
      </div>
    </div>
  );
}
