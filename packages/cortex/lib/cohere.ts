import { CohereClient } from "cohere-ai";

import { env } from "@pno/env/server";

export const cohere = new CohereClient({
  token: env.COHERE_API_KEY,
});
