// Email to the people following an idea. Each message is written to the emails table first, then
// handed to the platform queue, so a slow send never holds up a page and failures retry. Where no
// queue runs (a preview, a local run) it is sent once in the background. In demo mode nothing is
// sent: messages are recorded as skipped.
import { asSystem } from "./db.js";
import { demoOn } from "./demo.js";
import type { Mail } from "./emails.js";
import * as store from "./store.js";
import { enqueue, isPreview, log, queueAvailable, whiskApi } from "./whisk.js";

const runLater = (id: number) => void sendEmailNow(id).catch((err) => log.warn({ err: String(err), email_id: id }, "email failed"));

// email records each message and queues it. Failures are logged, never thrown at the person who
// made the change.
export const email = async (kind: string, messages: readonly Mail[]) => {
  try {
    const ids = await asSystem((tx) => Promise.all(messages.map((m) => store.queueEmail(tx, { kind, ...m }))));
    if (demoOn()) return void (await asSystem((tx) => Promise.all(ids.map((id) => store.markEmail(tx, id, "demo")))));
    for (const id of ids) {
      if (!queueAvailable() || isPreview()) runLater(id);
      else await enqueue("email.send", { email_id: id }, `email-${id}`).catch((err) => (log.warn({ err: String(err) }, "queue refused email; sending now"), runLater(id)));
    }
  } catch (err) {
    log.error({ err: String(err), kind }, "could not queue email");
  }
};

// sendEmailNow sends one recorded message through Whisk email. It throws so the queue retries.
export const sendEmailNow = async (id: number) => {
  const [e, s] = await asSystem(async (tx) => [await store.emailById(tx, id), await store.settings(tx)] as const);
  if (!e || e.status !== "pending") return;
  const from = s.email_from ? `"${s.board_name.replace(/["\\\r\n]/g, "")}" <${s.email_from}>` : undefined;
  await whiskApi("/email/send", { to: e.to_email, subject: e.subject, html: e.html, text: e.text, from });
  await asSystem((tx) => store.markEmail(tx, id, "sent"));
};

export const emailFailed = (id: number, why: string) => asSystem((tx) => store.markEmail(tx, id, "failed", why.slice(0, 500)));
