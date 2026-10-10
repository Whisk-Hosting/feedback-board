// The board's background functions. Step names match workflows/*.graph.yaml.
import { demoFunctions } from "./demo.js";
import { emailFailed, sendEmailNow } from "./events.js";
import { inngest } from "./whisk.js";

type Failure = { event: { data: { event: { data: Record<string, unknown> } } }; error: Error };

export const sendEmail = inngest.createFunction(
  {
    id: "send-email",
    triggers: [{ event: "email.send" }],
    retries: 4,
    throttle: { limit: 60, period: "1m" },
    onFailure: async ({ event, error }: Failure) => {
      await emailFailed(Number(event.data.event.data.email_id), error.message);
    },
  },
  async ({ event, step }) => step.run("send", () => sendEmailNow(Number(event.data.email_id))),
);

export const functions = [sendEmail, ...demoFunctions()];
