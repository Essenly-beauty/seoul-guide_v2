import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "data", "sources", "coffeelog-korea");
const candidatesPath = path.join(sourceDir, "seoul-cafe-candidates-2026-09-22.json");
const collectionsPath = path.join(sourceDir, "collections-2026-09-22.json");

const collectionDefinitions = {
  Views: {
    id: "coffeelog-korea:sky-view-cafes",
    slug: "sky-view-cafes",
    title_ko: "하늘이 예쁜 날 같이 가고 싶은 통창 카페",
    title_en: "Cafés with windows and a view",
    source_post_url: "https://www.threads.com/@coffeelog_korea/post/DdisKAzEWYc",
    source_address_post_url: "https://www.threads.com/@coffeelog_korea/post/DdisL3akfGp",
    context_tags: {
      occasions: ["slow-afternoon", "date", "good-weather"],
      spaces: ["large-window", "view"],
      seasons: [],
      food_drink: [],
    },
  },
  Work: {
    id: "coffeelog-korea:weekend-work-cafes",
    slug: "weekend-work-cafes",
    title_ko: "주말에 작업하고 싶을 때 저장해두는 카페",
    title_en: "Cafés for working on the weekend",
    source_post_url: "https://www.threads.com/@coffeelog_korea/post/DddjoYiEc26",
    source_address_post_url: "https://www.threads.com/@coffeelog_korea/post/DddjqnckYra",
    context_tags: {
      occasions: ["work", "study", "solo-time"],
      spaces: ["long-stay"],
      seasons: [],
      food_drink: [],
    },
  },
  Seongsu: {
    id: "coffeelog-korea:seongsu-coffee-walk",
    slug: "seongsu-coffee-walk",
    title_ko: "성수 카페 목록",
    title_en: "A Seongsu coffee walk",
    source_post_url: "https://www.threads.com/@coffeelog_korea/post/DRzHY7okQdI",
    source_address_post_url: "https://www.threads.com/@coffeelog_korea/post/DRzHY7okQdI",
    context_tags: {
      occasions: ["neighborhood-walk"],
      spaces: [],
      seasons: [],
      food_drink: ["coffee"],
    },
  },
  Hannam: {
    id: "coffeelog-korea:hannam-afternoon-cafes",
    slug: "hannam-afternoon-cafes",
    title_ko: "한남 카페 목록",
    title_en: "An afternoon in Hannam",
    source_post_url: "https://www.threads.com/@coffeelog_korea/post/DRt6YN2kbNq",
    source_address_post_url: "https://www.threads.com/@coffeelog_korea/post/DRt6YN2kbNq",
    context_tags: {
      occasions: ["afternoon", "neighborhood-walk"],
      spaces: [],
      seasons: [],
      food_drink: ["coffee"],
    },
  },
};

const payload = JSON.parse(await readFile(candidatesPath, "utf8"));

payload.schema_version = "1.1.0";
payload.editorial_context_policy = {
  meaning: "Tags describe the source post's editorial framing, not independently verified venue attributes.",
  taxonomy_document: "./EDITORIAL_CONTEXT_TAXONOMY.md",
  collections_manifest: "./collections-2026-09-22.json",
};

payload.records = payload.records.map((record) => {
  const collection = collectionDefinitions[record.discovery_theme];
  const neighborhoodTag = record.neighborhood_en
    ? record.neighborhood_en.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : null;

  return {
    ...record,
    source_collection_ids: collection ? [collection.id] : [],
    occasion_tags: collection?.context_tags.occasions ?? [],
    space_tags: collection?.context_tags.spaces ?? [],
    season_tags: collection?.context_tags.seasons ?? [],
    food_drink_tags: collection?.context_tags.food_drink ?? [],
    neighborhood_tags: neighborhoodTag ? [neighborhoodTag] : [],
    editorial_context_status: collection ? "source_derived" : "unclassified",
    editorial_context_provenance: collection ? "threads_collection_title" : null,
  };
});

const collections = Object.values(collectionDefinitions).map((collection) => ({
  ...collection,
  source_type: "threads_collection",
  verification_status: "source_derived_unverified",
  member_external_ids: payload.records
    .filter((record) => record.source_collection_ids.includes(collection.id))
    .map((record) => record.external_id),
}));

const collectionPayload = {
  schema_version: "1.0.0",
  dataset_id: "coffeelog-korea-editorial-collections-2026-09-22",
  source_profile_url: "https://www.threads.com/@coffeelog_korea",
  interpretation_note: "Collection membership and tags preserve the source account's framing. They are not ADoS or My Seoul Drop endorsements.",
  collections,
};

await writeFile(candidatesPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(collectionsPath, `${JSON.stringify(collectionPayload, null, 2)}\n`, "utf8");

console.log(`Updated ${payload.records.length} candidates and wrote ${collections.length} collections.`);
