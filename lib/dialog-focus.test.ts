import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)>, dialog: null as unknown, refCount: 0 }));
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: mock.refCount++ === 0 ? mock.dialog : value }),
  useEffect: (effect: () => void | (() => void)) => mock.effects.push(effect),
}));
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

afterEach(() => { vi.unstubAllGlobals(); mock.effects = []; mock.refCount = 0; });

describe("station-search dialog keyboard boundary", () => {
  it("wraps after the actual last Tab stop, excluding arrow-key-only results", () => {
    const back = { tabIndex: 0, closest: () => null, matches: () => false, getAttribute: () => null, focus: vi.fn() };
    const input = { ...back, focus: vi.fn() };
    const clear = { ...back, focus: vi.fn() };
    const option = { ...back, tabIndex: -1, focus: vi.fn() };
    const hidden = { ...back, closest: () => ({}), focus: vi.fn() };
    const keyHandlers: Array<(event: unknown) => void> = [];
    mock.dialog = { querySelectorAll: () => [back, input, clear, option, hidden], contains: () => true };
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("document", { activeElement: clear, addEventListener: (type: string, handler: (event: unknown) => void) => { if (type === "keydown") keyHandlers.push(handler); }, removeEventListener: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    useDialogFocus(true, vi.fn());
    const cleanups = mock.effects.map((effect) => effect());
    const event = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    keyHandlers[0](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(back.focus).toHaveBeenCalledOnce();
    expect(option.focus).not.toHaveBeenCalled();
    expect(hidden.focus).not.toHaveBeenCalled();
    cleanups.forEach((cleanup) => cleanup?.());
  });

  it("keeps Tab inside a saving dialog when controls inherit a disabled fieldset", () => {
    const input = { tabIndex: 0, closest: () => null, matches: (selector: string) => selector === ':disabled', focus: vi.fn() };
    const keyHandlers: Array<(event: unknown) => void> = [];
    const focus = vi.fn();
    mock.dialog = { querySelectorAll: () => [input], contains: () => true, focus };
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("document", { activeElement: input, addEventListener: (type: string, handler: (event: unknown) => void) => { if (type === "keydown") keyHandlers.push(handler); }, removeEventListener: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    useDialogFocus(true, vi.fn());
    const cleanups = mock.effects.map(effect => effect());
    const event = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    keyHandlers[0](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(input.focus).not.toHaveBeenCalled();
    cleanups.forEach(cleanup => cleanup?.());
  });

  it("returns forward Tab to the dialog when background focus was restored during a modal transition", () => {
    const first = { tabIndex: 0, closest: () => null, matches: () => false, focus: vi.fn() };
    const keyHandlers: Array<(event: unknown) => void> = [];
    mock.dialog = { querySelectorAll: () => [first], contains: () => false };
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("document", { activeElement: {}, addEventListener: (type: string, handler: (event: unknown) => void) => { if (type === "keydown") keyHandlers.push(handler); }, removeEventListener: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    useDialogFocus(true, vi.fn());
    const cleanups = mock.effects.map(effect => effect());
    const event = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    keyHandlers[0](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
    cleanups.forEach(cleanup => cleanup?.());
  });

  it("includes a native details summary at the end of a booking detail sheet", () => {
    const first = { tabIndex: 0, closest: () => null, matches: () => false, focus: vi.fn() };
    const summary = { ...first, focus: vi.fn() };
    const keyHandlers: Array<(event: unknown) => void> = [];
    mock.dialog = { querySelectorAll: (selector: string) => selector.includes('summary') ? [first, summary] : [first], contains: () => true };
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("document", { activeElement: summary, addEventListener: (type: string, handler: (event: unknown) => void) => { if (type === "keydown") keyHandlers.push(handler); }, removeEventListener: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    useDialogFocus(true, vi.fn());
    const cleanups = mock.effects.map(effect => effect());
    const event = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    keyHandlers[0](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
    cleanups.forEach(cleanup => cleanup?.());
  });
});
