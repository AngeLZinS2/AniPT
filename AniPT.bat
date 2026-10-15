@echo off
rem Compatibility launcher for existing AniPT shortcuts.
call "%~dp0AniBR.bat" %*
exit /b %errorlevel%
