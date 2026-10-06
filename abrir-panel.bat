@echo off
cd /d "%~dp0"
echo Abriendo el panel de administracion de Sion Book...
start "" http://localhost:4000
node admin.mjs
pause
