import { AsyncSessionSearch, openDatabase, search } from "@aliou/sesame";

const db = openDatabase(":memory:");
if (search(db, "*").length !== 0) throw new Error("Unexpected search results");
db.close();

const client = new AsyncSessionSearch(process.argv[2]);
try {
  const results = await client.search();
  if (results.length !== 0) throw new Error("Unexpected worker results");
} finally {
  await client.close();
}

console.log("runtime exports ok");
