import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo, UUID_RE } from "./helpers";

describe("children command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.branch("hotfix", "main");
    repo.commit("h", "h", "h");
    repo.branch("sub-feature", "feature");
    repo.commit("s", "s", "s");

    // Anchor every branch and wire up parents manually (no `init` yet)
    const mainId = repo.anchor(["get", "main"]).stdout;
    const featureId = repo.anchor(["get", "feature"]).stdout;
    repo.anchor(["get", "hotfix"]);
    repo.anchor(["get", "sub-feature"]);
    repo.anchor(["set-parent", "feature", mainId]);
    repo.anchor(["set-parent", "hotfix", mainId]);
    repo.anchor(["set-parent", "sub-feature", featureId]);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("lists child UUIDs by default", () => {
    const r = repo.anchor(["children", "main"]);
    const lines = r.stdout.split("\n").filter(Boolean);

    expect(lines.length).toBe(2);
    for (const line of lines) expect(line).toMatch(UUID_RE);

    const featureId = repo.configValue("branch.feature.anchor");
    const hotfixId = repo.configValue("branch.hotfix.anchor");
    expect(lines).toContain(featureId);
    expect(lines).toContain(hotfixId);
  });

  test("--name lists branch names sorted alphabetically", () => {
    const r = repo.anchor(["children", "main", "--name"]);

    expect(r.stdout).toBe("feature\nhotfix");
  });

  test("returns empty for a branch with no children", () => {
    const r = repo.anchor(["children", "hotfix", "--name"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("");
  });

  test("finds grandchildren through intermediate branch", () => {
    const r = repo.anchor(["children", "feature", "--name"]);
    expect(r.stdout).toBe("sub-feature");
  });

  test("defaults to current branch", () => {
    repo.checkout("main");
    const r = repo.anchor(["children", "--name"]);
    expect(r.stdout).toBe("feature\nhotfix");
  });

  test("errors on nonexistent branch", () => {
    const r = repo.anchor(["children", "ghost"]);
    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("does not exist");
  });

  test("empty output if the branch has no anchor yet", () => {
    // Remove main's anchor; children lookup should short-circuit cleanly
    repo.anchor(["remove", "main"]);
    const r = repo.anchor(["children", "main"]);
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("");
  });
});
