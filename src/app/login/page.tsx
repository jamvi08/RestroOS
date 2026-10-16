"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { AuthShell, FormCard } from "@/components/auth/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Owner / manager sign in with email + password
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        throw new Error("Wrong email or password. Please check and try again.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Login / लॉग इन"
      footer={
        <>
          New to RestroOS?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Register your restaurant
          </Link>
        </>
      }
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Owner &amp; manager login</h1>
        <p className="text-base text-muted-foreground">Use the email and password you registered with.</p>
      </div>

      <FormCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <Notice>{error}</Notice>}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </FormCard>

      <Link
        href="/waiter/login"
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-success"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
          <MessageCircle className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block text-base font-semibold text-foreground">Waiter or staff?</span>
          <span className="block text-[15px] text-muted-foreground">Use the waiter login instead</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </AuthShell>
  );
}
