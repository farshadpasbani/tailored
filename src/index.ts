import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// package.json is the single source of truth for the version.
export const version: string = (require("../package.json") as { version: string }).version;
