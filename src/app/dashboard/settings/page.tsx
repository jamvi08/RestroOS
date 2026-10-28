"use client";

import { useState, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ImagePlus, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/restaurant");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (error) {
        console.error("Failed to load profile", error);
      }
    }
    loadProfile();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    setMessage(null);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Could not upload the logo. Please try again.");
      
      const data = await res.json();
      setProfile({ ...profile, logoUrl: data.url });
      setMessage({ type: "success", text: "Logo uploaded. Tap Save changes to keep it." });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to upload logo" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Add logoUrl if it was uploaded
    if (profile?.logoUrl) {
      data.logoUrl = profile.logoUrl;
    }

    try {
      const res = await fetch("/api/restaurant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Could not save your details. Please try again.");
      
      setMessage({ type: "success", text: "Saved." });
      router.refresh();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-base text-muted-foreground">Loading your details...</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Settings" description="Your restaurant details. The name and logo show on your customer menu." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        {message && <Notice tone={message.type}>{message.text}</Notice>}

        <div className="flex items-center gap-4">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt="Restaurant logo" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="size-8 text-[#adb5bd]" />
            )}
          </div>
          <div className="space-y-2">
            <span className="block text-[15px] font-semibold text-foreground">Logo</span>
            <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer", isUploading && "pointer-events-none opacity-60")}>
              {isUploading ? "Uploading..." : profile.logoUrl ? "Change logo" : "Upload logo"}
              <input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} disabled={isUploading} />
            </label>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Restaurant name</Label>
            <Input id="name" name="name" defaultValue={profile.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerName">Owner name</Label>
            <Input id="ownerName" name="ownerName" defaultValue={profile.ownerName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={profile.phone} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={profile.address} required />
          </div>
        </div>

        <fieldset className="space-y-3 border-t border-border pt-5">
          <legend className="flex items-center gap-2 text-base font-bold text-foreground">
            <MessageCircle className="size-5 text-success" />
            Customer WhatsApp number
          </legend>
          <p className="text-[15px] text-muted-foreground">
            When customers scan the table QR, ask for their WhatsApp number with a 6-digit code. Their bill is sent there, and
            those who tick &quot;Send me offers&quot; show up in Customers.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: "OFF", label: "Don't ask", hint: "No number, no e-bill" },
              { value: "OPTIONAL", label: "Ask, can skip", hint: "Recommended" },
              { value: "REQUIRED", label: "Must verify", hint: "Before the first order" },
            ].map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] border-input p-3 has-checked:border-primary has-checked:bg-primary-soft"
              >
                <input
                  type="radio"
                  name="customerOtp"
                  value={o.value}
                  defaultChecked={(profile.customerOtp ?? "OFF") === o.value}
                  className="mt-0.5 size-5 accent-[#d9480f]"
                />
                <span>
                  <span className="block text-base font-semibold text-foreground">{o.label}</span>
                  <span className="block text-sm text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
