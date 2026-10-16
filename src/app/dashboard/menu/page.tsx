"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Tag, Utensils } from "lucide-react";
import { VegMark } from "@/components/ui/veg-mark";
import { MenuForm } from "@/components/menu/MenuForm";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { cn, formatPrice } from "@/lib/utils";

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const fetchMenuData = async () => {
    setIsLoading(true);
    try {
      const [menuRes, catRes] = await Promise.all([
        fetch("/api/menu"),
        fetch("/api/categories")
      ]);
      if (menuRes.ok) setMenuItems(await menuRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (error) {
      console.error("Failed to load menu", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, []);

  const handleAddCategory = async () => {
    const name = window.prompt("New category name (for example: Starters, Thali, Drinks):");
    if (!name) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        fetchMenuData(); // Reload to get new categories
      }
    } catch (err) {
      alert("Could not add the category. Please try again.");
    }
  };

  const handleToggleAvailable = async (item: any) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      });
      if (res.ok) fetchMenuData();
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Delete "${item.name}" from your menu?`)) return;
    try {
      const res = await fetch(`/api/menu/${item.id}`, { method: "DELETE" });
      if (res.ok) fetchMenuData();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Menu"
        description="Your dishes and prices. Customers see this when they scan a table QR code."
        actions={
          <>
            <Button onClick={handleAddCategory} variant="outline">
              <Tag />
              Add category
            </Button>
            <Button onClick={openNew}>
              <PlusCircle />
              Add dish
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="py-20 text-center text-base text-muted-foreground">Loading menu...</div>
      ) : menuItems.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No dishes yet"
          description={
            categories.length === 0
              ? "First add a category like Thali or Starters, then add your dishes with prices."
              : "Add your first dish with its price. It will show up on your QR menu straight away."
          }
          action={
            categories.length === 0 ? (
              <Button onClick={handleAddCategory}>
                <Tag />
                Add first category
              </Button>
            ) : (
              <Button onClick={openNew}>
                <PlusCircle />
                Add first dish
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {menuItems.map((item) => (
            <article
              key={item.id}
              className={cn("flex gap-4 rounded-2xl border border-border bg-card p-4", !item.isAvailable && "bg-muted/60")}
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#adb5bd]">
                    <Utensils className="size-7" />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <VegMark isVeg={item.isVeg} />
                    <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
                  </div>
                  <span className="shrink-0 text-base font-bold tabular-nums text-foreground">{formatPrice(item.price)}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.categories?.name || "No category"}
                  {item.isSpicy && " · Spicy"}
                </p>

                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.isAvailable}
                    onClick={() => handleToggleAvailable(item)}
                    className="inline-flex items-center gap-2 text-sm font-semibold"
                  >
                    <span
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        item.isAvailable ? "bg-success" : "bg-input"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute size-5 rounded-full bg-white shadow transition-transform",
                          item.isAvailable ? "translate-x-[22px]" : "translate-x-0.5"
                        )}
                      />
                    </span>
                    <span className={item.isAvailable ? "text-success" : "text-muted-foreground"}>
                      {item.isAvailable ? "Available" : "Sold out"}
                    </span>
                  </button>

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`} onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`} onClick={() => handleDelete(item)} className="text-destructive hover:bg-destructive-soft">
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen && (
        <MenuForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchMenuData}
          initialData={editingItem}
          categories={categories}
        />
      )}
    </div>
  );
}
