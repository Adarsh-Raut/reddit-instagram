import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// publishing polls Instagram for up to ~30s; give the function room on Vercel
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
