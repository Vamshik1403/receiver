import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK = () => new NextResponse("OK", { status: 200 });

const VALID_SN = /^[A-Za-z0-9]+$/;
const SUSPICIOUS = ["DROP", "DELETE", "INSERT", "UPDATE", "--", ";"];

async function handleRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const sn =
      url.searchParams.get("SN") ||
      url.searchParams.get("sn") ||
      url.searchParams.get("serial");

    const table = url.searchParams.get("table");
    const body = await req.text();

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // No SN → ignore
    if (!sn) return OK();

    // SN format validation
    if (!VALID_SN.test(sn)) return OK();

    // 1. Check device in DB
    const device = await pool.query(
      `SELECT is_verified FROM device_sn WHERE device_sn = $1`,
      [sn]
    );

    // Device not registered → auto-register (unverified)
    if (device.rowCount === 0) {
      pool
        .query(`INSERT INTO device_sn (device_sn) VALUES ($1) ON CONFLICT DO NOTHING`, [sn])
        .catch((err) => console.error("AUTO-REGISTER ERROR:", err));
      return OK();
    }

    // Device not verified → ignore
    if (!device.rows[0].is_verified) return OK();

    // 2. Payload validation
    if (body.length > 10000) return OK();
    if (body.length < 5) return OK();
    if (!body.includes(" ")) return OK();
    if (table !== "ATTLOG") return OK();

    // 3. Reject suspicious payloads
    const upper = body.toUpperCase();
    if (SUSPICIOUS.some((p) => upper.includes(p))) return OK();

    // 4. Determine validity for soft-flag
    const isValid = /\d/.test(body);

    // 5. Store only valid + verified device data
    pool
      .query(
        `INSERT INTO receiver_device_logs 
         (device_sn, request_path, query_params, raw_body, ip_address, is_valid)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sn, url.pathname, url.searchParams.toString(), body, ip, isValid]
      )
      .catch((err) => console.error("DB INSERT ERROR:", err));

    return OK();
  } catch (err) {
    console.error("REQUEST ERROR:", err);
    return OK();
  }
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}
