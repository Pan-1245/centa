import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

export const getSession = cache(() => auth());

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}
