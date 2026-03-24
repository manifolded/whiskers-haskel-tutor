import * as path from 'path';
import * as vscode from 'vscode';
import { ChatPanel } from './panel';
import { notebookEditorForContext } from './notebook/context';
import { serializeCellOutputs } from './notebook/output';
import { setPendingAttachment } from './attachment';
import { runIhaskellKernelDiagnostics } from './kernelDiagnostics';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand('whiskers.openChat', async () => {
      const panel = await ChatPanel.createOrShow(context);
      panel.reveal();
    }),
    vscode.commands.registerCommand('whiskers.attachCellOutput', async () => {
      const ed = notebookEditorForContext();
      if (!ed) {
        const panel = await ChatPanel.createOrShow(context);
        panel.reveal();
        panel.postToast(
          'Whiskers could not find a notebook to read from. Click inside your .ipynb tab (or the code area of a cell), select the cell whose output you want, then run this command again. If several notebooks are open, click the one you need first.',
          'warning'
        );
        return;
      }
      const idx = ed.selection.start;
      const cell = ed.notebook.cellAt(idx);
      const text = serializeCellOutputs(cell);
      if (!text || text.trim().length === 0) {
        const panel = await ChatPanel.createOrShow(context);
        panel.reveal();
        panel.postToast('No text output found on this cell.');
        return;
      }
      const block = `Cell ${idx} (${cell.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code'}):\n${text}`;
      setPendingAttachment(block);
      const panel = await ChatPanel.createOrShow(context);
      panel.postAttachedOutput(block);
      panel.reveal();
      panel.postToast('Cell output attached to the next chat message.');
    }),
    vscode.commands.registerCommand('whiskers.diagnoseIhaskellKernel', () => {
      const wf = vscode.workspace.workspaceFolders?.[0];
      const ndjsonPath = wf ? path.join(wf.uri.fsPath, '.cursor', 'debug-06212d.log') : undefined;
      runIhaskellKernelDiagnostics(ndjsonPath);
      void vscode.window.showInformationMessage(
        ndjsonPath
          ? `Whiskers IHaskell diagnostics appended to ${ndjsonPath}.`
          : 'Open a workspace folder to write IHaskell diagnostics to .cursor/debug-06212d.log in that folder.'
      );
    }),
    vscode.commands.registerCommand('whiskers.setReplicateApiToken', async () => {
      const token = await vscode.window.showInputBox({
        title: 'Replicate API token',
        prompt: 'Create at replicate.com/account/api-tokens. Stored in Secret Storage (not in the repo).',
        password: true,
        ignoreFocusOut: true,
      });
      if (token !== undefined && token.trim().length > 0) {
        await context.secrets.store('whiskers.replicate.apiToken', token.trim());
        const panel = await ChatPanel.createOrShow(context);
        panel.reveal();
        panel.postToast('Replicate API token saved.');
      }
    })
  );
}

export function deactivate(): void {
  ChatPanel.onDeactivate();
}
