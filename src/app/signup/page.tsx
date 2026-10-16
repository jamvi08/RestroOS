"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { AuthShell, FormCard } from "@/components/auth/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Something went wrong");
      }

      // Login the user automatically
      const res = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (res?.error) {
        throw new Error(res.error);
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
      title="Register / रजिस्टर करें"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </>
      }
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Register your restaurant</h1>
        <p className="text-base text-muted-foreground">Free to start. We check every new restaurant before it goes live, so you&apos;ll be able to add your menu once it&apos;s approved.</p>
      </div>

      <FormCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <Notice>{error}</Notice>}

          <div className="space-y-2">
            <Label htmlFor="restaurantName">Restaurant name</Label>
            <Input id="restaurantName" name="restaurantName" placeholder="Sharma Dhaba" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Your name</Label>
            <Input id="ownerName" name="ownerName" autoComplete="name" placeholder="Ramesh Sharma" required />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Restaurant address</Label>
            <Input id="address" name="address" autoComplete="street-address" placeholder="Shop no., street, city" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Create a password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <p className="text-sm text-muted-foreground">At least 8 characters.</p>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </FormCard>
    </AuthShell>
  );
}
