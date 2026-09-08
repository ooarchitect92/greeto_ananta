@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Greeto - Frontend Preview
rem Launch the existing local preview; no backend or provider actions are started.
rem No arguments. Errors stay visible and return a nonzero exit code.
pushd "%~dp0front end" 2>nul
if errorlevel 1 goto missing_frontend
if not exist package.json goto missing_package
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
node.exe -e "const m=process.versions.node.split('.').map(Number); process.exit((m[0]===24 && m[1]>=15) || m[0]>=26 ? 0 : 1)"
if errorlevel 1 goto unsupported_node
if exist node_modules\.bin\vite.cmd goto launch
echo Installing the dependencies from the supplied lockfile. First launch may take a few minutes.
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 goto install_failed

:launch
echo.
echo Opening Greeto at http://127.0.0.1:5174/frontend-preview
echo This is the frontend preview. Configuration pages save drafts only.
echo Keep this window open. Press Ctrl+C to stop the preview.
echo.
call npm.cmd run dev:frontend -- --strictPort
set "greeto_exit=%errorlevel%"
if "%greeto_exit%"=="0" goto done
echo.
echo Greeto stopped with an error. See the details above.
echo If port 5174 is in use, close the previous preview and try again.
pause
goto done

:missing_package
echo ERROR: The frontend package.json is missing. Restore the registered frontend source.
goto failed
:missing_node
echo ERROR: Node.js and npm must be installed and available on PATH.
echo Required Node version: 24.15 or later within 24.x, or 26 and above.
goto failed
:unsupported_node
echo ERROR: This Node.js version does not meet the frontend package requirements.
echo Required Node version: 24.15 or later within 24.x, or 26 and above.
goto failed
:install_failed
echo ERROR: Dependency installation failed. See the npm error above and retry after resolving it.
goto failed
:missing_frontend
echo ERROR: The front end folder is missing beside start.bat.
pause
exit /b 1
:failed
set "greeto_exit=1"
pause
:done
popd
exit /b %greeto_exit%
