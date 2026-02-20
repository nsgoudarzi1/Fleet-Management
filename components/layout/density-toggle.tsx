"use client";

import { Rows3, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DensityMode, useDensity } from "@/lib/hooks/use-density";

const OPTIONS: Array<{ value: DensityMode; label: string; icon: typeof Rows4 }> = [
  { value: "comfortable", label: "Comfortable", icon: Rows4 },
  { value: "compact", label: "Compact", icon: Rows3 },
];

export function DensityToggle() {
  const { density, setDensity } = useDensity();
  const active = OPTIONS.find((option) => option.value === density) ?? OPTIONS[0];
  const Icon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Table density settings">
          <Icon className="mr-2 h-4 w-4" />
          {active.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Density</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => setDensity(option.value)}>
            <option.icon className="mr-2 h-4 w-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

