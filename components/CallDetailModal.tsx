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
            <DialogContent className="max-w-[95vw] w-[95vw] min-w-[80vw] max-h-[90vh] h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-2 border-b">
                    <DialogTitle>Call Details: {callDetail.id}</DialogTitle>
                    <DialogDescription>
                        Call started on {formatDate(callDetail.createdAt)}.
                        {callDetail.endedReason && <Badge variant="outline" className="ml-2">{callDetail.endedReason}</Badge>}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden px-6">
                    <ScrollArea className="h-full py-4">
                        <div className="space-y-6">
                            {/* Three column layout: AI Summary, Transcript, and Recording/Data */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6">
                                {/* AI Summary */}
                                <Card className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center">
                                            <FileText className="mr-2 h-4 w-4"/> AI Summary
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ScrollArea className="h-[350px]">
                                            <div className="text-sm pr-4">
                                                {callDetail.summary || <p className="text-muted-foreground italic">No summary available.</p>}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>

                                {/* Transcript */}
                                <Card className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center">
                                            <Bot className="mr-2 h-4 w-4"/> Transcript
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow p-0">
                                        <ScrollArea className="h-[350px] px-6">
                                            <div className="py-2">
                                                {formatTranscript(callDetail.transcript)}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>

                                {/* Recording and Additional Data */}
                                <Card className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center">
                                            <AudioLines className="mr-2 h-4 w-4"/> Media & Data
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        {/* Enhanced Audio Player */}
                                        {callDetail.recordingUrl && (
                                            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
                                                <div className="flex items-center mb-3">
                                                    <div className="bg-primary/10 p-2 rounded-lg mr-3">
                                                        <AudioLines className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm">Call Recording</h4>
                                                        <p className="text-xs text-muted-foreground">High quality audio</p>
                                                    </div>
                                                </div>
                                                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm">
                                                    <audio 
                                                        controls 
                                                        className="w-full h-10 rounded-md"
                                                        style={{
                                                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                                        }}
                                                        src={callDetail.recordingUrl}
                                                        preload="auto"
                                                    >
                                                        <track kind="captions" srcLang="en" label="English" />
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                </div>
                                            </div>
                                        )}

                                        {/* Call Metadata */}
                                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                            <h4 className="font-semibold text-sm mb-2">Call Information</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Duration:</span>
                                                    <p className="font-medium">
                                                        {callDetail.durationSeconds 
                                                            ? `${Math.floor(callDetail.durationSeconds / 60)}:${String(callDetail.durationSeconds % 60).padStart(2, '0')}`
                                                            : 'N/A'
                                                        }
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Status:</span>
                                                    <Badge variant="outline" className="ml-1 text-xs">
                                                        {callDetail.status}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Started:</span>
                                                    <p className="font-medium text-xs">
                                                        {new Date(callDetail.createdAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Ended:</span>
                                                    <p className="font-medium text-xs">
                                                        {callDetail.endedAt 
                                                            ? new Date(callDetail.endedAt).toLocaleTimeString()
                                                            : 'N/A'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Structured Data */}
                                        {callDetail.structuredData && Object.keys(callDetail.structuredData).length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-sm mb-2">Structured Data</h4>
                                                <ScrollArea className="h-[150px]">
                                                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                                        {JSON.stringify(callDetail.structuredData, null, 2)}
                                                    </pre>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-background">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 