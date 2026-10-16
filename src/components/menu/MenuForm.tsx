"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };
type MenuItem = any; // We can type this strictly later

interface MenuFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: MenuItem;
  categories: Category[];
}

export function MenuForm({ isOpen, onClose, onSuccess, initialData, categories }: MenuFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    setError(null);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Could not upload the photo. Please try again.");
      
      const data = await res.json();
      setImageUrl(data.url);
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      categoryId: formData.get("categoryId"),
      isVeg: formData.get("isVeg") === "true",
      isSpicy: formData.get("isSpicy") === "true",
      isAvailable: formData.get("isAvailable") === "true", // unchecked boxes are absent from FormData
      imageUrl,
    };

    try {
      const url = isEditing ? `/api/menu/${initialData.id}` : "/api/menu";
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit dish" : "Add dish"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Change the details and save." : "Fill in the details. The dish appears on your QR menu after you save."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <Notice>{error}</Notice>}

          <div className="space-y-2">
            <Label htmlFor="name">Dish name</Label>
            <Input id="name" name="name" defaultValue={initialData?.name} placeholder="Paneer Butter Masala" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input id="price" name="price" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={initialData?.price} placeholder="220" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={initialData?.categoryId || ""}
                required
                className="h-12 w-full rounded-xl border-[1.5px] border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
              >
                <option value="" disabled>Choose</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="description" name="description" defaultValue={initialData?.description || ""} placeholder="Soft paneer in rich tomato gravy" className="resize-none" />
          </div>

          <div className="space-y-2">
            <span className="text-[15px] font-semibold text-foreground">
              Photo <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                {imageUrl ? (
                  <img src={imageUrl} alt="Dish" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="size-7 text-[#adb5bd]" />
                )}
              </div>
              <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer", isUploading && "pointer-events-none opacity-60")}>
                {isUploading ? "Uploading..." : imageUrl ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={isUploading} />
              </label>
            </div>
          </div>

          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">Dish options</legend>
            {[
              { id: "isAvailable", label: "Available now", checked: initialData ? initialData.isAvailable : true },
              { id: "isVeg", label: "Vegetarian", checked: initialData ? initialData.isVeg : true },
              { id: "isSpicy", label: "Spicy", checked: initialData ? initialData.isSpicy : false },
            ].map((opt) => (
              <label
                key={opt.id}
                htmlFor={opt.id}
                className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-input px-3 text-base font-medium has-checked:border-primary has-checked:bg-primary-soft"
              >
                <input type="checkbox" id={opt.id} name={opt.id} value="true" defaultChecked={opt.checked} className="size-5 accent-[#d9480f]" />
                {opt.label}
              </label>
            ))}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isUploading}>
              {isLoading ? "Saving..." : "Save dish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
