import mongoose from "mongoose";
import { getEnv } from "@/config/env";

/**
 * Reusable MongoDB connection utility.
 *
 * - Dev (hot reload): caches the connection promise on `globalThis` so
 *   repeated module reloads don't spawn duplicate connections.
 * - Production / serverless: reuses a module-level cache across warm
 *   invocations of the same execution context.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const globalCache: MongooseCache = global.__mongooseCache ?? { conn: null, promise: null };
if (process.env.NODE_ENV !== "production") {
  global.__mongooseCache = globalCache;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (globalCache.conn) {
    return globalCache.conn;
  }

  if (!globalCache.promise) {
    const { MONGODB_URI } = getEnv();
    mongoose.set("strictQuery", true);

    globalCache.promise = mongoose
      .connect(MONGODB_URI, {
        maxPoolSize: 10,
        bufferCommands: false,
      })
      .then((m) => m);
  }

  try {
    globalCache.conn = await globalCache.promise;
  } catch (err) {
    globalCache.promise = null;
    throw err;
  }

  return globalCache.conn;
}
