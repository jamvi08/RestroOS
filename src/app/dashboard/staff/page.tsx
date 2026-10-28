"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Notice } from "@/components/ui/notice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: "WAITER" | "MANAGER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "WAITER",
  });

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);
      }
    } catch (err) {
      console.error("Failed to load staff", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate 10-digit phone
    const cleaned = formData.phone.replace(/\D/g, "").slice(-10);
    if (cleaned.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: cleaned,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to add staff member");
      }

      setIsAddModalOpen(false);
      setFormData({ name: "", phone: "", role: "WAITER" });
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (staff: StaffMember) => {
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !staff.isActive }),
      });

      if (res.ok) {
        fetchStaff();
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}? They won't be able to log in any more.`)) return;

    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchStaff();
      }
    } catch (err) {
      console.error("Failed to delete staff member", err);
    }
  };

  const totalStaff = staffList.length;
  const activeWaiters = staffList.filter((s) => s.role === "WAITER" && s.isActive).length;

  const openAdd = () => {
    setError(null);
    setIsAddModalOpen(true);
  };

  const roleStyle: Record<StaffMember["role"], string> = {
    ADMIN: "bg-[#f3f0ff] text-[#6741d9]",
    MANAGER: "bg-[#e7f5ff] text-[#1971c2]",
    WAITER: "bg-success-soft text-success",
  };
  const roleLabel: Record<StaffMember["role"], string> = { ADMIN: "Admin", MANAGER: "Manager", WAITER: "Waiter" };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Staff"
        description="Add your waiters' WhatsApp numbers. They log in with that number and a code we send on WhatsApp. No password to remember."
        actions={
          <Button onClick={openAdd}>
            <UserPlus />
            Add staff
          </Button>
        }
      />

      {staffList.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:max-w-md md:gap-4">
          <StatCard label="Total staff" value={totalStaff} />
          <StatCard label="Waiters who can log in" value={activeWaiters} />
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-base text-muted-foreground">Loading staff...</div>
      ) : staffList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Add a waiter's WhatsApp number. They can then log in on their own phone and take orders."
          action={
            <Button onClick={openAdd}>
              <UserPlus />
              Add first waiter
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {staffList.map((staff) => (
            <article
              key={staff.id}
              className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-4", !staff.isActive && "bg-muted/60")}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                  {staff.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-foreground">{staff.name}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", roleStyle[staff.role])}>
                      {roleLabel[staff.role]}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[15px] tabular-nums text-muted-foreground">
                    <MessageCircle className="size-4 text-success" />
                    {staff.phone ? `+91 ${staff.phone}` : staff.email || "No phone number"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${staff.name}`}
                  onClick={() => handleDeleteStaff(staff.id, staff.name)}
                  className="text-destructive hover:bg-destructive-soft"
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="flex items-center justify-end border-t border-border pt-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={staff.isActive}
                  onClick={() => handleToggleActive(staff)}
                  className="inline-flex items-center gap-2 text-sm font-semibold"
                >
                  <span className={staff.isActive ? "text-success" : "text-muted-foreground"}>
                    {staff.isActive ? "Can log in" : "Blocked"}
                  </span>
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      staff.isActive ? "bg-success" : "bg-input"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute size-5 rounded-full bg-white shadow transition-transform",
                        staff.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>
              They open the waiter login on their phone, type this number and enter the code we send on WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddStaff} className="flex flex-col gap-5">
            {error && <Notice>{error}</Notice>}

            <div className="space-y-2">
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                placeholder="Rahul Sharma"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-phone">WhatsApp number</Label>
              <PhoneInput
                id="staff-phone"
                placeholder="98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                required
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-[15px] font-semibold text-foreground">Role</legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "WAITER", label: "Waiter" },
                  { value: "MANAGER", label: "Manager" },
                ].map((r) => (
                  <label
                    key={r.value}
                    className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-input px-3 text-base font-medium has-checked:border-primary has-checked:bg-primary-soft"
                  >
                    <input
                      type="radio"
                      name="staff-role"
                      value={r.value}
                      checked={formData.role === r.value}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="size-5 accent-[#d9480f]"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
