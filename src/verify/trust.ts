import fs from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { canonicalJson, sha256Bytes } from "./hash.js";

const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const Id = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/);
export const CorpusMemberSchema = z.object({
  id: Id,
  path: z.string().min(1),
  sha256: Digest,
  status: z.enum(["current", "draft", "approved", "submitted", "skipped", "abandoned", "superseded", "withdrawn"]),
  kind: z.enum(["document", "corpus"]).default("document"),
}).strict();
export const CorpusDescriptorSchema = z.object({
  schemaVersion: z.literal(1),
  members: z.array(CorpusMemberSchema),
}).strict().superRefine((value, context) => {
  const portable = (input: string) => input.normalize("NFC").toLocaleLowerCase("en-US");
  const ids = value.members.map(member => portable(member.id));
  const paths = value.members.map(member => portable(member.path));
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["members"], message: "corpus member IDs must be portably unique" });
  if (new Set(paths).size !== paths.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["members"], message: "corpus member paths must be portably unique" });
});

export interface FinalCorpusMember {
  id: string;
  path: string;
  physicalPath: string;
  sha256: string;
  status: "approved" | "submitted";
  kind: "document" | "corpus";
  bytes: Buffer;
}

export function snapshotFinalCorpus(packDirectory: string, rootDescriptorPath: string, currentArtifactPaths: string[]): { descriptor: CorpusDescriptor; descriptorBytes: Buffer; members: FinalCorpusMember[] } {
  const trustRoot = resolve(packDirectory, "..");
  const rootStat = fs.lstatSync(trustRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("corpus-eligibility: pack-vault trust base must be a real non-symlink directory");
  const physicalRoot = fs.realpathSync(trustRoot);
  const outside = (base: string, path: string) => { const offset = relative(base, path); return offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset); };
  const inspect = (path: string, label: string) => {
    const candidate = resolve(path);
    if (outside(trustRoot, candidate)) throw new Error(`corpus-eligibility: ${label} escapes the pack-vault trust base`);
    try {
      let cursor = trustRoot;
      for (const part of relative(trustRoot, candidate).split(sep).filter(Boolean)) {
        cursor = join(cursor, part);
        if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`corpus-eligibility: ${label} traverses a symbolic link`);
      }
      const stat = fs.lstatSync(candidate), physicalPath = fs.realpathSync(candidate);
      if (!stat.isFile() || (stat.mode & 0o444) === 0) throw new Error(`corpus-eligibility: ${label} is missing or unreadable`);
      if (outside(physicalRoot, physicalPath)) throw new Error(`corpus-eligibility: ${label} escapes the physical pack-vault trust base`);
      return { path: candidate, physicalPath, stat };
    } catch (error) {
      if ((error as Error).message.startsWith("corpus-eligibility:")) throw error;
      throw new Error(`corpus-eligibility: ${label} is missing or unreadable`);
    }
  };
  const authorityFile = (path: string, label: string, excluded = new Set<string>()) => {
    const before = inspect(path, label), sameIdentity = (stat: fs.Stats) => stat.isFile() && stat.dev === before.stat.dev && stat.ino === before.stat.ino;
    let fd: number | undefined, result: { path: string; physicalPath: string; bytes?: Buffer }, failure: Error | undefined;
    try {
      try { fd = fs.openSync(before.path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)); }
      catch { throw new Error(`corpus-eligibility: ${label} no-follow open failed`); }
      let opened: fs.Stats;
      try { opened = fs.fstatSync(fd); }
      catch { throw new Error(`corpus-eligibility: ${label} descriptor stat failed`); }
      if (!sameIdentity(opened)) throw new Error(`corpus-eligibility: ${label} changed file identity before open`);
      const after = inspect(path, label);
      if (!sameIdentity(after.stat) || after.physicalPath !== before.physicalPath) throw new Error(`corpus-eligibility: ${label} changed file identity during open`);
      if (excluded.has(after.physicalPath)) result = { path: after.path, physicalPath: after.physicalPath };
      else {
        let bytes: Buffer;
        try { bytes = fs.readFileSync(fd); }
        catch { throw new Error(`corpus-eligibility: ${label} descriptor read failed`); }
        result = { path: after.path, physicalPath: after.physicalPath, bytes };
      }
    } catch (error) { failure = error as Error; }
    finally {
      if (fd !== undefined) try { fs.closeSync(fd); }
      catch { if (!failure) failure = new Error(`corpus-eligibility: ${label} descriptor close failed`); }
    }
    if (failure) throw failure;
    return result!;
  };
  const parse = (bytes: Buffer, label: string) => {
    let raw: unknown;
    try { raw = yaml.load(bytes.toString("utf8")); }
    catch (error) { throw new Error(`corpus-eligibility: invalid ${label}: ${(error as Error).message}`); }
    const parsed = CorpusDescriptorSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`corpus-eligibility: invalid ${label}: ${parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    return parsed.data;
  };
  const root = authorityFile(rootDescriptorPath, "root corpus descriptor"), descriptorBytes = root.bytes!, descriptor = parse(descriptorBytes, "root corpus descriptor");
  const current = new Set(currentArtifactPaths.map(path => fs.realpathSync(path)));
  const active = new Set([root.physicalPath]), seenIds = new Set<string>(), seenPaths = new Set([root.physicalPath]), members: FinalCorpusMember[] = [];
  const portable = (value: string) => value.normalize("NFC").toLocaleLowerCase("en-US");
  const walk = (descriptorPath: string, corpus: CorpusDescriptor, prefix: string) => {
    for (const member of corpus.members) {
      if (member.status !== "approved" && member.status !== "submitted") continue;
      const id = prefix ? `${prefix}/${member.id}` : member.id, portableId = portable(id);
      if (seenIds.has(portableId)) throw new Error(`corpus-eligibility: duplicate member ID ${id}`);
      seenIds.add(portableId);
      const declared = isAbsolute(member.path) ? member.path : resolve(dirname(descriptorPath), member.path);
      const trusted = authorityFile(declared, `member ${id}`, member.kind === "document" ? current : undefined), portablePath = portable(trusted.physicalPath);
      if (member.kind === "corpus" && active.has(trusted.physicalPath)) throw new Error(`corpus-eligibility: cycle at ${id}`);
      if ([...seenPaths].some(path => portable(path) === portablePath)) throw new Error(`corpus-eligibility: duplicate member path ${id}`);
      seenPaths.add(trusted.physicalPath);
      if (!trusted.bytes) continue;
      const bytes = trusted.bytes;
      if (member.sha256 !== sha256Bytes(bytes)) throw new Error(`corpus-eligibility: stale member ${id}`);
      const final = { id, ...trusted, sha256: member.sha256, status: member.status, kind: member.kind, bytes };
      members.push(final);
      if (member.kind === "corpus") {
        active.add(trusted.physicalPath);
        walk(trusted.path, parse(bytes, `nested corpus ${id}`), id);
        active.delete(trusted.physicalPath);
      }
    }
  };
  walk(root.path, descriptor, "");
  members.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { descriptor, descriptorBytes, members };
}
const AttestationObjectSchema = z.object({
  schemaVersion: z.literal(1), id: Id, findingId: Id, packSha256: Digest, policySha256: Digest, findingSha256: Digest, approvedBy: z.string().min(1), approvedOn: z.string().date(), statement: z.string().min(1), sha256: Digest,
}).strict();
export const AttestationSchema = AttestationObjectSchema.superRefine((value, context) => {
  const { sha256, ...payload } = value;
  if (sha256 !== sha256Bytes(canonicalJson(payload))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sha256"], message: "attestation hash does not bind its exact scope" });
});
const WaiverObjectSchema = z.object({
  schemaVersion: z.literal(1), id: Id, findingId: Id, packSha256: Digest, policySha256: Digest, findingSha256: Digest, approvedBy: z.string().min(1), approvedOn: z.string().date(), reason: z.string().min(1), sha256: Digest,
}).strict();
export const WaiverSchema = WaiverObjectSchema.superRefine((value, context) => {
  const { sha256, ...payload } = value;
  if (sha256 !== sha256Bytes(canonicalJson(payload))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sha256"], message: "waiver hash does not bind its exact scope" });
});
export type CorpusDescriptor = z.infer<typeof CorpusDescriptorSchema>;
export type Attestation = z.infer<typeof AttestationSchema>;
export type Waiver = z.infer<typeof WaiverSchema>;
