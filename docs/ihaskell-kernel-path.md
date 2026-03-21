# IHaskell kernel: `ghc-pkg` not found (PATH)

If starting the **Haskell** kernel fails with:

```text
shelly did not find ghc-pkg in the PATH: ...
```

the Jupyter process that launches IHaskell does **not** include `~/.ghcup/bin` on `PATH`. Interactive terminals often add GHCup via `~/.bashrc` / `~/.zshrc`, but **Cursor / VS Code** (and the Jupyter extension) may start without those files, and **Conda** may put `anaconda3/bin` first.

## Fix 1 — Wrapper script (recommended)

This avoids **freezing** a full `PATH` string in `kernel.json` (which goes stale as your shell environment changes). A tiny script **prepends** GHCup for each kernel start, then **`exec`s** the real `ihaskell` with the same arguments Jupyter would have passed.

Put the script **outside** any project repo—e.g. **`~/.local/bin/ihaskell-kernel-wrap.sh`**—because `kernel.json` uses an **absolute** path and the kernel is **user-wide**, not tied to one workspace. The `.example` file in this repository is only a template to copy from.

1. Copy [ihaskell-kernel-wrap.sh.example](ihaskell-kernel-wrap.sh.example) to e.g. `~/.local/bin/ihaskell-kernel-wrap.sh`.

2. The example **`exec`s** `"${HOME}/.local/bin/ihaskell"` (cabal’s symlink). If your `ihaskell` lives elsewhere, edit that one line.

3. `chmod +x` the script.

4. Edit `~/Library/Jupyter/kernels/haskell/kernel.json` and replace **only** the first element of **`argv`** (the `ihaskell` path) with the **absolute path to the wrapper script**. Leave all other `argv` entries unchanged.

5. Reload the editor and try the kernel again.

The parent process still supplies its normal `PATH`; the wrapper only ensures `~/.ghcup/bin` is searched first so `ghc-pkg` resolves.

**Note:** `ihaskell install` **regenerates** `kernel.json` and sets **`argv[0]`** to the real `ihaskell` binary. If you rely on a wrapper for `PATH`, run **`ihaskell install`**, then **edit `kernel.json` again** and point **`argv[0]`** back to your wrapper script.

## Fix 2 — Frozen `env.PATH` in kernel.json (fallback)

You can set a single **`PATH`** string under **`env`** in `kernel.json`, but that **replaces** `PATH` for the kernel with whatever you paste—so it **does** get out of date unless you maintain it. Prefer Fix 1 if you care about drift.

If you still use this: prepend `$HOME/.ghcup/bin` to a copy of the PATH from the error log (one full string). See older revisions of this doc for an example shape.

## Fix 3 — Launch the editor from a shell where GHCup works

From a terminal where `which ghc-pkg` prints `~/.ghcup/bin/ghc-pkg`, start Cursor/VS Code so the process inherits `PATH`:

```bash
cd /path/to/project
cursor .
# or: code .
```

## Fix 4 — Login PATH on macOS

Add GHCup to **`~/.zprofile`** (or **`~/.profile`**) so login shells see it:

```bash
export PATH="$HOME/.ghcup/bin:$PATH"
```

This does not always affect apps started from the Dock; Fix 1 remains the most reliable for Jupyter without freezing PATH.
