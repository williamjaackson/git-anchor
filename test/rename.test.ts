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
});
