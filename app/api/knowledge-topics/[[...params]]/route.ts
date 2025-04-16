import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod'; // For input validation
import { uploadFileToVapi, generateVapiNamesUtil, vapiFetch } from '@/lib/vapiUtils'; // Import helpers

const prisma = new PrismaClient();

// --- Logging Utility ---
function log(message: string, data?: unknown) {
    console.log(`[${new Date().toISOString()}] [knowledge-topics] ${message}`);
    if (data !== undefined) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Adjust in production
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- Input Schemas (Zod) ---
const PostTopicSchema = z.object({
    assistantId: z.string().min(1, "Assistant ID is required"),
    topicName: z.string().min(1, "Topic name is required"),
    content: z.string().min(1, "Content cannot be empty"),
});

const PutTopicSchema = z.object({
    assistantId: z.string().min(1, "Assistant ID is required"), // Often needed for verification
    topicName: z.string().min(1, "Topic name is required"),
    content: z.string().min(1, "Content cannot be empty"),
});

// --- Helper Functions ---

// --- API Route Handlers ---

// GET /api/knowledge-topics?assistantId={id}
export async function GET(request: Request) {
    log("GET request received");
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistantId');

    if (!assistantId) {
        return NextResponse.json({ error: 'Missing assistantId query parameter' }, { status: 400, headers: corsHeaders });
    }

    try {
        const topics = await prisma.knowledgeTopic.findMany({
            where: { assistantId: assistantId },
            orderBy: { createdAt: 'asc' },
        });
        log(`Found ${topics.length} topics for assistant ${assistantId}`);
        return NextResponse.json(topics, { status: 200, headers: corsHeaders });
    } catch (error) {
        log('Error fetching knowledge topics from DB', error);
        const message = error instanceof Error ? error.message : 'Failed to retrieve knowledge topics.';
        return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
    } finally {
        await prisma.$disconnect().catch(e => log('Error disconnecting Prisma', e));
    }
}

// POST /api/knowledge-topics
export async function POST(request: Request) {
    log("POST request received");
    try {
        const body = await request.json();
        const validation = PostTopicSchema.safeParse(body);

        if (!validation.success) {
            log('Invalid POST request body', validation.error.errors);
            return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400, headers: corsHeaders });
        }

        // Assign assistantId after validation
        const _assistantId = validation.data.assistantId;
        const { topicName, content } = validation.data;
        log(`Processing POST for topic "${topicName}" for assistant ${_assistantId}`);

        const { vapiFileName, vapiToolName, vapiKbName, vapiDescription } = generateVapiNamesUtil(topicName);

        let vapiFileId: string | null = null;
        let vapiToolId: string | null = null;
        let assistantUpdated = false;

        try {
            // 1. Upload File via Utility Function
            vapiFileId = await uploadFileToVapi(content, vapiFileName);
            log(`File uploaded successfully via utility: ${vapiFileId}`);

            // 2. Create Query Tool in Vapi (Correct Payload)
            log(`Creating tool ${vapiToolName} with KB ${vapiKbName}...`);
            const toolPayload = {
                type: "query",
                function: { // Define how LLM calls it
                    name: vapiToolName,
                    description: vapiDescription,
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: `The specific question or topic about ${topicName.trim()} the user is asking.`
                            }
                        },
                        required: ["query"]
                    }
                },
                knowledgeBases: [{ // Define the KB source
                    provider: "openai", // Ensure this matches Vapi's capability
                    model: "gpt-4o-mini", // Ensure this matches Vapi's capability
                    name: vapiKbName,
                    description: vapiDescription,
                    fileIds: [vapiFileId],
                }],
                // messages: [ ... ] // Optional tool messages
            };
            const toolData = await vapiFetch('/tool', {
                method: 'POST',
                body: JSON.stringify(toolPayload),
            });
            vapiToolId = (toolData && typeof toolData === 'object' && 'id' in toolData && typeof toolData.id === 'string') ? toolData.id : null;
            if (!vapiToolId) throw new Error('Vapi did not return a valid tool ID after creation.');
            log(`Tool created successfully: ${vapiToolId}`);

            // 3. Update Assistant in Vapi
            log(`Attaching tool ${vapiToolId} to assistant ${_assistantId}...`);
            const assistantData = await vapiFetch(`/assistant/${_assistantId}`);
            let existingToolIds: string[] = [];
            if (assistantData && typeof assistantData === 'object' && 'model' in assistantData && assistantData.model && typeof assistantData.model === 'object' && 'toolIds' in assistantData.model && Array.isArray(assistantData.model.toolIds)) {
                existingToolIds = assistantData.model.toolIds.filter((id): id is string => typeof id === 'string');
            }
            const newToolIds = [...new Set([...existingToolIds, vapiToolId])];

            // --- Create the minimal PATCH payload ---
            const assistantUpdatePayload = {
                model: {
                    toolIds: newToolIds // Send ONLY the updated toolIds array
                }
            };
            log('Sending minimal PATCH payload to update assistant', assistantUpdatePayload);
            // -----------------------------------------

            await vapiFetch(`/assistant/${_assistantId}`, {
                method: 'PATCH',
                body: JSON.stringify(assistantUpdatePayload),
            });
            assistantUpdated = true;
            log(`Assistant ${_assistantId} updated successfully with tool ${vapiToolId}`);

            // 4. Create KnowledgeTopic in Local DB
            log(`Saving KnowledgeTopic "${topicName}" to local DB...`);
            const newTopic = await prisma.knowledgeTopic.create({
                data: {
                    topicName: topicName.trim(),
                    content: content,
                    assistantId: _assistantId,
                    vapiToolId: vapiToolId,
                    vapiFileId: vapiFileId,
                    vapiKbName: vapiKbName,
                    vapiToolName: vapiToolName,
                    vapiFileName: vapiFileName,
                    vapiDescription: vapiDescription,
                }
            });
            log('KnowledgeTopic saved to DB successfully', newTopic);

            return NextResponse.json(newTopic, { status: 201, headers: corsHeaders });

        } catch (vapiError) {
            log('Error during Vapi operations or DB save', vapiError);
            // --- Rollback Vapi Resources ---
             if (vapiToolId && assistantUpdated) {
                 log(`Attempting rollback: Detach tool ${vapiToolId} from assistant ${_assistantId}`);
                 try {
                     const currentAssistantData = await vapiFetch(`/assistant/${_assistantId}`);
                     let currentToolIds: string[] = [];
                      if (currentAssistantData && typeof currentAssistantData === 'object' && 'model' in currentAssistantData && currentAssistantData.model && typeof currentAssistantData.model === 'object' && 'toolIds' in currentAssistantData.model && Array.isArray(currentAssistantData.model.toolIds)) {
                         currentToolIds = currentAssistantData.model.toolIds.filter((id): id is string => typeof id === 'string');
                     }
                     const filteredToolIds = currentToolIds.filter((id: string) => id !== vapiToolId);
                     await vapiFetch(`/assistant/${_assistantId}`, {
                         method: 'PATCH',
                         body: JSON.stringify({ model: { toolIds: filteredToolIds } }),
                     });
                     log(`Rollback: Tool ${vapiToolId} detached from assistant ${_assistantId}`);
                 } catch (rollbackError) {
                     log(`CRITICAL: Failed to detach tool ${vapiToolId} during rollback`, rollbackError);
                 }
            }
            if (vapiToolId) {
                 log(`Attempting rollback: Delete tool ${vapiToolId}`);
                 try {
                     await vapiFetch(`/tool/${vapiToolId}`, { method: 'DELETE' });
                     log(`Rollback: Tool ${vapiToolId} deleted`);
                 } catch (rollbackError) {
                     log(`CRITICAL: Failed to delete tool ${vapiToolId} during rollback`, rollbackError);
                 }
            }
             if (vapiFileId) {
                 log(`Attempting rollback: Delete file ${vapiFileId}`);
                 try {
                     await vapiFetch(`/file/${vapiFileId}`, { method: 'DELETE' });
                     log(`Rollback: File ${vapiFileId} deleted`);
                 } catch (rollbackError) {
                     log(`CRITICAL: Failed to delete file ${vapiFileId} during rollback`, rollbackError);
                 }
            }
            const message = vapiError instanceof Error ? vapiError.message : 'Failed to create knowledge topic.';
            return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
        }

    } catch (error) {
        log('Unhandled error in POST handler', error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
    } finally {
        await prisma.$disconnect().catch(e => log('Error disconnecting Prisma', e));
    }
}


