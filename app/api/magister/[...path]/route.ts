import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * CORS-vrije server-side proxy naar https://{school}.magister.net/api/...
 * De school en token komen uit headers (of env), nooit uit de browser-URL.
 */
async function proxy(request: NextRequest, segments: string[]) {
  const school = (
    request.headers.get("x-magister-subdomain") ??
    process.env.MAGISTER_SUBDOMAIN ??
    ""
  )
    .replace(/^https?:\/\//, "")
    .replace(/\.magister\.net.*$/, "")
    .replace(/[^a-z0-9-]/gi, "")
    .toLowerCase();

  const token = request.headers.get("x-magister-token") ?? process.env.MAGISTER_TOKEN ?? "";
  if (!school) return NextResponse.json({ message: "Geen school-subdomain opgegeven." }, { status: 400 });
  if (!token) return NextResponse.json({ message: "Geen Bearer token opgegeven." }, { status: 401 });

  const path = segments.join("/");
  if (!/^(api\/|oauth2\/)/.test(path)) {
    return NextResponse.json({ message: "Pad niet toegestaan." }, { status: 403 });
  }

  const upstream = new URL(`https://${school}.magister.net/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "MagisterPro/1.0",
    },
    cache: "no-store",
  };
  if (!["GET", "HEAD"].includes(method)) {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const res = await fetch(upstream, init);
    const text = await res.text();
    let payload: unknown = text;
    try { payload = text ? JSON.parse(text) : null; } catch { /* tekst doorgeven */ }
    return NextResponse.json(payload, {
      status: res.status,
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Kon Magister niet bereiken. Controleer de schoolhost en je verbinding." },
      { status: 502 }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-magister-subdomain, x-magister-token",
    },
  });
}
