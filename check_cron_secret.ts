import dotenv from "dotenv";

dotenv.config();

console.log("CRON_SECRET is set:", !!process.env.CRON_SECRET);