// PUT /api/knowledge-topics/{toolId}
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ params?: string[] }> }
) {
    const { params: segments } = await params;  // Await the dynamic params (Next.js 15+)
    const toolId = segments?.[0];
    log(`PUT request received for toolId: ${toolId}`);

     if (!toolId) {
        return NextResponse.json({ error: 'Missing knowledge topic ID (toolId) in URL path' }, { status: 400, headers: corsHeaders });
    }

    let assistantIdFromBody: string | undefined; // For use in catch/finally
    try {
        const body = await request.json();
        const validation = PutTopicSchema.safeParse(body);

        if (!validation.success) {
            log('Invalid PUT request body', validation.error.errors);
            return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400, headers: corsHeaders });
        }

        assistantIdFromBody = validation.data.assistantId; // Assign here
        const { topicName, content } = validation.data;
        log(`Processing PUT for topic "${topicName}" (toolId: ${toolId})`);

        // 1. Fetch existing topic from DB
        const existingTopic = await prisma.knowledgeTopic.findUnique({
            where: { vapiToolId: toolId },
        });

        if (!existingTopic || !existingTopic.vapiToolId || !existingTopic.vapiFileId) {
            log(`Knowledge topic with Vapi tool ID ${toolId} not found in DB or missing Vapi IDs.`);
            return NextResponse.json({ error: 'Knowledge topic not found.' }, { status: 404, headers: corsHeaders });
        }

        // Optional: Verify assistantId matches if needed for authorization
        if (existingTopic.assistantId !== assistantIdFromBody) {
             log(`Authorization error: Assistant ID mismatch for tool ${toolId}`);
             return NextResponse.json({ error: 'Unauthorized to modify this topic.' }, { status: 403, headers: corsHeaders });
        }

        let newVapiFileId: string | null = null;
        const oldVapiFileId = existingTopic.vapiFileId;
        const names = generateVapiNamesUtil(topicName); // Use Util function

         try {
            // 2. Upload *new* File content via Utility Function
            log(`Uploading new file content ${names.vapiFileName} via utility...`);
            newVapiFileId = await uploadFileToVapi(content, names.vapiFileName);
            log(`New file uploaded successfully via utility: ${newVapiFileId}`);

             // 3. Update Vapi Tool (PATCH) - Correct Payload
             log(`Updating Vapi tool ${toolId} to use new file ${newVapiFileId}...`);
             const toolUpdatePayload = {
                 type: "query", // Type is required for PATCH on tools
                 function: { // Update function description
                     description: names.vapiDescription,
                     // IMPORTANT: Resend the *entire* function block for safety
                     name: existingTopic.vapiToolName || names.vapiToolName, // Use existing or new tool name
                     parameters: {
                         type: "object",
                         properties: { query: { type: "string", description: `The specific question or topic about ${topicName.trim()} the user is asking.` }},
                         required: ["query"]
                     }
                 },
                 knowledgeBases: [{
                     // Re-specify all required KB fields
                     provider: "openai", // Assuming openai provider
                     model: "gpt-4o-mini", // Assuming this model
                     name: existingTopic.vapiKbName || names.vapiKbName, // Use existing or new KB name
                     description: names.vapiDescription, // Update description
                     fileIds: [newVapiFileId], // The crucial update
                 }],
                 // messages: [...] // Resend messages if they were part of the original tool
             };
             await vapiFetch(`/tool/${toolId}`, {
                 method: 'PATCH',
                 body: JSON.stringify(toolUpdatePayload),
             });
             log(`Vapi tool ${toolId} updated successfully.`);

             // 4. Delete *old* Vapi File
             if (oldVapiFileId) {
                 log(`Deleting old Vapi file ${oldVapiFileId}...`);
                 await vapiFetch(`/file/${oldVapiFileId}`, { method: 'DELETE' }).catch(delErr => {
                      log(`WARNING: Failed to delete old Vapi file ${oldVapiFileId}. Manual cleanup might be needed.`, delErr);
                 });
                 log(`Old Vapi file ${oldVapiFileId} deleted (or deletion attempted).`);
             }

            // 5. Update KnowledgeTopic in Local DB
            log(`Updating KnowledgeTopic ${existingTopic.id} in local DB...`);
            const updatedTopic = await prisma.knowledgeTopic.update({
                where: { id: existingTopic.id },
                data: {
                    topicName: topicName.trim(),
                    content: content,
                    vapiFileId: newVapiFileId,
                    vapiFileName: names.vapiFileName,
                    vapiDescription: names.vapiDescription,
                    vapiToolName: names.vapiToolName, // Update tool name if regenerated
                    vapiKbName: names.vapiKbName,     // Update KB name if regenerated
                }
            });
            log('KnowledgeTopic updated in DB successfully', updatedTopic);

            return NextResponse.json(updatedTopic, { status: 200, headers: corsHeaders });

        } catch (vapiError) {
            log('Error during Vapi operations or DB update', vapiError);
             // --- Rollback attempt for new file ---
             if (newVapiFileId) {
                 log(`Attempting rollback: Delete newly uploaded file ${newVapiFileId}`);
                 try {
                     await vapiFetch(`/file/${newVapiFileId}`, { method: 'DELETE' });
                     log(`Rollback: New file ${newVapiFileId} deleted`);
                 } catch (rollbackError) {
                     log(`CRITICAL: Failed to delete newly uploaded file ${newVapiFileId} during PUT rollback`, rollbackError);
                 }
             }
            const message = vapiError instanceof Error ? vapiError.message : 'Failed to update knowledge topic.';
            return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
        }

    } catch (error) {
        log('Unhandled error in PUT handler', error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
    } finally {
        await prisma.$disconnect().catch(e => log('Error disconnecting Prisma', e));
    }
}


