"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type EntityDrawerProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
};

export function EntityDrawer({ trigger, title, description, children }: EntityDrawerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="left-auto right-0 top-0 h-dvh w-full max-w-md translate-x-0 translate-y-0 rounded-none border-l border-slate-200 p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </div>
        <div className="h-[calc(100dvh-72px)] overflow-y-auto px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
