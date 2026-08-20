import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const blogSource = readFileSync(new URL("../app/blog/page.tsx", import.meta.url), "utf8");
const tagUrl = new URL("../components/ui/topic-tag.tsx", import.meta.url);
const tagSource = existsSync(tagUrl) ? readFileSync(tagUrl, "utf8") : "";

describe("blog topic presentation", () => {
  it("uses semantic static tags instead of button-like chips", () => {
    expect(blogSource).toContain('import { TopicTag } from "@/components/ui/topic-tag"');
    expect(blogSource).not.toContain('import { Chip } from "@/components/ui/chip"');
    expect(blogSource).toContain("<TopicTag");
    expect(tagSource).toContain("<span");
    expect(tagSource).toContain('`#${children}`');
    expect(tagSource).not.toContain("<button");
  });
});
