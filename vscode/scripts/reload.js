/* eslint-disable @typescript-eslint/no-var-requires -- scripts/ 是 CommonJS 开发脚本，与 dev.js 保持一致，不在 lint 脚本（src --ext ts）范围内 */
const { execFileSync } = require('child_process');

// 激活 VS Code 窗口并发 ⌘R，触发 Reload Window（扩展宿主重新加载 out/*.js）
// ponytail: 仅 macOS。Windows/Linux 需要 xdotool / wscript，等真有人用再加。
if (process.platform !== 'darwin') {
  console.error('npm run reload 目前只支持 macOS，请手动在扩展宿主窗口按 Ctrl+R');
  process.exit(1);
}

// 首次运行需要在 系统设置 → 隐私与安全性 里给终端授权「自动化」和「辅助功能」，
// 否则 System Events 的 keystroke 会被静默拒绝。
try {
  execFileSync(
    'osascript',
    [
      '-e',
      'tell application "Visual Studio Code" to activate',
      '-e',
      'delay 0.3',
      '-e',
      'tell application "System Events" to keystroke "r" using command down',
    ],
    { stdio: 'inherit' }
  );
  console.log('已刷新 VS Code 窗口（作用于最前面的那个窗口）');
} catch {
  console.error('刷新失败，请确认已授权「自动化」+「辅助功能」权限。');
  process.exit(1);
}
