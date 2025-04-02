#!/usr/bin/env ts-node
// @ts-nocheck
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

  console.log('🔍 Checking VAPI tools configuration for the assistant...');
  
  const client = new VapiClient({ token: VAPI_API_KEY });
  
  try {
    // Get the assistant details
    console.log(`📋 Fetching assistant details for ID: ${ASSISTANT_ID}`);
    const assistant = await client.assistants.get(ASSISTANT_ID);
    
    console.log('Assistant Name:', assistant.name);
    console.log('Assistant Status:', assistant.status);
    
    // Check for toolIds
    if (assistant.model?.toolIds && assistant.model.toolIds.length > 0) {
      console.log(`✅ Assistant has ${assistant.model.toolIds.length} toolIds configured:`);
      for (const toolId of assistant.model.toolIds) {
        console.log(`- ${toolId}`);
        
        try {
          // Fetch and display the tool details
          const tool = await client.tools.get(toolId);
          console.log(`  Name: ${tool.function?.name || 'Unknown'}`);
          console.log(`  Type: ${tool.type}`);
          console.log(`  Description: ${tool.function?.description?.substring(0, 50)}...`);
          console.log(`  Server URL: ${tool.server?.url || 'Not set'}`);
        } catch (error: any) {
          console.error(`  ❌ Error fetching tool ${toolId}:`, error.message || 'Unknown error');
        }
      }
    } else {
      console.log('❌ Assistant has no toolIds configured.');
    }
    
    // Check for embedded tools
    if (assistant.model?.tools && assistant.model.tools.length > 0) {
      console.log(`✅ Assistant has ${assistant.model.tools.length} embedded tools:`);
      for (const tool of assistant.model.tools) {
        console.log(`- Name: ${tool.function?.name || 'Unknown'}`);
        console.log(`  Type: ${tool.type}`);
      }
    } else {
      console.log('❌ Assistant has no embedded tools.');
    }
    
    console.log('\n🔄 Tool configuration check complete.');
    
  } catch (error: any) {
    console.error('❌ Error checking VAPI tools:', error.message || error);
    process.exit(1);
  }
}

main(); 