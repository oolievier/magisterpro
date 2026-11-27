import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * CORS-vrije server-side proxy naar https://{school}.zportal.nl/api/v3/...
 * Ondersteunt ook de token-uitwisseling (koppelingscode -> access_token).
 */
async function proxy(request: NextRequest, segments: string[]) {
  const school = (
    request.headers.get("x-zermelo-subdomain") ??
    process.env.ZERMELO_SUBDOMAIN ??
    ""
  )
    .replace(/^https?:\/\//, "")
    .replace(/\.zportal\.nl.*$/, "")
    .replace(/[^a-z0-9-]/gi, "")
    .toLowerCase();

  if (!school) return NextResponse.json({ message: "Geen Zermelo-school-subdomain opgegeven." }, { status: 400 });

  const path = segments.join("/");
  const isToken = path === "oauth/token" || path === "api/v3/oauth/token";
  if (!/^api\/v[34]\//.test(path) && !isToken) {
    return NextResponse.json({ message: "Pad niet toegestaan." }, { status: 403 });
  }

  const isCodeExchange = isToken && request.method.toUpperCase() === "POST";
  const token = isCodeExchange
    ? ""
    : request.headers.get("x-zermelo-token") ?? process.env.ZERMELO_TOKEN ?? "";
  if (!isCodeExchange && !token) {
    return NextResponse.json({ message: "Geen Zermelo access_token opgegeven." }, { status: 401 });
  }

  const upstream = new URL(`https://${school}.zportal.nl/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "MagisterPro/1.0",
      "X-Zermelo-Client": "WebApp/MagisterPro",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      { message: error instanceof Error ? error.message : "Kon Zermelo niet bereiken." },
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
      "Access-Control-Allow-Headers": "Content-Type, x-zermelo-subdomain, x-zermelo-token",
    },
  });
}
