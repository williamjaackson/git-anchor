# git-anchor

Persistent UUIDs for git branches, and tracked parents.

```
$ git anchor get feature
7c9e6679-7425-40de-944b-e07fc1f90ae7

$ git branch -m feature feature-renamed
$ git anchor resolve 7c9e6679-7425-40de-944b-e07fc1f90ae7
feature-renamed
```

## Why

Git branches are identified by name, and git deliberately has no concept of branch identity beyond that. Once you branch off something, the two branches are completely separate; once you rename a branch, no record of its previous name exists. That's correct for git's mental model but painful for tools built on top.

`git-anchor` assigns a persistent UUID to each branch and records the UUID of its parent. Downstream tools can key their data on anchor IDs instead of names and look up the current name whenever needed — so renames don't lose metadata and explicit "base branch" declarations aren't needed.

## How it works

Two pieces of state per branch, stored in local git config:

| Key | Value |
|---|---|
| `branch.<name>.anchor` | this branch's UUID |
| `branch.<name>.anchorparent` | UUID of the parent branch |

Two mechanisms keep that state up to date:

1. **A `post-checkout` hook** captures the parent at the exact moment a new branch is created. It installs itself automatically the first time a command creates an anchor (`git anchor get`, `git anchor set-parent`) or when you run `git anchor init`.
2. **`git anchor init`** sweeps the repo once to backfill anchors and best-effort parent detection for branches that existed before git-anchor was installed. Optional — only needed when you already have branches predating the tool.

Pure-read commands (`list`, `parent`, `resolve`, `remove`) don't install the hook or sweep — they're side-effect-free, cheap, and safe to call from other tools or scripts.

Rename handling is free: git's own `git branch -m` automatically migrates `branch.<old>.*` config entries to `branch.<new>.*`, so UUIDs follow the branch by default.

## Installation

