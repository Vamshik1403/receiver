import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const sn =
      url.searchParams.get("SN") ||
      url.searchParams.get("sn") ||
      url.searchParams.get("serial") ||
      "unknown";

    const queryParams = url.searchParams.toString();
    const path = url.pathname;

    const body = await req.text();

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Fire-and-forget: don't block response
    pool
      .query(
        `INSERT INTO device_raw_logs 
         (device_sn, request_path, query_params, raw_body, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [sn, path, queryParams, body, ip]
      )
      .catch((err) => console.error("DB INSERT ERROR:", err));

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("REQUEST ERROR:", err);
    // Device MUST always get OK
    return new NextResponse("OK", { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}
