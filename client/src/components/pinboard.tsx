import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X, Pin } from "lucide-react";

interface PinboardNote {
  id: number;
  memberId: string;
  message: string;
  memberName: string;
  memberColor: string;
  memberAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PinboardProps {
  currentMemberId?: string | null;
}

const ROTATIONS = [-3.2, 1.6, -2.4, 0.8, -1.6, 2.8, -0.6, 2.2, -1.8, 0.4, -2.6, 1.0, 2.6, -0.4, -1.2, 3.0];

function hexToRgba(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(139, 92, 246, ${alpha})`;
  }
}

function needsLightText(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.48;
  } catch {
    return false;
  }
}

export function Pinboard({ currentMemberId }: PinboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");

  const { data: notes = [], isLoading } = useQuery<PinboardNote[]>({
    queryKey: ["/api/pinboard"],
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const myNotes = notes.filter((n) => n.memberId === currentMemberId);
  const canAdd = currentMemberId != null && myNotes.length < 2;

  const createMutation = useMutation({
    mutationFn: (message: string) => apiRequest("POST", "/api/pinboard", { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pinboard"] });
      setNewText("");
      setIsAdding(false);
    },
    onError: (error: any) => {
      const description = error.message === "acting_as_member"
        ? t("pinboard.actingAsError")
        : undefined;
      toast({ title: t("pinboard.error"), description, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
      apiRequest("PUT", `/api/pinboard/${id}`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pinboard"] });
      setEditingId(null);
      setEditText("");
    },
    onError: (error: any) => {
      const description = error.message === "acting_as_member"
        ? t("pinboard.actingAsError")
        : undefined;
      toast({ title: t("pinboard.error"), description, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pinboard/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pinboard"] }),
    onError: () => toast({ title: t("pinboard.error"), variant: "destructive" }),
  });

  const handleEdit = (note: PinboardNote) => {
    setEditingId(note.id);
    setEditText(note.message);
    setIsAdding(false);
  };

  const handleSaveEdit = () => {
    if (!editText.trim() || !editingId) return;
    updateMutation.mutate({ id: editingId, message: editText.trim() });
  };

  const handlePost = () => {
    if (!newText.trim()) return;
    createMutation.mutate(newText.trim());
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-border bg-card">
      {/* Header — only shown when add button is available */}
      {canAdd && !isAdding && editingId === null && (
        <div className="flex items-center justify-end px-3 py-2 bg-card border-b border-border">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsAdding(true)}
            data-testid="button-pinboard-add"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Board surface */}
      <div className="p-3 space-y-3 min-h-[80px] bg-card">
        {isLoading && (
          <p className="text-muted-foreground text-xs text-center py-2">{t("pinboard.loading")}</p>
        )}
        {!isLoading && notes.length === 0 && !isAdding && (
          <p className="text-muted-foreground/60 text-xs text-center py-3 italic">{t("pinboard.empty")}</p>
        )}

        {notes.map((note) => {
          const isOwn = note.memberId === currentMemberId;
          const isEditing = editingId === note.id;
          const rotation = ROTATIONS[note.id % ROTATIONS.length];
          const bgColor = hexToRgba(note.memberColor, 0.82);
          const lightText = needsLightText(note.memberColor);
          const textColor = lightText ? "#ffffff" : "#1a1a1a";
          const subColor = lightText ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.5)";

          return (
            <div
              key={note.id}
              className="relative rounded-sm shadow-md"
              style={{
                transform: `rotate(${rotation}deg)`,
                backgroundColor: bgColor,
                borderTop: `3px solid ${note.memberColor}`,
                padding: "10px 10px 8px",
              }}
            >
              {/* Pin dot */}
              <div
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow"
                style={{
                  backgroundColor: note.memberColor,
                  border: "2px solid rgba(255,255,255,0.6)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                }}
              />

              {/* Member header row */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <Avatar className="h-5 w-5 shrink-0">
                  {note.memberAvatarUrl ? <AvatarImage src={note.memberAvatarUrl} /> : null}
                  <AvatarFallback
                    style={{ backgroundColor: note.memberColor, color: lightText ? "#fff" : "#000", fontSize: "9px", fontWeight: 700 }}
                  >
                    {note.memberName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-semibold leading-none truncate flex-1" style={{ color: subColor }}>
                  {note.memberName}
                </span>
                {isOwn && !isEditing && (
                  <div className="flex gap-0.5 shrink-0">
                    <button
                      onClick={() => handleEdit(note)}
                      className="p-0.5 rounded transition-opacity opacity-50 hover:opacity-90"
                      style={{ color: textColor }}
                      data-testid={`button-pinboard-edit-${note.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(note.id)}
                      className="p-0.5 rounded transition-opacity opacity-50 hover:opacity-90"
                      style={{ color: textColor }}
                      data-testid={`button-pinboard-delete-${note.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Note content */}
              {isEditing ? (
                <div className="space-y-1.5">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value.slice(0, 150))}
                    className="w-full text-xs rounded px-2 py-1 resize-none bg-white/60 border-0 outline-none min-h-[56px]"
                    style={{ color: "#1a1a1a", fontFamily: "inherit" }}
                    autoFocus
                    data-testid="textarea-pinboard-edit"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: subColor }}>{editText.length}/150</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(null); setEditText(""); }}
                        className="p-0.5 transition-opacity opacity-50 hover:opacity-90"
                        style={{ color: textColor }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editText.trim() || updateMutation.isPending}
                        className="p-0.5 transition-opacity opacity-70 hover:opacity-100 disabled:opacity-30"
                        style={{ color: textColor }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p
                  className="text-[13px] leading-snug break-words"
                  style={{ color: textColor, fontFamily: "'Nunito', cursive" }}
                >
                  {note.message}
                </p>
              )}
            </div>
          );
        })}

        {/* New note input */}
        {isAdding && (
          <div
            className="relative rounded-sm shadow-md bg-card border border-border"
            style={{
              transform: `rotate(${ROTATIONS[(notes.length) % ROTATIONS.length]}deg)`,
              borderTop: "3px solid hsl(var(--primary))",
              padding: "10px 10px 8px",
            }}
          >
            <div
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow bg-primary"
              style={{ border: "2px solid rgba(255,255,255,0.6)", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
            />
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value.slice(0, 150))}
              placeholder={t("pinboard.placeholder")}
              className="w-full text-[13px] bg-transparent border-0 outline-none resize-none min-h-[56px] text-foreground placeholder:text-muted-foreground"
              style={{ fontFamily: "'Nunito', cursive" }}
              autoFocus
              data-testid="textarea-pinboard-new"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">{newText.length}/150</span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setIsAdding(false); setNewText(""); }}
                  className="p-0.5 text-muted-foreground opacity-50 hover:opacity-90 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handlePost}
                  disabled={!newText.trim() || createMutation.isPending}
                  className="p-0.5 text-foreground opacity-70 hover:opacity-100 disabled:opacity-30 transition-opacity"
                  data-testid="button-pinboard-post"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
