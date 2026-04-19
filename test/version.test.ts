import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo } from "./helpers";

describe("version command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("prints a semver-looking string", () => {
    const r = repo.anchor(["version"]);
    expect(r.ok).toBe(true);
    expect(r.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });
});
