import { ArrowRight, Building2 } from "lucide-react";
import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/app");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const error = resolvedSearchParams.error;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/app",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return redirect(`/sign-in?error=${err.type}`);
      }
      throw err;
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="w-full max-w-4xl rounded-[var(--radius)] border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[calc(var(--radius)-4px)] bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-800 p-8 text-white">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Building2 className="h-3.5 w-3.5" />
              FleetFlow DMS
            </div>
            <h1 className="text-3xl font-semibold leading-tight">Modern dealer workflows without legacy friction.</h1>
            <p className="mt-3 text-slate-200">
              Work queue home, keyboard-first actions, recon tracking, desking-lite, and accounting visibility in one app.
            </p>
            <div className="mt-8 rounded-lg border border-white/20 bg-white/10 p-4 text-sm">
              <p className="font-semibold">Demo Credentials</p>
              <p>Email: owner@summitauto.dev</p>
              <p>Password: demo1234</p>
            </div>
          </section>
          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Use your dealership account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={login} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required defaultValue="owner@summitauto.dev" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required defaultValue="demo1234" />
                </div>
                {typeof error === "string" ? (
                  <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    Unable to sign in: {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Need access? Contact your org owner in Settings.
                <Link href="#" className="ml-1 underline">
                  Learn more
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
