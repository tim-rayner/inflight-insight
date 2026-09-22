"use server";

import { cookies } from "next/headers";

export async function persistTrackedFlightNumber(flightNumber: string) {
  const trimmed = flightNumber.trim();
  if (!trimmed) return;
  const cookieStore = await cookies();
  cookieStore.set("trackedFlightNumber", trimmed, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}
