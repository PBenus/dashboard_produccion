@echo off
title Dashboard de Produccion
echo Iniciando servidor local para el Dashboard...
echo Se abrira tu navegador en breve. No cierres esta ventana.
echo.

:: Start python simple http server in the background
start /B python -m http.server 8000

:: Wait a brief moment to ensure server starts
timeout /t 2 /nobreak >nul

:: Open the browser pointing to the dashboard folder
start http://localhost:8000/dashboard/index.html

:: Keep window open
echo Presiona cualquier tecla para detener el servidor completo y salir...
pause >nul
taskkill /F /IM python.exe /T
exit
