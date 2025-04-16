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
import { Bot, User, FileText, ListTree, AudioLines } from "lucide-react";

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
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isUser ? 'bg-primary/10 text-primary-foreground' : 'bg-muted'}`}>
                    <p className="font-semibold text-xs mb-1 capitalize">{speaker}</p>
                    <p>{content}</p>
                </div>
                 {isUser && <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />}
            </div>
        );
    });
};

const formatStructuredData = (data: Record<string, unknown> | null): React.ReactNode => {
    if (!data || Object.keys(data).length === 0) {
        return <p className="text-muted-foreground italic text-xs">No structured data extracted.</p>;
    }
    return (
        <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
};

export default function CallDetailModal({ isOpen, onOpenChange, callDetail }: CallDetailModalProps) {
    if (!callDetail) return null;

    const formatDate = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleString() : 'N/A';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-[90vw] h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Call Details: {callDetail.id}</DialogTitle>
                    <DialogDescription>
                        Call started on {formatDate(callDetail.createdAt)}.
                        {callDetail.endedReason && <Badge variant="outline" className="ml-2">{callDetail.endedReason}</Badge>}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-grow pr-6 -mr-6">
                    <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center"><FileText className="mr-2 h-4 w-4"/> AI Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm">
                                    {callDetail.summary || <p className="text-muted-foreground italic">No summary available.</p>}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center"><ListTree className="mr-2 h-4 w-4"/> Structured Data</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {formatStructuredData(callDetail.structuredData)}
                                </CardContent>
                            </Card>

                             {callDetail.recordingUrl && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center"><AudioLines className="mr-2 h-4 w-4"/> Recording</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <audio controls className="w-full h-10" src={callDetail.recordingUrl}>
                                            <track kind="captions" src="" label="English captions" />
                                            Your browser does not support the audio element.
                                        </audio>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <Card className="md:col-span-1 h-full flex flex-col">
                            <CardHeader>
                                <CardTitle className="text-base">Transcript</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow overflow-hidden">
                                <ScrollArea className="h-[calc(100%-1rem)] pr-3">
                                    {formatTranscript(callDetail.transcript)}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-auto pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 