// DELETE /api/knowledge-topics/{toolId}
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ params?: string[] }> }
) {
     const { params: segments } = await params;  // Await the dynamic params (Next.js 15+)
     const toolId = segments?.[0];
     log(`DELETE request received for toolId: ${toolId}`);

    if (!toolId) {
        return NextResponse.json({ error: 'Missing knowledge topic ID (toolId) in URL path' }, { status: 400, headers: corsHeaders });
    }

     try {
        // 1. Fetch existing topic from DB to get Vapi IDs and assistantId
        const existingTopic = await prisma.knowledgeTopic.findUnique({
            where: { vapiToolId: toolId },
        });

        if (!existingTopic || !existingTopic.vapiToolId || !existingTopic.vapiFileId || !existingTopic.assistantId) {
            log(`Knowledge topic with Vapi tool ID ${toolId} not found in DB or missing crucial IDs.`);
            return NextResponse.json({ error: 'Knowledge topic not found.' }, { status: 404, headers: corsHeaders });
        }

        const { vapiToolId, vapiFileId, assistantId } = existingTopic;
        log(`Found topic in DB. Proceeding with deletion for assistant ${assistantId}, tool ${vapiToolId}, file ${vapiFileId}`);

        // --- Delete Vapi Resources (Best effort, log errors) ---
        const vapiErrors: string[] = [];

        // 2. Detach Tool from Assistant
        try {
            log(`Detaching tool ${vapiToolId} from assistant ${assistantId}...`);
            const assistantData = await vapiFetch(`/assistant/${assistantId}`);
            let currentToolIds: string[] = [];
             if (assistantData && typeof assistantData === 'object' && 'model' in assistantData && assistantData.model && typeof assistantData.model === 'object' && 'toolIds' in assistantData.model && Array.isArray(assistantData.model.toolIds)) {
                 currentToolIds = assistantData.model.toolIds.filter((id): id is string => typeof id === 'string');
            }
            const filteredToolIds = currentToolIds.filter((id: string) => id !== vapiToolId);
            
            const assistantUpdatePayload = {
                model: {
                    toolIds: filteredToolIds // Send ONLY the updated toolIds array
                }
            };
            log('Sending minimal PATCH payload to update assistant', assistantUpdatePayload);
            
            await vapiFetch(`/assistant/${assistantId}`, {
                method: 'PATCH',
                body: JSON.stringify(assistantUpdatePayload),
            });
            log(`Tool ${vapiToolId} detached successfully.`);
        } catch (error) {
             const msg = `Failed to detach tool ${vapiToolId} from assistant ${assistantId}: ${error instanceof Error ? error.message : error}`;
             log(msg);
             vapiErrors.push(msg);
        }

        // 3. Delete Tool
        try {
            log(`Deleting tool ${vapiToolId}...`);
            await vapiFetch(`/tool/${vapiToolId}`, { method: 'DELETE' });
            log(`Tool ${vapiToolId} deleted successfully.`);
        } catch (error) {
             const msg = `Failed to delete tool ${vapiToolId}: ${error instanceof Error ? error.message : error}`;
             log(msg);
             vapiErrors.push(msg);
        }

        // 4. Delete File
        try {
            log(`Deleting file ${vapiFileId}...`);
            await vapiFetch(`/file/${vapiFileId}`, { method: 'DELETE' });
            log(`File ${vapiFileId} deleted successfully.`);
        } catch (error) {
             const msg = `Failed to delete file ${vapiFileId}: ${error instanceof Error ? error.message : error}`;
             log(msg);
             vapiErrors.push(msg);
        }

        // 5. Delete from Local DB
        log(`Deleting KnowledgeTopic ${existingTopic.id} from local DB...`);
        await prisma.knowledgeTopic.delete({
            where: { id: existingTopic.id },
        });
        log('KnowledgeTopic deleted from DB successfully.');

        if (vapiErrors.length > 0) {
             log('DELETE completed with Vapi errors. Local DB record deleted.', vapiErrors);
             // Return 200 with message instead of 204
             return NextResponse.json({ message: "Knowledge topic deleted from database. Some Vapi resources might require manual cleanup.", details: vapiErrors }, { status: 200, headers: corsHeaders });
        }

        log(`DELETE completed successfully for tool ${toolId}.`);
        return new NextResponse(null, { status: 204, headers: corsHeaders }); // No content on successful delete

    } catch (error) {
        log('Unhandled error in DELETE handler', error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred while deleting the knowledge topic.';
        return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
    } finally {
        await prisma.$disconnect().catch(e => log('Error disconnecting Prisma', e));
    }
}


// Handle CORS preflight OPTIONS request
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}