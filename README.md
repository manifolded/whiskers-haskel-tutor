# Whiskers Haskell Tutor

Welcome. **Whiskers** brings a friendly AI tutor into **VS Code** or **Cursor** next to your **IHaskell** Jupyter notebooks—so you can ask questions, get challenges, and debug cell output without leaving the editor.

## What you get

- **Chat modes** tailored for learning: **Coach**, **Challenge**, and **Quiz** (powered by your local **LM Studio** or any OpenAI-compatible API), plus **Generation** and **Debugging** (via **Replicate**, defaulting to Claude Opus 4.6).
- **Notebook-aware context**: Whiskers sees your notebook’s cell map and where you’re focused, so answers line up with what you’re working on.
- **Attach cell output**: Pipe IHaskell errors or stdout into the next chat message when you need help fixing a cell.

You’ll run Haskell in `.ipynb` notebooks with the **IHaskell** kernel, and use Whiskers’ chat panel for the rest.

## Quick start

1. **Install the extension** — Build from this repo and install the `.vsix`, or run under the Extension Development Host. Full steps, prerequisites, and troubleshooting are in **[INSTALLATION.md](INSTALLATION.md)**.
2. **Open a workspace folder** — Whiskers uses the first root folder as your project; chat history lives in `<workspace>/.whiskers/`.
3. **Configure settings** — LM Studio URL and model for coach modes; Replicate for generation/debugging. See **[INSTALLATION.md#configuration-no-silent-defaults](INSTALLATION.md#configuration-no-silent-defaults)** and [docs/whiskers-settings.example.json](docs/whiskers-settings.example.json).
4. **Open the tutor** — Command Palette: **Whiskers: Open Tutor Chat**.

For **IHaskell**, GHCup, Jupyter PATH quirks, and ZeroMQ on Apple Silicon, head straight to **[INSTALLATION.md](INSTALLATION.md)**—that’s where the thorny bits live.

## Documentation

| Doc | What it’s for |
|-----|----------------|
| [INSTALLATION.md](INSTALLATION.md) | Build, VSIX, settings, IHaskell, kernel PATH, development |
| [docs/notebook-code-targeting.md](docs/notebook-code-targeting.md) | How notebook context and cell targeting work |
| [docs/ihaskell-kernel-path.md](docs/ihaskell-kernel-path.md) | Jupyter can’t find `ghc-pkg` — wrapper script |
| [docs/ihaskell-kernel-wrap.sh.example](docs/ihaskell-kernel-wrap.sh.example) | Example kernel wrapper |

## Repository

`https://github.com/manifolded/whiskers-haskel-tutor.git`
