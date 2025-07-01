const { GoogleGenerativeAI } = require('@google/generative-ai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class MedConnectAI {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async analyzeSymptoms(symptoms, userProfile = {}) {
    try {
      const { age, gender, medicalHistory = [] } = userProfile;
      
      const prompt = `
You are a medical AI assistant for MedConnect AI, a health-tech platform in Kenya. 
Analyze the following symptoms and provide a preliminary assessment.

IMPORTANT: Always emphasize that this is NOT a replacement for professional medical care.

Patient Profile:
- Age: ${age || 'Not specified'}
- Gender: ${gender || 'Not specified'}
- Medical History: ${medicalHistory.map(h => h.condition).join(', ') || 'None specified'}

Symptoms: ${symptoms.join(', ')}

Please provide a JSON response with the following structure:
{
  "condition": "Most likely condition or symptom category",
  "confidence": "Confidence level as a percentage (0-100)",
  "urgency": "low/medium/high/critical",
  "recommendations": [
    "List of recommended actions",
    "Include when to seek immediate care",
    "Self-care suggestions if appropriate"
  ],
  "warning_signs": [
    "Symptoms that require immediate medical attention"
  ],
  "next_steps": [
    "Specific actions the patient should take"
  ],
  "disclaimer": "Medical disclaimer about seeking professional care"
}

Focus on conditions common in Kenya and consider tropical diseases when relevant.
Always recommend seeking professional medical care for serious symptoms.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        // Extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            analysis: analysis
          };
        } else {
          // Fallback if JSON parsing fails
          return {
            success: true,
            analysis: {
              condition: "Symptom analysis completed",
              confidence: 75,
              urgency: "medium",
              recommendations: [
                "Based on your symptoms, please consider consulting a healthcare provider",
                "Monitor your symptoms and note any changes",
                "Maintain proper hygiene and rest"
              ],
              warning_signs: [
                "Severe or worsening symptoms",
                "High fever",
                "Difficulty breathing",
                "Severe pain"
              ],
              next_steps: [
                "Contact a nearby health facility if symptoms persist",
                "Use *384*57000# for immediate health assistance"
              ],
              disclaimer: "This is an AI-generated assessment and not a substitute for professional medical diagnosis."
            }
          };
        }
      } catch (parseError) {
        logger.error('Error parsing AI response:', parseError);
        return this.getFallbackAnalysis(symptoms);
      }
      
    } catch (error) {
      logger.error('Error in AI symptom analysis:', error);
      return this.getFallbackAnalysis(symptoms);
    }
  }

  async generateHealthTip(category = 'general') {
    try {
      const prompt = `
Generate a health tip for MedConnect AI users in Kenya. 
Category: ${category}

Provide a practical, culturally appropriate health tip that is:
1. Easy to understand
2. Actionable
3. Relevant to the Kenyan context
4. Under 160 characters for SMS

Focus on preventive care, nutrition, hygiene, or general wellness.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return {
        success: true,
        tip: response.text().trim()
      };
    } catch (error) {
      logger.error('Error generating health tip:', error);
      return {
        success: false,
        tip: "Remember to drink plenty of clean water, eat balanced meals, and get regular exercise for good health!"
      };
    }
  }

  async generateEmergencyInstructions(emergencyType, location = '') {
    try {
      const prompt = `
Generate emergency response instructions for: ${emergencyType}
Location: ${location || 'Kenya'}

Provide immediate action steps that are:
1. Clear and concise
2. Prioritize safety
3. Include local emergency contacts when relevant
4. Consider resource availability in Kenya

Format as a JSON with:
{
  "immediate_actions": ["Step 1", "Step 2", ...],
  "emergency_contacts": ["Contact 1", "Contact 2", ...],
  "what_not_to_do": ["Don't do this", "Avoid that", ...],
  "additional_info": "Any other relevant information"
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return {
            success: true,
            instructions: JSON.parse(jsonMatch[0])
          };
        }
      } catch (parseError) {
        // Fallback emergency instructions
        return this.getFallbackEmergencyInstructions(emergencyType);
      }
      
    } catch (error) {
      logger.error('Error generating emergency instructions:', error);
      return this.getFallbackEmergencyInstructions(emergencyType);
    }
  }

  getFallbackAnalysis(symptoms) {
    return {
      success: true,
      analysis: {
        condition: "Symptom assessment needed",
        confidence: 60,
        urgency: "medium",
        recommendations: [
          "Please consult with a healthcare provider for proper diagnosis",
          "Monitor your symptoms closely",
          "Seek immediate care if symptoms worsen"
        ],
        warning_signs: [
          "Severe or sudden onset of symptoms",
          "High fever (above 38.5°C)",
          "Difficulty breathing",
          "Chest pain",
          "Severe headache"
        ],
        next_steps: [
          "Visit the nearest health facility",
          "Call emergency services if urgent",
          "Use our USSD service *384*57000# for assistance"
        ],
        disclaimer: "This is a preliminary assessment. Always consult qualified healthcare professionals for accurate diagnosis and treatment."
      }
    };
  }

  getFallbackEmergencyInstructions(emergencyType) {
    const instructions = {
      "medical": {
        immediate_actions: [
          "Call emergency services immediately",
          "Keep the person calm and still",
          "Check for breathing and pulse",
          "Apply first aid if trained"
        ],
        emergency_contacts: ["999 (Police)", "911 (Ambulance)", "Nearest Hospital"],
        what_not_to_do: [
          "Don't move person if spinal injury suspected",
          "Don't give food or water to unconscious person",
          "Don't leave person alone"
        ],
        additional_info: "Stay with the person until help arrives"
      },
      "fire": {
        immediate_actions: [
          "Call fire department immediately",
          "Evacuate everyone safely",
          "Stay low to avoid smoke",
          "Don't use elevators"
        ],
        emergency_contacts: ["998 (Fire Department)", "999 (Police)"],
        what_not_to_do: [
          "Don't go back for belongings",
          "Don't use water on electrical fires",
          "Don't panic"
        ],
        additional_info: "Meet at designated assembly point"
      }
    };

    return {
      success: true,
      instructions: instructions[emergencyType.toLowerCase()] || instructions.medical
    };
  }

  async generateHealthChatResponse(context) {
    try {
      const { user, question, isUSSD = false, maxLength = 1000 } = context;
      
      const prompt = `
You are MedConnect AI, a friendly health assistant for Africa. You're chatting with ${user.name || 'a user'} via ${isUSSD ? 'USSD' : 'SMS'}.

User Profile:
- Name: ${user.name || 'Not provided'}
- Age: ${user.age || 'Not specified'}
- Gender: ${user.gender || 'Not specified'}
- Location: ${user.location || 'Kenya'}
- Medical History: ${user.medicalHistory?.join(', ') || 'None specified'}
- Current Medications: ${user.currentMedications?.join(', ') || 'None'}

User Question: "${question}"

IMPORTANT GUIDELINES:
1. Keep response under ${maxLength} characters for ${isUSSD ? 'USSD' : 'SMS'}
2. Be warm, friendly, and culturally sensitive for African context
3. Use simple, clear language - avoid medical jargon
4. Always emphasize this is NOT a replacement for professional medical care
5. Suggest seeking medical care for serious symptoms
6. Include practical, affordable advice suitable for Africa
7. If emergency symptoms, urgently recommend immediate care
8. Use emojis sparingly and appropriately

Please provide a JSON response:
{
  "response": "Your friendly, helpful response to the user's question",
  "urgency": "low/medium/high/emergency",
  "recommendations": [
    "Practical, affordable recommendations",
    "When to seek medical care",
    "Self-care options if appropriate"
  ],
  "should_see_doctor": true/false,
  "emergency_keywords": ["any emergency symptoms detected"]
}

Examples of good responses:
- For headache: "I understand you have a headache. This could be from stress, dehydration, or lack of sleep..."
- For fever: "Fever can be concerning. Let me help you understand when to worry..."
- For cough: "A cough can have many causes. Based on your symptoms..."
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure response fits character limit
        if (parsed.response && parsed.response.length > maxLength) {
          parsed.response = parsed.response.substring(0, maxLength - 50) + "...";
        }
        
        logger.info(`AI Chat Response generated for: ${question.substring(0, 50)}`);
        return parsed;
      }
      
      // Fallback response
      return {
        response: "I understand your health concern. While I can provide general guidance, please remember that this doesn't replace professional medical advice. For serious symptoms, please visit your nearest health facility.",
        urgency: "medium",
        recommendations: [
          "Monitor your symptoms closely",
          "Stay hydrated and get adequate rest",
          "Seek medical care if symptoms worsen"
        ],
        should_see_doctor: true,
        emergency_keywords: []
      };

    } catch (error) {
      logger.error('AI Chat Generation Error:', error);
      
      // Emergency fallback response
      return {
        response: "I'm having trouble right now, but I want to help. For any serious health concerns, please contact your nearest health facility or call emergency services.",
        urgency: "medium",
        recommendations: [
          "Seek professional medical advice",
          "Call emergency services if critical",
          "Stay calm and monitor symptoms"
        ],
        should_see_doctor: true,
        emergency_keywords: []
      };
    }
  }
}

module.exports = new MedConnectAI();
