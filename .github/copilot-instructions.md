<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# MedConnect AI - GitHub Copilot Instructions

## Project Overview
This is a revolutionary health-tech solution built for the Africa's Talking Health-tech Hackathon. The project combines AI-powered diagnostics, USSD interface, emergency response systems, and real-time analytics.

## Technology Stack
- **Backend**: Node.js, Express, MongoDB
- **AI Integration**: Google Gemini AI for health analysis
- **Communication**: Africa's Talking APIs (SMS, USSD, Voice, Airtime)
- **Frontend**: React with Chart.js for dashboard
- **Database**: MongoDB Atlas with Mongoose ODM
- **Scheduling**: Node-cron for automated tasks
- **Security**: Helmet, CORS, rate limiting

## Key Architecture Patterns
- **RESTful API Design**: Follow REST principles for all endpoints
- **Modular Structure**: Separate routes, services, and database models
- **Error Handling**: Comprehensive error catching and logging
- **Security First**: Always implement proper validation and sanitization
- **Real-time Updates**: Use efficient polling and caching strategies

## Africa's Talking Integration Guidelines
- **Phone Number Formatting**: Always use the formatPhoneNumber utility
- **Error Handling**: Gracefully handle API failures with fallbacks
- **Rate Limiting**: Respect API limits and implement backoff strategies
- **Message Templates**: Use predefined templates for consistency

## AI Integration Best Practices
- **Prompt Engineering**: Create clear, contextual prompts for Gemini
- **Fallback Responses**: Always provide fallback when AI fails
- **Context Awareness**: Include user profile and medical history
- **Response Parsing**: Robust JSON parsing with error handling

## Database Best Practices
- **Schema Validation**: Use Mongoose schemas with proper validation
- **Indexing**: Index frequently queried fields for performance
- **Data Sanitization**: Always sanitize user inputs
- **Atomic Operations**: Use transactions for complex operations

## USSD Development Guidelines
- **State Management**: Use session-based state management
- **Menu Navigation**: Provide clear navigation options
- **Input Validation**: Validate all user inputs thoroughly
- **Session Cleanup**: Implement session cleanup for memory management

## Dashboard Development
- **Real-time Data**: Implement efficient data fetching strategies
- **Responsive Design**: Ensure mobile-first responsive design
- **Performance**: Optimize charts and data visualization
- **Accessibility**: Follow accessibility best practices

## Emergency System Guidelines
- **Response Time**: Prioritize fast response times for emergencies
- **Redundancy**: Implement backup communication channels
- **Logging**: Comprehensive logging for emergency situations
- **Testing**: Regular testing of emergency workflows

## Health Data Security
- **Data Privacy**: Implement proper data privacy measures
- **HIPAA Considerations**: Follow health data protection guidelines
- **Encryption**: Encrypt sensitive health information
- **Audit Trails**: Maintain comprehensive audit logs

## Code Style Guidelines
- **Naming**: Use descriptive variable and function names
- **Comments**: Add meaningful comments for complex logic
- **Error Messages**: User-friendly error messages
- **Logging**: Structured logging with appropriate levels

## Testing Considerations
- **Unit Tests**: Write tests for critical health logic
- **Integration Tests**: Test API endpoints thoroughly
- **Emergency Testing**: Regular testing of emergency workflows
- **User Acceptance**: Test with actual USSD interfaces

## Deployment Notes
- **Environment Variables**: Secure credential management
- **Health Checks**: Implement health check endpoints
- **Monitoring**: Set up comprehensive monitoring
- **Backup Strategies**: Regular database backups

## Special Considerations for Health-tech
- **Medical Disclaimers**: Always include appropriate medical disclaimers
- **Regional Adaptation**: Consider local health patterns and diseases
- **Cultural Sensitivity**: Ensure culturally appropriate messaging
- **Regulatory Compliance**: Follow local healthcare regulations

When writing code for this project, prioritize user safety, data security, and system reliability. Always consider the critical nature of health-related information and emergency response systems.
