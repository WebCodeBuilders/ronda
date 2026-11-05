import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · ronda" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if ((await prisma.organization.count()) === 0) redirect("/setup");
  const { next } = await searchParams;
  return <LoginForm next={next ?? null} />;
}
