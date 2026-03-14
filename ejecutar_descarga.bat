@echo off
title Descarga de Produccion (Cada 30 min)
echo Iniciando el proceso de descarga automatica.
echo Por favor, manten esta ventana abierta.
echo.
powershell.exe -ExecutionPolicy Bypass -NoExit -File "d:\SUM_2026\DASH_REPROCESO\descargar_produccion.ps1"
