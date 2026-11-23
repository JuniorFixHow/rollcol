# Testing the Part 8b fixes, round 2

What this changes:

- **Overview of a paid workspace** now shows the plan (for example **"Alerts plan"**, with the students paid for), not "A free workspace".
- **Billing in a workspace:** the card is now called **"Add students to this term's plan"** (or semester's) and explains that workspaces have one paid plan, so there is nothing to switch. A plan paid for a term that has not started yet now shows as **"Paid ahead"** on the plan card.
- **Top right of the dashboard:** a bell for notifications (with the unread count) and your initials. Clicking your initials opens a menu with your name and email, **Your account**, **Notifications**, **RollCol platform** (platform admins only), the theme, and **Sign out**. These are no longer at the bottom of the side menu.

**Where:** Website, https://rollcol.vercel.app on your computer, and on your phone's browser where a step says so.

**Accounts** (password `RollCol-Test-2026`): **basic.teacher1@rollcol.test** (Samuel Ankrah, owner of the classes workspace you paid for), **basic.admin@rollcol.test**, and your own account (platform admin).

## Installation

1. Extract `rollcol-part8b-fixes-2.zip` into the project folder, replacing files when asked. No migration, no function, no package, no app change.
2. Commit and push, then wait for Vercel to finish the deployment.

## Tests

### Test 1: a paid workspace's overview

1. **Website**, as **basic.teacher1@rollcol.test**: switch to the workspace you paid for (school switcher at the top of the side menu), then open **Overview**.
2. Expected: a green notice **"Alerts plan"**: "This term's plan covers N students in this workspace. Guardians get absence and late alerts by SMS.", with a **Billing** link. The Students card says **"X of N (this term's plan)"**.
3. If you still see **"A free workspace"**, open **Billing** and check whether the plan card says **"Paid ahead"**: that means you paid for a term that has not started yet, so the free limits apply until it starts. Tell me which term you paid for.

### Test 2: Billing in the workspace

1. **Website**, same account and workspace: open **Billing**.
2. Expected: the plan card is titled **"Alerts plan"**, with **Paid for** showing the term and its dates.
3. Expected: a card **"Add students to this term's plan"** that says workspaces have one paid plan, with **More students** and **Pay for more students**. There is no upgrade, as expected.

### Test 3: the bell and the account menu

1. **Website**, same account: look at the top right of any dashboard page. Expected: a bell and a circle with **SA**. The side menu no longer has **Notifications**, **Your account**, the theme or **Sign out** at the bottom.
2. If you have unread notifications, a number shows on the bell. Click the bell. Expected: the Notifications page opens and the number disappears.
3. Click **SA**. Expected: a menu with **Samuel Ankrah**, the email, **Your workspace** (or **Teacher, Test: Adenta Basic School** when you switch to the school), **Your account**, **Notifications**, **Theme** (Auto, Light, Dark) and **Sign out**.
4. Click **Dark** in the menu. Expected: the page turns dark and the menu stays open. Click **Auto** to go back.
5. Click anywhere outside the menu. Expected: it closes. Open it again and press **Esc**. Expected: it closes.
6. Open it and click **Your account**. Expected: the account page opens and the menu closes.
7. **Website**, signed in as **your own account**: open the menu. Expected: **RollCol platform** is in it.
8. **Phone browser**, as **basic.admin@rollcol.test**: the bar at the top shows the page name, the bell, **GA**, and **Menu**. Tap **GA**. Expected: the same menu, fully on screen. Tap **Sign out**. Expected: you are signed out.
