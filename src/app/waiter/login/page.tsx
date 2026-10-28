"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, MessageCircle, RefreshCw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Notice } from "@/components/ui/notice";
import { AuthShell, FormCard } from "@/components/auth/AuthShell";

// PHONE: type mobile number. CODE: 6-digit WhatsApp code.
// PICK: works at more than one restaurant, choose which one (also used for "Switch restaurant").
type Step = "PHONE" | "CODE" | "PICK";
type StaffRestaurant = { userId: string; restaurantName: string; role: string };

const REMEMBER_KEY = "restro.waiterLogin";
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export default function WaiterLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("PHONE");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [ticket, setTicket] = useState("");
  const [restaurants, setRestaurants] = useState<StaffRestaurant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const cleanedPhone = phone.replace(/\D/g, "").slice(-10);

  // Same phone every day: fill it in from last time. "?switch=1" (from the waiter
  // header) skips straight to choosing another restaurant.
  // Done after mount because localStorage doesn't exist during the server render.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
      if (saved?.phone) setPhone(saved.phone);
    } catch {
      // storage blocked or empty: start blank
    }

    if (new URLSearchParams(window.location.search).get("switch") !== "1") return;
    fetch("/api/auth/staff/restaurants", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setTicket(data.ticket);
        setRestaurants(data.restaurants);
        setCurrentUserId(data.currentUserId);
        setStep("PICK");
      })
      .catch(() => {
        // fall back to the normal login
      });
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const logIn = async (withTicket: string, userId: string) => {
    const res = await signIn("credentials", { redirect: false, type: "staff-ticket", ticket: withTicket, userId });
    if (res?.error) throw new Error(res.error);
    router.push("/waiter");
    router.refresh();
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (cleanedPhone.length !== 10) return setError("Please enter a valid 10-digit mobile number.");

    setIsLoading(true);
    setDevOtp(null);
    try {
      const data = await postJson("/api/auth/staff/send-code", { phone: cleanedPhone });
      if (data.devOtp) setDevOtp(data.devOtp);
      try {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ phone: cleanedPhone }));
      } catch {
        // not critical
      }
      setOtp("");
      setCountdown(60);
      setStep("CODE");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const verify = async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await postJson("/api/auth/staff/verify", { phone: cleanedPhone, otp: code });
      setTicket(data.ticket);
      if (data.restaurants.length === 1) {
        await logIn(data.ticket, data.restaurants[0].userId);
        return;
      }
      setRestaurants(data.restaurants);
      setStep("PICK");
      setIsLoading(false);
    } catch (err) {
      setError(errorMessage(err));
      setIsLoading(false);
    }
  };

  const onOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    // No extra button tap: check the code as soon as all 6 digits are in
    if (digits.length === 6 && !isLoading) void verify(digits);
  };

  const pick = async (userId: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await logIn(ticket, userId);
    } catch (err) {
      setError(errorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Waiter Login / वेटर लॉग इन"
      footer={
        <>
          Owner?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Login with email
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Store className="size-8" />
        </span>
        <h1 className="text-2xl font-bold text-foreground">
          {step === "PHONE" ? "Waiter login" : step === "CODE" ? "Enter the code" : "Which restaurant?"}
        </h1>
        <p className="max-w-sm text-base text-muted-foreground">
          {step === "PHONE"
            ? "Type your mobile number. We'll send a code on WhatsApp."
            : step === "CODE"
              ? `We sent a 6-digit code to +91 ${cleanedPhone} on WhatsApp.`
              : "You work at more than one place. Tap the one you're at today."}
        </p>
      </div>

      {error && <Notice>{error}</Notice>}

      {step === "PHONE" && (
        <FormCard>
          <form onSubmit={sendCode} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="waiter-phone">Mobile number</Label>
              <PhoneInput
                id="waiter-phone"
                placeholder="98765 43210"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <Button type="submit" variant="success" size="lg" className="w-full" disabled={isLoading || cleanedPhone.length !== 10}>
              <MessageCircle />
              {isLoading ? "Sending code..." : "Send code on WhatsApp"}
            </Button>
          </form>
        </FormCard>
      )}

      {step === "CODE" && (
        <FormCard>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (otp.length === 6) void verify(otp);
            }}
            className="flex flex-col gap-5"
          >
            {devOtp && (
              <Notice tone="info">
                <p className="font-semibold">WhatsApp server is offline (test mode)</p>
                <p className="mt-1">
                  Your code is{" "}
                  <button
                    type="button"
                    onClick={() => onOtpChange(devOtp)}
                    className="rounded-md bg-card px-2 py-0.5 font-mono font-bold tracking-wider text-foreground underline"
                  >
                    {devOtp}
                  </button>{" "}
                  — tap it to fill.
                </p>
              </Notice>
            )}

            <div className="space-y-2">
              <Label htmlFor="otp-input">WhatsApp code</Label>
              <Input
                id="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                placeholder="------"
                value={otp}
                onChange={(e) => onOtpChange(e.target.value)}
                required
                className="h-14 text-center font-mono text-2xl font-bold tracking-[0.6em]"
              />
              <div className="flex items-center justify-between pt-1 text-[15px]">
                <span className="text-muted-foreground">Didn&apos;t get it?</span>
                {countdown > 0 ? (
                  <span className="font-semibold tabular-nums text-muted-foreground">Resend in 0:{String(countdown).padStart(2, "0")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendCode()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                  >
                    <RefreshCw className="size-4" /> Resend code
                  </button>
                )}
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" /> Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("PHONE");
              }}
              className="text-[15px] font-semibold text-primary hover:underline"
            >
              Change number
            </button>
          </form>
        </FormCard>
      )}

      {step === "PICK" && (
        <div className="flex flex-col gap-3">
          {restaurants.map((r) => {
            const current = r.userId === currentUserId;
            return (
              <button
                key={r.userId}
                type="button"
                disabled={isLoading || current}
                onClick={() => pick(r.userId)}
                className="flex items-center gap-4 rounded-2xl border-[1.5px] border-input bg-card p-4 text-left transition-colors hover:border-primary disabled:opacity-60"
              >
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg font-bold text-primary">
                  {r.restaurantName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold text-foreground">{r.restaurantName}</span>
                  <span className="block text-[15px] text-muted-foreground">
                    {current ? "You're here now" : r.role === "WAITER" ? "Waiter" : r.role === "MANAGER" ? "Manager" : "Owner"}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            );
          })}
          {currentUserId && (
            <Button variant="outline" size="lg" onClick={() => router.push("/waiter")}>
              Back to tables
            </Button>
          )}
        </div>
      )}
    </AuthShell>
  );
}
