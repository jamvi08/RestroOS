import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Shared frame for login and signup: top bar with back arrow, centred column. */
export function AuthShell({
  title,
  backHref = "/",
  children,
  footer,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2 px-2">
          <Link
            href={backHref}
            aria-label="Back"
            className="inline-flex size-12 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-6" />
          </Link>
          <span className="text-lg font-bold text-foreground">{title}</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">{children}</main>
      {footer && <div className="mx-auto w-full max-w-lg px-4 pb-8 text-center text-[15px] text-muted-foreground">{footer}</div>}
    </div>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6">{children}</div>;
}
