import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Notice } from "@/components/ui/notice";
import { SearchField } from "@/components/ui/search-field";

function render(element: React.ReactElement) {
  return load(renderToStaticMarkup(element));
}

describe("design-system rendered markup", () => {
  it("renders disabled controls with native semantics and component variants", () => {
    const button = render(<Button variant="secondary" disabled>Unavailable</Button>);
    const iconButton = render(<IconButton name="x" label="Close" variant="soft" disabled />);

    expect(button("button").attr("disabled")).toBe("disabled");
    expect(button("button").hasClass("secondary")).toBe(true);
    expect(iconButton("button").attr("aria-label")).toBe("Close");
    expect(iconButton("button").attr("disabled")).toBe("disabled");
    expect(iconButton("button").hasClass("soft")).toBe(true);
  });

  it("renders radio chips without conflicting pressed semantics", () => {
    const chip = render(
      <Chip role="radio" aria-checked selected onClick={() => {}}>
        Dry
      </Chip>,
    );

    expect(chip("button").attr("role")).toBe("radio");
    expect(chip("button").attr("aria-checked")).toBe("true");
    expect(chip("button").attr("aria-pressed")).toBeUndefined();
    expect(chip("button").hasClass("selected")).toBe(true);
  });

  it("adds live-region roles only when a Notice requests one", () => {
    const staticNotice = render(<Notice tone="info">Static guidance</Notice>);
    const dynamicNotice = render(<Notice tone="warning" role="status">Updated guidance</Notice>);

    expect(staticNotice(".banner").attr("role")).toBeUndefined();
    expect(dynamicNotice(".banner").attr("role")).toBe("status");
  });

  it("renders a contextual SearchField clear action and variant", () => {
    const field = render(
      <SearchField
        value="Anua"
        onChange={() => {}}
        label="Search brands"
        onClear={() => {}}
        clearLabel="Clear brand search"
        clearVariant="soft"
      />,
    );

    expect(field('input[type="search"]').attr("aria-label")).toBe("Search brands");
    expect(field('button[aria-label="Clear brand search"]').hasClass("soft")).toBe(true);
  });
});
