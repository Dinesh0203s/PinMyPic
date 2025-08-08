import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle, Info, CheckCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmationAlertProps {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive" | "warning" | "info" | "success"
  onConfirm: () => void
  onCancel?: () => void
  trigger: React.ReactNode
  disabled?: boolean
  showIcon?: boolean
}

const variantConfig = {
  default: {
    icon: Info,
    titleClass: "text-gray-100",
    descriptionClass: "text-gray-300",
    iconClass: "text-gray-300",
  },
  destructive: {
    icon: Trash2,
    titleClass: "text-red-300",
    descriptionClass: "text-red-200",
    iconClass: "text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    titleClass: "text-amber-300",
    descriptionClass: "text-amber-200",
    iconClass: "text-amber-400",
  },
  info: {
    icon: Info,
    titleClass: "text-cyan-300",
    descriptionClass: "text-cyan-200",
    iconClass: "text-cyan-400",
  },
  success: {
    icon: CheckCircle,
    titleClass: "text-green-300",
    descriptionClass: "text-green-200",
    iconClass: "text-green-400",
  },
}

export function ConfirmationAlert({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  trigger,
  disabled = false,
  showIcon = true,
}: ConfirmationAlertProps) {
  const [open, setOpen] = React.useState(false)
  const config = variantConfig[variant]
  const IconComponent = config.icon

  const handleConfirm = () => {
    onConfirm()
    setOpen(false)
  }

  const handleCancel = () => {
    onCancel?.()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {showIcon && (
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border",
                variant === "destructive" && "bg-red-950/30 border-red-700/50",
                variant === "warning" && "bg-amber-950/30 border-amber-700/50",
                variant === "info" && "bg-cyan-950/30 border-cyan-700/50",
                variant === "success" && "bg-green-950/30 border-green-700/50",
                variant === "default" && "bg-gray-800/50 border-gray-600/50"
              )}>
                <IconComponent className={cn("h-5 w-5", config.iconClass)} />
              </div>
            )}
            <AlertDialogTitle className={cn("text-left text-gray-100", config.titleClass)}>
              {title}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className={cn("text-left mt-2 text-gray-300", config.descriptionClass)}>
          {description}
        </AlertDialogDescription>
        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          <AlertDialogCancel 
            onClick={handleCancel} 
            className="sm:w-auto bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              "sm:w-auto text-white font-medium",
              variant === "destructive" && "bg-red-600 hover:bg-red-700 border-red-500",
              variant === "warning" && "bg-amber-600 hover:bg-amber-700 border-amber-500",
              variant === "info" && "bg-cyan-600 hover:bg-cyan-700 border-cyan-500",
              variant === "success" && "bg-green-600 hover:bg-green-700 border-green-500",
              variant === "default" && "bg-gray-600 hover:bg-gray-700 border-gray-500"
            )}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Convenience components for common use cases
interface DeleteConfirmationProps {
  itemName: string
  itemType?: string
  onConfirm: () => void
  onCancel?: () => void
  trigger: React.ReactNode
  disabled?: boolean
}

export function DeleteConfirmation({
  itemName,
  itemType = "item",
  onConfirm,
  onCancel,
  trigger,
  disabled = false,
}: DeleteConfirmationProps) {
  return (
    <ConfirmationAlert
      title={`Delete ${itemType}`}
      description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
      trigger={trigger}
      disabled={disabled}
    />
  )
}

interface RemoveConfirmationProps {
  itemName: string
  action?: string
  onConfirm: () => void
  onCancel?: () => void
  trigger: React.ReactNode
  disabled?: boolean
}

export function RemoveConfirmation({
  itemName,
  action = "remove",
  onConfirm,
  onCancel,
  trigger,
  disabled = false,
}: RemoveConfirmationProps) {
  return (
    <ConfirmationAlert
      title={`${action.charAt(0).toUpperCase() + action.slice(1)} item`}
      description={`Are you sure you want to ${action} "${itemName}"?`}
      confirmText={action.charAt(0).toUpperCase() + action.slice(1)}
      cancelText="Cancel"
      variant="warning"
      onConfirm={onConfirm}
      onCancel={onCancel}
      trigger={trigger}
      disabled={disabled}
    />
  )
}