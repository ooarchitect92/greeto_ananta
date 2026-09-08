$ErrorActionPreference = 'Stop'
$server = Start-Process `
  -FilePath node `
  -ArgumentList './node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4174', '--strictPort' `
  -WorkingDirectory (Get-Location) `
  -WindowStyle Hidden `
  -PassThru

try {
  $deadline = (Get-Date).AddSeconds(30)
  do {
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4174/login' -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) { break }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  } while ((Get-Date) -lt $deadline)

  if ((Get-Date) -ge $deadline) {
    throw 'Timed out waiting for the E2E web server.'
  }

  & npx.cmd playwright test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
