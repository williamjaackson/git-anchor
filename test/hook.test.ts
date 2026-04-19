import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync, chmodSync } from "fs";
import { createRepo, type Repo, UUID_RE } from "./helpers";

const MARKER_START = "# >>> git-anchor managed block (do not edit)";
const MARKER_END = "# <<< git-anchor managed block";

describe("hook install", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("creates post-checkout with shebang + marked block when missing", () => {
    repo.anchor(["get"]);

    const contents = repo.readHook();
    expect(contents.startsWith("#!/bin/sh")).toBe(true);
    expect(contents).toContain(MARKER_START);
    expect(contents).toContain(MARKER_END);
  });

  test("appends marked block to an existing hook without clobbering it", () => {
    const hookPath = repo.hookPath();
    writeFileSync(hookPath, "#!/bin/sh\necho existing-hook\n");
    chmodSync(hookPath, 0o755);

    repo.anchor(["get"]);

    const contents = repo.readHook();
    expect(contents).toContain("echo existing-hook");
    expect(contents).toContain(MARKER_START);
  });

  test("does not duplicate the block on rerun", () => {
    repo.anchor(["get"]);
    repo.anchor(["get"]);

    const contents = repo.readHook();
    const occurrences = contents.split(MARKER_START).length - 1;
    expect(occurrences).toBe(1);
  });

  test("skips install entirely when anchor.hook=false", () => {
    repo.git("config anchor.hook false");
    repo.anchor(["get"]);

    expect(repo.hookExists()).toBe(false);
  });
});

describe("__hook-post-checkout handler", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("anchors the current branch and records parent from prev-sha", () => {
    // Anchor main explicitly so there's something for the hook to reference
    const mainSha = repo.head("main");
    repo.anchor(["get"]);

    // Create the branch without going through git's hook
    repo.git("checkout -b feature");

    // Clear any anchor the sweep might have set (we want to test the handler)
    repo.gitSafe("config --unset branch.feature.anchor");
    repo.gitSafe("config --unset branch.feature.anchorparent");

    // Invoke the handler as the hook would, with prev-sha=mainSha, new-sha=same
    const r = repo.anchor([
      "__hook-post-checkout",
      mainSha,
      mainSha,
    ]);

    expect(r.ok).toBe(true);
    expect(repo.configValue("branch.feature.anchor")).toMatch(UUID_RE);
    expect(repo.configValue("branch.feature.anchorparent")).toBe(
      repo.configValue("branch.main.anchor"),
    );
  });

  test("no-ops when anchor.hook=false", () => {
    repo.anchor(["get"]);
    const mainSha = repo.head("main");
    repo.git("checkout -b feature");

    repo.git("config anchor.hook false");

    const r = repo.anchor([
      "__hook-post-checkout",
      mainSha,
      mainSha,
    ]);

    expect(r.ok).toBe(true);
    // No anchor assigned — handler bailed out
    expect(repo.configValue("branch.feature.anchor")).toBeNull();
  });

  test("skips when current branch already has an anchor", () => {
    repo.anchor(["get"]);
    const mainSha = repo.head("main");
    repo.git("checkout -b feature");
    const featureId = repo.anchor(["get", "feature"]).stdout;

    const r = repo.anchor([
      "__hook-post-checkout",
      mainSha,
      mainSha,
    ]);

    expect(r.ok).toBe(true);
    // Unchanged
    expect(repo.configValue("branch.feature.anchor")).toBe(featureId);
  });
});
