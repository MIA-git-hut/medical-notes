@echo off
title 一键发布医学笔记网站
cd /d D:\medical-notes
echo ==========================================
echo  正在发布网站，请稍候...
echo ==========================================
echo.
git add -A
git commit -m "update notes"
git push origin main
echo.
if %errorlevel%==0 (
    echo ==========================================
    echo  发布成功！等 1-2 分钟后网站自动更新
    echo  网址: https://medical-notes-iota.vercel.app
    echo ==========================================
) else (
    echo ==========================================
    echo  发布失败，请把窗口内容截图发给 Claude 看
    echo ==========================================
)
pause
