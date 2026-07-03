const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const output = "release";
const unpacked = path.join(root, output, "win-unpacked");

function killWinProcesses() {
  if (process.platform !== "win32") return;
  for (const name of ["electron.exe", "每日激励.exe"]) {
    try {
      execSync(`taskkill /F /IM "${name}" /T`, { stdio: "ignore" });
    } catch {
      /* 进程未运行 */
    }
  }
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) return true;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return !fs.existsSync(dir);
    } catch {
      if (attempt < 2) {
        try {
          execSync("ping -n 2 127.0.0.1 >nul", { stdio: "ignore", shell: true });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return false;
}

killWinProcesses();

try {
  execSync("ping -n 2 127.0.0.1 >nul", { stdio: "ignore", shell: true });
} catch {
  /* ignore */
}

if (!removeDir(unpacked)) {
  console.error(
    "\n无法清理构建目录，文件可能被占用：\n" +
      `  ${unpacked}\n\n` +
      "请先：\n" +
      "  1. 退出系统托盘中的「每日激励」（右键托盘图标 → 退出）\n" +
      "  2. 关闭正在运行的 npm start / electron 开发窗口\n" +
      "  3. 关闭资源管理器中打开的 release 或 dist 文件夹\n" +
      "  4. 仍无法删除时，重启电脑后再执行 npm run build\n"
  );
  process.exit(1);
}
