import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, Star, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Approvals() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedCompletion, setSelectedCompletion] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingCompletions, isLoading } = useQuery({
    queryKey: ["/api/tasks/completions/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async (completionId: string) => {
      const res = await apiRequest("POST", `/api/tasks/completions/${completionId}/approve`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      toast({
        title: t("approvals.toastApproved"),
        description: t("approvals.toastAwardedPoints", { points: data.pointsAwarded, name: data.updatedMember?.displayName }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("approvals.toastApprovalFailed"),
        description: error.message || t("approvals.toastApprovalFailedDesc"),
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ completionId, reason }: { completionId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/tasks/completions/${completionId}/reject`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completions/pending"] });
      setRejectDialogOpen(false);
      setSelectedCompletion(null);
      setRejectionReason("");
      toast({
        title: t("approvals.toastRejected"),
        description: t("approvals.toastRejectedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("approvals.toastRejectionFailed"),
        description: error.message || t("approvals.toastRejectionFailedDesc"),
        variant: "destructive",
      });
    },
  });

  const handleApprove = (completionId: string) => {
    approveMutation.mutate(completionId);
  };

  const handleRejectClick = (completion: any) => {
    setSelectedCompletion(completion);
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = () => {
    if (selectedCompletion) {
      rejectMutation.mutate({
        completionId: selectedCompletion.id,
        reason: rejectionReason || t("approvals.defaultRejectionReason"),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/dashboard">
            <Button 
              variant="outline" 
              size="sm" 
              className="mb-4 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60" 
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("approvals.backToDashboard")}
            </Button>
          </Link>
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">{t("approvals.title")}</h1>
          </div>
          <p className="text-muted-foreground">{t("approvals.loadingPending")}</p>
        </div>
      </div>
    );
  }

  const completions = Array.isArray(pendingCompletions) ? pendingCompletions : [];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard">
          <Button 
            variant="outline" 
            size="sm" 
            className="mb-4 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60" 
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("approvals.backToDashboard")}
          </Button>
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold">{t("approvals.title")}</h1>
          {completions.length > 0 && (
            <Badge className="ml-2" data-testid="badge-pending-count">
              {completions.length}
            </Badge>
          )}
        </div>

        {completions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{t("approvals.allCaughtUp")}</p>
              <p className="text-muted-foreground">{t("approvals.noPendingCompletions")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {completions.map((completion: any) => (
              <Card key={completion.id} data-testid={`card-completion-${completion.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={completion.memberAvatar} />
                        <AvatarFallback>{completion.memberName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-task-title-${completion.id}`}>
                          {completion.taskTitle}
                        </CardTitle>
                        <CardDescription>
                          {t("approvals.completedBy", { name: completion.memberName })} • {formatDistanceToNow(new Date(completion.completedAt))} {t("approvals.ago")}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {t("approvals.points", { count: completion.pointsEarned })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {completion.proofPhotoUrl && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">{t("approvals.photoProof")}</Label>
                      <div className="relative rounded-md overflow-hidden border">
                        <img
                          src={completion.proofPhotoUrl}
                          alt={t("approvals.photoProofAlt")}
                          className="w-full max-w-md object-cover"
                          data-testid={`img-proof-${completion.id}`}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(completion.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1"
                      data-testid={`button-approve-${completion.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t("approvals.approve")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRejectClick(completion)}
                      disabled={rejectMutation.isPending}
                      className="flex-1"
                      data-testid={`button-reject-${completion.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      {t("approvals.reject")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>{t("approvals.rejectDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("approvals.rejectDialogDesc", { name: selectedCompletion?.memberName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{t("approvals.reasonLabel")}</Label>
              <Textarea
                id="reason"
                placeholder={t("approvals.reasonPlaceholder")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} data-testid="button-cancel-reject">
              {t("approvals.cancel")}
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? t("approvals.rejecting") : t("approvals.rejectTask")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
