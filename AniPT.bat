@echo off
chcp 65001 > nul
title AniPT — Anime CLI Brasileiro

:: ============================================================
::  AniPT Launcher para Windows
::  Duplo clique neste arquivo para iniciar o AniPT.
:: ============================================================

:: Obtém o diretório onde este .bat está localizado
set "DIR=%~dp0"

:: Verifica se o executável existe
if not exist "%DIR%anipt.exe" (
    echo.
    echo  [ERRO] anipt.exe nao encontrado!
    echo  Certifique-se de que anipt.exe esta na mesma pasta que este arquivo.
    echo.
    pause
    exit /b 1
)

:: Verifica se o mpv esta instalado
where mpv.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if not exist "C:\mpv\mpv.exe" (
        if not exist "C:\Program Files\mpv\mpv.exe" (
            echo.
            echo  [AVISO] mpv nao encontrado no sistema!
            echo.
            echo  Para assistir animes, voce precisa instalar o mpv:
            echo   1. Acesse: https://mpv.io/installation/
            echo   2. Baixe o instalador Windows
            echo   3. Instale e reinicie este launcher
            echo.
            echo  Pressione qualquer tecla para continuar mesmo assim...
            pause > nul
        )
    )
)

:: Inicia o AniPT
"%DIR%anipt.exe"

:: Ao sair, mostra mensagem de encerramento
echo.
echo  AniPT encerrado. Pressione qualquer tecla para fechar esta janela.
pause > nul
