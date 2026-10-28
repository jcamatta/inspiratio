@echo off
setlocal
cd /d "%~dp0.."
set URL=http://127.0.0.1:4319

git pull --ff-only --quiet origin main || echo Could not update from GitHub, starting the local version
if not exist node_modules\.package-lock.json (call npm install) else (
  for /f %%n in ('powershell -NoProfile -Command "[int]((Get-Item package-lock.json).LastWriteTime -gt (Get-Item node_modules\.package-lock.json).LastWriteTime)"') do if %%n==1 call npm install
)
call npm run build || (pause & exit /b 1)

curl -s -o nul "%URL%/api/board" || goto start
curl -s "%URL%/api/generations" | findstr /C:"\"status\":\"pending\"" /C:"\"status\":\"in_progress\"" >nul && goto open
for /f "tokens=5" %%p in ('netstat -ano ^| findstr LISTENING ^| findstr ":4319 "') do taskkill /PID %%p /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Inspiratio server*" /T /F >nul 2>&1
timeout /t 1 /nobreak >nul

:start
start "Inspiratio server" /min cmd /c npm start
for /l %%i in (1,1,120) do (
  curl -s -o nul "%URL%/api/board" && goto open
  timeout /t 1 /nobreak >nul
)
echo Inspiratio server did not start
pause
exit /b 1

:open
set EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if not exist "%EDGE%" set EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe
if exist "%EDGE%" (start "" "%EDGE%" --app=%URL%) else (start "" %URL%)
