// Create the chat tables in Neon from schema.sql.
// Usage: DATABASE_URL=<pooled Neon URI> node scripts/setup-chat-db.mjs
// or: python3 scripts/setup-chat-db.py   (fetches the URI via the Neon API)
// The connection string comes only from the environment — never from a file,
// never printed, never committed.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = neon(url);
const text = readFileSync(join(root, "schema.sql"), "utf8");
// Strip full-line `--` comments first: otherwise the first statement
// chunk starts with a comment and would be filtered out below.
const withoutComments = text
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

// Split on semicolons at line ends; schema.sql contains no stray semicolons.
const statements = withoutComments
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s);

for (const statement of statements) {
  // @neondatabase/serverless 0.10.4: the query function can be called
  // directly with a plain SQL string (no sql.query method).
  await sql(statement);
}
console.log("Chat tables ready: chat_messages, chat_typing");

const counts = await sql`
  SELECT
    (SELECT count(*) FROM chat_messages) AS messages,
    (SELECT count(*) FROM chat_typing) AS typing
`;
console.log("chat_messages rows:", Number(counts[0].messages));
console.log("chat_typing rows:", Number(counts[0].typing));
