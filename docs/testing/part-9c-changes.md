# Testing the Part 9c changes: separate pages, and reported children start as absent

What this changes:

- **Separate pages:** a child's page shows attendance only again. Pickup codes and absence reports each have their own page, for all the parent's children, with a **Child** choice on the form (it is picked for you when you have one child).
  - **Website:** **Pickups** and **Absences** in the parent menu.
  - **App:** on **Children**, a group **For the school** with **Pickup codes** and **Absences**.
- **Reported children start as absent:** a child whose parent reported an absence is marked **Absent** on that day's registers:
  - when the register is opened, and
  - when the report comes in while a register is already open.

  The teacher can change the mark if the child comes after all. Marks the teacher already gave are never changed.

**Where:** Website, https://rollcol.vercel.app on your computer. App, the development build on your iPhone.

**Accounts** (password `RollCol-Test-2026`): the parent (your number), **basic.teacher1@rollcol.test** (Basic 4's class teacher, School ID `BT001`).

## Installation

1. Extract `rollcol-part9c-changes.zip` into the project folder, replacing files when asked.
2. **Delete this file**, which the zip cannot remove (the website will not build while it is there):
   ```
   Remove-Item -LiteralPath "apps\web\src\app\parent\child\[id]\extras.tsx"
   ```
3. Update the database. It should list `20261207000000_absence_defaults.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
4. Commit and push, then wait for Vercel to finish.
5. App: from `apps/mobile`, run `pnpm exec expo start --dev-client --clear`. No new build.

## Tests

### Test 1: the child's page is attendance only

1. **App**, as the parent: **Children**, tap **Abena Mensah**. Expected: the week with arrows and the week's attendance only. No pickup codes or absences.
2. **Website**, as the parent: **Children > Abena Mensah**. Expected: the same, attendance only.

### Test 2: pickup codes on their own page

1. **App**, as the parent: **Children**. Expected under the children: **For the school**, with **Pickup codes** and **Absences**.
2. Tap **Pickup codes**. Expected: the explanation, **Make a pickup code**, and your codes from the last week (for example Uncle Kofi, **Collected**), each with the child's name.
3. Tap **Make a pickup code**. Expected: a **Child** choice with your three children. Choose **Adwoa Amoah**, type **Auntie Esi**, tap **Make a code**. Expected: the code. Tap **Done**.
4. Expected: back on **Pickup codes**, with Auntie Esi's code, **Ready**, and **Share** and **Cancel** under it. Tap **Share**: the share sheet opens with the code.
5. **Website**, as the parent: click **Pickups** in the menu. Expected: **Make a code** (with **Child**, **Day**, **Who collects** and **Their phone**) and **Your codes**, including Auntie Esi.

### Test 3: absences on their own page

1. **Website**, as the parent: click **Absences**. Expected: **Report an absence** with **Child**, **Reason**, **From**, **To** and a note; and **Reported absences**.
2. Choose **Akosua Appiah**, **Sick**, from today to today, and click **Report absence**. Expected: "Reported. The class teacher has been told." and the report listed with Akosua's name.
3. **App**, as the parent: **Children > Absences**. Expected: the same report, with **Cancel**, and **Report an absence** at the top.

### Test 4: a reported child starts as absent on a new register

1. If **Basic 4**'s register for today is already open, use Test 5 instead (or try this tomorrow).
2. **App**, sign in as **basic.teacher1**: on **Today**, open **Basic 4**'s register.
3. Expected: **Akosua Appiah** is already marked **Absent**, with "Parent reported absent: Sick" under her name. Everyone else is not marked.
4. Tap **Present** for Akosua. Expected: it changes to Present. (The teacher can always change it.) Mark the others and submit.

### Test 5: a report while the register is open

1. **App**, as **basic.teacher1**: open today's **Basic 4** register (or keep it open). Leave **Adwoa Amoah** unmarked.
2. **Website**, as the parent: **Absences**, report **Adwoa Amoah**, **Family matter**, today to today.
3. **App**, as **basic.teacher1**: pull down on the register. Expected: **Adwoa Amoah** is now **Absent**, with "Parent reported absent: Family matter".
4. **Website**, as **basic.teacher1@rollcol.test**: open the same register under **Registers**. Expected: Adwoa shows **Absent** with the same note.
5. If you had already marked Adwoa before step 2, expected instead: your mark stays as it was, with the note under her name.
