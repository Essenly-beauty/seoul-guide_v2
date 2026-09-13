import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  THUMBNAIL_EDGE,
  optimizePlacePhoto,
  optimizePlacePhotoTree,
  validatePlacePhotoAliases,
} from "../scripts/optimize-place-photos.mjs";
import { CATALOGUE_PLACES } from "./data";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("place photo optimizer", () => {
  it("keeps the checked-in alias manifest one-to-one and attached to real catalogue ids", () => {
    const manifest = JSON.parse(readFileSync("data/place-photo-aliases.json", "utf8"));
    const aliases = validatePlacePhotoAliases(
      manifest,
      new Set(CATALOGUE_PLACES.map((place) => place.id)),
    );

    expect(aliases).toHaveLength(22);
  });

  it("accepts only explicit one-to-one aliases to known canonical places", () => {
    const aliases = validatePlacePhotoAliases(
      {
        schemaVersion: 1,
        aliases: [{
          sourcePlaceId: "ados-source-duplicate",
          targetPlaceId: "ct-canonical-place",
          reason: "Same branch and exact address",
          evidence: ["https://example.com/venue"],
        }],
      },
      new Set(["ct-canonical-place"]),
    );

    expect(aliases).toEqual(new Map([["ados-source-duplicate", "ct-canonical-place"]]));
    expect(() => validatePlacePhotoAliases(
      {
        schemaVersion: 1,
        aliases: [{
          sourcePlaceId: "ados-source-duplicate",
          targetPlaceId: "missing-place",
          reason: "Unreviewed",
          evidence: [],
        }],
      },
      new Set(["ct-canonical-place"]),
    )).toThrow(/unknown canonical place/i);
  });

  it("rotates and writes metadata-free full and list-thumbnail WebPs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "place-photo-optimize-"));
    tempDirs.push(dir);
    const input = join(dir, "source.jpg");
    const output = join(dir, "1.webp");

    await sharp({
      create: {
        width: 1800,
        height: 1200,
        channels: 3,
        background: { r: 210, g: 80, b: 70 },
      },
    })
      .jpeg({ quality: 95 })
      .withMetadata({ orientation: 6 })
      .toFile(input);

    const result = await optimizePlacePhoto(input, output);
    const metadata = await sharp(output).metadata();
    const thumbnailMetadata = await sharp(result.thumbnailOutputPath).metadata();

    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1080);
    expect(metadata.exif).toBeUndefined();
    expect(result.outputBytes).toBeGreaterThan(0);
    expect(result.outputBytes).toBeLessThan(result.inputBytes);
    expect(thumbnailMetadata.format).toBe("webp");
    expect(Math.max(thumbnailMetadata.width ?? 0, thumbnailMetadata.height ?? 0))
      .toBeLessThanOrEqual(THUMBNAIL_EDGE);
    expect(thumbnailMetadata.exif).toBeUndefined();
    expect(result.thumbnailBytes).toBeGreaterThan(0);
  });

  it("only emits folders included in the application allowlist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "place-photo-tree-"));
    tempDirs.push(dir);
    const inputRoot = join(dir, "input");
    const outputRoot = join(dir, "output");
    const included = join(inputRoot, "ados-included", "source.jpg");
    const pending = join(inputRoot, "ados-pending", "source.jpg");
    mkdirSync(join(inputRoot, "ados-included"), { recursive: true });
    mkdirSync(join(inputRoot, "ados-pending"), { recursive: true });

    await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toFile(included);
    await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000000" } })
      .jpeg()
      .toFile(pending);

    const results = await optimizePlacePhotoTree(inputRoot, outputRoot, {
      allowedPlaceIds: new Set(["ados-included"]),
    });

    expect(results).toHaveLength(1);
    expect(results[0].placeId).toBe("ados-included");
    await expect(sharp(join(outputRoot, "ados-included", "1.thumb.webp")).metadata())
      .resolves.toMatchObject({ format: "webp" });
  });

  it("publishes an approved source folder under its existing canonical place id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "place-photo-alias-"));
    tempDirs.push(dir);
    const inputRoot = join(dir, "input");
    const outputRoot = join(dir, "output");
    const source = join(inputRoot, "ados-source-duplicate", "source.jpg");
    mkdirSync(join(inputRoot, "ados-source-duplicate"), { recursive: true });

    await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toFile(source);

    const results = await optimizePlacePhotoTree(inputRoot, outputRoot, {
      allowedPlaceIds: new Set(["ct-canonical-place"]),
      placeIdAliases: new Map([["ados-source-duplicate", "ct-canonical-place"]]),
    });

    expect(results).toHaveLength(1);
    expect(results[0].placeId).toBe("ct-canonical-place");
    await expect(sharp(join(outputRoot, "ct-canonical-place", "1.webp")).metadata())
      .resolves.toMatchObject({ format: "webp" });
  });

  it("appends an alias source after canonical photos without overwriting either set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "place-photo-alias-merge-"));
    tempDirs.push(dir);
    const inputRoot = join(dir, "input");
    const outputRoot = join(dir, "output");
    const aliasSource = join(inputRoot, "ados-former-name", "source.jpg");
    const canonicalSource = join(inputRoot, "ados-current-name", "source.jpg");
    mkdirSync(join(inputRoot, "ados-former-name"), { recursive: true });
    mkdirSync(join(inputRoot, "ados-current-name"), { recursive: true });

    await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toFile(aliasSource);
    await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000000" } })
      .jpeg()
      .toFile(canonicalSource);

    const results = await optimizePlacePhotoTree(inputRoot, outputRoot, {
      allowedPlaceIds: new Set(["ados-current-name"]),
      placeIdAliases: new Map([["ados-former-name", "ados-current-name"]]),
    });

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.outputPath)).toEqual([
      join(outputRoot, "ados-current-name", "1.webp"),
      join(outputRoot, "ados-current-name", "2.webp"),
    ]);
  });
});
