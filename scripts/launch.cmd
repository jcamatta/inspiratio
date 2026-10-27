@echo off
setlocal
cd /d "%~dp0.."
set URL=http://127.0.0.1:4319

if not exist node_modules call npm install
call npm run build || (pause & exit /b 1)

curl -s -o nul "%URL%/api/board" && goto open
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
