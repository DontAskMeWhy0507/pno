import { sendOrganizationDeletionEmail } from "@quenti/emails";
import { disbandOrgUsers } from "@quenti/enterprise/users";
import { env } from "@quenti/env/server";
import { cancelOrganizationSubscription } from "@quenti/payments";
import { prisma } from "@quenti/prisma";

import { inngest } from "../inngest";

export const scheduleOrgDeletion = inngest.createFunction(
  {
    id: "schedule-org-deletion",
  },
  {
    event: "orgs/delete",
  },
  async ({ event, step }) => {
    await Promise.all(
      event.data.ownerEmails.map((email) =>
        step.run(
          "Send organization deletion email",
          async () =>
            await sendOrganizationDeletionEmail(email, {
              orgName: event.data.org.name,
            }),
        ),
      ),
    );

    if (env.SERVER_NAME === "production") {
      await step.sleep("wait-48-hours", "48h");
    }

    const org = await step.run("Verify organization pending deletion", () =>
      prisma.organization.findUnique({
        where: { id: event.data.org.id },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!org || !org.deletedAt) return;

    await step.run("Cancel organization subscription", () =>
      cancelOrganizationSubscription(org.id),
    );

    await step.run("Delete organization and disband users", async () => {
      await prisma.organization.deleteMany({
        where: { id: org.id },
      });
      await disbandOrgUsers(org.id);
    });
  },
);
