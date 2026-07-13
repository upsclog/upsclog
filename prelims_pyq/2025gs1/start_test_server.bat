@echo off
cd /d "%~dp0"
echo Starting local server in this folder...
start "" http://localhost:8000/
python -m http.server 8000
