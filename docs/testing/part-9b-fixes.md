# Testing the Part 9b fixes: messages, quiet hours and the Account screen

What this changes:

- **Website messages open in full:** on **Messages**, each message shows two lines at most. Click it to open its own page with the whole text, who it went to, its status, when it went and what it cost.
- **Quiet hours only when they matter:** the send dialog mentions quiet hours only when it is quiet hours right now. A message that uses no credits and is not held goes out without a dialog.
- **Messages are not notifications:** school messages and attendance alerts still alert the parent's phone, but they are listed only in **Messages**, which now has its own unread count. Notifications keeps the notices about the parent's account and links (confirmed, removed, ended, channel changes).
- **Opening a message:** in the app, Messages shows three lines of each, with a dot on new ones. Tap one to read it in full. Tapping a message's notification opens that message.
- **Parents delete messages:** one at a time on the message's screen, or **Delete all**. The school's own record is kept.
- **A tidier Account screen:** the app's Account screens (staff, students and parents) are now organised as grouped lists: who you are at the top, then your school or schools, Preferences, Account and About, with Delete account on its own at the bottom.

**Where:** Website, https://rollcol.vercel.app on your computer. App, the development build on your iPhone.

**Accounts** (password `RollCol-Test-2026`): the parent (your number), **basic.admin@rollcol.test**, **basic.teacher1@rollcol.test**.

## Installation

1. Extract `rollcol-part9b-fixes.zip` into the project folder, replacing files when asked.
2. Update the database. It should list `20261205000000_parent_messages_split.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
3. Commit and push, then wait for Vercel to finish.
4. App: from `apps/mobile`, run `pnpm exec expo start --dev-client --clear` and open the app.

## Tests

### Test 1: a message opens in full on the website

1. **Website**, as **basic.admin@rollcol.test**: open **Messages**, send this to **Basic 4** (long on purpose): "Test: Dear parents, the PTA meets on Friday at 3pm in the assembly hall. We will discuss the end of term party, the new uniform supplier and the sports day. Please come with your ward's report card. Thank you."
2. Expected: in **Sent and waiting**, the message shows two lines, ending with "...".
3. Click the message. Expected: a page titled **Broadcast** with the whole message, then **Details**:
   - **To:** the guardian's name and number.
   - **Sent to:** Basic 4, with the number of guardians.
   - **Status:** for example **In the app**.
   - **Sent:** the date and time.
   - **Length:** "Delivered in the RollCol app, no credits" (or the SMS and credits).
4. Click **All messages** to go back.

### Test 2: quiet hours in the send dialog

Ghana time is the same as UTC, so use your clock as it is.

1. **Website**, as **basic.admin@rollcol.test**: **Settings > SMS to guardians**. Turn on **Hold SMS during quiet hours**. Set **Quiet hours start** to one hour ago and **Quiet hours end** to two hours from now (for example 9:00 and 12:00 at 10:00). Save.
2. **Messages**: write "Test: quiet hours check." for **Basic 4** and click **Send**. Expected: RollCol's dialog says how many credits it uses (or that everyone gets it in the app), and "It is within your quiet hours, so it waits until 12:00pm." Click **Cancel**.
3. **Settings**: set quiet hours to the evening again (for example 20:00 to 6:00). Save.
4. **Messages**: send "Test: no quiet hours now." to **Basic 4**.
   - Expected, if every Basic 4 guardian with a number uses the app (0 credits): no dialog. It is sent at once.
   - Expected, if it uses credits: the dialog only mentions the credits, with nothing about quiet hours.

### Test 3: messages and notifications are separate

1. **App**, as the parent: open **Notifications** and pull down. Expected: no school messages or attendance alerts in this list, only notices such as **Link removed**.
2. **Website**, as **basic.admin@rollcol.test**: send "Test: separate lists." to **Basic 4**.
3. **App**: expected a notification on the phone as usual. The **Messages** tab gets a red count; **Notifications** does not.
4. Open **Messages**. Expected: the new message has a blue dot and shows at most three lines. The red count on the tab clears.

### Test 4: open, and delete

1. **App**, Messages: tap the long PTA message from Test 1. Expected: a **Message** screen with the school, the label, the time and the whole text.
2. Tap **Delete**, then **Delete** in RollCol's dialog. Expected: back on Messages, the message is gone.
3. **Website**, Messages: expected the message is still there for the school.
4. **App**: tap **Delete all** at the top of Messages, then **Delete all**. Expected: "No messages yet."
5. **Website**: send one more message to **Basic 4**, then tap its notification on the phone. Expected: the app opens that message directly.

### Test 5: the new Account screens

1. **App**, as the parent: open **Account**. Expected, from top to bottom:
   - a round phone icon with your number and "Parent account";
   - **Your children's schools**: each school with its children and **Remove**, then **Add a child**;
   - **Preferences**: **Notifications**, and **Appearance** with **Automatic**, **Light** and **Dark**;
   - **About**: **Privacy policy** and **Terms of Use**, which open in the browser;
   - **Sign out** on its own;
   - **Delete account** in red, with the note under it.
2. Tap **Dark**. Expected: the app turns dark at once. Tap **Automatic**.
3. **App**: sign out, and sign in with **School ID** as basic.teacher1 (school code of Test: Adenta Basic School, School ID `BT001`). Open **Account**. Expected, from top to bottom:
   - a circle with **SA**, the name, email and school;
   - **School**: **Your schools and workspaces**, **School code** and **School ID**;
   - **Preferences**;
   - **Account**: **Change password** and **Sign out**;
   - **About**;
   - **Delete account**.
4. Sign out, and sign back in as the parent.
