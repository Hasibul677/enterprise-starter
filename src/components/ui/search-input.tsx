"use client";

import { Search } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "@/lib/utils/cn";

export function SearchInput({ className, ...props }: InputProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}
