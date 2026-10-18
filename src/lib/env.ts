import { z } from "zod";

/** Each integration validates only its own variables, so one can work without the others. */
const cloudinarySchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

const redditSchema = z.object({
  REDDIT_CLIENT_ID: z.string().min(1),
  REDDIT_CLIENT_SECRET: z.string().min(1),
  REDDIT_USER_AGENT: z.string().min(1),
});

function load<T extends z.ZodType>(schema: T, what: string): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`${what} isn’t configured. Missing environment variables: ${missing}`);
  }
  return parsed.data;
}

export const getCloudinaryEnv = () => load(cloudinarySchema, "Cloudinary");
export const getRedditEnv = () => load(redditSchema, "Reddit");
