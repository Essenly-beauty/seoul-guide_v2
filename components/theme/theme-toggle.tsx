"use client";

import { Chip } from "@/components/ui/chip";
import { useTheme, type AppTheme } from "@/components/theme/theme-provider";

/** Settings → Appearance: dark (brand default) / light, persisted locally. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const modes: { value: AppTheme; label: string }[] = [
    { value: "dark", label: "🌙 Dark" },
    { value: "light", label: "☀️ Light" },
  ];
  return (
    <div className="chipwrap" role="group" aria-label="App theme">
      {modes.map((m) => (
        <Chip key={m.value} selected={theme === m.value} onClick={() => setTheme(m.value)}>
          {m.label}
        </Chip>
      ))}
    </div>
  );
}
