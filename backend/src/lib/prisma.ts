
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta configurar DATABASE_URL");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
