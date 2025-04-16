"use client";

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Loader2,
    AlertCircle,
    FileText,
    Info,
    PlusCircle,
    Pencil,
    Trash2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Interface matching the data returned by GET /api/knowledge-topics
interface KnowledgeTopic {
    id: string; // This is the Prisma ID
    topicName: string;
    content: string;
    assistantId: string;
    vapiToolId: string | null; // Vapi Tool ID is crucial for updates/deletes
    vapiFileId: string | null;
    createdAt: string;
    updatedAt: string;
    // Add other vapi IDs if needed for display/debugging
}

interface TrainTabProps {
  assistantId: string;
}

export function TrainTab({ assistantId }: TrainTabProps) {
    const [knowledgeTopics, setKnowledgeTopics] = useState<KnowledgeTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for the Add/Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<KnowledgeTopic | null>(null); // null for Add mode
    const [modalTopicName, setModalTopicName] = useState('');
    const [modalContent, setModalContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // State for delete operation loading indicator
    const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);

    // Fetch topics function
    const fetchTopics = useCallback(async () => {
        if (!assistantId) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/knowledge-topics?assistantId=${assistantId}`);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `Failed to fetch knowledge topics (${response.status})`);
            }
            const data: KnowledgeTopic[] = await response.json();
            setKnowledgeTopics(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load knowledge topics.');
            console.error("Fetch Topics Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [assistantId]);

    // Initial fetch
    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    // --- Modal Handlers ---
    const handleOpenAddModal = () => {
        setEditingTopic(null);
        setModalTopicName('');
        setModalContent('');
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (topic: KnowledgeTopic, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTopic(topic);
        setModalTopicName(topic.topicName);
        setModalContent(topic.content);
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleModalSave = async () => {
        setIsSaving(true);
        setModalError(null);
        setError(null); // Clear main page error

        const apiUrl = editingTopic
            ? `/api/knowledge-topics/${editingTopic.vapiToolId}` // PUT for update
            : '/api/knowledge-topics'; // POST for create

        const method = editingTopic ? 'PUT' : 'POST';

        const payload = {
            assistantId: assistantId,
            topicName: modalTopicName,
            content: modalContent,
        };

        try {
            const response = await fetch(apiUrl, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to ${editingTopic ? 'update' : 'create'} topic (${response.status})`);
            }

            setIsModalOpen(false); // Close modal on success
            fetchTopics(); // Refresh the list

        } catch (err) {
            const message = err instanceof Error ? err.message : `Could not ${editingTopic ? 'update' : 'create'} topic.`;
            setModalError(message);
            console.error("Save Topic Error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Delete Handler ---
    const handleDeleteClick = async (topic: KnowledgeTopic, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!topic.vapiToolId) {
            setError("Cannot delete topic: Missing Vapi Tool ID.");
      return;
    }
        if (!window.confirm(`Are you sure you want to delete the topic "${topic.topicName}"? This will remove the associated knowledge from Vapi.`)) {
      return;
    }

        setDeletingTopicId(topic.vapiToolId);
        setError(null); // Clear main page error
        setModalError(null); // Clear modal error

        try {
            const response = await fetch(`/api/knowledge-topics/${topic.vapiToolId}`, {
                method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
                // Send assistantId in body for potential verification on backend
                body: JSON.stringify({ assistantId })
            });

            if (!response.ok && response.status !== 204) { // Allow 204 No Content
                const data = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
                throw new Error(data.error || `Failed to delete topic (${response.status})`);
            }

            fetchTopics(); // Refresh the list

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete topic.';
            setError(message); // Show error on main page
            console.error("Delete Topic Error:", err);
    } finally {
            setDeletingTopicId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <h2 className="text-xl font-semibold mb-2 flex items-center">
        <FileText className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" /> Train Your Assistant
      </h2>

      <Alert variant="default" className="bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-300 mt-1" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">Manage Knowledge Topics</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                    Add, edit, or delete specific knowledge topics for your assistant. Each topic is uploaded as a separate document.
                    Remember to update your assistant&apos;s system prompt in the &apos;Configure&apos; tab to guide it on *when* to use the knowledge from a specific topic (referencing it by the Topic Name you provide here).
        </AlertDescription>
      </Alert>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {isLoading ? (
                <div className="space-y-3 py-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
          </div>
            ) : (
                <>
                    <Accordion type="single" collapsible className="w-full space-y-2">
                        {knowledgeTopics.length === 0 && (
                             <p className="text-center text-muted-foreground py-6">No knowledge topics added yet.</p>
                        )}
                        {knowledgeTopics.map((topic) => (
                            <AccordionItem value={topic.vapiToolId || topic.id} key={topic.vapiToolId || topic.id} className="border dark:border-gray-700 rounded-md bg-card overflow-hidden">
                                <AccordionTrigger className="hover:no-underline px-4 py-3 text-left w-full">
                                    <div className="flex justify-between items-center w-full" >
                                        <span className="font-medium text-card-foreground truncate mr-4">{topic.topicName}</span>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleOpenEditModal(topic, e)} disabled={!!deletingTopicId}>
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit {topic.topicName}</span>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7" onClick={(e) => handleDeleteClick(topic, e)} disabled={deletingTopicId === topic.vapiToolId || !topic.vapiToolId}>
                                                {deletingTopicId === topic.vapiToolId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                <span className="sr-only">Delete {topic.topicName}</span>
                                            </Button>
          </div>
      </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-0">
                                    <Textarea
                                        readOnly
                                        value={topic.content}
                                        className="w-full font-mono text-xs bg-muted/30 border-none h-auto min-h-[100px] max-h-[300px] overflow-y-auto"
                                        rows={Math.min(15, topic.content.split('\n').length + 1)}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    <Button onClick={handleOpenAddModal} className="w-full mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Knowledge Topic
                    </Button>
                </>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingTopic ? 'Edit Knowledge Topic' : 'Add New Knowledge Topic'}</DialogTitle>
                        <DialogDescription>
                            {editingTopic ? `Modify the name and content for &quot;${editingTopic.topicName}&quot;.` : 'Provide a name and the content for this knowledge topic.'} Remember to update the assistant&apos;s system prompt to utilize this topic.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
       <div>
                            <Label htmlFor="modalTopicName">Topic Name</Label>
            <Input
                                id="modalTopicName"
                                value={modalTopicName}
                                onChange={(e) => setModalTopicName(e.target.value)}
                                placeholder="e.g., Office Hours, Insurance Policy"
              className="mt-1"
                                disabled={isSaving}
            />
                             <p className="text-xs text-muted-foreground mt-1">A user-friendly name for this knowledge.</p>
          </div>
      <div>
                            <Label htmlFor="modalContent">Knowledge Content</Label>
        <Textarea
                                id="modalContent"
                                value={modalContent}
                                onChange={(e) => setModalContent(e.target.value)}
                                rows={12}
          className="mt-1 w-full font-mono text-sm"
                                placeholder="Enter Q&A pairs, policy details, or other information..."
                                disabled={isSaving}
        />
      </div>
                        {modalError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{modalError}</AlertDescription>
        </Alert>
      )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isSaving}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="button" onClick={handleModalSave} disabled={isSaving || !modalTopicName.trim() || !modalContent.trim()}>
                            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            {isSaving ? 'Saving...' : (editingTopic ? 'Update Topic' : 'Add Topic')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    </div>
  );
} 