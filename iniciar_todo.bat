@echo off
title Sistema Dashboard Produccion
echo =======================================================
echo INICIANDO DASHBOARD LOCAL Y DESCARGA PERIODICA
echo =======================================================
echo.

echo [1/3] Iniciando proceso de descarga automatica (cada 30 min)...
:: Ejecuta el script de powershell en segundo plano en esta misma ventana
start /B powershell.exe -ExecutionPolicy Bypass -File "d:\SUM_2026\DASH_REPROCESO\descargar_produccion.ps1"

echo [2/3] Levantando servidor local en el puerto 8000...
start /B python -m http.server 8000

echo [3/3] Abriendo el Dashboard en tu navegador web...
:: Esperar 3 segundos para asegurar que todo haya cargado
timeout /t 3 /nobreak >nul
start http://localhost:8000/dashboard/index.html

echo.
echo =======================================================
echo TODO ESTA LISTO Y FUNCIONANDO
echo =======================================================
echo 1. Se abrira el Dashboard en tu navegador.
echo 2. El archivo se descargara silenciosamente cada 30 minutos.
echo 3. Manten ESTA ventana negra abierta para que todo siga vivo.
echo 4. Si deseas detenerlo por completo, simplemente cierra esta ventana.
echo =======================================================
echo.
:: Mantiene cmd en pausa sin cerrarse para no tumbar los subprocesos de start /B
pause
