import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    MapPin, 
    Clock, 
    Trash2, 
    CheckCircle2, 
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Camera,
    Package
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusColors = {
    pending: "bg-yellow-500 text-white",
    scheduled: "bg-blue-500 text-white",
    in_progress: "bg-purple-500 text-white",
    completed: "bg-green-500 text-white",
    cancelled: "bg-gray-500 text-white"
};

export default function MobileJobCard({ 
    job, 
    onStatusUpdate, 
    onPhotoUpload, 
    onReportIncident,
    onGiveOutItems 
}) {
    const [expanded, setExpanded] = useState(false);

    const wasteTypeIcons = {
        general: <Trash2 className="w-5 h-5" />,
        recyclable: <Trash2 className="w-5 h-5" />,
        organic: <Trash2 className="w-5 h-5" />,
        hazardous: <AlertTriangle className="w-5 h-5" />,
        bulky: <Trash2 className="w-5 h-5" />
    };

    const handlePhotoCapture = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0 && onPhotoUpload) {
                await onPhotoUpload(job, files);
            }
        };
        input.click();
    };

    return (
        <Card className={cn(
            "border-0 shadow-lg mb-4 overflow-hidden transition-all",
            job.status === 'completed' ? "opacity-75" : ""
        )}>
            {/* Header - Always Visible */}
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-full">
                            {wasteTypeIcons[job.waste_type] || wasteTypeIcons.general}
                        </div>
                        <div>
                            <p className="font-bold text-base capitalize">{job.waste_type || 'General Waste'}</p>
                            <p className="text-xs text-white/80">{job.request_type?.replace('_', ' ') || 'Standard'}</p>
                        </div>
                    </div>
                    <Badge className={cn("text-xs font-semibold", statusColors[job.status])}>
                        {job.status.replace('_', ' ')}
                    </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-white/90">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{job.address || 'Address not set'}</span>
                </div>
            </div>

            {/* Collapsible Details */}
            <div className={cn("transition-all duration-300", expanded ? "max-h-96" : "max-h-0 overflow-hidden")}>
                <CardContent className="p-4 space-y-4 bg-white">
                    {/* Job Details */}
                    <div className="space-y-3">
                        {job.scheduled_date && (
                            <div className="flex items-center gap-3 text-sm">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Scheduled:</span>
                                <span className="font-medium">
                                    {format(new Date(job.scheduled_date), 'EEEE, MMM d, yyyy')}
                                </span>
                            </div>
                        )}
                        
                        {job.notes && (
                            <div className="p-3 bg-secondary rounded-lg">
                                <p className="text-xs text-muted-foreground">{job.notes}</p>
                            </div>
                        )}

                        {job.photo_urls && job.photo_urls.length > 0 && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Evidence Photos ({job.photo_urls.length})
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {job.photo_urls.slice(0, 3).map((url, idx) => (
                                        <img 
                                            key={idx} 
                                            src={url} 
                                            alt="Evidence" 
                                            className="w-full h-20 object-cover rounded-lg"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        {job.status === 'pending' && (
                            <Button 
                                className="h-12 text-base"
                                onClick={() => onStatusUpdate?.(job, 'in_progress')}
                            >
                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                Start Job
                            </Button>
                        )}
                        
                        {job.status === 'in_progress' && (
                            <>
                                <Button 
                                    className="h-12 text-base"
                                    variant="outline"
                                    onClick={handlePhotoCapture}
                                >
                                    <Camera className="w-5 h-5 mr-2" />
                                    Add Photo
                                </Button>
                                <Button 
                                    className="h-12 text-base bg-green-600 hover:bg-green-700"
                                    onClick={() => onStatusUpdate?.(job, 'completed')}
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Complete
                                </Button>
                            </>
                        )}

                        <Button 
                            className="h-12 text-base"
                            variant="outline"
                            onClick={() => onReportIncident?.(job)}
                        >
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Report Issue
                        </Button>

                        {onGiveOutItems && (
                            <Button 
                                className="h-12 text-base"
                                variant="secondary"
                                onClick={() => onGiveOutItems(job)}
                            >
                                <Package className="w-5 h-5 mr-2" />
                                Distribute
                            </Button>
                        )}
                    </div>
                </CardContent>
            </div>

            {/* Expand Toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full py-3 bg-secondary flex items-center justify-center gap-2 text-sm font-medium"
            >
                {expanded ? (
                    <>
                        <ChevronUp className="w-4 h-4" />
                        Show Less
                    </>
                ) : (
                    <>
                        <ChevronDown className="w-4 h-4" />
                        Show Details
                    </>
                )}
            </button>
        </Card>
    );
}