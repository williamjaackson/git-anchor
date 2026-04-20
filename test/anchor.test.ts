import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo, UUID_RE } from "./helpers";

describe("get command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("creates and prints a UUID v4 on first call", () => {
    const r = repo.anchor(["get"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toMatch(UUID_RE);
  });

  test("returns the same UUID on subsequent calls", () => {
    const first = repo.anchor(["get"]);
    const second = repo.anchor(["get"]);

    expect(first.stdout).toBe(second.stdout);
  });

  test("takes an explicit branch argument", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.checkout("main");

    const r = repo.anchor(["get", "feature"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toMatch(UUID_RE);
    expect(repo.configValue("branch.feature.anchor")).toBe(r.stdout);
  });

  test("--no-create exits 1 when unset and does not create", () => {
    const r = repo.anchor(["get", "--no-create"]);

    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe("");
    expect(repo.configValue("branch.main.anchor")).toBeNull();
  });

  test("--no-create prints existing UUID without creating", () => {
    const first = repo.anchor(["get"]);
    const r = repo.anchor(["get", "--no-create"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe(first.stdout);
  });

  test("errors on nonexistent branch", () => {
    const r = repo.anchor(["get", "ghost"]);

    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("does not exist");
  });
});

describe("parent command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    const mainId = repo.anchor(["get", "main"]).stdout;
    repo.anchor(["get", "feature"]);
    repo.git(`config branch.feature.anchorparent ${mainId}`);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("prints parent UUID by default", () => {
    const r = repo.anchor(["parent", "feature"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toMatch(UUID_RE);
    expect(r.stdout).toBe(repo.configValue("branch.main.anchor"));
  });

  test("--name resolves to branch name", () => {
    const r = repo.anchor(["parent", "feature", "--name"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("main");
  });

  test("empty output + exit 0 when no parent is set", () => {
    const r = repo.anchor(["parent", "main"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("");
  });
});

describe("parent command auto-sweep", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    // Anchor feature directly via config so there's no parent recorded yet.
    repo.git("config branch.feature.anchor 11111111-1111-4111-8111-111111111111");
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("compensates with a sweep when parent is not recorded", () => {
    const r = repo.anchor(["parent", "feature", "--name"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("main");
    // Sweep should have also anchored main and set feature's parent pointer.
    expect(repo.configValue("branch.main.anchor")).toMatch(UUID_RE);
    expect(repo.configValue("branch.feature.anchorparent")).toBe(
      repo.configValue("branch.main.anchor"),
    );
  });

  test("--no-sweep skips compensation and returns empty", () => {
    const r = repo.anchor(["parent", "feature", "--no-sweep"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("");
    // Sweep should NOT have run — main stays unanchored.
    expect(repo.configValue("branch.main.anchor")).toBeNull();
  });
});

describe("resolve command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.anchor(["get", "main"]);
    repo.anchor(["get", "feature"]);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("resolves UUID back to branch name", () => {
    const id = repo.configValue("branch.feature.anchor")!;
    const r = repo.anchor(["resolve", id]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("feature");
  });

  test("exits 1 on unknown UUID", () => {
    const r = repo.anchor([
      "resolve",
      "00000000-0000-4000-8000-000000000000",
    ]);

    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("no branch found");
  });

  test("rejects malformed UUID", () => {
    const r = repo.anchor(["resolve", "not-a-uuid"]);

    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("not a valid UUID");
  });
});

describe("set-parent command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.branch("hotfix", "main");
    repo.commit("h", "h", "h");
    repo.anchor(["get", "main"]);
    repo.anchor(["get", "feature"]);
    repo.anchor(["get", "hotfix"]);
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("sets parent to another branch's anchor", () => {
    const featureId = repo.configValue("branch.feature.anchor")!;
    const r = repo.anchor(["set-parent", "hotfix", featureId]);

    expect(r.ok).toBe(true);
    expect(repo.configValue("branch.hotfix.anchorparent")).toBe(featureId);
  });

  test("rejects malformed UUID", () => {
    const r = repo.anchor(["set-parent", "hotfix", "not-a-uuid"]);

    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("not a valid UUID");
  });

  test("rejects UUID not bound to any branch", () => {
    const r = repo.anchor([
      "set-parent",
      "hotfix",
      "00000000-0000-4000-8000-000000000000",
    ]);

    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("no branch found");
  });
});

describe("list command", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("empty output when no branches anchored", () => {
    const r = repo.anchor(["list"]);

    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("");
  });

  test("tab-separated rows: branch, anchor, parent", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.anchor(["get", "main"]);
    repo.anchor(["get", "feature"]);

    const r = repo.anchor(["list"]);
    const rows = r.stdout.split("\n").filter(Boolean);

    expect(rows.length).toBe(2);
    const featureRow = rows.find((l) => l.startsWith("feature\t"))!;
    const parts = featureRow.split("\t");
    expect(parts[0]).toBe("feature");
    expect(parts[1]).toMatch(UUID_RE);
    expect(parts[2]).toBe(""); // no parent set yet
  });

  test("--json emits structured data", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    repo.anchor(["get", "feature"]);

    const r = repo.anchor(["list", "--json"]);
    const parsed = JSON.parse(r.stdout);

    expect(Array.isArray(parsed)).toBe(true);
    const feature = parsed.find(
      (e: { branch: string }) => e.branch === "feature",
    );
    expect(feature.anchor).toMatch(UUID_RE);
    expect(feature.parent).toBeNull();
  });
});
