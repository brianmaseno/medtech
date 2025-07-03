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
      const { user, question, conversationHistory, isUSSD = false, maxLength = 1000 } = context;
      
      logger.info(`🤖 AI Processing question: "${question}" for user: ${user.name || 'Unknown'}`);
      
      const prompt = `
You are MedConnect AI, a knowledgeable and caring health assistant for Africa. You're helping ${user.name || 'a user'} via ${isUSSD ? 'USSD' : 'SMS'}.

User Profile:
- Name: ${user.name || 'Not provided'}
- Age: ${user.age || 'Not specified'}
- Gender: ${user.gender || 'Not specified'}
- Location: ${user.location || 'Kenya'}
- Medical History: ${user.medicalHistory?.join(', ') || 'None specified'}
- Current Medications: ${user.currentMedications?.join(', ') || 'None'}

${conversationHistory ? `Previous Conversation:
${conversationHistory}

` : ''}User's Question: "${question}"

RESPONSE GUIDELINES:
1. Maximum ${maxLength} characters for ${isUSSD ? 'USSD' : 'SMS'}
2. Be helpful, warm, and professional
3. Use simple language, avoid complex medical terms
4. ALWAYS include medical disclaimer
5. For serious symptoms, recommend immediate medical care
6. Provide practical, affordable advice for African context
7. Use minimal emojis for clarity
8. Be direct and actionable
9. Reference conversation history when relevant
10. Show empathy and understanding

Respond with ONLY a JSON object in this exact format:
{
  "response": "Your clear, helpful medical advice response here",
  "urgency": "low/medium/high/emergency",
  "recommendations": [
    "First practical recommendation",
    "Second practical recommendation"
  ],
  "should_see_doctor": true,
  "emergency_keywords": []
}

SAMPLE RESPONSES:
- Headache: "Headaches can be caused by stress, dehydration, or eye strain. Try drinking water, resting in a quiet dark room, and gentle neck massage..."
- Fever: "Fever shows your body is fighting infection. If over 38.5°C or lasting 3+ days, see a doctor. Rest, drink fluids, use paracetamol..."
- Cough: "Persistent cough can indicate respiratory infection. If lasting over 2 weeks or with blood, see a doctor immediately..."
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      logger.info(`🤖 Raw AI Response: ${text.substring(0, 200)}...`);
      
      // Clean and extract JSON
      let cleanText = text.trim();
      
      // Remove any markdown code blocks
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Find JSON object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Validate required fields
          if (!parsed.response) {
            throw new Error('Missing response field');
          }
          
          // Ensure response fits character limit
          if (parsed.response.length > maxLength) {
            parsed.response = parsed.response.substring(0, maxLength - 50) + "...";
          }
          
          // Set defaults for missing fields
          parsed.urgency = parsed.urgency || 'medium';
          parsed.recommendations = parsed.recommendations || [
            "Monitor your symptoms closely",
            "Seek medical care if symptoms worsen"
          ];
          parsed.should_see_doctor = parsed.should_see_doctor !== false;
          parsed.emergency_keywords = parsed.emergency_keywords || [];
          
          logger.info(`✅ AI Response successfully parsed for: ${question.substring(0, 50)}`);
          return parsed;
          
        } catch (parseError) {
          logger.error('JSON Parse Error:', parseError);
          logger.error('Attempted to parse:', jsonMatch[0]);
        }
      }
      
      logger.warn('No valid JSON found, using structured fallback');
      
      // Enhanced fallback response based on question content
      const lowerQuestion = question.toLowerCase();
      let fallbackResponse = "";
      let urgency = "medium";
      let recommendations = [];
      
      if (lowerQuestion.includes('fever')) {
        fallbackResponse = "Fever can indicate your body is fighting infection. If it's over 38.5°C, persistent for more than 3 days, or accompanied by severe symptoms, please see a doctor. Rest, drink plenty of fluids, and use paracetamol if needed.";
        recommendations = ["Take paracetamol for fever reduction", "Drink plenty of fluids", "See a doctor if fever persists over 3 days"];
      } else if (lowerQuestion.includes('headache') || lowerQuestion.includes('head')) {
        fallbackResponse = "Headaches can be caused by stress, dehydration, eye strain, or tension. Try resting in a dark quiet room, drinking water, and gentle massage. If severe or persistent, please consult a healthcare provider.";
        recommendations = ["Rest in a dark, quiet room", "Stay hydrated", "Try gentle head/neck massage"];
      } else if (lowerQuestion.includes('cough')) {
        fallbackResponse = "Coughs can be due to infections, allergies, or irritants. If persistent for over 2 weeks, accompanied by blood, or with high fever, see a doctor immediately. Stay hydrated and avoid irritants.";
        recommendations = ["Stay hydrated with warm liquids", "Avoid smoke and irritants", "See doctor if cough persists over 2 weeks"];
      } else if (lowerQuestion.includes('chest pain') || lowerQuestion.includes('breathing')) {
        fallbackResponse = "Chest pain or breathing difficulties can be serious. If you're experiencing severe chest pain, shortness of breath, or difficulty breathing, seek immediate medical attention or call emergency services.";
        urgency = "high";
        recommendations = ["Seek immediate medical attention", "Call emergency services if severe", "Don't delay treatment"];
      } else {
        fallbackResponse = "I understand your health concern. While I can provide general guidance, this doesn't replace professional medical advice. For accurate diagnosis and treatment, please consult a qualified healthcare provider.";
        recommendations = ["Consult a healthcare provider", "Monitor symptoms closely", "Seek immediate care if symptoms worsen"];
      }
      
      return {
        response: fallbackResponse,
        urgency: urgency,
        recommendations: recommendations,
        should_see_doctor: true,
        emergency_keywords: []
      };

    } catch (error) {
      logger.error('AI Chat Generation Error:', error);
      
      // Emergency fallback with specific error handling
      return {
        response: "I'm experiencing technical difficulties right now. For immediate health concerns, please visit your nearest health facility or call emergency services. You can also try asking your question again.",
        urgency: "medium",
        recommendations: [
          "Try asking your question again",
          "Visit nearest health facility for serious concerns",
          "Call emergency services if urgent"
        ],
        should_see_doctor: true,
        emergency_keywords: []
      };
    }
  }
}

module.exports = new MedConnectAI();
