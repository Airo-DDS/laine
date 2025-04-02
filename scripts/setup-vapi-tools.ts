const { VapiClient } = require('@vapi-ai/server-sdk');
require('dotenv').config();

// Replace with your VAPI API key
const VAPI_API_KEY = process.env.VAPI_API_KEY || 'your_vapi_api_key_here';
const ASSISTANT_ID = '5ddeb40e-9013-47f3-b980-2091e6b9269e';

async function main() {
  if (!VAPI_API_KEY || VAPI_API_KEY === 'your_vapi_api_key_here') {
    console.error('⚠️ Please set your VAPI_API_KEY environment variable');
    process.exit(1);
  }

  console.log('🔧 Setting up VAPI tools for appointment scheduling...');
  
  const client = new VapiClient({ token: VAPI_API_KEY });
  
  try {
    // 1. Create check_availability tool
    console.log('📅 Creating check_availability tool...');
    const checkAvailabilityTool = await client.tools.create({
      type: "function",
      async: false, // We need to wait for the availability result
      function: {
        name: "check_availability",
        description: "Checks the appointment schedule for available slots within a given date range. Use this when the user asks about availability for specific dates or times.",
        parameters: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "The start date and time in ISO 8601 format (e.g., 2024-07-30T09:00:00Z) for the availability check range. Infer this from the user query."
            },
            endDate: {
              type: "string",
              description: "The end date and time in ISO 8601 format (e.g., 2024-07-30T17:00:00Z) for the availability check range. Infer this from the user query."
            }
          },
          required: ["startDate", "endDate"]
        }
      },
      server: {
        url: "https://claire-core.vercel.app/api/claire/check-availability"
      },
      messages: [
        { type: "request-start", content: "Let me check our appointment availability for you..." },
        { type: "request-failed", content: "I'm having trouble checking our schedule right now. Could we try again?" }
      ]
    });
    
    console.log('✅ check_availability tool created with ID:', checkAvailabilityTool.id);
    
    // 2. Create book_appointment tool
    console.log('📝 Creating book_appointment tool...');
    const bookAppointmentTool = await client.tools.create({
      type: "function",
      async: false,
      function: {
        name: "book_appointment",
        description: "Books a new appointment slot for the user. Requires the exact start time (from available slots), user's full name, and email address.",
        parameters: {
          type: "object",
          properties: {
            start: {
              type: "string",
              description: "The exact appointment start date and time in ISO 8601 format (e.g., 2024-07-30T14:00:00Z). This MUST be a time confirmed as available."
            },
            name: {
              type: "string",
              description: "The full name of the person booking the appointment."
            },
            email: {
              type: "string",
              description: "The email address of the person booking."
            },
            smsReminderNumber: {
              type: "string",
              description: "Optional. The phone number for sending an SMS reminder."
            }
          },
          required: ["start", "name", "email"]
        }
      },
      server: {
        url: "https://claire-core.vercel.app/api/claire/book-appointment"
      },
      messages: [
        { type: "request-start", content: "I'll book that appointment for you now..." },
        { type: "request-failed", content: "I'm having trouble booking that appointment. Let's try again." }
      ]
    });
    
    console.log('✅ book_appointment tool created with ID:', bookAppointmentTool.id);
    
    // 3. Update the assistant with the new tools
    console.log(`🔄 Updating assistant ${ASSISTANT_ID} with the new tools...`);
    
    // First get the current assistant to preserve existing configuration
    const assistant = await client.assistants.get(ASSISTANT_ID);
    
    // Now update the assistant with our new tools
    const updatedAssistant = await client.assistants.update(ASSISTANT_ID, {
      model: {
        ...assistant.model,
        toolIds: [
          ...(assistant.model.toolIds || []),
          checkAvailabilityTool.id,
          bookAppointmentTool.id
        ],
        messages: [
          {
            role: "system",
            content: `[Identity]
You are "Claire," an AI voice receptionist for Airodental, a reputable dental practice in Anaheim, California. The practice is located at "seventy one oh one North Dental Boulevard" and is led by Dr. Claire Johnson. Airodental offers high-quality dental services to the local community, with business hours from 8 AM to 5 PM daily (closed on Sundays).

[Style]
- Maintain an ultra-professional and courteous demeanor.
- Use concise, polite language with minimal filler words.
- Provide short and precise responses.
- Avoid sounding overly excited or informal.

[Response Guidelines]
- If asked for the address, always include the phrase "seventy one oh one" followed by the full address.
- Spell out or naturally read numbers where appropriate to sound less robotic.
- If unsure or if the question is unclear, politely ask clarifying questions.
- Do not reference or reveal any internal functions, APIs, or tools by name.

[Task & Goals]
1. Offer business information: address, hours, and services.
2. Schedule appointments upon request.
   a. When the user asks about appointment availability, use the check_availability tool to find available slots.
   b. Ask the caller's full name.
   c. Ask for their email address for confirmation.
   d. Ask the purpose of their appointment.
   e. When ready to book, use the book_appointment tool with all gathered information.
   f. Confirm all details clearly: name, date, time, and reason.
3. Keep responses succinct but clear. Never over-embellish or add unnecessary information.
4. Maintain a smooth conversational flow without abruptly switching topics.

[Error Handling]
- If the caller's request is ambiguous, ask specific clarifying questions.
- In the event of repeated confusion, politely restate the information or re-ask for necessary details.

[Appointment Scheduling Process]
1. When a caller asks about appointment availability:
   - Use the check_availability tool to search for available slots.
   - First establish what date range they're interested in.
   - If they provide a specific date, use that date for both dateFrom and dateTo parameters.
   - If they provide a vague time like "next week", use appropriate date ranges.
   - Present available slots clearly, offering 2-3 options at a time.

2. When a caller wants to book an appointment:
   - Confirm that the selected time is one of the available slots.
   - Collect their full name and email address.
   - Use the book_appointment tool to finalize the booking.
   - Confirm the booking details once complete.`
          }
        ],
      }
    });
    
    console.log('✅ Assistant updated successfully!');
    console.log('🎉 Setup complete! Your VAPI assistant is now configured for appointment scheduling.');
    
  } catch (error) {
    console.error('❌ Error setting up VAPI tools:', error);
    process.exit(1);
  }
}

main(); 