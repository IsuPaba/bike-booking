/** Build an .ics calendar file for a booking: from the first-day time until the return time on the last day. */
import { returnDeadline, startInstant } from "./rules";
import type { Booking, Settings } from "./types";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);

export function bookingIcs(b: Booking, s: Settings, bikes: string, where: string): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ride Easy//Prototype//EN", "BEGIN:VEVENT",
    `UID:${b.reference}@rideeasy.test`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(startInstant(b))}`,
    `DTEND:${stamp(returnDeadline(b.end_date, s.return_time))}`,
    `SUMMARY:${escape(`Bicycle rental ${b.reference}`)}`,
    `LOCATION:${escape(where)}`,
    `DESCRIPTION:${escape(`${bikes}. PIN ${b.pin}. Return by ${s.return_time} on the last day.`)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadFile(filename: string, content: string, type = "text/calendar") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
