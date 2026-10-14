@echo off
if "%~1"=="success" goto success
if "%~1"=="missing" goto missing
if "%~1"=="denied" goto denied
if "%~1"=="empty" exit /b 0
exit /b 2
:success
echo warning on stderr 1>&2
echo {"Account":"123456789012"}
exit /b 0
:missing
echo An error occurred ^(ParameterNotFound^) when calling GetParameter: not found 1>&2
exit /b 255
:denied
echo An error occurred ^(AccessDeniedException^) when calling GetParameter: not authorized 1>&2
exit /b 254
