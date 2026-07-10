import { toZonedTime } from "date-fns-tz";
const CAIRO_TIMEZONE = "Africa/Cairo";

const now = new Date('2026-06-30T21:00:00Z');
const cairoNow = toZonedTime(now, CAIRO_TIMEZONE);

console.log("True now ISO:", now.toISOString());
console.log("Cairo now ISO:", cairoNow.toISOString());
console.log("Cairo now getDate():", cairoNow.getDate());
console.log("Cairo now getUTCHours():", cairoNow.getUTCHours());
console.log("Cairo now getHours():", cairoNow.getHours());
