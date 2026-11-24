import { functions, inngest } from "@pno/inngest";
import { serve } from "@pno/inngest/next";

export default serve({ client: inngest, functions });
