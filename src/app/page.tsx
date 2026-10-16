import Link from "next/link";
import { ArrowRight, Check, ChevronRight, MessageCircle, QrCode, BellRing, BookOpen, LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const steps = [
  { icon: BookOpen, title: "Add your menu", hi: "मेन्यू जोड़ें", text: "Type your dishes and prices. Takes about 10 minutes." },
  { icon: QrCode, title: "Print table QR codes", hi: "QR प्रिंट करें", text: "Stick one QR code on each table." },
  { icon: BellRing, title: "Receive orders", hi: "ऑर्डर पाएं", text: "Customers order from their phone. You see it instantly." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo />
          <Link href="/login" className={cn(buttonVariants({ variant: "outline-primary", size: "sm" }))}>
            <LogIn />
            Login / लॉग इन
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:items-start md:gap-14 md:py-16">
        <section className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ffd8a8] bg-primary-soft px-3.5 py-1.5 text-sm font-semibold text-primary-strong">
            <span className="size-2 rounded-full bg-success" />
            QR स्कैन करें, मेन्यू देखें, ऑर्डर करें
          </span>

          <div className="space-y-4">
            <h1 className="text-[2rem] leading-tight font-bold tracking-tight text-foreground md:text-5xl">
              Take table orders on your customer&apos;s phone
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              Customers scan a QR code on the table, see your menu and order. No app download needed.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "sm:px-8")}>
              Register restaurant – Free
              <ArrowRight />
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline-primary", size: "lg" }))}>
              I already have an account
            </Link>
          </div>

          <Link
            href="/waiter/login"
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-success"
          >
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
              <MessageCircle className="size-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-semibold text-foreground">Waiter or staff?</span>
              <span className="block text-[15px] text-muted-foreground">Waiter login with your mobile number</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-foreground">
            How it works <span className="font-semibold text-muted-foreground">/ कैसे काम करता है</span>
          </h2>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                  {i + 1}
                </span>
                <div className="space-y-0.5">
                  <h3 className="text-base font-semibold text-foreground">
                    {step.title} <span className="font-medium text-muted-foreground">· {step.hi}</span>
                  </h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[15px] font-medium text-muted-foreground">
            {["Free to start", "Works on any phone", "Hindi & English"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-success" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} RestroOS · Made for India&apos;s restaurants and dhabas
      </footer>
    </div>
  );
}
