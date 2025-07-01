# MedConnect AI - SMS Configuration Guide

## 🔧 Africa's Talking SMS Callback Setup

### **1. Callback URL Configuration**

Use this exact callback URL in your Africa's Talking dashboard:

```
https://k99gkq4s-3000.euw.devtunnels.ms/callback
```

### **2. SMS Settings in Africa's Talking Dashboard**

1. **Login** to your Africa's Talking sandbox account
2. **Navigate** to SMS → Settings → Callbacks
3. **Set Callback URL**: `https://k99gkq4s-3000.euw.devtunnels.ms/callback`
4. **Method**: POST
5. **Enable** "SMS - Inbox Callback" ✅
6. **Click** "Submit" to save

### **3. Your Current Configuration** (from .env)

```
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=atsk_0995ca80ce9172d14f327c45fbdf5ff5eca528d03aebabb4b96958513212d938b75a0849
AFRICASTALKING_SHORTCODE=15629
AFRICASTALKING_ENVIRONMENT=sandbox
```

## 📱 SMS Commands for Testing

### **Basic Commands**
```
HELP                          - Get command list
CHAT I have a headache        - AI health consultation
SYMPTOMS fever cough fatigue  - Symptom analysis
TIP                          - Get health tip
PROFILE                      - View profile
```

### **Appointment Commands**
```
DOCTORS                      - List available doctors
BOOK Sarah Tomorrow 2PM      - Book appointment with Dr. Sarah
APPOINTMENTS                 - View your bookings
CANCEL APT_1688123456789     - Cancel appointment
CONFIRM APT_1688123456789    - Confirm appointment
```

### **Profile Commands**
```
UPDATE name John Doe         - Update your name
UPDATE age 30               - Update your age
UPDATE gender male          - Update gender
UPDATE location Nairobi     - Update location
```

## 🧪 SMS Testing Instructions

### **Step 1: Test Basic Functionality**
Send SMS to `15629`:
```
HELP
```
Expected response: Command list with all available options

### **Step 2: Test AI Chat**
Send SMS to `15629`:
```
CHAT I have a headache and fever
```
Expected response: AI analysis and recommendations

### **Step 3: Test Doctor Booking**
Send SMS to `15629`:
```
DOCTORS
```
Expected response: List of 5 available doctors

### **Step 4: Book Appointment**
Send SMS to `15629`:
```
BOOK Sarah Tomorrow 2PM
```
Expected response: Confirmation with appointment details and ID

### **Step 5: View Appointments**
Send SMS to `15629`:
```
APPOINTMENTS
```
Expected response: List of your upcoming appointments

## 🔧 Troubleshooting

### **If SMS responses are not working:**

1. **Check callback URL** is correctly set in Africa's Talking
2. **Verify tunnel** is active: `https://k99gkq4s-3000.euw.devtunnels.ms/callback`
3. **Test callback manually**:
   ```
   curl -X GET https://k99gkq4s-3000.euw.devtunnels.ms/callback
   ```

### **If booking fails:**
1. Check that MongoDB is connected
2. Verify doctors are in database
3. Check server logs for errors

### **Server Status Check:**
Visit: `https://k99gkq4s-3000.euw.devtunnels.ms/health-check`

## 📊 Available Doctors in System

1. **Dr. Sarah Kimani** - General Medicine (KSh 2,500)
2. **Dr. James Ochieng** - Pediatrics (KSh 3,000)
3. **Dr. Mary Wanjiku** - Gynecology (KSh 3,500)
4. **Dr. Peter Mutua** - Cardiology (KSh 4,000)
5. **Dr. Grace Akinyi** - Dermatology (KSh 2,800)

## 🎯 Quick Test Script

Send these SMS commands in sequence to test full functionality:

```
1. HELP
2. DOCTORS
3. BOOK Sarah Tomorrow 10AM
4. APPOINTMENTS
5. CHAT I have a headache
6. PROFILE
```

## ✅ Expected Behavior

- **Immediate SMS responses** to all commands
- **Appointment confirmations** with unique IDs
- **AI health advice** for chat commands
- **Error handling** for invalid commands
- **User creation** for new phone numbers

## 🚀 Production Checklist

- [ ] Callback URL configured
- [ ] SMS responses working
- [ ] Appointment booking functional
- [ ] AI chat responding
- [ ] Error handling working
- [ ] Server logs showing activity

Your MedConnect AI SMS system is now ready for the Africa's Talking hackathon! 🏆
