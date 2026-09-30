@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\2007\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
echo Campus Events: http://127.0.0.1:5174/
call "C:\Users\2007\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
pause
