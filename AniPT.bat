@echo off
title AniPT - Anime CLI Brasileiro
set "DIR=%~dp0"

:: Verifica se o executavel existe
if not exist "%DIR%anipt.exe" (
    echo.
    echo  [ERRO] anipt.exe nao encontrado nesta pasta!
    echo  Certifique-se de que anipt.exe esta na mesma pasta que AniPT.bat
    echo.
    pause
    exit /b 1
)

:: Configura VLC automaticamente se encontrado e mpv nao estiver disponivel
where mpv.exe >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" (
        echo  [INFO] VLC detectado - usando VLC como player.
        "%DIR%anipt.exe" config set player vlc >nul 2>&1
    ) else if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" (
        echo  [INFO] VLC detectado - usando VLC como player.
        "%DIR%anipt.exe" config set player vlc >nul 2>&1
    ) else (
        if not exist "C:\mpv\mpv.exe" (
            echo.
            echo  [AVISO] Nenhum player encontrado. Instale mpv ou VLC:
            echo    mpv:  https://mpv.io/installation/  - extraia para C:\mpv\
            echo    VLC:  https://www.videolan.org/vlc/
            echo.
        )
    )
)

:: Inicia o AniPT
echo.
"%DIR%anipt.exe"

echo.
echo  AniPT encerrado. Pressione qualquer tecla para fechar.
pause >nul
