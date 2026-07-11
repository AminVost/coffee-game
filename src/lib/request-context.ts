export function getRequestIp(request?: Request) {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || null;
}

export function getRequestUserAgent(request?: Request) {
  return request?.headers.get("user-agent")?.slice(0, 500) || null;
}
