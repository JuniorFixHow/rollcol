import { buttonClass } from "@/components/ui";

export function SignOutButton({ variant = "secondary" }: { variant?: Parameters<typeof buttonClass>[0] }) {
  return (
    <form action="/auth/sign-out" method="post">
      <button type="submit" className={buttonClass(variant, "sm")}>
        Sign out
      </button>
    </form>
  );
}
