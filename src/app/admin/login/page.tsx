import { Logo } from "@/components/site/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Inloggen" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ terug?: string }> }) {
  const { terug } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-ink p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8">
        <Logo className="h-3.5 w-auto text-ink" />
        <h1 className="mt-8 font-sans text-2xl font-semibold">Inloggen op het beheer</h1>
        <p className="mt-1 text-sm text-ink-soft">Alleen voor medewerkers van de Honeymoon shop.</p>
        <LoginForm terug={terug ?? ""} />
      </div>
    </main>
  );
}
