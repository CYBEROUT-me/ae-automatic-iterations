// Cross-platform persistence for the user's logo library folder, stored
// outside the extension's own installed folder so it survives updates --
// same location category as userPresets.ts's user-presets.json (see that
// file's header comment for the full cross-platform-path-resolution
// reasoning, mirrored here exactly). Unlike userPresets.ts, there's no save
// function -- the user drops image files into this folder directly via
// Finder/Explorer; this file only resolves the path and lists its contents.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

export function logoLibraryPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = ""
): string {
  try {
    const resolvedHomedir = homedir || os.homedir();
    if (platform === "win32") {
      return path.win32.join(env.APPDATA || resolvedHomedir, "AE Iterations", "logos");
    }
    return path.posix.join(resolvedHomedir, "Library", "Application Support", "AE Iterations", "logos");
  } catch (e) {
    return "";
  }
}

// Creates the folder (so there's always somewhere for the user to drop
// files into, empty-state or not) and returns absolute paths to the image
// files inside it, sorted by path. Recurses into subfolders -- organizing
// logos one folder per brand/client is a natural, expected way to use this,
// not just a flat dump of files.
export function listLogoFiles(dirPath: string = logoLibraryPath()): string[] {
  try {
    if (!dirPath) return [];
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      return [];
    }
    const results: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        let isDirectory: boolean;
        try {
          isDirectory = fs.statSync(full).isDirectory();
        } catch (e) {
          continue;
        }
        if (isDirectory) {
          walk(full);
        } else if (IMAGE_EXTENSIONS.indexOf(path.extname(name).toLowerCase()) !== -1) {
          results.push(full);
        }
      }
    };
    walk(dirPath);
    return results.sort();
  } catch (e) {
    return [];
  }
}
