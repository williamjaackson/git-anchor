import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo } from "./helpers";

describe("remove command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.anchor(["get", "feature"]);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("clears the anchor", () => {
    const r = repo.anchor(["remove", "feature"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toContain("cleared anchor");
    expect(repo.configValue("branch.feature.anchor")).toBeNull();
  });

  test("errors on nonexistent branch", () => {
    const r = repo.anchor(["remove", "ghost"]);

    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("does not exist");
  });
});
