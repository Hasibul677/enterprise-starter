import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";

dayjs.extend(utc);
dayjs.extend(duration);

export { dayjs };

/** Always store/compute in UTC; format only at the presentation layer. */
export function nowUtc() {
  return dayjs.utc();
}

export function addDurationFromNow(input: string): Date {
  // input like "30m" / "45m" / "7d" - simple parser for common suffixes
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration string: ${input}`);
  const [, amountStr, unit] = match;
  const amount = Number(amountStr);
  const unitMap: Record<string, dayjs.ManipulateType> = {
    ms: "millisecond",
    s: "second",
    m: "minute",
    h: "hour",
    d: "day",
  };
  return dayjs.utc().add(amount, unitMap[unit]).toDate();
}

export function formatDate(date: Date | string, pattern = "YYYY-MM-DD HH:mm:ss"): string {
  return dayjs.utc(date).format(pattern);
}
