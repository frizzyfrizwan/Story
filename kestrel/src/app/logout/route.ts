import { signOut } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  await signOut({ redirectTo: "/" });
}

export async function POST() {
  await signOut({ redirectTo: "/" });
}
