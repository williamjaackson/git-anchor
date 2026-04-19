import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRepo, type Repo } from "./helpers";

describe("rename preservation", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  test("UUID survives git branch -m", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    const before = repo.anchor(["get", "feature"]).stdout;

    repo.git("checkout main");
    repo.git("branch -m feature feature-renamed");

    const after = repo.anchor(["get", "feature-renamed"]).stdout;
    expect(after).toBe(before);
  });

  test("resolve returns the new name after rename", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    const id = repo.anchor(["get", "feature"]).stdout;

    repo.git("checkout main");
    repo.git("branch -m feature feature-renamed");

    const r = repo.anchor(["resolve", id]);
    expect(r.stdout).toBe("feature-renamed");
  });

  test("parent resolves to the renamed parent's current name", () => {
    repo.branch("parent", "main");
    repo.commit("p", "p", "p");
    repo.branch("child", "parent");
    repo.commit("c", "c", "c");
    const parentId = repo.anchor(["get", "parent"]).stdout;
    repo.anchor(["get", "child"]);
    repo.anchor(["set-parent", "child", parentId]);

    repo.git("checkout main");
    repo.git("branch -m parent parent-renamed");

    const r = repo.anchor(["parent", "child", "--name"]);
    expect(r.stdout).toBe("parent-renamed");
  });

  test("parent UUID itself is unchanged after parent is renamed", () => {
    repo.branch("parent", "main");
    repo.commit("p", "p", "p");
    repo.branch("child", "parent");
    repo.commit("c", "c", "c");
    const parentId = repo.anchor(["get", "parent"]).stdout;
    repo.anchor(["get", "child"]);
    repo.anchor(["set-parent", "child", parentId]);

    const before = repo.anchor(["parent", "child"]).stdout;

    repo.git("checkout main");
    repo.git("branch -m parent parent-renamed");

    const after = repo.anchor(["parent", "child"]).stdout;
    expect(after).toBe(before);
  });

  test("both anchor and anchorparent migrate together on rename", () => {
    repo.branch("feature", "main");
    repo.commit("f", "f", "f");
    const mainId = repo.anchor(["get", "main"]).stdout;
    repo.anchor(["get", "feature"]);
    repo.anchor(["set-parent", "feature", mainId]);

    const anchor = repo.configValue("branch.feature.anchor");
    const parent = repo.configValue("branch.feature.anchorparent");

    repo.git("checkout main");
    repo.git("branch -m feature feature-renamed");

    expect(repo.configValue("branch.feature.anchor")).toBeNull();
    expect(repo.configValue("branch.feature.anchorparent")).toBeNull();
    expect(repo.configValue("branch.feature-renamed.anchor")).toBe(anchor);
    expect(repo.configValue("branch.feature-renamed.anchorparent")).toBe(
      parent,
    );
  });
});
