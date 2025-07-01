# PowerShell Test Script for SMS Delivery Reports

Write-Host "📊 Testing MedConnect AI SMS Delivery Reports" -ForegroundColor Green
Write-Host ""

$baseUrl = "http://localhost:3000"

# Test 1: GET delivery report endpoint
Write-Host "1. Testing GET /delivery-report endpoint..." -ForegroundColor Yellow
try {
    $getResponse = Invoke-WebRequest -Uri "$baseUrl/delivery-report" -Method GET
    Write-Host "✅ GET /delivery-report: Status $($getResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($getResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ GET /delivery-report failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: POST delivery report - Success
Write-Host "2. Testing delivery report - Success status..." -ForegroundColor Yellow
$successPayload = @{
    id = "MSG_" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    status = "Success"
    phoneNumber = "+254712345678"
    networkCode = "63902"
    cost = "KES 1.00"
    retryCount = 0
} | ConvertTo-Json

try {
    $successResponse = Invoke-WebRequest -Uri "$baseUrl/delivery-report" -Method POST -Body $successPayload -ContentType "application/json"
    Write-Host "✅ Success Delivery Report: Status $($successResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($successResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Success delivery report failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: POST delivery report - Failed
Write-Host "3. Testing delivery report - Failed status..." -ForegroundColor Yellow
$failedPayload = @{
    id = "MSG_" + ([DateTimeOffset]::Now.ToUnixTimeMilliseconds() + 1)
    status = "Failed"
    phoneNumber = "+254712345679"
    networkCode = "63902"
    failureReason = "Number not reachable"
    retryCount = 2
    cost = "KES 0.00"
} | ConvertTo-Json

try {
    $failedResponse = Invoke-WebRequest -Uri "$baseUrl/delivery-report" -Method POST -Body $failedPayload -ContentType "application/json"
    Write-Host "✅ Failed Delivery Report: Status $($failedResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($failedResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed delivery report failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: POST delivery report - Sent
Write-Host "4. Testing delivery report - Sent status..." -ForegroundColor Yellow
$sentPayload = @{
    id = "MSG_" + ([DateTimeOffset]::Now.ToUnixTimeMilliseconds() + 2)
    status = "Sent"
    phoneNumber = "+254712345680"
    networkCode = "63902"
    retryCount = 0
} | ConvertTo-Json

try {
    $sentResponse = Invoke-WebRequest -Uri "$baseUrl/delivery-report" -Method POST -Body $sentPayload -ContentType "application/json"
    Write-Host "✅ Sent Delivery Report: Status $($sentResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($sentResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Sent delivery report failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: SMS routes delivery endpoint
Write-Host "5. Testing SMS routes delivery endpoint..." -ForegroundColor Yellow
try {
    $smsDeliveryResponse = Invoke-WebRequest -Uri "$baseUrl/sms/delivery-report" -Method GET
    Write-Host "✅ SMS Delivery Route: Status $($smsDeliveryResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($smsDeliveryResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ SMS delivery route failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📊 Delivery Reports Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 For Africa's Talking Dashboard:" -ForegroundColor Magenta
Write-Host "   Delivery Reports URL: https://k99gkq4s-3000.euw.devtunnels.ms/delivery-report" -ForegroundColor Yellow
Write-Host "   Method: POST" -ForegroundColor White
Write-Host "   Purpose: Track SMS delivery status" -ForegroundColor White
Write-Host ""
Write-Host "📋 Expected Delivery Statuses:" -ForegroundColor Magenta
Write-Host "   • Success ✅ - Message delivered" -ForegroundColor White
Write-Host "   • Failed ❌ - Delivery failed" -ForegroundColor White
Write-Host "   • Sent 📤 - Sent to network" -ForegroundColor White
Write-Host "   • Pending ⏳ - Delivery pending" -ForegroundColor White
