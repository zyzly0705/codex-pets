$ErrorActionPreference = "Stop"

npm install
npm run dist:win

Write-Host "Installer generated under dist/"
