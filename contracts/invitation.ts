// دومين المعاينة خاص بصاحب المشروع؛ الدعوات ترسل دائماً إلى النشر العام.
const DEFAULT_PUBLIC_APP_URL = "https://u5walep5vxzzu.kimi.place";

export type InvitationLocation = {
  hostname: string;
  origin: string;
  pathname: string;
};

export function isPrivatePreviewHost(hostname: string): boolean {
  return /(^|\.)kimi\.ai$/i.test(hostname);
}

function validPublicBase(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function buildInvitationUrl(
  code: string,
  location: InvitationLocation,
  configuredPublicUrl = "",
): string {
  const url = isPrivatePreviewHost(location.hostname)
    ? validPublicBase(configuredPublicUrl) ?? new URL(DEFAULT_PUBLIC_APP_URL)
    : new URL(location.pathname, location.origin);
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  url.searchParams.set("join", code);
  url.hash = "";
  return url.toString();
}
