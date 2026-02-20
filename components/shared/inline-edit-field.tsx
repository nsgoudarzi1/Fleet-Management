"use client";

import { Check, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InlineEditFieldProps = {
  label: string;
  value: string | number | null | undefined;
  field: string;
  endpoint: string;
  type?: "text" | "number";
  className?: string;
};

export function InlineEditField({
  label,
  value,
  field,
  endpoint,
  type = "text",
  className,
}: InlineEditFieldProps) {
  const initialValue = useMemo(() => String(value ?? ""), [value]);
  const [localValue, setLocalValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(initialValue);
    setSavedValue(initialValue);
    setEdited(false);
  }, [initialValue]);

  const save = async (next: string) => {
    if (next === savedValue) return;
    setSaving(true);
    setEdited(true);
    try {
      const payload =
        type === "number"
          ? {
              [field]: Number(next || 0),
            }
          : {
              [field]: next,
            };
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      setSavedValue(next);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      toast.success(`${label} saved`);
    } catch {
      setLocalValue(savedValue);
      toast.error(`Unable to save ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 500);
  };

  return (
    <div className={cn("space-y-1", className)} style={{ gap: "var(--density-form-gap)" }}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {saving ? <span>Saving...</span> : savedFlash ? <span className="text-emerald-700">Saved</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={localValue}
          onChange={(event) => {
            const next = event.target.value;
            setLocalValue(next);
            scheduleSave(next);
          }}
          onBlur={() => void save(localValue)}
          type={type}
        />
        {edited ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            <Check className="h-3 w-3" />
            Edited
          </span>
        ) : null}
        {localValue !== savedValue ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setLocalValue(savedValue);
              if (timer.current) clearTimeout(timer.current);
              setEdited(false);
            }}
            aria-label={`Undo ${label}`}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
