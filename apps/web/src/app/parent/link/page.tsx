import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { linkChildren } from "../actions";

export const metadata: Metadata = { title: "Add your child" };

export default async function LinkChildPage() {
  await requireParent();
  return (
    <>
      <PageHeader
        title="Add your child"
        description={
          <Link href="/parent" className="text-accent hover:underline">
            Your children
          </Link>
        }
      />
      <Card>
        <ActionForm action={linkChildren} className="max-w-md space-y-4">
          <p className="text-sm">
            Type one of your child&apos;s names, as the school has it. Your other children at the same school appear too.
          </p>
          <TextField name="name" label="Child's name" hint="First name or surname, for example Abena." autoComplete="off" />
          <FormMessage />
          <SubmitButton pendingLabel="Linking...">Link</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
