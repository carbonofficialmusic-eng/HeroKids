import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const TOAST_DURATION = 3500

function ToastIcon({ variant }: { variant?: string }) {
  if (variant === "destructive") {
    return <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
  }
  if (variant === "success") {
    return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
  }
  return <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} duration={TOAST_DURATION} {...props}>
            <ToastIcon variant={variant} />
            <div className="grid gap-0.5 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
