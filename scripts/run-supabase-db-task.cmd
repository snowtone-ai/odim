@echo off
setlocal enabledelayedexpansion

if "%~1"=="" (
  echo usage: run-supabase-db-task.cmd ^<staging^|production^> ^<sql-file^>
  exit /b 2
)

set TARGET=%~1
set SQL_FILE=%~2
if "%SQL_FILE%"=="" (
  echo sql file is required
  exit /b 2
)
if not exist "%SQL_FILE%" (
  echo sql file not found: %SQL_FILE%
  exit /b 2
)

set KEY=
if /i "%TARGET%"=="staging" set KEY=SUPABASE_STAGING_DATABASE_URL
if /i "%TARGET%"=="production" set KEY=SUPABASE_PRODUCTION_DATABASE_URL
if "%KEY%"=="" (
  echo unknown target: %TARGET%
  exit /b 2
)

set DB=
for /f "tokens=1,* delims==" %%a in ('findstr /b "%KEY%=" ".env.local" 2^>nul') do (
  set DB=%%b
)

if "%DB%"=="" (
  echo %KEY% is missing in .env.local
  exit /b 3
)

set DB=%DB:"=%
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -X -v ON_ERROR_STOP=1 -q "%DB%" -f "%SQL_FILE%"
if errorlevel 1 exit /b %errorlevel%

echo {"target":"%TARGET%","sql":"%SQL_FILE%","result":"ok"}
exit /b 0
