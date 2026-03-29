# Installing Whiskers Haskell Tutor

This guide covers building the extension from source, installing the `.vsix`, configuring AI backends, and getting **IHaskell** working as your Jupyter kernel—plus a few sharp corners you might hit on macOS or Cursor.

## Install the extension

This project does not assume a published Marketplace listing. Use one of these approaches.

### From a `.vsix` (normal install)

1. Clone or copy this repository and open a terminal at the project root.
2. Install dependencies and build:
   ```bash
   npm install
   npm run compile
   ```
3. Create the extension package:
   ```bash
   npx vsce package
   ```
4. Install the packaged extension:
   - **Command Palette** (macOS: **⇧⌘P**): run **Extensions: Install from VSIX…**, then choose the generated `whiskers-haskell-tutor-*.vsix` in the project directory (or wherever you saved it).
   - Alternatively, open **Extensions** (**⇧⌘X** in VS Code on macOS; your keybindings may differ) and use the **⋯** menu on that view if your build shows **Install from VSIX…** there.

After installation, configure [settings](#configuration-no-silent-defaults) and complete the [prerequisites](#prerequisites-developer-environment) for notebooks and AI backends (including [Haskell toolchain (GHC 9.8.4)](#haskell-toolchain-ghc-984) if you use IHaskell).

### From source (Extension Development Host)

For development and debugging, use **F5** in VS Code/Cursor with this folder open (see [Development](#development)). That launches an **Extension Development Host** with Whiskers loaded without installing a `.vsix`.

## Prerequisites (developer environment)

- **GHCup** with **GHC** (docs assume **9.8.4**), **Cabal**, **IHaskell** as the Jupyter kernel, and optionally **HLS** for Haskell in the editor—see **[Haskell toolchain (GHC 9.8.4)](#haskell-toolchain-ghc-984)** below for the full sequence.
- **Jupyter** extension: `ms-toolsai.jupyter` (install from the Marketplace).
- **LM Studio** (or another OpenAI-compatible server) for **coach / challenge / quiz**.
- **Replicate** API token for **generation / debugging** (Claude Opus 4.6 via `anthropic/claude-opus-4.6` by default).

<a id="haskell-toolchain-ghc-984"></a>

## Haskell toolchain (GHC 9.8.4)

End-to-end steps for **GHCup**, **Cabal**, **HLS**, **IHaskell**, and Jupyter. The Whiskers extension itself is TypeScript; you need this toolchain for **IHaskell notebooks** and (optionally) **`.hs`** files in Cursor/VS Code.

### Assumptions

- **GHCup** is installed (e.g. via Homebrew).
- **`~/.ghcup/bin`** is on your `PATH` in shells where you run the commands below (add `export PATH="$HOME/.ghcup/bin:$PATH"` to `~/.bashrc` or `~/.zshrc` if needed; Homebrew’s GHCup does not always create `~/.ghcup/env`).
- For Jupyter, **`~/.ghcup/bin`** often **does not** appear in the GUI environment—use a [kernel wrapper](docs/ihaskell-kernel-path.md) so `ghc-pkg` resolves when the kernel starts.

### 1. Install and select GHC 9.8.4

```bash
ghcup install ghc 9.8.4
ghcup set ghc 9.8.4
```

Verify:

```bash
ghc --numeric-version   # should print 9.8.4
```

### 2. Upgrade Cabal (via ghcup)

Use **`ghcup install`**, not `ghcup upgrade cabal` (that form is invalid on current ghcup):

```bash
ghcup install cabal latest
ghcup set cabal recommended   # or the exact version you installed
cabal update
```

### 3. Install HLS for this GHC

```bash
ghcup install hls
ghcup set hls <version>   # pick a version `ghcup list` shows; choose one that supports GHC 9.8.4
```

**Cursor / VS Code:** the editor should use **`haskell-language-server-wrapper`** from **`~/.ghcup/bin`**—the same **PATH** story as **`ghc`**. The **Haskell** extension may run **`ghcup run --hls …`** for you. If anything misbehaves, set **`haskell.serverExecutablePath`** to **`$HOME/.ghcup/bin/haskell-language-server-wrapper`**.

**How to read the Haskell log:** Install the **Haskell** extension (`haskell.haskell`) from the Marketplace; the log does not exist without it. **Command Palette** (`⇧⌘P` on macOS): run **Output: Focus on Output View**. In the **Output** panel, open the **dropdown on the right** (not the terminal dropdown) and choose **Haskell**—often **`Haskell`** or **`Haskell (folder-name)`**. The channel stays **empty or absent** until the language server has started: create or open a trivial **`.hs`** file (e.g. `main = putStrLn "ok"`), **edit or save it once** so the Haskell extension activates, wait a few seconds, then reopen the dropdown or scroll the log. Use **Find** (`⌘F`) in that panel to search for **`Project GHC version`** or **`haskell-language-server-9.8.4`**.

**Log quirk:** that log may also show a line like **`ghc-9.10.3`** next to **`haskell-language-server-wrapper`**. That is usually the **GHC used to compile that wrapper binary**, not your **project** GHC. In the same log, confirm **`Project GHC version: 9.8.4`** (or your pin) and that the server launches **`haskell-language-server-9.8.4`** (or matching version).

### 4. Rebuild IHaskell (critical)

One GHC everywhere—**9.8.4** on PATH before **`cabal install`**:

```bash
unset GHC_PACKAGE_PATH
ghcup set ghc 9.8.4
cabal install ihaskell --overwrite-policy=always
~/.local/bin/ihaskell install
```

**`ihaskell install`** registers or updates the Jupyter spec (macOS: **`~/Library/Jupyter/kernels/haskell/kernel.json`**) with the correct **`argv`** and **`--ghclib`** paths.

**Stale `kernel.json`:** if it still points at **`.../ghc-9.6.*/...`**, the wrong **`ihaskell`** ran. Cabal should keep **`~/.local/bin/ihaskell`** pointing at the new build—check **`ls -l ~/.local/bin/ihaskell`** targets **`.../cabal/store/ghc-9.8.4/...`**. Prefer **`~/.local/bin/ihaskell install`** by absolute path. Add **`~/.local/bin`** to PATH, or symlink **`~/.local/bin/ihaskell`** into **`~/.ghcup/bin`** (symlink the **stable** `~/.local/bin` name, not a hardcoded store hash path).

If **`cabal install ihaskell`** says **`ghc` could not be found**, run **`ghcup set ghc 9.8.4`** again.

### 5. Kernel wrapper (if you use it)

**`ihaskell install`** overwrites **`kernel.json`**. If you use the [wrapper script](docs/ihaskell-kernel-path.md), set **`argv[0]`** back to that script’s absolute path after **`ihaskell install`**; leave the rest of **`argv`** unchanged.

### 6. Notebook project / Cabal package environment

In each folder where you use **`ghci`** or notebooks with **`cabal install --lib`**:

- Remove or ignore old **`.ghc.environment.*`** files for the wrong GHC (e.g. **`*9.6.7*`**).
- Recreate for **9.8.4**, e.g.  
  **`cabal install --lib criterion --package-env .`**  
  (add whatever packages you need). That produces **`.ghc.environment.<arch>-<os>-9.8.4`**.

### 7. Smoke tests

- **Terminal:** from the notebook project directory, **`ghci`** should pick up the new environment file when present.
- **Notebook:** start the **Haskell** kernel; run **`import IHaskell.Display`** or a trivial cell.
- If the kernel misbehaves, run **Whiskers: Diagnose IHaskell Kernel Environment** (after **`npm run compile`** and loading the extension).

### IHaskell / Jupyter troubleshooting

**Apple Silicon (arm64):** If the linker reports `found architecture 'x86_64', required architecture 'arm64'` for ZeroMQ, install the native arm64 ZeroMQ: `brew install zeromq` (use arm64 Homebrew at `/opt/homebrew`, not Intel Homebrew at `/usr/local`).

**Kernel fails with `ghc-pkg` not in PATH:** Jupyter often starts without your shell `PATH`, so `~/.ghcup/bin` may be missing. See [docs/ihaskell-kernel-path.md](docs/ihaskell-kernel-path.md).

**Kernel fails with hidden package `ihaskell` / wrong `ghc-lib-parser` version:** Your active **GHC** likely does not match the GHC used to build IHaskell, or **`GHC_PACKAGE_PATH`** is set. See [docs/ihaskell-kernel-path.md#kernel-fails-hidden-package-ihaskell](docs/ihaskell-kernel-path.md#kernel-fails-hidden-package-ihaskell).

## Workspace

Open a **folder** as the workspace. The first root folder is the Whiskers project root. Chat history is stored under `<workspace>/.whiskers/history.sqlite` (SQLite via **sql.js**).

### Dump chat history (CLI)

After building (`npm run compile`), you can export that SQLite file from the shell. The CLI writes **into the current working directory** (not necessarily the workspace path) using fixed filenames, or prints to stdout with `--read` / `-r`.

| Invocation | Output |
|------------|--------|
| `npm run dump-history -- <workspace>` | `whiskers-history-dump.json` (pretty-printed JSON array of message rows) |
| `npm run dump-history -- -m <workspace>` | `whiskers-history-dump.md` (Markdown transcript: headings, role, mode, content) |
| `npm run dump-history -- -t <workspace>` | `whiskers-history-timestamps.txt` (one **ISO 8601** timestamp per line, `created_at` ascending) |
| `npm run dump-history -- -t -m <workspace>` | `whiskers-history-timestamps.md` (Markdown bullet list with **human-readable** date/time via the system locale, e.g. `toLocaleString()`) |
| `npm run dump-history -- -r <workspace>` | Same formats as above, but **stdout** instead of a file |

**Flags (combinable where noted):**

- **`-u` / `--user-only`** — only rows with `role = user`.
- **`-t` / `--timestamps-only`** — only timestamps (format: plain ISO lines, or Markdown + locale times with `-m`).
- **`-m` / `--markdown`** — Markdown for the full transcript; with `-t`, switches timestamp-only output to the `.md` list with human-readable times.
- **`-r` / `--read`** — write to stdout.
- **`--limit <n>`** — cap rows (default: 100000).

Examples:

```bash
npm run compile
npm run dump-history -- /path/to/your/project
npm run dump-history -- -m -r /path/to/your/project
npm run dump-history -- -u -t /path/to/your/project
```

You can also run the built script directly: `node dist/whiskers-dump-history.js <workspace> [options]`. There is no `package.json` `bin` entry; use `npm run dump-history` or `node` as above.

## Configuration (no silent defaults)

Set in **Settings** (JSON). A starting point is [docs/whiskers-settings.example.json](docs/whiskers-settings.example.json): copy its keys into your **User** or **Workspace** `settings.json`, set `whiskers.lmStudio.model` to your LM Studio model id, and leave `whiskers.lmStudio.apiKey` empty unless your server requires a key. The Replicate token is not stored in settings—use **Whiskers: Set Replicate API Token**.

| Setting | Purpose |
|--------|---------|
| `whiskers.lmStudio.baseUrl` | OpenAI-compatible base URL (e.g. `http://127.0.0.1:1234/v1`). **Required** for coach modes. |
| `whiskers.lmStudio.model` | Model id for coach/challenge/quiz. **Required**. |
| `whiskers.lmStudio.apiKey` | Optional if your local server does not require a key. |
| `whiskers.replicate.model` | Replicate model id for generation/debugging (default: `anthropic/claude-opus-4.6`). |

**Replicate API token:** run command **Whiskers: Set Replicate API Token** (create a token at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens); stored in VS Code Secret Storage, not in repo).

## Commands

- **Whiskers: Open Tutor Chat** — open the chat webview.
- **Whiskers: Attach Active Cell Output to Chat** — attach the active notebook cell’s text output to the next message (debugging workflow). Jupyter-style stdout/stderr (including IHaskell/GHC errors) and structured notebook errors are included.
- **Whiskers: Set Replicate API Token** — store the Replicate API token.

**Toasts:** Info from attach / token commands appears as a **banner at the top of the chat webview** (above the transcript), so it does not cover the message input. The workspace [`.vscode/settings.json`](.vscode/settings.json) sets `workbench.notifications.position` to `top-right` for any remaining native notifications (VS Code/Cursor do not offer a top-left option). Adjust in **Settings** if you prefer `bottom-left` or `bottom-right`.

## Notebook context

The extension sends a **cell map** (see [docs/notebook-code-targeting.md](docs/notebook-code-targeting.md)) plus focus/selection for each request.

## Development

```bash
npm install
npm run compile
```

Press **F5** in VS Code with the provided launch configuration to run the **Extension Development Host**.

If you install from a **VSIX**, Cursor loads the copy under `~/.cursor/extensions/<publisher>.<name>-<version>`. After `npm run compile` and rebuilding the VSIX, **reinstall** or bump the version so you are not testing an old bundle.

## Packaging

```bash
npx vsce package
```

Produces a `.vsix` for [installation](#from-a-vsix-normal-install). `sql.js` is used for SQLite so the extension installs without native compilation; the on-disk file remains standard SQLite.
