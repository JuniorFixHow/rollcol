import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="mb-8">
        <Brand />
      </div>
      <main className="w-full max-w-md">{children}</main>
      <footer className="mt-10 flex gap-4 text-xs text-muted">
        <a href="/privacy" className="hover:text-foreground">
          Privacy policy
        </a>
        <a href="/terms" className="hover:text-foreground">
          Terms of use
        </a>
      </footer>
    </div>
  );
}
