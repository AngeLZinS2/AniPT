@echo off
title AniBR - Anime CLI Brasileiro
set "DIR=%~dp0"

:: Verifica se o executavel existe
if not exist "%DIR%anibr.exe" (
    echo.
    echo  [ERRO] anibr.exe nao encontrado nesta pasta!
    echo  Certifique-se de que anibr.exe esta na mesma pasta que AniBR.bat
    echo.
    pause
    exit /b 1
)

:: Configura VLC automaticamente se encontrado e mpv nao estiver disponivel
where mpv.exe >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" (
        echo  [INFO] VLC detectado - usando VLC como player.
        "%DIR%anibr.exe" config set player vlc >nul 2>&1
    ) else if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" (
        echo  [INFO] VLC detectado - usando VLC como player.
        "%DIR%anibr.exe" config set player vlc >nul 2>&1
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

:: Inicia o AniBR
echo.
"%DIR%anibr.exe" %*

echo.
echo  AniBR encerrado. Pressione qualquer tecla para fechar.
pause >nul
