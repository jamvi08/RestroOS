"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";

type Table = any;

interface TableFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Table;
}

export function TableForm({ isOpen, onClose, onSuccess, initialData }: TableFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      tableNumber: formData.get("tableNumber"),
      label: formData.get("label"),
      capacity: formData.get("capacity"),
    };

    try {
      const url = isEditing ? `/api/tables/${initialData.id}` : "/api/tables";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Something went wrong");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit table" : "Add table"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Change the table details and save." : "You'll get a QR code for this table after saving."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <Notice>{error}</Notice>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tableNumber">Table number</Label>
              <Input
                id="tableNumber"
                name="tableNumber"
                defaultValue={initialData?.tableNumber}
                placeholder="5"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Seats</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                inputMode="numeric"
                min="1"
                defaultValue={initialData?.capacity || 4}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="label"
              name="label"
              defaultValue={initialData?.label || ""}
              placeholder="Window side, family section"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
