"use client";

import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Notice } from "@/components/ui/notice";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Strings } from "./i18n";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

/**
 * WhatsApp number + 6-digit code on the QR menu. The restaurant decides whether
 * it's optional (Skip button) or required before ordering.
 */
export function VerifyPhone({
  open,
  onOpenChange,
  slug,
  token,
  restaurantName,
  required,
  t,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  token: string;
  restaurantName: string;
  required: boolean;
  t: Strings;
  onVerified: () => void;
}) {
  const [step, setStep] = useState<"PHONE" | "CODE">("PHONE");
  const [phone, setPhone] = useState("");
  const [offers, setOffers] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) return setError(t.invalidPhone);
    setBusy(true);
    setDevOtp(null);
    try {
      const data = await postJson("/api/public/otp/send", { slug, token, phone });
      if (data.devOtp) setDevOtp(data.devOtp);
      setOtp("");
      setCountdown(60);
      setStep("CODE");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/public/otp/verify", { slug, token, phone, otp: code, offers });
      setStep("PHONE");
      setOtp("");
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  };

  const onOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    if (digits.length === 6 && !busy) void verify(digits);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === "PHONE" ? t.verifyTitle : t.codeTitle}</DialogTitle>
          <DialogDescription>
            {step === "PHONE" ? (required ? t.verifyRequiredDesc : t.verifyDesc) : t.codeDesc(phone)}
          </DialogDescription>
        </DialogHeader>

        {error && <Notice>{error}</Notice>}

        {step === "PHONE" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer-phone">{t.phoneLabel}</Label>
              <PhoneInput
                id="customer-phone"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {/* Unticked by default: offers only with a clear yes */}
            <label className="flex cursor-pointer items-start gap-3 text-[15px] text-foreground">
              <input
                type="checkbox"
                checked={offers}
                onChange={(e) => setOffers(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[#2b8a3e]"
              />
              {t.offersOptIn(restaurantName)}
            </label>
            <Button type="submit" variant="success" size="lg" className="w-full" disabled={busy || phone.length !== 10}>
              <MessageCircle />
              {busy ? t.sending : t.sendCode}
            </Button>
            {!required && (
              <Button type="button" variant="ghost" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
                {t.skip}
              </Button>
            )}
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (otp.length === 6) void verify(otp);
            }}
            className="flex flex-col gap-4"
          >
            {devOtp && (
              <Notice tone="info">
                {t.testCode}{" "}
                <button type="button" onClick={() => onOtpChange(devOtp)} className="rounded-md bg-card px-2 py-0.5 font-mono font-bold underline">
                  {devOtp}
                </button>
              </Notice>
            )}
            <Input
              aria-label={t.codeTitle}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="------"
              value={otp}
              onChange={(e) => onOtpChange(e.target.value)}
              className="h-14 text-center font-mono text-2xl font-bold tracking-[0.6em]"
            />
            <div className="flex items-center justify-between text-[15px]">
              <button type="button" onClick={() => setStep("PHONE")} className="font-semibold text-primary">
                {t.changeNumber}
              </button>
              {countdown > 0 ? (
                <span className="font-semibold tabular-nums text-muted-foreground">{t.resendIn(String(countdown).padStart(2, "0"))}</span>
              ) : (
                <button type="button" onClick={() => sendCode()} disabled={busy} className="inline-flex items-center gap-1.5 font-semibold text-primary">
                  <RefreshCw className="size-4" /> {t.resend}
                </button>
              )}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy || otp.length !== 6}>
              {busy ? t.sending : t.verify}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
