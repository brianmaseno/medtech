#!/usr/bin/env node

/**
 * MedConnect AI - Deployment and Setup Script
 * This script helps set up and deploy the MedConnect AI health-tech solution
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                MedConnect AI - Setup Script                 ║
║            Revolutionary Health-tech Solution                ║
╚══════════════════════════════════════════════════════════════╝
`);

function checkEnvironment() {
  console.log('🔧 Checking Environment Configuration...');
  
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) {
    console.log('❌ .env file not found. Please create .env file with required variables.');
    console.log(`
Required Environment Variables:
- MONGODB_URI=your_mongodb_connection_string
- AFRICASTALKING_USERNAME=sandbox
- AFRICASTALKING_API_KEY=your_api_key
- GEMINI_API_KEY=your_gemini_api_key
- PORT=3000
    `);
    return false;
  }
  
  console.log('✅ Environment file found');
  return true;
}

function checkDependencies() {
  console.log('📦 Checking Dependencies...');
  
  const packageFile = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageFile)) {
    console.log('❌ package.json not found');
    return false;
  }
  
  const nodeModules = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log('❌ node_modules not found. Run: npm install');
    return false;
  }
  
  console.log('✅ Dependencies installed');
  return true;
}

function checkDirectories() {
  console.log('📁 Checking Directory Structure...');
  
  const requiredDirs = ['routes', 'services', 'public/dashboard', 'logs'];
  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`❌ Directory missing: ${dir}`);
      return false;
    }
  }
  
  console.log('✅ Directory structure verified');
  return true;
}

function displayStartupInstructions() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     Startup Instructions                    ║
╠══════════════════════════════════════════════════════════════╣
║  Development Mode:                                           ║
║  $ npm run dev                                               ║
║                                                              ║
║  Production Mode:                                            ║
║  $ npm start                                                 ║
║                                                              ║
║  Run Tests:                                                  ║
║  $ node test.js                                              ║
╠══════════════════════════════════════════════════════════════╣
║  Access Points:                                              ║
║  📱 USSD: *384*57000#                                        ║
║  🌐 Dashboard: http://localhost:3000/dashboard               ║
║  🔗 API: http://localhost:3000                               ║
║  📊 Health Check: http://localhost:3000/health-check        ║
╠══════════════════════════════════════════════════════════════╣
║  Features:                                                   ║
║  🤖 AI-Powered Health Diagnostics                           ║
║  📱 USSD Interface (No Internet Required)                   ║
║  🚨 Emergency Response System                               ║
║  💬 SMS Notifications & Reminders                           ║
║  📊 Real-time Analytics Dashboard                           ║
║  🔄 Automated Health Workflows                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

function main() {
  const checks = [
    checkEnvironment(),
    checkDependencies(),
    checkDirectories()
  ];
  
  if (checks.every(check => check)) {
    console.log('🎉 MedConnect AI setup verification completed successfully!');
    displayStartupInstructions();
    
    console.log(`
🏆 HACKATHON READY! 🏆

MedConnect AI is fully configured and ready for the Africa's Talking
Health-tech Solutions Hackathon. This revolutionary platform will
change how healthcare is delivered across Africa!

Key Demo Points:
✅ Real-time AI health analysis using Google Gemini
✅ USSD interface accessible on any phone
✅ Emergency response coordination system
✅ Beautiful React dashboard with live analytics
✅ Automated SMS workflows and reminders
✅ Cultural adaptation for African healthcare

Good luck with the hackathon! 🚀
    `);
  } else {
    console.log('❌ Setup verification failed. Please address the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkEnvironment, checkDependencies, checkDirectories };
