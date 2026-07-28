import Image from "next/image";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/auth/brand-lockup";

const drinks = {
  mango: "https://to-tea.vercel.app/assets/MangoSagoCoconutMilk-Bq8wQafP.webp",
  matcha: "https://to-tea.vercel.app/assets/MatchaLatte-u18XXNNY.jpg",
  coffee: "https://to-tea.vercel.app/assets/VietnameseSeaSaltCoffee-CPCTHlCa.png",
};

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid h-[100dvh] overflow-hidden bg-(--surface) lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <section className="relative flex min-h-0 flex-col px-5 py-5 sm:px-8 lg:px-14 lg:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_0%,rgba(241,206,131,0.34),transparent_26rem)]" />
        <div className="relative"><BrandLockup /></div>
        <div className="relative mx-auto flex min-h-0 w-full max-w-[402px] flex-1 items-center py-4 sm:py-6">{children}</div>
      </section>
      <aside className="hidden min-h-0 border-l border-(--line) bg-(--surface-tint) p-4 lg:block xl:p-7">
        <div className="grid h-full min-h-0 grid-cols-[1.2fr_0.8fr] grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="col-span-2 flex items-start justify-between gap-6 pb-1">
            <div>
              <p className="text-sm font-medium text-(--accent)">ToTea workspace</p>
              <h2 className="mt-1 max-w-xs text-2xl font-semibold tracking-tight text-foreground xl:text-3xl">
                Made for the morning rush.
              </h2>
            </div>
            <div className="shrink-0 rounded-xl border border-(--line) bg-(--surface-raised) px-3 py-2 text-right text-[11px] font-medium leading-4 text-(--muted)">
              Bubble tea<br />
              and more
            </div>
          </div>
          <figure className="relative row-span-2 min-h-0 overflow-hidden rounded-[20px] bg-white shadow-[0_14px_32px_rgba(34,74,74,0.10)]">
            <Image src={drinks.mango} alt="Mango sago coconut milk from ToTea" fill priority unoptimized sizes="28vw" className="object-cover object-center" />
          </figure>
          <figure className="relative min-h-0 overflow-hidden rounded-[20px] bg-white shadow-[0_14px_32px_rgba(34,74,74,0.10)]">
            <Image src={drinks.matcha} alt="Matcha latte from ToTea" fill unoptimized sizes="18vw" className="object-cover object-center" />
          </figure>
          <figure className="relative min-h-0 overflow-hidden rounded-[20px] bg-white shadow-[0_14px_32px_rgba(34,74,74,0.10)]">
            <Image src={drinks.coffee} alt="Vietnamese sea salt coffee from ToTea" fill unoptimized sizes="18vw" className="object-cover object-center" />
          </figure>
        </div>
      </aside>
    </main>
  );
}
