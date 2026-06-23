import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// GET /api/proxy/enrich/:jobId - Get enrichment progress
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const targetUrl = `${BACKEND_URL}/enrich/${jobId}`;
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.startsWith("host") && !lowerKey.startsWith("connection") && !lowerKey.startsWith("content-length")) {
        headers.set(key, value);
      }
    });

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const responseData = await response.arrayBuffer();
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "content-type") {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "ProxyError", message: error.message || "Failed to reach backend" },
      { status: 502 }
    );
  }
}

// DELETE /api/proxy/enrich/:jobId - Cancel enrichment job
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const targetUrl = `${BACKEND_URL}/enrich/${jobId}`;
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.startsWith("host") && !lowerKey.startsWith("connection") && !lowerKey.startsWith("content-length")) {
        headers.set(key, value);
      }
    });

    const response = await fetch(targetUrl, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });

    const responseData = await response.arrayBuffer();
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "content-type") {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "ProxyError", message: error.message || "Failed to reach backend" },
      { status: 502 }
    );
  }
}
