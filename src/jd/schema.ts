import { z } from "zod";
export const JdSchema = z.object({
  role: z.string().min(1),
  company: z.string().optional(),
  mustHave: z.array(z.string().min(1)).min(1),
  niceToHave: z.array(z.string().min(1)).default([]),
  synonyms: z.record(z.string(), z.array(z.string().min(1))).default({}),
});
export type Jd = z.infer<typeof JdSchema>;
/** @deprecated Legacy keyword compatibility model. It cannot produce verified v2 fit. */
export const LegacyJdSchema = JdSchema;
/** @deprecated Use Requirements for verified fit. */
export type LegacyJd = Jd;
