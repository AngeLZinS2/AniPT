@echo off
title AniPT - Anime CLI Brasileiro

:: ============================================================
::  AniPT Launcher para Windows
::  Duplo clique neste arquivo para iniciar o AniPT.
:: ============================================================

set "DIR=%~dp0"
set "PLAYER_FOUND=0"

:: Verifica se o executavel existe
if not exist "%DIR%anipt.exe" (
    echo.
    echo  [ERRO] anipt.exe nao encontrado!
    echo  Certifique-se de que anipt.exe esta na mesma pasta que este arquivo.
    echo.
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: Detecta player disponivel (mpv ou VLC)
:: -------------------------------------------------------

:: 1) Verifica mpv no PATH
where mpv.exe >nul 2>&1
if %ERRORLEVEL% equ 0 set PLAYER_FOUND=1

:: 2) Verifica mpv em locais comuns
if %PLAYER_FOUND% equ 0 (
    if exist "C:\mpv\mpv.exe" set PLAYER_FOUND=1
    if exist "C:\Program Files\mpv\mpv.exe" set PLAYER_FOUND=1
)

:: 3) Verifica VLC no PATH
if %PLAYER_FOUND% equ 0 (
    where vlc.exe >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set PLAYER_FOUND=1
        "%DIR%anipt.exe" config set player vlc >nul 2>&1
        echo  [INFO] VLC detectado - configurado como player padrao.
    )
)

:: 4) Verifica VLC nos locais de instalacao padrao
if %PLAYER_FOUND% equ 0 (
    if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" (
        set PLAYER_FOUND=1
        "%DIR%anipt.exe" config set player vlc >nul 2>&1
        echo  [INFO] VLC detectado em Program Files - configurado como player padrao.
    )
)
if %PLAYER_FOUND% equ 0 (
    if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" (
        set PLAYER_FOUND=1
        "%DIR%anipt.exe" config set player vlc >nul 2>&1
        echo  [INFO] VLC detectado - configurado como player padrao.
    )
)

:: 5) Nenhum player encontrado - avisa e continua
if %PLAYER_FOUND% equ 0 (
    echo.
    echo  [AVISO] Nenhum player de video encontrado!
    echo.
    echo  Instale um dos seguintes players:
    echo.
    echo  Opcao 1 - mpv (recomendado, mais leve):
    echo    1. Acesse: https://mpv.io/installation/
    echo    2. Baixe e extraia para C:\mpv\
    echo    3. Reinicie este launcher
    echo.
    echo  Opcao 2 - VLC (mais popular):
    echo    1. Acesse: https://www.videolan.org/vlc/
    echo    2. Instale normalmente
    echo    3. Reinicie este launcher
    echo.
    echo  Pressione qualquer tecla para continuar mesmo assim...
    pause >nul
)

:: Inicia o AniPT
"%DIR%anipt.exe"

echo.
echo  AniPT encerrado. Pressione qualquer tecla para fechar esta janela.
pause >nul
