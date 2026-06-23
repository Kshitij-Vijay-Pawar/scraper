import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const params = await (context.params as any);
    const id = params.id;
    const targetUrl = `${BACKEND_URL}/leads/${id}`;
    
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

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const responseData = await response.json();
      return NextResponse.json(responseData, {
        status: response.status,
      });
    } else {
      const textData = await response.text();
      return NextResponse.json(
        { success: false, error: "BackendResponseNotJson", message: textData },
        { status: response.status }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "ProxyError", message: error.message || "Failed to reach backend" },
      { status: 502 }
    );
  }
}
