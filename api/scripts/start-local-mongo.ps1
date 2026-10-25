param(
  [string]$MongoExe
)
$ErrorActionPreference = 'Stop'
if (!$MongoExe) {
  $mongoCommand = Get-Command mongod -ErrorAction SilentlyContinue
  if ($mongoCommand) { $MongoExe = $mongoCommand.Source }
  else {
    $mongoVersion = Get-ChildItem 'C:\Program Files\MongoDB\Server' -Directory -ErrorAction SilentlyContinue |
      Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\mongod.exe') } |
      Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if ($mongoVersion) { $MongoExe = Join-Path $mongoVersion.FullName 'bin\mongod.exe' }
  }
}
if (!$MongoExe) { throw 'Install MongoDB or set -MongoExe to your mongod.exe path.' }
if (!(Test-Path -LiteralPath $MongoExe)) { throw 'Set -MongoExe to your mongod.exe path.' }
$apiRoot = Split-Path $PSScriptRoot -Parent
$dataPath = Join-Path $apiRoot '.local\mongo-rs'
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
if (!(Test-NetConnection 127.0.0.1 -Port 27018 -InformationLevel Quiet -WarningAction SilentlyContinue)) {
  Start-Process -FilePath $MongoExe -WindowStyle Hidden -ArgumentList @(
    '--replSet', 'byb-rs', '--bind_ip', '127.0.0.1', '--port', '27018',
    '--dbpath', ('"' + $dataPath + '"'), '--logpath', ('"' + (Join-Path $dataPath 'mongod.log') + '"')
  )
}
node (Join-Path $PSScriptRoot 'init-replica.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Replica set initialization failed.' }
