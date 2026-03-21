# Whiskers Haskell Tutor

VS Code / Cursor extension: IHaskell Jupyter notebooks plus an editor **Whiskers Tutor** chat with multiple modes (coach, challenge, quiz → LM Studio / OpenAI-compatible; generation, debugging → Replicate -> Claude Opus 4.6).

## Installation

This project does not assume a published Marketplace listing. Install Whiskers in one of these ways:

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

After installation, configure [settings](#configuration-no-silent-defaults) and complete the [prerequisites](#prerequisites-developer-environment) for notebooks and AI backends.

### From source (Extension Development Host)

For development and debugging, use **F5** in VS Code/Cursor with this folder open (see [Development](#development)). That launches an **Extension Development Host** with Whiskers loaded without installing a `.vsix`.

## Prerequisites (developer environment)

- **GHCup** with **GHC** and **IHaskell** available as the Jupyter kernel.
- **Jupyter** extension: `ms-toolsai.jupyter` (user installs from Marketplace).
- **LM Studio** (or another OpenAI-compatible server) for **coach / challenge / quiz**.
- **Replicate** API token for **generation / debugging** (Claude Opus 4.6 via `anthropic/claude-opus-4.6` by default).

### IHaskell setup (after installing GHCup via Homebrew)

Ensure `~/.ghcup/bin` is in your PATH (Homebrew GHCup does not create `~/.ghcup/env`; add `export PATH="$HOME/.ghcup/bin:$PATH"` to `~/.bashrc` or `~/.zshrc` if needed).

```bash
ghcup install ghc
ghcup install cabal
ghcup set ghc 9.6.7    # or your installed version — required so `ghc` is on PATH
cabal update
cabal install ihaskell    # this takes a while
ihaskell install
```

Cabal installs `ihaskell` to `~/.local/bin`. If you prefer not to add that to PATH, symlink it into `~/.ghcup/bin`: `ln -s ~/.local/state/cabal/store/ghc-9.6.7/hskll-0.13.0.0-70faaa06/bin/ihaskell ~/.ghcup/bin/ihaskell`.

If `cabal install ihaskell` reports "ghc could not be found", run `ghcup set ghc <version>` (e.g. `ghcup set ghc 9.6.7`) to set the active GHC and create the symlink in `~/.ghcup/bin`.

**Apple Silicon (arm64):** If the linker reports `found architecture 'x86_64', required architecture 'arm64'` for ZeroMQ, install the native arm64 ZeroMQ: `brew install zeromq` (use arm64 Homebrew at `/opt/homebrew`, not Intel Homebrew at `/usr/local`).

**Kernel fails with `ghc-pkg` not in PATH:** Jupyter often starts without your shell `PATH`, so `~/.ghcup/bin` may be missing. See [docs/ihaskell-kernel-path.md](docs/ihaskell-kernel-path.md).

## Workspace

Open a **folder** as the workspace. The first root folder is the Whiskers project root. Chat history is stored under `<workspace>/.whiskers/history.sqlite` (SQLite via **sql.js**).

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

## Notebook context

The extension sends a **cell map** (see [docs/notebook-code-targeting.md](https://github.com/manifolded/whiskers-haskel-tutor/blob/main/docs/notebook-code-targeting.md)) plus focus/selection for each request.

## Development

```bash
npm install
npm run compile
```

Press **F5** in VS Code with the provided launch configuration to run the **Extension Development Host**.

## Packaging

```bash
npx vsce package
```

Produces a `.vsix` for [installation](#installation-from-a-vsix-normal-install). `sql.js` is used for SQLite so the extension installs without native compilation; the on-disk file remains standard SQLite.