Requires [Bun](https://bun.sh) to build.

```sh
git clone https://github.com/williamjaackson/git-anchor
cd git-anchor
bun install
bash build.sh            # produces ./git-anchor (compiled binary)
cp git-anchor ~/.local/bin/
```

The binary must be on `PATH`. Git invokes it as `git anchor <cmd>` automatically via its plugin convention (`git-*` binaries on `PATH` become `git *` subcommands). The installed hook also calls `git anchor __hook-post-checkout`, so if the binary isn't discoverable the hook silently does nothing.

## Quick start

Nothing to do — just start using it. The first time you run a command that creates an anchor, the hook installs itself.

```sh
$ git anchor get
git-anchor: installed post-checkout hook
7c9e6679-7425-40de-944b-e07fc1f90ae7
```

From here, any new branch you create is automatically anchored and parented. If you have **pre-existing** branches you'd like to backfill in one pass, run `git anchor init`:

```sh
$ git anchor init
anchored:
  main      e863bb23-ed43-4abb-ab86-dead7ff0dfdd
  feature   a3f2b1c4-1234-4567-89ab-cdef01234567
parented:
  feature   -> main
```

## Commands

### `git anchor init`

Installs the `post-checkout` hook (if not already installed) and sweeps all local branches: anchors any that don't have one, and attempts reflog-based parent recovery for anchored-but-parentless branches. Idempotent — safe to rerun. Prints a report of what changed.

**Optional.** The hook self-installs on first use of `get`/`set-parent`, so you only need `init` when you want to backfill pre-existing branches in one pass, or to re-sweep after disabling the hook (`anchor.hook = false`) and creating branches while it was off.

```sh
$ git anchor init
git-anchor: installed post-checkout hook
anchored:
  main      e863bb23-ed43-4abb-ab86-dead7ff0dfdd
  feature   a3f2b1c4-1234-4567-89ab-cdef01234567
parented:
  feature   -> main

$ git anchor init
nothing to do — 2 branches already set up
```

### `git anchor get [branch] [--no-create]`

Prints the anchor UUID for `branch`, or the current branch if omitted. Lazy-creates an anchor for that one branch if it doesn't have one, and installs the `post-checkout` hook the first time it runs. Does **not** run the repo-wide sweep — use `init` for that.

Flags:
- `--no-create` — exits 1 if no anchor exists instead of creating one.

```sh
$ git anchor get
7c9e6679-7425-40de-944b-e07fc1f90ae7

$ git anchor get feature --no-create
# prints uuid, or exits 1 silently if unset
```

### `git anchor parent [branch] [--name]`

Prints the parent anchor UUID, or the parent branch name with `--name`. Empty output + exit 0 if no parent is recorded.

```sh
$ git anchor parent feature
a3f2b1c4-1234-4567-89ab-cdef01234567

$ git anchor parent feature --name
main
```

### `git anchor children [branch] [--name]`

Prints the anchor UUIDs of every branch whose parent is `branch` (or the current branch if omitted). `--name` prints branch names instead. Output is sorted alphabetically by branch name; empty output if the branch has no children. Pure read — no side effects, does not install the hook.

```sh
$ git anchor children main --name
feature
hotfix
```

### `git anchor resolve <id>`

Resolves an anchor UUID to a branch name. Exits 1 if the UUID isn't bound to any current branch.

```sh
$ git anchor resolve 7c9e6679-7425-40de-944b-e07fc1f90ae7
feature
```

### `git anchor list [--json]`

Lists every branch with its anchor and parent.

```sh
$ git anchor list
main     e863bb23-ed43-4abb-ab86-dead7ff0dfdd
feature  a3f2b1c4-1234-4567-89ab-cdef01234567   e863bb23-ed43-4abb-ab86-dead7ff0dfdd
```

Columns are tab-separated: `<branch>\t<anchor>\t<parent>`. Parent column is empty for branches without a recorded parent.

Flags:
- `--json` — emits a JSON array of `{branch, anchor, parent}` objects. Machine-readable.

### `git anchor set-parent <branch> <parent-id>`

Manually set a branch's parent. Useful when automatic detection failed (reflog expired, branch predates `git-anchor`, etc.).

Validates that `<parent-id>` is a well-formed UUID v4 and that it's actually bound to a current branch — rejects ghost IDs.

```sh
$ git anchor set-parent feature e863bb23-ed43-4abb-ab86-dead7ff0dfdd
set parent of 'feature' to e863bb23-ed43-4abb-ab86-dead7ff0dfdd
```

### `git anchor remove [branch] [--parent]`

Clears both the anchor and the parent for `branch` (or the current branch). Does not delete the branch itself.

Flags:
- `--parent` — clears only the recorded parent, leaving the anchor intact. Use when `set-parent` was pointed at the wrong branch or when you want parent detection to re-run on the next `init`.

```sh
$ git anchor remove feature
cleared anchor for 'feature'

$ git anchor remove feature --parent
cleared parent for 'feature'
```

Note: `git branch -D` already removes `branch.<name>.*` entries automatically — no cleanup needed after normal branch deletion.

There's no flag for removing only the anchor while keeping the parent. An orphan parent record (without an anchor to attach it to) has no meaning, and resetting the anchor dangles every stored reference in downstream tools. If you truly need it, `git config --unset branch.<name>.anchor` is one line.

### `git anchor version`

Prints the git-anchor version.

```sh
$ git anchor version
0.1.0
```

### `git anchor help [command]`

Global help, or per-command help with a command name.

Note: `git anchor --help` does **not** work — git intercepts `--help` and tries to open a man page, which this plugin doesn't ship. Use `git anchor help` instead.

## Configuration

### `anchor.hook` (boolean, default `true`)

Controls the `post-checkout` hook.

```sh
git config anchor.hook false     # disable
git config anchor.hook true      # re-enable (or unset)
```

When disabled:
- `git anchor init` skips hook installation.
- An already-installed hook self-deactivates — the handler bails out early after checking the config, without needing to edit the hook file. Flip back to `true` and the hook resumes.

See [Limitations](#limitations) for what you lose when the hook is off.

## Parent detection

The hook records parents with this priority:

1. **Branches at `prev-sha`** — if exactly one branch (other than the new one) points at the commit HEAD was on before the checkout, that's the parent. Most reliable.
2. **Own reflog `branch: Created from X`** — if X isn't `HEAD`.
3. **HEAD reflog fallback** — finds `checkout: moving from <X> to <new-branch>` in HEAD's reflog. Handles `git checkout -b <name>` without an explicit source.
4. **`@{-1}`** — previous branch.

`git anchor init`'s sweep uses strategies 2 and 3 only — 1 and 4 depend on information that's only available at checkout time, which is why the hook is the primary capture path.

## Limitations

### Local-only

All state lives in local git config. It does not cross clones — a fresh clone starts with no anchors.

If you need cross-clone persistence, git-anchor isn't the right tool. Refs under `refs/anchors/*` would be pushable, but they'd go stale on every commit and need constant rewriting; a committed `.gitanchor.json` would conflict on merges.

### Hook requires `git-anchor` on PATH

The hook calls `git anchor __hook-post-checkout`. If the binary isn't discoverable, the hook silently does nothing (`|| true`). Symptoms: new branches get anchors when you next run `git anchor get`, but without recorded parents.

### Pre-existing branches have limited parent recovery

For branches created before `git-anchor` was installed, parent detection depends entirely on reflog contents. Known failure cases:

| Case | Recoverable? |
|---|---|
| `git checkout -b b main` (explicit source) | Yes — own reflog records "Created from main" |
| `git checkout -b b` from `main` | Yes — HEAD reflog fallback finds "moving from main to b" |
| Parent renamed before first `git anchor` call | No — reflog still names the old branch, but it no longer exists. We detect this and skip (no ghost entries written). |
| Reflog expired (default 30–90 days) | No |
| Clone-created tracking branches | No — reflog says `clone:`, not a branch name |
| Multiple branches at the same commit when you branched | Ambiguous after the fact; hook would have disambiguated via prev-sha |

Use `git anchor set-parent <branch> <parent-id>` to fix any of these manually.

### Detached HEAD

Commands that default to the current branch throw `error: not on a branch (detached HEAD)`. Pass an explicit branch name, or check out a branch first.

### `set --force` is not implemented

There is no `set` command for directly setting a branch's own anchor (as opposed to `set-parent`). Anchors are always generated via `ensureAnchor`. If you need to restore a specific UUID (e.g. after a clone, to match a collaborator's anchors), edit `.git/config` directly.

### UUIDs are not signed or verified

A local `git config` user can assign any UUID to any branch. This is a local metadata system, not a trust boundary.

## Design decisions

- **Why git config, not refs or tracked files?** Git auto-migrates `branch.<old>.*` entries to `branch.<new>.*` when a branch is renamed. That makes rename handling free. Refs break on every commit; tracked files conflict on merges.
- **Why UUID v4 and not short hex?** (practically) Zero collision risk if anchors ever need to be shared across repos (they aren't today, but the option is open). 36 chars is fine — they appear in config and JSON, rarely on command lines.
- **Why auto-install the hook?** Parent capture is only fully reliable at the moment a branch is created. Making it opt-in via an `install` command would mean users create branches, forget to run `install`, and silently lose parent data. Disable via `git config anchor.hook false` if you want out.

## Building from source

```sh
bun install
bash build.sh
```

`build.sh` runs `bun build --compile --minify` and re-signs the resulting Mach-O binary on macOS (`codesign -f -s -`), which is required for Bun's compiled binaries to execute on recent macOS.

## Project layout

```
src/
  index.ts                  CLI dispatcher
  core/
    anchor.ts               get/set/resolve/list/ensureAnchor primitives
    git.ts                  exec wrapper + branch/ref helpers
    hook.ts                 ensureHookInstalled + isHookEnabled
    reflog.ts               parseReflogCreatedFrom (own + HEAD fallback)
    log.ts                  out / info / err with TTY-gated ANSI
    error.ts                AnchorError
  commands/
    index.ts                command registry
    types.ts                Command interface
    get.ts parent.ts resolve.ts list.ts setParent.ts remove.ts help.ts
    _hookPostCheckout.ts    internal, invoked by the hook
```

## License

MIT.
