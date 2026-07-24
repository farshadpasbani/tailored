import { execFileSync } from "node:child_process";

export default function setup(): void {
  execFileSync("npm", ["run", "build"], { cwd: process.cwd(), stdio: "pipe" });
}
