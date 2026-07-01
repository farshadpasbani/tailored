import { z } from "zod";
const Link = z.object({ label: z.string(), url: z.string().url() });
const Project = z.object({ name: z.string(), tagline: z.string().optional(), year: z.string().optional(), links: z.array(Link).optional(), bullets: z.array(z.string()).min(1) });
const Experience = z.object({ title: z.string(), org: z.string(), location: z.string().optional(), start: z.string(), end: z.string().default("Present"), bullets: z.array(z.string()).min(1) });
const Education = z.object({ qualification: z.string(), institution: z.string(), result: z.string().optional(), year: z.string(), note: z.string().optional() });
const Claims = z.object({ can: z.array(z.string()).optional(), cannot: z.array(z.string()).optional() });
export const CanonSchema = z.object({
  identity: z.object({ name: z.string().min(1), role: z.string().min(1), location: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), links: z.array(Link).optional() }),
  summary: z.string().optional(),
  skills: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  projects: z.array(Project).default([]),
  experience: z.array(Experience).default([]),
  education: z.array(Education).default([]),
  certifications: z.array(z.string()).default([]),
  publications: z.array(z.string()).default([]),
  protectedTopics: z.array(z.string()).default([]),
  claims: Claims.optional(),
});
export type Canon = z.infer<typeof CanonSchema>;
