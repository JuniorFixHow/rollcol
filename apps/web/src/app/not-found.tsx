import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col px-4">
      <header className="mx-auto w-full max-w-5xl py-5">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center pb-16">
        <NotFoundView home="/" homeLabel="Go to the home page" />
      </main>
    </div>
  );
}
