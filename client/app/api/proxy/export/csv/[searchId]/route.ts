import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export async function GET(req: NextRequest, { params }: { params: Promise<{ searchId: string }> }) {
  try {
    const { searchId } = await params;
    const targetUrl = `${BACKEND_URL}/export/csv/${searchId}`;
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.startsWith("host") && !lowerKey.startsWith("connection")) {
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
      if (lowerKey === "content-type" || lowerKey === "content-disposition") {
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
