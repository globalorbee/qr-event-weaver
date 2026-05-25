import React from "react";

export interface TemplateEntry {
  component: React.ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  to?: string;
  displayName?: string;
  previewData?: Record<string, any>;
}

import { template as passIssued } from "./pass-issued";
import { template as passUsed } from "./pass-used";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "pass-issued": passIssued,
  "pass-used": passUsed,
};