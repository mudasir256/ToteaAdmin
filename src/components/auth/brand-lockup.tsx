import Image from "next/image";
import Link from "next/link";

const logoUrl = "https://to-tea.vercel.app/assets/logo-CKB8Ex8V.png";

export function BrandLockup() {
  return (
    <Link
      href="/login"
      className="inline-flex items-center gap-3 rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-4 focus-visible:ring-offset-(--surface)"
      aria-label="ToTea dashboard sign in"
    >
      <Image
        src={logoUrl}
        alt="ToTea"
        width={48}
        height={48}
        priority
        className="size-11 rounded-full border border-(--line) bg-(--surface-raised) object-cover"
      />
      <span className="grid gap-0.5">
        <span className="text-lg font-semibold tracking-tight text-foreground">ToTea</span>
        <span className="text-[10px] font-medium tracking-[0.18em] text-(--muted)">
          BUBBLE TEA &amp; MORE
        </span>
      </span>
    </Link>
  );
}
