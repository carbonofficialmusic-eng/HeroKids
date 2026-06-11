import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, XCircle, Clock, Star, ArrowLeft, Gift, Coins, Pencil, CheckSquare } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { Locale } from "date-fns";
import { de, enUS, fr, es, ja, zhCN, ko, sv } from "date-fns/locale";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

const dateFnsLocales: Record<string, Locale> = {
  de, en: enUS, fr, es, ja, zh: zhCN, ko, sv
};

export default function Approvals() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedCompletion, setSelectedCompletion] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Edit reward request state
  const [editRewardDialogOpen, setEditRewardDialogOpen] = useState(false);
  const [editingRewardRequest, setEditingRewardRequest] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPoints, setEditPoints] = useState("");

  const { data: pendingCompletions, isLoading } = useQuery({
    queryKey: ["/api/tasks/completions/pending"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: rewardRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/reward-requests"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/family-members"],
    staleTime: 5 * 60 * 1000,
  });

  const pendingRewardRequests = rewardRequests.filter((r: any) => r.status === "pending");

  const approveRewardRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest("PATCH", `/api/reward-requests/${requestId}/approve`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: t("approvals.rewardRequestApproved"),
        description: t("approvals.rewardRequestApprovedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineRewardRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest("PATCH", `/api/reward-requests/${requestId}/decline`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      toast({
        title: t("approvals.rewardRequestDeclined"),
        description: t("approvals.rewardRequestDeclinedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRewardRequestMutation = useMutation({
    mutationFn: async ({ requestId, title, description, pointThreshold }: { requestId: string; title: string; description: string; pointThreshold: number }) => {
      const res = await apiRequest("PATCH", `/api/reward-requests/${requestId}`, { title, description, pointThreshold });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      setEditRewardDialogOpen(false);
      setEditingRewardRequest(null);
      toast({
        title: t("approvals.rewardRequestUpdated"),
        description: t("approvals.rewardRequestUpdatedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditRewardRequest = (request: any) => {
    setEditingRewardRequest(request);
    setEditTitle(request.title);
    setEditDescription(request.description || "");
    setEditPoints(String(request.pointThreshold));
    setEditRewardDialogOpen(true);
  };

  const handleSaveRewardRequest = () => {
    if (editingRewardRequest && editTitle.trim() && editPoints) {
      updateRewardRequestMutation.mutate({
        requestId: editingRewardRequest.id,
        title: editTitle.trim(),
        description: editDescription.trim(),
        pointThreshold: parseInt(editPoints, 10),
      });
    }
  };

  const approveMutation = useMutation({
    mutationFn: async (completionId: string) => {
      const res = await apiRequest("POST", `/api/tasks/completions/${completionId}/approve`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
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

  // Bulk selection helpers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || isBulkApproving) return;
    setIsBulkApproving(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    await Promise.all(
      ids.map(async (id) => {
        try {
          await apiRequest("POST", `/api/tasks/completions/${id}/approve`, {});
          successCount++;
        } catch {
          failCount++;
        }
      })
    );

    queryClient.invalidateQueries({ queryKey: ["/api/tasks/completions/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/pending-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

    setSelectedIds(new Set());
    setIsBulkApproving(false);

    if (failCount === 0) {
      toast({
        title: t("approvals.bulkApproveSuccess", { count: successCount, defaultValue: `${successCount} Aufgaben genehmigt` }),
      });
    } else {
      toast({
        title: t("approvals.bulkApprovePartial", { success: successCount, failed: failCount, defaultValue: `${successCount} genehmigt, ${failCount} fehlgeschlagen` }),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
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
  const allSelected = completions.length > 0 && completions.every((c: any) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(completions.map((c: any) => c.id)));
    }
  };

  const isBusy = approveMutation.isPending || rejectMutation.isPending || isBulkApproving;

  return (
    <div className="min-h-screen p-6 pb-32" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
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
          {(completions.length + pendingRewardRequests.length) > 0 && (
            <Badge className="ml-2" data-testid="badge-pending-count">
              {completions.length + pendingRewardRequests.length}
            </Badge>
          )}
        </div>

        {/* Pending Reward Requests Section */}
        {pendingRewardRequests.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">{t("approvals.rewardRequests")}</h2>
              <Badge className="ml-2" data-testid="badge-reward-requests-count">
                {pendingRewardRequests.length}
              </Badge>
            </div>
            <div className="space-y-4">
              {pendingRewardRequests.map((request: any) => {
                const requester = request.requester;
                return (
                  <Card key={request.id} data-testid={`card-reward-request-${request.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback style={{ backgroundColor: requester?.color }} className="text-white">
                              {requester?.displayName?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-reward-title-${request.id}`}>
                              {request.title}
                            </CardTitle>
                            <CardDescription>
                              {t("approvals.requestedBy", { name: requester?.displayName || t("common.unknown") })} • {formatDistanceToNow(new Date(request.createdAt), { locale: dateFnsLocales[i18n.language] || enUS, addSuffix: true })}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {request.pointThreshold} {t("common.points")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {request.description && (
                        <p className="text-muted-foreground mb-4">{request.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleEditRewardRequest(request)}
                          data-testid={`button-edit-reward-${request.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          onClick={() => approveRewardRequestMutation.mutate(request.id)}
                          disabled={approveRewardRequestMutation.isPending}
                          data-testid={`button-approve-reward-${request.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {t("approvals.approveReward")}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => declineRewardRequestMutation.mutate(request.id)}
                          disabled={declineRewardRequestMutation.isPending}
                          data-testid={`button-decline-reward-${request.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {t("approvals.declineReward")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Task Completions Section */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t("approvals.taskCompletions")}</h2>
          {completions.length > 0 && (
            <Badge className="ml-2" data-testid="badge-task-completions-count">
              {completions.length}
            </Badge>
          )}
          {completions.length > 1 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSelectAll}
              className="ml-auto font-medium"
              data-testid="button-select-all"
            >
              <Checkbox
                checked={allSelected}
                className="mr-2 pointer-events-none"
                aria-hidden
              />
              {allSelected
                ? t("approvals.deselectAll", { defaultValue: "Alle abwählen" })
                : t("approvals.selectAll", { defaultValue: "Alle auswählen" })}
            </Button>
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
            {completions.map((completion: any) => {
              const isSelected = selectedIds.has(completion.id);
              return (
                <Card
                  key={completion.id}
                  data-testid={`card-completion-${completion.id}`}
                  className={isSelected ? "ring-2 ring-primary" : ""}
                  onClick={() => toggleSelection(completion.id)}
                  style={{ cursor: "pointer" }}
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(completion.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 shrink-0"
                        data-testid={`checkbox-completion-${completion.id}`}
                      />
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={completion.memberAvatar} />
                        <AvatarFallback>{completion.memberName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-task-title-${completion.id}`}>
                              {completion.taskTitle}
                            </CardTitle>
                            <CardDescription>
                              {t("approvals.completedBy", { name: completion.memberName })} • {formatDistanceToNow(new Date(completion.completedAt), { locale: dateFnsLocales[i18n.language] || enUS, addSuffix: true })}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3" />
                            {t("approvals.points", { count: completion.pointsEarned })}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
                        disabled={isBusy}
                        className="flex-1"
                        data-testid={`button-approve-${completion.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {t("approvals.approve")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRejectClick(completion)}
                        disabled={isBusy}
                        className="flex-1"
                        data-testid={`button-reject-${completion.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {t("approvals.reject")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bulk Action Bar */}
      {someSelected && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 p-4 border-t bg-background/95 backdrop-blur-sm"
          data-testid="bulk-action-bar"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              {t("approvals.selectedCount", { count: selectedIds.size, defaultValue: `${selectedIds.size} ausgewählt` })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                disabled={isBulkApproving}
                data-testid="button-clear-selection"
              >
                {t("approvals.clearSelection", { defaultValue: "Auswahl aufheben" })}
              </Button>
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                data-testid="button-bulk-approve"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {isBulkApproving
                  ? t("approvals.approving", { defaultValue: "Wird genehmigt…" })
                  : t("approvals.bulkApprove", { count: selectedIds.size, defaultValue: `${selectedIds.size} genehmigen` })}
              </Button>
            </div>
          </div>
        </div>
      )}

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

      {/* Edit Reward Request Dialog */}
      <Dialog open={editRewardDialogOpen} onOpenChange={setEditRewardDialogOpen}>
        <DialogContent data-testid="dialog-edit-reward">
          <DialogHeader>
            <DialogTitle>{t("approvals.editRewardRequest")}</DialogTitle>
            <DialogDescription>
              {t("approvals.editRewardRequestDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{t("rewards.title")}</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="input-edit-reward-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("rewards.description")}</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                data-testid="input-edit-reward-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-points">{t("rewards.pointThreshold")}</Label>
              <Input
                id="edit-points"
                type="number"
                min="1"
                value={editPoints}
                onChange={(e) => setEditPoints(e.target.value)}
                data-testid="input-edit-reward-points"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRewardDialogOpen(false)} data-testid="button-cancel-edit-reward">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveRewardRequest}
              disabled={updateRewardRequestMutation.isPending || !editTitle.trim() || !editPoints}
              data-testid="button-save-edit-reward"
            >
              {updateRewardRequestMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
