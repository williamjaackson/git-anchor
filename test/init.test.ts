import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo, UUID_RE } from "./helpers";

describe("init command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("anchors every local branch and installs the hook", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");

    const result = repo.anchor(["init"]);

    expect(result.ok).toBe(true);
    expect(repo.configValue("branch.main.anchor")).toMatch(UUID_RE);
    expect(repo.configValue("branch.feature.anchor")).toMatch(UUID_RE);
    expect(repo.hookExists()).toBe(true);
  });

  test("captures parent via reflog", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");

    repo.anchor(["init"]);

    const mainAnchor = repo.configValue("branch.main.anchor");
    const featureParent = repo.configValue("branch.feature.anchorparent");
    expect(featureParent).toBe(mainAnchor);
  });

  test("captures chained parents", () => {
    repo.branch("fix-1", "main");
    repo.commit("a", "a", "a");
    repo.branch("fix-2", "fix-1");
    repo.commit("b", "b", "b");

    repo.anchor(["init"]);

    const fix1Anchor = repo.configValue("branch.fix-1.anchor");
    const fix2Parent = repo.configValue("branch.fix-2.anchorparent");
    expect(fix2Parent).toBe(fix1Anchor);
  });

  test("reports anchored and parented branches on first run", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");

    const result = repo.anchor(["init"]);

    expect(result.stdout).toContain("anchored:");
    expect(result.stdout).toContain("main");
    expect(result.stdout).toContain("feature");
    expect(result.stdout).toContain("parented:");
    expect(result.stdout).toContain("feature");
    expect(result.stdout).toContain("-> main");
  });

  test("idempotent rerun reports nothing-to-do", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");

    repo.anchor(["init"]);
    const second = repo.anchor(["init"]);

    expect(second.ok).toBe(true);
    expect(second.stdout).toContain("nothing to do");
    expect(second.stdout).not.toContain("anchored:");
    expect(second.stdout).not.toContain("parented:");
  });

  test("flags newly-anchored branches with no recoverable parent", () => {
    // main has no parent by design
    const result = repo.anchor(["init"]);

    expect(result.stdout).toContain("no parent recoverable:");
    expect(result.stdout).toContain("main");
  });

  test("does not reflag unrecoverable branches on rerun", () => {
    repo.anchor(["init"]);
    const second = repo.anchor(["init"]);

    expect(second.stdout).not.toContain("no parent recoverable:");
  });

  test("skips hook install when anchor.hook=false", () => {
    repo.git("config anchor.hook false");
    repo.anchor(["init"]);

    expect(repo.hookExists()).toBe(false);
    expect(repo.configValue("branch.main.anchor")).toMatch(UUID_RE);
  });
});
