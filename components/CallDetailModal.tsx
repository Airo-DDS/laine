"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, FileText, AudioLines } from "lucide-react";

interface CallLogInfo {
    id: string;
    createdAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    status: string;
    endedReason: string | null;
    transcript: string | null;
    summary: string | null;
    structuredData: Record<string, unknown> | null;
    recordingUrl: string | null;
}

interface CallDetailModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    callDetail: CallLogInfo | null;
}

const formatTranscript = (transcript: string | null): React.ReactNode => {
    if (!transcript) return <p className="text-muted-foreground italic">No transcript available.</p>;

    const lines = transcript.split('\n').filter(line => line.trim() !== '');

    return lines.map((line, index) => {
        const speakerMatch = line.match(/^(User|AI|System|Bot|Laine):\s*/i);
        const speaker = speakerMatch ? speakerMatch[1] : 'Unknown';
        const content = speakerMatch ? line.substring(speakerMatch[0].length) : line;
        const isUser = speaker.toLowerCase() === 'user';
        const Icon = isUser ? User : Bot;

        const lineKey = `${speaker}-${content.substring(0, 10)}-${index}`;

        return (
            <div key={lineKey} className={`flex gap-3 my-2 text-sm ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isUser ? 'bg-primary/10 text-black' : 'bg-muted'}`}>
                    <p className="font-semibold text-xs mb-1 capitalize">{speaker}</p>
                    <p>{content}</p>
                </div>
                 {isUser && <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />}
            </div>
        );
    });
};

export default function CallDetailModal({ isOpen, onOpenChange, callDetail }: CallDetailModalProps) {
    if (!callDetail) return null;

    const formatDate = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleString() : 'N/A';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90%] w-[90vw] h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Call Details: {callDetail.id}</DialogTitle>
                    <DialogDescription>
                        Call started on {formatDate(callDetail.createdAt)}.
                        {callDetail.endedReason && <Badge variant="outline" className="ml-2">{callDetail.endedReason}</Badge>}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow flex flex-col overflow-hidden mt-4">
                    {/* Top row: AI Summary and Transcript */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow mb-4">
                        {/* AI Summary */}
                        <Card className="flex flex-col h-full">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center">
                                    <FileText className="mr-2 h-4 w-4"/> AI Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow overflow-auto">
                                <div className="text-sm">
                                    {callDetail.summary || <p className="text-muted-foreground italic">No summary available.</p>}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Transcript */}
                        <Card className="flex flex-col h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Transcript</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow overflow-hidden p-0">
                                <ScrollArea className="h-full max-h-[50vh] px-6">
                                    <div className="py-2">
                                        {formatTranscript(callDetail.transcript)}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Bottom row: Recording */}
                    {callDetail.recordingUrl && (
                        <Card className="mb-4 border-2 border-primary/50 shadow-md">
                            <CardHeader className="bg-primary/10">
                                <CardTitle className="text-lg flex items-center">
                                    <AudioLines className="mr-2 h-6 w-6 text-primary"/> Call Recording
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="bg-white rounded-lg p-4 flex flex-col items-center shadow">
                                    <p className="text-base mb-3 font-medium">Listen to call recording:</p>
                                    <audio 
                                        controls 
                                        className="w-full h-16" 
                                        src={callDetail.recordingUrl}
                                        preload="auto"
                                    >
                                        <track kind="captions" srcLang="en" label="English" />
                                        Your browser does not support the audio element.
                                    </audio>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Click play to listen to the call
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <DialogFooter className="pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 