import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo, UUID_RE } from "./helpers";

describe("detached HEAD", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.git(`checkout ${repo.head("HEAD")}`);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("get without a branch arg errors with detached-HEAD message", () => {
    const r = repo.anchor(["get"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("detached HEAD");
  });

  test("remove without a branch arg errors", () => {
    const r = repo.anchor(["remove"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("detached HEAD");
  });

  test("explicit branch argument still works while detached", () => {
    const r = repo.anchor(["get", "feature"]);
    expect(r.ok).toBe(true);
    expect(r.stdout).toMatch(UUID_RE);
  });
});

describe("dotted branch names", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("anchors branches with dots in their names", () => {
    repo.branch("feature.v2", "main");
    repo.commit("f", "f", "f");

    repo.anchor(["get", "feature.v2"]);
    expect(repo.configValue("branch.feature.v2.anchor")).toMatch(UUID_RE);
  });

  test("list correctly parses dotted branch names", () => {
    repo.branch("release/1.0", "main");
    repo.commit("r", "r", "r");
    repo.branch("feature.v2", "main");
    repo.commit("f", "f", "f");
    repo.anchor(["get", "release/1.0"]);
    repo.anchor(["get", "feature.v2"]);

    const r = repo.anchor(["list"]);
    const branches = r.stdout
      .split("\n")
      .map((line) => line.split("\t")[0])
      .filter(Boolean);

    expect(branches).toContain("release/1.0");
    expect(branches).toContain("feature.v2");
  });

  test("resolve round-trips through a dotted branch name", () => {
    repo.branch("feature.v2", "main");
    repo.commit("f", "f", "f");
    const id = repo.anchor(["get", "feature.v2"]).stdout;

    const resolved = repo.anchor(["resolve", id]);
    expect(resolved.stdout).toBe("feature.v2");
  });

  test("rename survives for dotted branch names", () => {
    repo.branch("feature.v2", "main");
    repo.commit("f", "f", "f");
    const id = repo.anchor(["get", "feature.v2"]).stdout;

    repo.git("checkout main");
    repo.git("branch -m feature.v2 feature.v3");

    expect(repo.anchor(["get", "feature.v3"]).stdout).toBe(id);
    expect(repo.anchor(["resolve", id]).stdout).toBe("feature.v3");
  });
});
