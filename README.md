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

`git anchor sweep` scans every local branch, anchors any that don't have one, and attempts reflog-based parent recovery. It's the primary way to populate state, and is safe to rerun as an idempotent refresh.

Individual commands (`get`, `set-parent`) lazy-create anchors on demand without requiring a sweep. Reads (`list`, `resolve`) return whatever's currently in config. Relational reads (`parent`, `children`) compensate with an automatic sweep if they can't find the queried relation; `--no-sweep` opts out of that for callers that want bounded cost and pure-read semantics.

Rename handling is free: git's own `git branch -m` automatically migrates `branch.<old>.*` config entries to `branch.<new>.*`, so UUIDs follow the branch by default.

## Installation

### macOS and Linux (recommended)

```sh
curl -fsSL https://raw.githubusercontent.com/williamjaackson/git-anchor/master/install.sh | sh
```

Drops the latest release binary at `~/.local/bin/git-anchor` and makes it executable. Override the target directory with `INSTALL_DIR=/somewhere/else`. If `~/.local/bin` isn't on your `PATH`, the script prints a note telling you what to add to your shell profile.

To pin a specific version, pass the release tag as an argument:

```sh
curl -fsSL https://raw.githubusercontent.com/williamjaackson/git-anchor/master/install.sh | sh -s <tag>
```

Each release page shows its own install snippet with the tag pre-filled.

### npm

```sh
npm install -g git-anchor
```

Also works with `bun install -g git-anchor` or `pnpm add -g git-anchor`. A postinstall script downloads the matching platform binary (darwin-arm64/x64, linux-arm64/x64, or windows-x64) from GitHub releases.

### Windows

