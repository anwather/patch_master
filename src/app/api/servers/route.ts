import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listServers } from "@/lib/arm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const showEnabledOnly = url.searchParams.get("showEnabledOnly") !== "false";

    const all = await listServers(session.accessToken);
    const filtered = showEnabledOnly
      ? all.filter((s) => s.isUpdateManagerEnabled)
      : all;

    return NextResponse.json({ showEnabledOnly, servers: filtered });
  } catch (error) {
    console.error("Server enumeration failed:", error);
    return NextResponse.json(
      {
        error: "Failed to enumerate Azure servers.",
        details: (error as Error).message,
      },
      { status: 502 }
    );
  }
}
