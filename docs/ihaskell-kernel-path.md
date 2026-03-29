# IHaskell kernel: `ghc-pkg` not found (PATH)

If starting the **Haskell** kernel fails with:

```text
shelly did not find ghc-pkg in the PATH: ...
```

the Jupyter process that launches IHaskell does **not** include `~/.ghcup/bin` on `PATH`. Interactive terminals often add GHCup via `~/.bashrc` / `~/.zshrc`, but **Cursor / VS Code** (and the Jupyter extension) may start without those files, and **Conda** may put `anaconda3/bin` first.

## Kernel fails: hidden package ihaskell

If starting the kernel fails with errors like:

```text
Could not load module `IHaskell.Display'
It is a member of the hidden package `ihaskell-0.13.0.0'.
You can run `:set -package ihaskell' to expose it.
```

and similar lines for `template-haskell`, `unix`, `directory`, or **`ghc-lib-parser-9.8.*`** (or another `ghc-lib-parser-*` line that does not match your compiler line), the IHaskell **build** and the **GHC you run** are out of sync. For example, the **IHaskell** binary (or its Cabal dependencies) may have been built against **`ghc-lib` 9.8** while **`ghc` on your PATH** is still **9.6** (or the reverse). GHCi then cannot expose `IHaskell.*` and base packages consistently.

**Even if `kernel.json` already has `--ghclib` …/ghc-9.8.4/…/lib`:** `ihaskell install` can still leave you with an **`ihaskell` executable** that was **compiled** against a **different** `ghc-lib` / store snapshot. The kernel passes one `--ghclib`, but the running binary may still try to load mismatched `ghc-lib-parser` modules. Fix is still a **full rebuild** of IHaskell with **only** the intended GHC active (`ghcup set ghc` + `cabal install ihaskell --overwrite-policy=always` + **`~/.local/bin/ihaskell install`** if PATH might pick an old `ihaskell`), then point **`argv[0]`** at your wrapper again.

**1. Pick a single GHC and stick to it** — [INSTALLATION.md](../INSTALLATION.md) assumes **9.8.4** for GHC, Cabal, IHaskell, and HLS. Do not mix **9.6.x** and **9.8.x** on PATH, in `kernel.json`, or in `.ghc.environment.*`.

**2. Reinstall IHaskell for that compiler** (this rebuilds against one `ghc-lib` / boot package set):

```bash
ghcup set ghc 9.8.4          # match INSTALLATION.md
cabal update
cabal install ihaskell --overwrite-policy=always
~/.local/bin/ihaskell install    # avoids a stale ihaskell earlier on PATH
```

After `ihaskell install`, if you use the [kernel wrapper](#fix-1--wrapper-script-recommended), point **`kernel.json` `argv[0]`** back to the wrapper script again.

If you must stay on **9.6.x**, use the same four steps with **`ghcup set ghc 9.6.7`** (or your pin) instead—**all** of GHC, IHaskell rebuild, `kernel.json` `--ghclib`, and project `.ghc.environment.*` must match that version.

**3. Clear `GHC_PACKAGE_PATH` for the kernel.** The wrapper script below runs `unset GHC_PACKAGE_PATH` before starting `ihaskell`. A global `cabal install --lib …` can set this and confuse GHCi; removing `~/.ghc/.../environments/default` (or not using a global env) also helps.

**4. Optional:** Run **Whiskers: Diagnose IHaskell Kernel Environment** (after `npm run compile` and reloading the Extension Development Host) with the **same workspace folder open** where the kernel fails. It appends NDJSON lines to `<workspace>/.cursor/debug-06212d.log` with `ghc --version`, `ghc --print-libdir`, full `kernel.json` `argv`, and a **kernel-like** `PATH` (no conda) for comparison.

## Kernel works in one workspace folder but not another

`kernel.json` is **per user** (e.g. `~/Library/Jupyter/kernels/haskell/kernel.json` on macOS), so the **IHaskell command line** is usually the same everywhere. Even so, the **Jupyter server** and **kernel subprocess** inherit the **environment of the VS Code / Cursor process** for the **currently opened folder**—including `PATH`, Conda activation, and Python/Jupyter selection. So IHaskell can **start in one project** and **fail in another** without any change to Whiskers or to `kernel.json`.

**What to do:** Open the **failing** folder as the workspace, run **Whiskers: Diagnose IHaskell Kernel Environment**, and compare `PATH` / `GHC_PACKAGE_PATH` to a terminal where `jupyter` works. Use the [wrapper](#fix-1--wrapper-script-recommended) and a **single** GHC + reinstall IHaskell as in the section above if you still see hidden-package / `ghc-lib-parser` errors.

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