Download `git-anchor-windows-x64.exe` from the [latest release](https://github.com/williamjaackson/git-anchor/releases/latest), rename it to `git-anchor.exe`, and put it in a directory on your `PATH`. SmartScreen will warn on first run; click "More info" then "Run anyway".

### Manual download on macOS

If you download the macOS binary via a browser, macOS attaches a quarantine flag and Gatekeeper will refuse to run it. Either use the `curl | sh` installer above (which bypasses the quarantine) or remove the flag manually:

```sh
xattr -d com.apple.quarantine ~/Downloads/git-anchor-darwin-arm64
chmod +x ~/Downloads/git-anchor-darwin-arm64
mv ~/Downloads/git-anchor-darwin-arm64 ~/.local/bin/git-anchor
```

### From source

Requires [Bun](https://bun.sh):

```sh
git clone https://github.com/williamjaackson/git-anchor
cd git-anchor
bun install
bash build.sh            # produces ./git-anchor (compiled binary)
cp git-anchor ~/.local/bin/
```

The binary must be on `PATH`. Git invokes it as `git anchor <cmd>` automatically via its plugin convention (`git-*` binaries on `PATH` become `git *` subcommands).

## Quick start

Run `git anchor sweep` in your repo. It anchors every branch and recovers parents via reflog where possible:

```sh
$ git anchor sweep
anchored:
  main      e863bb23-ed43-4abb-ab86-dead7ff0dfdd
  feature   a3f2b1c4-1234-4567-89ab-cdef01234567
parented:
  feature   -> main
```

After that, individual commands (`get`, `set-parent`) maintain state on demand, and `parent` / `children` will auto-sweep if they hit a gap. Rerun `sweep` any time you want an explicit full refresh.

## Commands

### `git anchor sweep`

Scans all local branches: anchors any that don't have one, and attempts reflog-based parent recovery for anchored-but-parentless branches. Idempotent, safe to rerun whenever you want to refresh state.

```sh
$ git anchor sweep
anchored:
  main      e863bb23-ed43-4abb-ab86-dead7ff0dfdd
  feature   a3f2b1c4-1234-4567-89ab-cdef01234567
parented:
  feature   -> main

$ git anchor sweep
nothing to do — 2 branches already set up
```

### `git anchor get [branch] [--no-create]`

Prints the anchor UUID for `branch`, or the current branch if omitted. Lazy-creates an anchor for that one branch if it doesn't have one. Does **not** run the repo-wide sweep — use `sweep` for that.

Flags:
- `--no-create` — exits 1 if no anchor exists instead of creating one.

```sh
$ git anchor get
7c9e6679-7425-40de-944b-e07fc1f90ae7

$ git anchor get feature --no-create
# prints uuid, or exits 1 silently if unset
```

### `git anchor parent [branch] [--name] [--no-sweep]`

Prints the parent anchor UUID, or the parent branch name with `--name`. Empty output + exit 0 if no parent is recorded.

If no parent is recorded, runs a full sweep to try to recover it. Pass `--no-sweep` to skip that fallback and get a pure, predictable-cost read.

```sh
$ git anchor parent feature
a3f2b1c4-1234-4567-89ab-cdef01234567

$ git anchor parent feature --name
main
```

### `git anchor children [branch] [--name] [--no-sweep]`

Prints the anchor UUIDs of every branch whose parent is `branch` (or the current branch if omitted). `--name` prints branch names instead. Output is sorted alphabetically by branch name.

If no children are recorded, runs a full sweep in case there are branches whose parent pointer hasn't been populated yet. Pass `--no-sweep` to skip that fallback. Leaf branches under the default behavior will pay one sweep per invocation, since there's no way to distinguish "legit leaf" from "unpopulated."

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
- `--parent` — clears only the recorded parent, leaving the anchor intact. Use when `set-parent` was pointed at the wrong branch or when you want parent detection to re-run on the next `sweep`.

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

## Parent detection

`git anchor sweep` recovers parents from reflog with this priority:

1. **Own reflog `branch: Created from X`** — if X isn't `HEAD`.
2. **HEAD reflog fallback** — finds `checkout: moving from <X> to <new-branch>` in HEAD's reflog. Handles `git checkout -b <name>` without an explicit source.

When neither signal produces a valid existing branch, the branch is reported as `no parent recoverable` in the sweep report.

## Limitations

### Local-only

All state lives in local git config. It does not cross clones — a fresh clone starts with no anchors.

If you need cross-clone persistence, git-anchor isn't the right tool. Refs under `refs/anchors/*` would be pushable, but they'd go stale on every commit and need constant rewriting; a committed `.gitanchor.json` would conflict on merges.

### Parent recovery is best-effort

Parent detection depends on reflog contents. Known failure cases:

| Case | Recoverable? |
|---|---|
| `git checkout -b b main` (explicit source) | Yes — own reflog records "Created from main" |
| `git checkout -b b` from `main` | Yes — HEAD reflog fallback finds "moving from main to b" |
| Parent renamed before `git anchor sweep` is run | No — reflog still names the old branch, but it no longer exists. We detect this and skip (no ghost entries written). |
| Reflog expired (default 30–90 days) | No |
| Clone-created tracking branches | No — reflog says `clone:`, not a branch name |

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
- **Why no `post-checkout` hook (yet)?** A hook could capture parents at branch creation and avoid needing the sweep fallback, but hook installation has awkward interactions with tools like husky that commit their own hooks directory. That's tracked for a later release; for now the tool is intentionally local-only state with `sweep` (and the auto-sweep fallback on `parent` / `children`) as the refresh lever.

## Build system

`build.sh` has two modes:

- `bash build.sh` (no arguments): builds for the host platform, outputs `./git-anchor`. Ad-hoc codesigns on Darwin (required for Bun-compiled binaries to run on recent macOS).
- `bash build.sh <target>`: cross-compiles via `bun --target=bun-<target>`, outputs to `dist/git-anchor-<target>[.exe]`. Supported targets are `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `windows-x64`.

The release workflow calls the second form for each target on a macOS runner to produce the five release binaries.

## Project layout

```
src/
  index.ts                  CLI dispatcher
  core/
    anchor.ts               get/set/resolve/list/ensureAnchor primitives + runSweep
    git.ts                  exec wrapper + branch/ref helpers
    reflog.ts               parseReflogCreatedFrom (own + HEAD fallback)
    log.ts                  out / info / err with TTY-gated ANSI
    error.ts                AnchorError
  commands/
    index.ts                command registry
    types.ts                Command interface
    sweep.ts get.ts parent.ts children.ts resolve.ts list.ts setParent.ts remove.ts version.ts help.ts
```

## License

MIT.
