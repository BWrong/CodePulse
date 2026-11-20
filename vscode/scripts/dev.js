const { spawn } = require('child_process');

spawn('code', ['--new-window', `--extensionDevelopmentPath=${process.cwd()}`], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
