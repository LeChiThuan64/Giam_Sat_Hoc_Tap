@echo off
REM Simple HTTP Server for FocusAI using PowerShell

powershell -NoProfile -Command ^
  "Push-Location '%~dp0'; " ^
  "$port = 8000; " ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add('http://localhost:' + $port + '/'); " ^
  "$listener.Start(); " ^
  "Write-Host '🚀 FocusAI v1.1 Server started!'; " ^
  "Write-Host ('📍 Open browser: http://localhost:' + $port); " ^
  "Write-Host ('📁 Serving from: ' + (Get-Location).Path); " ^
  "Write-Host '⏹️  Press Ctrl+C to stop'; " ^
  "while($listener.IsListening) { " ^
    "try { " ^
      "$context = $listener.GetContext(); " ^
      "$request = $context.Request; " ^
      "$response = $context.Response; " ^
      "$path = [System.Uri]::UnescapeDataString($request.Url.LocalPath); " ^
      "if($path -eq '/') { $path = '/index.html' } " ^
      "$localPath = (Get-Location).Path + $path; " ^
      "if(Test-Path $localPath -PathType Leaf) { " ^
        "$buffer = [System.IO.File]::ReadAllBytes($localPath); " ^
        "$response.ContentLength64 = $buffer.Length; " ^
        "$response.OutputStream.Write($buffer, 0, $buffer.Length); " ^
      "} else { " ^
        "$response.StatusCode = 404; " ^
      "} " ^
      "$response.OutputStream.Close(); " ^
    "} catch { } " ^
  "} " ^
  "$listener.Close();"
