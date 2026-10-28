"use client";

import { useEffect, useState } from "react";
import { Utensils, Minus, Plus, ArrowRight, BellRing, Receipt, Footprints, Loader2, Lock, PencilLine, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VegMark } from "@/components/ui/veg-mark";
import { Notice } from "@/components/ui/notice";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn, formatPrice } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";
import { STRINGS, type Lang } from "./i18n";
import { VerifyPhone } from "./VerifyPhone";

interface Category {
  id: string;
  name: string;
  displayOrder: number;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  isSpicy: boolean;
  isBestseller: boolean;
}

interface Restaurant {
  name: string;
  logo: string | null;
  currency: string;
  /** Ask for a WhatsApp number on this menu: OFF, OPTIONAL (can skip) or REQUIRED (before ordering) */
  customerOtp: "OFF" | "OPTIONAL" | "REQUIRED";
}

interface MenuDisplayProps {
  restaurant: Restaurant;
  slug: string;
  token: string;
  tableNumber: string;
  categories: Category[];
  menuItems: MenuItem[];
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  note: string;
}

type RequestType = "CALL_WAITER" | "WATER" | "BILL";
type OrderStatus = "RECEIVED" | "PREPARING" | "READY" | "SERVED";

interface TableStatus {
  /** FREE: nobody owns the table yet (ordering claims it). OWNER: this phone. TAKEN: another phone. */
  access: "FREE" | "OWNER" | "TAKEN";
  paid: { canRate: boolean } | null;
  /** This phone verified a WhatsApp number here (masked), so the e-bill goes there */
  customer: { phone: string } | null;
  orders: {
    id: string;
    status: OrderStatus;
    total: number;
    items: { id: string; name: string; quantity: number; price: number; isVeg: boolean; specialInstructions: string | null }[];
  }[];
  requests: { id: string; type: RequestType; status: "OPEN" | "ACKNOWLEDGED" }[];
  bill: { subtotal: number; tax: number; total: number; taxRate: number } | null;
}

const HELP_ICONS: Record<RequestType, string> = { CALL_WAITER: "🙋", WATER: "💧", BILL: "🧾" };
const LANG_KEY = "restro.lang";
const SKIPPED_KEY = "restro.skipVerify";

function QuantityStepper({ quantity, onChange, label }: { quantity: number; onChange: (delta: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border-[1.5px] border-primary bg-primary-soft">
      <button type="button" onClick={() => onChange(-1)} aria-label={`One less ${label}`} className="inline-flex size-10 items-center justify-center rounded-l-xl text-primary hover:bg-[#ffe8cc]">
        <Minus className="size-4" />
      </button>
      <span className="min-w-7 text-center text-base font-bold tabular-nums text-foreground">{quantity}</span>
      <button type="button" onClick={() => onChange(1)} aria-label={`One more ${label}`} className="inline-flex size-10 items-center justify-center rounded-r-xl text-primary hover:bg-[#ffe8cc]">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "Something went wrong."), { code: data.code as string | undefined });
  return data;
}

