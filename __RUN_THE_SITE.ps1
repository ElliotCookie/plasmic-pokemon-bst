Start-Process "cmd" "/k npm run dev"
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000"