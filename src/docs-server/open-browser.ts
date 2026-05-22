import { spawn } from 'node:child_process';
import { platform } from 'node:os';

/* ========================================================================== */
/*                          CROSS-PLATFORM BROWSER OPEN                       */
/* ========================================================================== */

/**
 * Best-effort open-in-default-browser. Spawns the platform's default
 * URL-handler in the background and returns immediately. Errors are
 * swallowed — failure to launch a browser shouldn't tank the CLI.
 */
export function openBrowser(url: string): void {
  try {
    const p = platform();
    let cmd: string;
    let args: string[];

    if (p === 'darwin') {
      cmd = 'open';
      args = [url];
    } else if (p === 'win32') {
      // `start` is a cmd.exe builtin; first quoted arg is the window title
      cmd = 'cmd';
      args = ['/c', 'start', '""', url];
    } else {
      cmd = 'xdg-open';
      args = [url];
    }

    const child = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', () => {
      // Swallow — no PATH for xdg-open in some containers, etc.
    });
    child.unref();
  } catch {
    // Same — swallow.
  }
}
