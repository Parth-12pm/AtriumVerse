import { format, parseISO } from "date-fns";

const HAS_TZ_SUFFIX = /(Z|[+-]\d{2}:\d{2})$/i;

export function formatChatTimestamp(timestamp: string): string {
  if (!timestamp) return "";

  try {
    const normalized = HAS_TZ_SUFFIX.test(timestamp)
      ? timestamp
      : `${timestamp}Z`;
    return format(parseISO(normalized), "h:mm a");
  } catch {
    return "";
  }
}
