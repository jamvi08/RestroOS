"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { MessageCircle, RefreshCw, Store, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { Notice } from "@/components/ui/notice";
import { AuthShell, FormCard } from "@/components/auth/AuthShell";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

// LOGIN: restaurant + number + password. FORGOT: choose manager reset or WhatsApp code.
// RESET: enter WhatsApp code + new password.
type Step = "LOGIN" | "FORGOT" | "RESET";

const REMEMBER_KEY = "restro.waiterLogin";
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");

export default function WaiterLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("LOGIN");
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const cleanedPhone = phone.replace(/\D/g, "").slice(-10);

  // Same phone, same restaurant every day: fill them in from last time.
  // Done after mount because localStorage doesn't exist during the server render.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
      if (saved?.restaurantName) setRestaurantName(saved.restaurantName);
      if (saved?.phone) setPhone(saved.phone);
    } catch {
      // storage blocked or empty: start blank
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const logIn = async (pw: string) => {
    const res = await signIn("credentials", {
      redirect: false,
      type: "phone-password",
      restaurantName,
      phone: cleanedPhone,
      password: pw,
    });
    if (res?.error) throw new Error(res.error);
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ restaurantName: restaurantName.trim(), phone: cleanedPhone }));
    } catch {
      // not critical
    }
    router.push("/waiter");
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!restaurantName.trim()) return setError("Please enter your restaurant name.");
    if (cleanedPhone.length !== 10) return setError("Please enter a valid 10-digit mobile number.");

    setIsLoading(true);
    try {
      await logIn(password);
    } catch (err) {
      setError(errorMessage(err));
      setIsLoading(false);
    }
  };

  const openForgot = () => {
    setError(null);
    setStep("FORGOT");
  };

  // Uses one WhatsApp OTP from the restaurant's limited quota
  const sendCode = async () => {
    setError(null);
    if (cleanedPhone.length !== 10) return setError("Please enter a valid 10-digit mobile number.");

    setIsLoading(true);
    setDevOtp(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not send the code. Please try again.");
      if (data.devOtp) setDevOtp(data.devOtp);
      setOtp("");
      setCountdown(60);
      setStep("RESET");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (newPassword !== confirmPassword) return setError("The two passwords don't match.");

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/staff/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone, otp, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not save the password. Please try again.");
      await logIn(newPassword);
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
          Owner or manager?{" "}
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
          {step === "LOGIN" ? "Waiter login" : step === "FORGOT" ? "Forgot password?" : "Set a new password"}
        </h1>
        <p className="max-w-sm text-base text-muted-foreground">
          {step === "LOGIN"
            ? "Use the restaurant name, mobile number and password your manager gave you."
            : step === "FORGOT"
              ? "The quickest way is to ask your manager."
              : `Enter the 6-digit code sent to +91 ${cleanedPhone} on WhatsApp, then choose a new password.`}
        </p>
      </div>

      {error && <Notice>{error}</Notice>}

      {step === "LOGIN" && (
        <FormCard>
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Restaurant name</Label>
              <Input
                id="restaurant-name"
                autoComplete="organization"
                autoCapitalize="words"
                placeholder="Sharma Dhaba"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waiter-phone">Mobile number</Label>
              <PhoneInput
                id="waiter-phone"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="waiter-password">Password</Label>
                <button type="button" onClick={openForgot} className="text-[15px] font-semibold text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="waiter-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" /> Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        </FormCard>
      )}

      {step === "FORGOT" && (
        <>
          <div className="flex gap-4 rounded-2xl border-2 border-primary bg-primary-soft p-4">
            <UserCog className="mt-0.5 size-7 shrink-0 text-primary" />
            <div>
              <p className="text-base font-bold text-foreground">Ask your manager</p>
              <p className="text-[15px] text-muted-foreground">
                They can set a new password for you in <strong className="text-foreground">Staff</strong> on their phone, in a few seconds.
              </p>
            </div>
          </div>

          <FormCard>
            <div className="space-y-1">
              <p className="text-base font-bold text-foreground">Manager not around?</p>
              <p className="text-[15px] text-muted-foreground">Get a code on WhatsApp and set the password yourself.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-phone">Mobile number</Label>
              <PhoneInput
                id="reset-phone"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button variant="success" size="lg" className="w-full" disabled={isLoading || cleanedPhone.length !== 10} onClick={sendCode}>
              <MessageCircle />
              {isLoading ? "Sending code..." : "Send code on WhatsApp"}
            </Button>
          </FormCard>

          <Button variant="outline" size="lg" onClick={() => { setError(null); setStep("LOGIN"); }}>
            Back to login
          </Button>
        </>
      )}

      {step === "RESET" && (
        <FormCard>
          <form onSubmit={handleReset} className="flex flex-col gap-5">
            {devOtp && (
              <Notice tone="info">
                <p className="font-semibold">WhatsApp server is offline (test mode)</p>
                <p className="mt-1">
                  Your code is{" "}
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp)}
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
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
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
                    onClick={sendCode}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                  >
                    <RefreshCw className="size-4" /> Resend code
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput id="new-password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <p className="text-sm text-muted-foreground">At least {MIN_PASSWORD_LENGTH} letters or numbers.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Type it again</Label>
              <PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {!restaurantName.trim() && (
              <div className="space-y-2">
                <Label htmlFor="reset-restaurant">Restaurant name</Label>
                <Input id="reset-restaurant" placeholder="Sharma Dhaba" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required />
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? "Saving..." : "Save password & login"}
            </Button>
            <button type="button" onClick={() => { setError(null); setStep("LOGIN"); }} className="text-[15px] font-semibold text-primary hover:underline">
              Back to login
            </button>
          </form>
        </FormCard>
      )}
    </AuthShell>
  );
}
