import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

function makeNdjsonLogger(outFile?: string) {
  return function log(message: string, data: Record<string, unknown>, tag?: string): void {
    if (!outFile) {
      return;
    }
    try {
      const payload = {
        location: 'kernelDiagnostics.ts',
        message,
        data,
        timestamp: Date.now(),
        ...(tag ? { tag } : {}),
      };
      fs.appendFileSync(outFile, `${JSON.stringify(payload)}\n`);
    } catch {
      // ignore
    }
  };
}

function jupyterHaskellKernelJson(): string | null {
  const home = os.homedir();
  const p = process.platform;
  if (p === 'darwin') {
    return path.join(home, 'Library/Jupyter/kernels/haskell/kernel.json');
  }
  if (p === 'win32') {
    const app = process.env.APPDATA;
    if (!app) {
      return null;
    }
    return path.join(app, 'jupyter', 'kernels', 'haskell', 'kernel.json');
  }
  return path.join(home, '.local', 'share', 'jupyter', 'kernels', 'haskell', 'kernel.json');
}

function sh(cmd: string, env?: NodeJS.ProcessEnv): { out: string; err?: string } {
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 20000, env: env ?? process.env }).trim();
    return { out };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return { out: '', err };
  }
}

/** PATH like the kernel wrapper: ghcup first, minimal tail (no conda). */
function kernelLikeEnv(): NodeJS.ProcessEnv {
  const home = os.homedir();
  const p = `${path.join(home, '.ghcup', 'bin')}:${path.join(home, '.local', 'bin')}:/usr/bin:/bin`;
  const e: NodeJS.ProcessEnv = { ...process.env, PATH: p };
  delete e['GHC_PACKAGE_PATH'];
  return e;
}

/** Collect GHC / IHaskell / kernel.json facts for troubleshooting (writes NDJSON when `outFile` is set). */
export function runIhaskellKernelDiagnostics(outFile?: string): void {
  const log = makeNdjsonLogger(outFile);

  log('ghc_package_path', { GHC_PACKAGE_PATH: process.env.GHC_PACKAGE_PATH ?? '(unset)' }, 'env');
  log('path_head', { pathFirst800: (process.env.PATH ?? '').slice(0, 800) }, 'env');

  const kernelPath = jupyterHaskellKernelJson();
  let kernelJson: unknown;
  let kernelReadError: string | undefined;
  if (kernelPath && fs.existsSync(kernelPath)) {
    try {
      kernelJson = JSON.parse(fs.readFileSync(kernelPath, 'utf8')) as unknown;
    } catch (e) {
      kernelReadError = String(e);
    }
  }

  const argvFull =
    kernelJson &&
    typeof kernelJson === 'object' &&
    kernelJson !== null &&
    'argv' in kernelJson &&
    Array.isArray((kernelJson as { argv?: unknown }).argv)
      ? (kernelJson as { argv: string[] }).argv
      : undefined;

  log(
    'kernel_json_path_and_shape',
    {
      kernelPath,
      exists: kernelPath ? fs.existsSync(kernelPath) : false,
      argv0: argvFull?.[0],
      argvLength: argvFull?.length,
      argvFull,
      envKeys:
        kernelJson &&
        typeof kernelJson === 'object' &&
        kernelJson !== null &&
        'env' in kernelJson &&
        (kernelJson as { env?: unknown }).env &&
        typeof (kernelJson as { env: unknown }).env === 'object'
          ? Object.keys((kernelJson as { env: Record<string, string> }).env)
          : [],
      kernelReadError,
    },
    'kernel'
  );

  const ghcWhich = sh('which ghc');
  const ghcVer = sh('ghc --version');
  const ghcLibdir = sh('ghc --print-libdir');
  const ghcPkg = sh('ghc-pkg list');
  const ihWhich = sh('which ihaskell');
  const ihVer = sh('ihaskell --version');

  const kenv = kernelLikeEnv();
  const ghcVerKernelLike = sh('ghc --version', kenv);
  const ghcLibdirKernelLike = sh('ghc --print-libdir', kenv);
  const ghcPkgKernelLike = sh('ghc-pkg list', kenv);

  log(
    'ghc_resolution',
    {
      whichGhc: ghcWhich.out,
      whichGhcErr: ghcWhich.err,
      ghcVersion: ghcVer.out,
      ghcVersionErr: ghcVer.err,
    },
    'ghc'
  );
  log('ghc_libdir', { libdir: ghcLibdir.out, err: ghcLibdir.err }, 'ghc');
  log(
    'kernel_like_ghc',
    {
      ghcVersion: ghcVerKernelLike.out,
      ghcVersionErr: ghcVerKernelLike.err,
      libdir: ghcLibdirKernelLike.out,
      libdirErr: ghcLibdirKernelLike.err,
    },
    'ghc'
  );
  log(
    'ihaskell_resolution',
    {
      whichIhaskell: ihWhich.out,
      whichIhaskellErr: ihWhich.err,
      ihaskellVersion: ihVer.out,
      ihaskellVersionErr: ihVer.err,
    },
    'ihaskell'
  );
  log('ghc_pkg_list_truncated', { truncated: ghcPkg.out.slice(0, 2500), err: ghcPkg.err }, 'ghc-pkg');
  log(
    'ghc_pkg_kernel_like_has_ghc_lib',
    {
      hasGhcLibParser: /ghc-lib-parser/i.test(ghcPkgKernelLike.out),
      kernelLikeTruncated: ghcPkgKernelLike.out.slice(0, 2500),
      err: ghcPkgKernelLike.err,
    },
    'ghc-pkg'
  );
}
