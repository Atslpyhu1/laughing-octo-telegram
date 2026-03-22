// lib/vsd.ts
// Virtual Store Directory — Canonical link generation & resolution
//
// Architecture:
//   Canonical route:   /vsd/{vendorSlug}         ← source of truth (identity)
//   Subdomain alias:   {vendorSlug}.{rootDomain}  ← branded alias (rewrites to canonical)
//   Shareable link:    /vsd?token={token}          ← portable, resolves to canonical
//
// Artifacts preserve truth: original vendor identity is immutable via the canonical path.

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
const PROTOCOL = process.env.NODE_ENV === "production" ? "https" : "http";

/** Generate the canonical VSD path (source of truth) */
export function vsdCanonicalPath(vendorSlug: string): string {
  return `/vsd/${encodeURIComponent(vendorSlug.toLowerCase())}`;
}

/** Generate a full canonical URL */
export function vsdCanonicalUrl(vendorSlug: string): string {
  return `${PROTOCOL}://${ROOT_DOMAIN}${vsdCanonicalPath(vendorSlug)}`;
}

/** Generate the branded subdomain URL (alias — rewrites to canonical) */
export function vsdSubdomainUrl(vendorSlug: string): string {
  const slug = vendorSlug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${PROTOCOL}://${slug}.${ROOT_DOMAIN}`;
}

/** Generate a base64url share token for a vendor slug */
export function generateVsdToken(vendorSlug: string): string {
  const payload = JSON.stringify({ slug: vendorSlug.toLowerCase(), v: 1 });
  if (typeof btoa === "function") {
    return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(payload).toString("base64url");
}

/** Verify and decode a VSD share token → returns vendor slug or null */
export function verifyVsdToken(token: string): string | null {
  try {
    let payload: string;
    if (typeof atob === "function") {
      const padded = token.replace(/-/g, "+").replace(/_/g, "/");
      payload = atob(padded);
    } else {
      payload = Buffer.from(token, "base64url").toString("utf-8");
    }
    const parsed = JSON.parse(payload);
    return parsed.slug || null;
  } catch {
    return null;
  }
}

/** Generate a full shareable URL with token */
export function vsdShareUrl(vendorSlug: string): string {
  const token = generateVsdToken(vendorSlug);
  return `${PROTOCOL}://${ROOT_DOMAIN}/vsd?token=${token}`;
}

export interface VsdIdentity {
  vendorSlug: string;
  canonicalPath: string;
  canonicalUrl: string;
  subdomainUrl: string;
  shareUrl: string;
}

/** Resolve a vendor slug to the full VSD identity (all link forms) */
export function resolveVsdIdentity(vendorSlug: string): VsdIdentity {
  const slug = vendorSlug.toLowerCase();
  return {
    vendorSlug: slug,
    canonicalPath: vsdCanonicalPath(slug),
    canonicalUrl: vsdCanonicalUrl(slug),
    subdomainUrl: vsdSubdomainUrl(slug),
    shareUrl: vsdShareUrl(slug),
  };
}

/** Extract vendor slug from subdomain in request host header */
export function extractVsdSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];

  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    const match = hostname.match(/^([^.]+)\.localhost/);
    return match?.[1] || null;
  }

  if (hostname.includes("---") && hostname.endsWith(".vercel.app")) {
    return hostname.split("---")[0] || null;
  }

  if (
    hostname !== rootHostname &&
    hostname !== `www.${rootHostname}` &&
    hostname.endsWith(`.${rootHostname}`)
  ) {
    return hostname.replace(`.${rootHostname}`, "");
  }

  return null;
}