export function MenuDisplay({ restaurant, slug, token, tableNumber, categories, menuItems }: MenuDisplayProps) {
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];

  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id || "");
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [helpBusy, setHelpBusy] = useState<RequestType | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [ratingSent, setRatingSent] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  // Customer closed the WhatsApp sheet this visit: don't pop it up again by itself
  const [verifySkipped, setVerifySkipped] = useState(false);
  const [orderAfterVerify, setOrderAfterVerify] = useState(false);

  // Remember the customer's language on this phone (after mount: no localStorage on the server)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
      if (saved === "hi" || saved === "en") setLang(saved);
    } catch {
      // storage blocked: stay in English
    }
  }, []);

  const toggleLang = () => {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // not critical
    }
  };

  const status = usePoll<TableStatus>(`/api/public/table?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`, 8000);
  const access = status.data?.access ?? "FREE";
  const canOrder = access !== "TAKEN";
  const myOrders = status.data?.orders ?? [];
  const myRequests = status.data?.requests ?? [];
  const orderedCount = myOrders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0);
  const price = (n: number) => formatPrice(n, restaurant.currency);
  const verifiedPhone = status.data?.customer?.phone ?? null;
  const askNumber = restaurant.customerOtp !== "OFF" && canOrder && status.data !== null && !verifiedPhone && !status.data.paid;

  // Right after the scan: ask for the WhatsApp number once (unless skipped earlier this visit)
  useEffect(() => {
    let skipped = false;
    try {
      skipped = sessionStorage.getItem(SKIPPED_KEY) === slug;
    } catch {
      // storage blocked: ask once per page load
    }
    if (skipped) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
      setVerifySkipped(true);
      return;
    }
    if (askNumber && !verifySkipped) setIsVerifyOpen(true);
    // Only when the first table status arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askNumber]);

  const onVerifyOpenChange = (open: boolean) => {
    setIsVerifyOpen(open);
    if (open) return;
    setOrderAfterVerify(false);
    setVerifySkipped(true);
    try {
      sessionStorage.setItem(SKIPPED_KEY, slug);
    } catch {
      // not critical
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      const offsetPosition = element.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  const updateQuantity = (item: MenuItem, delta: number) => {
    setCart((prev) => {
      const current = prev[item.id];
      const quantity = (current?.quantity || 0) + delta;
      if (quantity <= 0) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: { menuItem: item, quantity, note: current?.note ?? "" } };
    });
  };

  const setNote = (id: string, note: string) =>
    setCart((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], note } } : prev));

  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((acc, c) => acc + c.quantity, 0);
  const totalPrice = cartItems.reduce((acc, c) => acc + c.menuItem.price * c.quantity, 0);
  const visibleItems = vegOnly ? menuItems.filter((i) => i.isVeg) : menuItems;

  // Server messages are English; the "another phone" case is common enough to translate
  const errorText = (err: unknown) =>
    (err as { code?: string })?.code === "TABLE_TAKEN" ? `${t.takenTitle}. ${t.takenText}` : err instanceof Error ? err.message : t.error;

  const placeOrder = async () => {
    // Restaurant wants a verified number before the first order
    if (restaurant.customerOtp === "REQUIRED" && !verifiedPhone) {
      setIsCartOpen(false);
      setOrderAfterVerify(true);
      setIsVerifyOpen(true);
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    try {
      await postJson("/api/public/orders", {
        slug,
        token,
        items: cartItems.map((c) => ({ menuItemId: c.menuItem.id, quantity: c.quantity, note: c.note })),
      });
      setCart({});
      setOpenNotes({});
      setIsCartOpen(false);
    } catch (err) {
      if ((err as { code?: string })?.code === "VERIFY_PHONE") {
        setIsCartOpen(false);
        setOrderAfterVerify(true);
        setIsVerifyOpen(true);
        return;
      }
      setPlaceError(errorText(err));
      setIsCartOpen(true);
    } finally {
      setPlacing(false);
      void status.refresh();
    }
  };

  const onVerified = async () => {
    setIsVerifyOpen(false);
    await status.refresh();
    if (orderAfterVerify) {
      setOrderAfterVerify(false);
      setIsCartOpen(true);
    }
  };

  const askForHelp = async (type: RequestType) => {
    setHelpBusy(type);
    setHelpError(null);
    try {
      await postJson("/api/public/requests", { slug, token, type });
      setIsHelpOpen(false);
    } catch (err) {
      setHelpError(errorText(err));
    } finally {
      setHelpBusy(null);
      void status.refresh();
    }
  };

  const sendRating = async () => {
    if (!rating) return;
    setRatingBusy(true);
    try {
      await postJson("/api/public/feedback", { slug, token, rating, comment });
    } catch {
      // Already rated or window passed: nothing useful to show the customer
    } finally {
      setRatingSent(true);
      setRatingBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card shadow-[0_1px_0_var(--border)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
            {restaurant.logo ? <img src={restaurant.logo} alt="" className="h-full w-full object-cover" /> : <Utensils className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-1 text-lg leading-tight font-bold text-foreground">{restaurant.name}</h1>
            <p className="text-sm font-semibold text-primary-strong">{t.table(tableNumber)}</p>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="h-10 shrink-0 rounded-full border-[1.5px] border-input px-3.5 text-[15px] font-semibold text-foreground"
            lang={lang === "en" ? "hi" : "en"}
          >
            {t.switchTo}
          </button>
        </div>

        <div className="border-t border-border bg-background">
          <div className="hide-scrollbar mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3">
            <button
              type="button"
              onClick={() => setVegOnly((v) => !v)}
              aria-pressed={vegOnly}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 text-[15px] font-semibold transition-colors",
                vegOnly ? "border-veg bg-success-soft text-veg" : "border-input bg-card text-foreground"
              )}
            >
              <VegMark isVeg />
              {t.vegOnly}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={cn(
                  "h-10 shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-4 text-[15px] font-semibold transition-colors",
                  activeCategory === cat.id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:border-primary"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-4 empty:hidden">
        {/* Bill paid on this phone: thank you + one-tap rating */}
        {status.data?.paid && (
          <section className="space-y-3 rounded-2xl border-2 border-success bg-success-soft p-4">
            <p className="flex items-center gap-2 text-lg font-bold text-success">
              <CheckCircle2 className="size-6" /> {t.paidTitle}
            </p>
            {status.data.paid.canRate && !ratingSent ? (
              <>
                <p className="text-base font-semibold text-foreground">{t.rateQ}</p>
                <div className="grid grid-cols-3 gap-2">
                  {["😞", "😐", "😊"].map((emoji, i) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-pressed={rating === i + 1}
                      onClick={() => setRating(i + 1)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 bg-card py-3 text-sm font-semibold",
                        rating === i + 1 ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                      )}
                    >
                      <span className="text-3xl">{emoji}</span>
                      {t.rate[i]}
                    </button>
                  ))}
                </div>
                {rating && (
                  <>
                    <Textarea id="feedback-comment" placeholder={t.commentPlaceholder} value={comment} onChange={(e) => setComment(e.target.value)} className="resize-none bg-card" />
                    <Button size="lg" className="w-full" disabled={ratingBusy} onClick={sendRating}>
                      {t.send}
                    </Button>
                  </>
                )}
              </>
            ) : (
              ratingSent && <p className="text-base text-foreground">{t.thanks}</p>
            )}
          </section>
        )}

        {/* Another phone owns this table: read-only menu */}
        {access === "TAKEN" && (
          <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-base font-bold text-foreground">{t.takenTitle}</p>
              <p className="text-[15px] text-muted-foreground">{t.takenText}</p>
            </div>
          </div>
        )}

        {myRequests.map((r) => (
          <div
            key={r.id}
            role="status"
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold",
              r.status === "ACKNOWLEDGED" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
            )}
          >
            {r.status === "ACKNOWLEDGED" ? <Footprints className="size-5 shrink-0" /> : <Loader2 className="size-5 shrink-0 animate-spin" />}
            {r.status === "ACKNOWLEDGED" ? t.waiterComing(tableNumber) : t.requestSent(r.type)}
          </div>
        ))}

        {myOrders.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOrdersOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Receipt className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-foreground">{t.yourOrder(orderedCount)}</span>
              <span className="block text-[15px] text-muted-foreground">{t.billSoFar(price(status.data?.bill?.total ?? 0))}</span>
            </span>
            <span className="text-[15px] font-semibold text-primary">{t.view}</span>
          </button>
        )}

        {/* Skipped the WhatsApp sheet earlier: a quiet way back to it */}
        {askNumber && verifySkipped && (
          <button
            type="button"
            onClick={() => setIsVerifyOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#b2f2bb] bg-success-soft px-4 py-3 text-left text-[15px] font-semibold text-success"
          >
            <MessageCircle className="size-5 shrink-0" />
            <span className="flex-1">{t.verifyTitle}</span>
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>

      {/* Menu */}
      <main className="mx-auto max-w-2xl space-y-8 px-4 pt-5">
        {categories.map((category) => {
          const items = visibleItems.filter((i) => i.categoryId === category.id);
          if (items.length === 0) return null;

          return (
            <section key={category.id} id={`category-${category.id}`} className="scroll-mt-40">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-foreground">{category.name}</h2>
                <span className="text-sm text-muted-foreground">{t.itemCount(items.length)}</span>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const quantity = cart[item.id]?.quantity || 0;
                  return (
                    <article
                      key={item.id}
                      className={cn(
                        "flex gap-4 rounded-2xl border bg-card p-4 transition-colors",
                        quantity > 0 ? "border-primary" : "border-border",
                        !item.isAvailable && "opacity-60"
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <VegMark isVeg={item.isVeg} />
                          {item.isBestseller && (
                            <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-bold tracking-wide text-warning uppercase">{t.bestseller}</span>
                          )}
                          {item.isSpicy && <span className="text-xs font-semibold text-nonveg">🌶 {t.spicy}</span>}
                        </div>
                        <h3 className="text-[17px] leading-snug font-semibold text-foreground">{item.name}</h3>
                        {item.description && <p className="line-clamp-2 text-[15px] leading-snug text-muted-foreground">{item.description}</p>}
                        <p className="pt-0.5 text-lg font-bold tabular-nums text-foreground">{price(item.price)}</p>
                      </div>

                      <div className="flex shrink-0 flex-col items-center justify-center gap-3">
                        {item.imageUrl && (
                          <div className="size-24 overflow-hidden rounded-xl bg-muted">
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                        )}
                        {!item.isAvailable ? (
                          <span className="rounded-lg bg-destructive-soft px-3 py-2 text-sm font-semibold text-destructive">{t.soldOut}</span>
                        ) : !canOrder ? null : quantity > 0 ? (
                          <QuantityStepper quantity={quantity} label={item.name} onChange={(d) => updateQuantity(item, d)} />
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, 1)}
                            className="h-10 min-w-24 rounded-xl border-[1.5px] border-primary bg-card px-5 text-base font-bold text-primary transition-colors hover:bg-primary-soft"
                          >
                            {t.add}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {visibleItems.length === 0 && <p className="py-16 text-center text-base text-muted-foreground">{vegOnly ? t.noVeg : t.emptyMenu}</p>}
      </main>

      {/* Floating Help button, bottom-left so it never covers the ADD buttons on the right */}
      {canOrder && (
        <button
          type="button"
          onClick={() => {
            setHelpError(null);
            setIsHelpOpen(true);
          }}
          className={cn(
            "fixed left-[max(16px,env(safe-area-inset-left))] z-30 inline-flex h-14 items-center gap-2 rounded-full bg-success px-5 text-base font-bold text-white shadow-lg transition-[bottom]",
            totalItems > 0 ? "bottom-[calc(88px+env(safe-area-inset-bottom))]" : "bottom-[calc(20px+env(safe-area-inset-bottom))]"
          )}
        >
          <BellRing className="size-5" />
          {t.help}
        </button>
      )}

      {/* Cart bar */}
      {totalItems > 0 && canOrder && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-primary pb-[env(safe-area-inset-bottom)] text-primary-foreground shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
            <p className="text-lg font-bold tabular-nums">
              {t.itemCount(totalItems)} · {price(totalPrice)}
            </p>
            <button
              type="button"
              onClick={() => {
                setPlaceError(null);
                setIsCartOpen(true);
              }}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-card px-5 text-base font-bold text-primary-strong"
            >
              {t.viewOrder} <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* Cart: check items, add a note per dish, place order */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.cartTitle}</DialogTitle>
            <DialogDescription>{t.cartDesc}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {cartItems.map((c) => (
              <div key={c.menuItem.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <VegMark isVeg={c.menuItem.isVeg} />
                      <p className="line-clamp-1 text-base font-semibold text-foreground">{c.menuItem.name}</p>
                    </div>
                    <p className="mt-0.5 pl-6 text-sm text-muted-foreground">
                      {price(c.menuItem.price)} {t.each}
                    </p>
                  </div>
                  <QuantityStepper quantity={c.quantity} label={c.menuItem.name} onChange={(d) => updateQuantity(c.menuItem, d)} />
                </div>
                {openNotes[c.menuItem.id] || c.note ? (
                  <Input
                    id={`note-${c.menuItem.id}`}
                    aria-label={`${t.addNote}: ${c.menuItem.name}`}
                    placeholder={t.notePlaceholder}
                    maxLength={100}
                    value={c.note}
                    onChange={(e) => setNote(c.menuItem.id, e.target.value)}
                    className="h-11 text-[15px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenNotes((o) => ({ ...o, [c.menuItem.id]: true }))}
                    className="ml-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary"
                  >
                    <PencilLine className="size-4" /> {t.addNote}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4 text-lg font-bold">
            <span>{t.total}</span>
            <span className="tabular-nums">{price(totalPrice)}</span>
          </div>

          {placeError && <Notice>{placeError}</Notice>}

          <DialogFooter>
            <Button size="lg" className="w-full" disabled={placing || cartItems.length === 0} onClick={placeOrder}>
              {placing ? t.sending : t.placeOrder}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help: call waiter / water / bill */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.helpTitle}</DialogTitle>
            <DialogDescription>{t.helpDesc}</DialogDescription>
          </DialogHeader>
          {helpError && <Notice>{helpError}</Notice>}
          <div className="grid gap-3">
            {(["CALL_WAITER", "WATER", "BILL"] as RequestType[]).map((type) => {
              const [title, sub] = t[`help_${type}`];
              const pending = myRequests.find((r) => r.type === type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={helpBusy !== null}
                  onClick={() => askForHelp(type)}
                  className="flex items-center gap-4 rounded-2xl border-[1.5px] border-input bg-card p-4 text-left transition-colors hover:border-primary disabled:opacity-60"
                >
                  <span className="text-3xl" aria-hidden>{HELP_ICONS[type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-foreground">{title}</span>
                    <span className="block text-[15px] text-muted-foreground">
                      {pending ? (pending.status === "ACKNOWLEDGED" ? t.waiterComing(tableNumber) : t.alreadySent) : sub}
                    </span>
                  </span>
                  {helpBusy === type && <Loader2 className="size-5 animate-spin text-primary" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <VerifyPhone
        open={isVerifyOpen}
        onOpenChange={onVerifyOpenChange}
        slug={slug}
        token={token}
        restaurantName={restaurant.name}
        required={restaurant.customerOtp === "REQUIRED"}
        t={t}
        onVerified={onVerified}
      />

      {/* Orders placed from this phone, with the running bill */}
      <Dialog open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.yourOrder(orderedCount)}</DialogTitle>
            <DialogDescription>{t.changeHint}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto">
            {myOrders.map((o, idx) => (
              <section key={o.id} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-foreground">{t.orderN(idx + 1)}</h3>
                  <span className={cn("text-sm font-semibold", o.status === "SERVED" ? "text-success" : "text-primary")}>
                    {t.status[o.status]}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="text-base">
                      <div className="flex items-center gap-2">
                        <VegMark isVeg={i.isVeg} />
                        <span className="min-w-0 flex-1 truncate">{i.quantity} × {i.name}</span>
                        <span className="tabular-nums text-muted-foreground">{price(i.price * i.quantity)}</span>
                      </div>
                      {i.specialInstructions && <p className="pl-6 text-sm text-muted-foreground">📝 {i.specialInstructions}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {status.data?.bill && status.data.bill.total > 0 && (
            <dl className="space-y-1 border-t border-border pt-3 text-base tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <dt>{t.items}</dt>
                <dd>{price(status.data.bill.subtotal)}</dd>
              </div>
              {status.data.bill.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>{t.tax(status.data.bill.taxRate)}</dt>
                  <dd>{price(status.data.bill.tax)}</dd>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-foreground">
                <dt>{t.total}</dt>
                <dd>{price(status.data.bill.total)}</dd>
              </div>
            </dl>
          )}
          {verifiedPhone && (
            <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
              <MessageCircle className="size-4 shrink-0 text-success" /> {t.verified(verifiedPhone)}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
