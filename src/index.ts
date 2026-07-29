import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// package.json is the single source of truth for the version.
export const version: string = (require("../package.json") as { version: string }).version;

export { CanonSchema, CanonV2Schema, LegacyCanonSchema, FactV2Schema, StructuredMetricV2Schema } from "./canon/schema.js";
export type { Canon, CanonV2, LegacyCanon } from "./canon/schema.js";
export { EvidenceFileSchema, EvidenceFileObjectSchema, CompleteStructuredMetricSchema, parseEvidenceFile, loadEvidenceFile } from "./evidence/schema.js";
export type { EvidenceFile, ClaimEvidence, EvidenceParseResult } from "./evidence/schema.js";
export { parseDeclarativeHtml, htmlFragmentToText } from "./evidence/html.js";
export { buildResourceManifest, computeResourceManifestHash, verifyArtifactResources } from "./evidence/resources.js";
export type { ResourceManifest, ResourceManifestEntry, VerifiedResource } from "./evidence/resources.js";
export { analyzeClaimIntegrity, analyzeClaimIntegrityPreflight, computeClaimBindingHash, verifyClaimIntegrity } from "./gates/claimIntegrity.js";
export type { ClaimIntegrityInput, VerifyClaimIntegrityInput, ClaimIntegrityIssue, ClaimIntegrityIssueKind, ClaimIntegrityResult } from "./gates/claimIntegrity.js";
export { loadCanon, parseCanon, parseCanonV2 } from "./canon/load.js";
export type { LoadedCanon, ParseResult, ParseV2Result } from "./canon/load.js";
export { migrateCanon } from "./canon/migrate.js";
export type { MigrationResult } from "./canon/migrate.js";
export { analyzeProhibitedClaims, hasVisibleNumericOccurrences, MetricClaimsFileSchema } from "./gates/prohibitedClaims.js";
export type {
  MetricClaim,
  MetricFact,
  ProhibitedClaimIssue,
  ProhibitedClaimsInput,
  ProhibitedClaimsResult,
  StructuredMetric,
  MetricClaimsFile,
  NumericExemption,
  NumericExemptionClassification,
} from "./gates/prohibitedClaims.js";
export { inspectRenderedDocument, inspectAndPrintDocument } from "./render/chrome.js";
export type { RenderedClaimMarker, RenderedDocumentEvidence, RenderedOwnerMarker, RenderedSourceMarker, RenderedTextUnit } from "./render/chrome.js";
export { RequirementsSchema, RequirementSchema, RequirementWaiverSchema, ChangeReceiptSchema, BaselineReceiptSchema, loadRequirements, parseRequirements, sha256Text, digestCanonical, prepareRequirementsBaseline, issueBaselineReceipt, createChangeReceipt } from "./requirements/schema.js";
export type { Requirements, VerifiedRequirements, Requirement, RequirementWaiver, RequirementsParseResult, BaselineReceipt, ChangeReceipt, ReceiptResolver, BaselineReceiptResolver } from "./requirements/schema.js";
export { migrateLegacyJdToRequirements } from "./requirements/migrate.js";
export { analyzeRequirementFit } from "./gates/fit.js";
export type { RequirementFitVerdict, FitEvidencePolicy } from "./gates/fit.js";
export { analyzeRequirementAts } from "./gates/ats.js";
export { PackDescriptorSchema, verifyPack, verifyReceiptFreshness, assertVerifierIssuedReceipt } from "./verify/pack.js";
export type { PackDescriptor, IssuedVerifyReceipt } from "./verify/pack.js";
export { VerifyReceiptSchema, FindingSchema } from "./verify/receipt.js";
export type { VerifyReceipt, PackFinding } from "./verify/receipt.js";
export { GATES, PACK_GATES, SMOKE_SET, gate, gateCommands } from "./gates/registry.js";
// Deliberately narrow: a published package cannot un-export a type without a breaking
// change, and the CLI-declaration layer (GateCommand, ConsoleReport) and the pack lane's
// internals (GateArtifact, GateThresholds) are not shapes a consumer should pin.
export type { Finding, Gate, GateInput, GateSeverity } from "./gates/gate.js";
export { VerifyPolicySchema, BlockingGateIdSchema, AdvisoryGateIdSchema, REQUIRED_BLOCKING_GATES, REQUIRED_ADVISORY_GATES } from "./policy/verify.js";
export type { VerifyPolicy } from "./policy/verify.js";
export { CorpusDescriptorSchema, CorpusMemberSchema, WaiverSchema, AttestationSchema } from "./verify/trust.js";
export type { CorpusDescriptor, Waiver, Attestation } from "./verify/trust.js";
