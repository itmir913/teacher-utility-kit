@echo off

:: 관리자 권한으로 실행되었는지 확인
net session >nul 2>nul
if %errorlevel% neq 0 (
    echo 관리자 권한이 필요합니다.
    pause
    exit
)

echo 대교협 자동 재시작 배치 프로그램
echo.
echo.

set processName=tomcat8.exe
set serviceName=KCUE_WAS

:loop
    rem 프로세스가 실행 중인지 확인
    tasklist /FI "IMAGENAME eq %processName%" 2>NUL | find /I "%processName%" > NUL

    if errorlevel 1 (
        rem 프로세스가 실행되지 않으면 로그 출력
        echo [%date% %time%]
        echo tomcat8.exe가 종료되었습니다. 서비스 재시작합니다...

        rem KCUE_WAS 서비스를 중지하고 다시 시작
        net stop %serviceName%
        timeout /t 3 > NUL
        net start %serviceName%
        echo.
        echo.
    )

    rem 5초마다 확인
    timeout /t 5 > NUL
    goto loop
