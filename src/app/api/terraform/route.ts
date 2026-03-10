import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildTerraform } from "@/lib/terraform";
import { TerraformInput } from "@/lib/types";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as TerraformInput;
  const input: TerraformInput = {
    ...body,
    selectedServerIds: Array.isArray(body.selectedServerIds)
      ? body.selectedServerIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      : [],
  };
  const terraform = buildTerraform(input);

  return NextResponse.json({ terraform });
}
