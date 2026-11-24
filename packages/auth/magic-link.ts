import { sendMagicLinkEmail } from "@pno/emails";
import { env } from "@pno/env/server";

export const sendVerificationRequest = async (params: {
  identifier: string;
  url: string;
}) => {
  if (env.NODE_ENV === "development") {
    console.log("\n=======================================================");
    console.log(`🔗 [LOCAL AUTH] Magic Login Link for ${params.identifier}:`);
    console.log(params.url);
    console.log("=======================================================\n");
  }
  await sendMagicLinkEmail(params.identifier, params);
};
