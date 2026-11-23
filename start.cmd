@echo off
setlocal
cd /d "%~dp0"
where pnpm >nul 2>&1
if errorlevel 1 (
  echo Install pnpm and reopen this window.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Run pnpm install --frozen-lockfile in this folder first.
  pause
  exit /b 1
)
call pnpm dev
if errorlevel 1 pause
