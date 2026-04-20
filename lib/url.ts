export function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  }

  const isProductionDomain =
    process.env.NEXT_PUBLIC_BASE_URL &&
    window.location.host === new URL(process.env.NEXT_PUBLIC_BASE_URL).host;

  if (isProductionDomain) {
    return process.env.NEXT_PUBLIC_BASE_URL!;
  }

  return `${window.location.protocol}//${window.location.host}`;
}
