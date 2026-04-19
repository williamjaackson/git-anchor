import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo, UUID_RE } from "./helpers";

describe("remove command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    const mainId = repo.anchor(["get", "main"]).stdout;
    repo.anchor(["get", "feature"]);
    repo.anchor(["set-parent", "feature", mainId]);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("clears both anchor and parent by default", () => {
    const r = repo.anchor(["remove", "feature"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toContain("cleared anchor");
    expect(repo.configValue("branch.feature.anchor")).toBeNull();
    expect(repo.configValue("branch.feature.anchorparent")).toBeNull();
  });

  test("--parent clears only the parent, anchor stays", () => {
    const anchor = repo.configValue("branch.feature.anchor");
    expect(anchor).toMatch(UUID_RE);

    const r = repo.anchor(["remove", "feature", "--parent"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toContain("cleared parent");
    expect(repo.configValue("branch.feature.anchor")).toBe(anchor);
    expect(repo.configValue("branch.feature.anchorparent")).toBeNull();
  });

  test("errors on nonexistent branch", () => {
    const r = repo.anchor(["remove", "ghost"]);

    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("does not exist");
  });
});
