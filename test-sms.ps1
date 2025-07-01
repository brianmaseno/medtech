# PowerShell SMS Test Script for MedConnect AI

Write-Host "🧪 Testing MedConnect AI SMS Functionality" -ForegroundColor Green
Write-Host ""

# Test data
$baseUrl = "http://localhost:3000"
$testPhone = "+254712345678"

# Test 1: GET callback endpoint
Write-Host "1. Testing GET /callback endpoint..." -ForegroundColor Yellow
try {
    $getResponse = Invoke-WebRequest -Uri "$baseUrl/callback" -Method GET
    Write-Host "✅ GET /callback: Status $($getResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($getResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ GET /callback failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: POST SMS callback - HELP command
Write-Host "2. Testing SMS HELP command..." -ForegroundColor Yellow
$helpPayload = @{
    from = $testPhone
    text = "HELP"
    to = "15629"
    id = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    date = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
} | ConvertTo-Json

try {
    $helpResponse = Invoke-WebRequest -Uri "$baseUrl/callback" -Method POST -Body $helpPayload -ContentType "application/json"
    Write-Host "✅ SMS HELP: Status $($helpResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($helpResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ SMS HELP failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: POST SMS callback - DOCTORS command
Write-Host "3. Testing SMS DOCTORS command..." -ForegroundColor Yellow
$doctorsPayload = @{
    from = $testPhone
    text = "DOCTORS"
    to = "15629"
    id = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    date = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
} | ConvertTo-Json

try {
    $doctorsResponse = Invoke-WebRequest -Uri "$baseUrl/callback" -Method POST -Body $doctorsPayload -ContentType "application/json"
    Write-Host "✅ SMS DOCTORS: Status $($doctorsResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($doctorsResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ SMS DOCTORS failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: POST SMS callback - BOOK command
Write-Host "4. Testing SMS BOOK command..." -ForegroundColor Yellow
$bookPayload = @{
    from = $testPhone
    text = "BOOK Sarah Tomorrow 2PM"
    to = "15629"
    id = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    date = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
} | ConvertTo-Json

try {
    $bookResponse = Invoke-WebRequest -Uri "$baseUrl/callback" -Method POST -Body $bookPayload -ContentType "application/json"
    Write-Host "✅ SMS BOOK: Status $($bookResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($bookResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ SMS BOOK failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: SMS test endpoint
Write-Host "5. Testing SMS test endpoint..." -ForegroundColor Yellow
try {
    $testResponse = Invoke-WebRequest -Uri "$baseUrl/sms/test-callback" -Method GET
    Write-Host "✅ SMS Test Endpoint: Status $($testResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($testResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ SMS Test Endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 SMS Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 To test with real SMS, send these commands to shortcode 15629:" -ForegroundColor Magenta
Write-Host "   • HELP" -ForegroundColor White
Write-Host "   • DOCTORS" -ForegroundColor White
Write-Host "   • BOOK Sarah Tomorrow 2PM" -ForegroundColor White
Write-Host "   • APPOINTMENTS" -ForegroundColor White
Write-Host "   • CHAT I have a headache" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Callback URL for Africa's Talking:" -ForegroundColor Magenta
Write-Host "   https://k99gkq4s-3000.euw.devtunnels.ms/callback" -ForegroundColor Yellow
