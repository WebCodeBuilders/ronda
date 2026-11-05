import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · ronda" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={next ?? null} />;
}
