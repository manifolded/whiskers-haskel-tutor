Let's build a VS Code/Cursor extension to act as a Haskell tutor written in TypeScript. 

## User Interaction
The user's interaction will be split between two primary channels: 

1. one or more Jupyter notebooks running IHaskell kernels where the user will write and test their own Haskell code. 
2. a "Webview in the editor" chat window running the Vercel AI SDK where the user will interact with the tutor

## Storage
The user will select a project directory on the local filesystem for all their Jupyter .ipynb notebooks which will also be used by the extension to cache chat history with the user. 

This project will assume that the user will store their Jupyter .ipynb notebooks in a project directory to which the extension has access as these notebooks will provide crucial context for the tutor. Raw chat history will be stored in a SQLite (single writer) database in a .whiskers project subdirectory also providing crucial persistent context.

User profiles and the summarization of chat history for content window budgeting will be postponed for future work.

## Environment
The developer will pre-install GHCup to provide IHaskell as the interactive Haskell kernel for the Jupyter notebooks. The developer will also pre-install the standard ms-toolsai Jupyter extension for Jupyter notebook support.

## Modes
The user will have a drop down menu in the chat offering "coach", "generation", or "debugging" modes. Which model is queries depends on the mode.

### Coach/Tutor Model
The Haskel coach/tutor behavior will be implemented via the OpenAI API to an LM Studio hosted LLM (probably gpt-oss-20b). The code should be designed to allow changing this to a cloud-hosted chat service in the future. The coach/tutor does not actually generate or debug code.

### Code Generation Model
The actual Haskel code generation (when required) will be handled by Claude Opus 4.6 via Replicate (Anthropic official model on Replicate) with API token to be stored locally (not in the repo). 

The code suggested by the Code Generation model will be displayed in the chat, then the user may cut and paste it if they wish to include it in the document. Automatic cell/code insertion in the notebook will be postponed for future work.

### Debugging Workflow
The Code Generation model will also be responsible for handling debugging requests from the user. The user should be able to forward cell output (including error messages) to the chat for analysis as is done in Cursor.

## Project Wide Preferences
In this project, defaults/fallbacks are to be avoided and should not be used without first consulting with the developer.

When faced with significant design choices or conflicts please raise them with the developer before proceeding. The developer will not mind be included in the design process.
