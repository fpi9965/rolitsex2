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

function validPublicBase(value: string): string {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

export function buildInvitationUrl(
  code: string,
  location: InvitationLocation,
  configuredPublicUrl = "",
): string {
  const publicBase = validPublicBase(configuredPublicUrl) || DEFAULT_PUBLIC_APP_URL;
  const base = isPrivatePreviewHost(location.hostname)
    ? publicBase
    : `${location.origin}${location.pathname}`.replace(/\/+$/, "");
  return `${base}/?join=${code}`;
}
