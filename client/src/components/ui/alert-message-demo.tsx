import { Button } from "@/components/ui/button"
import { ConfirmationAlert, DeleteConfirmation, RemoveConfirmation } from "@/components/ui/confirmation-alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, UserX, FileX, AlertTriangle, Info, CheckCircle, Download, Edit, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AlertMessageDemo() {
  const { toast } = useToast()

  const showToast = (title: string, description: string) => {
    toast({ title, description })
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Alert Message Components</h2>
        <p className="text-muted-foreground">
          Styled confirmation dialogs for delete operations and other important actions
        </p>
      </div>

      {/* Quick Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Examples</CardTitle>
          <CardDescription>Common use cases with pre-configured components</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Delete Photo */}
          <DeleteConfirmation
            itemName="Wedding Photo #123"
            itemType="photo"
            onConfirm={() => showToast("Photo Deleted", "The photo has been permanently removed.")}
            trigger={
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Photo
              </Button>
            }
          />

          {/* Remove from Saved */}
          <RemoveConfirmation
            itemName="Favorite Image"
            action="unsave"
            onConfirm={() => showToast("Photo Unsaved", "The photo has been removed from your saved collection.")}
            trigger={
              <Button variant="outline" size="sm" className="w-full">
                <FileX className="h-4 w-4 mr-2" />
                Unsave Photo
              </Button>
            }
          />

          {/* Delete Event */}
          <DeleteConfirmation
            itemName="Summer Wedding 2025"
            itemType="event"
            onConfirm={() => showToast("Event Deleted", "The event and all its photos have been removed.")}
            trigger={
              <Button variant="ghost" size="sm" className="w-full text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Event
              </Button>
            }
          />
        </CardContent>
      </Card>

      {/* Different Variants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Different Alert Variants</CardTitle>
          <CardDescription>Various styles for different types of actions</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Destructive - Permanent Actions */}
          <div className="space-y-3">
            <h4 className="font-medium text-red-600">Destructive Actions</h4>
            <div className="space-y-2">
              <ConfirmationAlert
                title="Delete User Account"
                description="This will permanently delete the user account and all associated data. This action cannot be undone."
                confirmText="Delete Account"
                variant="destructive"
                onConfirm={() => showToast("Account Deleted", "User account has been permanently removed.")}
                trigger={
                  <Button variant="destructive" size="sm" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                }
              />
              
              <ConfirmationAlert
                title="Clear All Photos"
                description="This will remove all photos from this event. Are you sure?"
                confirmText="Clear All"
                variant="destructive"
                onConfirm={() => showToast("Photos Cleared", "All photos have been removed from the event.")}
                trigger={
                  <Button variant="outline" size="sm" className="w-full text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Photos
                  </Button>
                }
              />
            </div>
          </div>

          {/* Warning - Reversible Actions */}
          <div className="space-y-3">
            <h4 className="font-medium text-amber-600">Warning Actions</h4>
            <div className="space-y-2">
              <ConfirmationAlert
                title="Overwrite Event Settings"
                description="This will replace the current event settings. You can change them back later."
                confirmText="Overwrite"
                variant="warning"
                onConfirm={() => showToast("Settings Updated", "Event settings have been overwritten.")}
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Overwrite Settings
                  </Button>
                }
              />
              
              <RemoveConfirmation
                itemName="Premium Package"
                action="downgrade"
                onConfirm={() => showToast("Package Downgraded", "Your package has been changed.")}
                trigger={
                  <Button variant="secondary" size="sm" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Downgrade Package
                  </Button>
                }
              />
            </div>
          </div>

          {/* Info - Informational Actions */}
          <div className="space-y-3">
            <h4 className="font-medium text-blue-600">Informational Actions</h4>
            <div className="space-y-2">
              <ConfirmationAlert
                title="Send Email Notification"
                description="This will send a notification email to all event participants."
                confirmText="Send Email"
                variant="info"
                onConfirm={() => showToast("Email Sent", "Notification has been sent to all participants.")}
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Info className="h-4 w-4 mr-2" />
                    Send Notification
                  </Button>
                }
              />
              
              <ConfirmationAlert
                title="Download Event Report"
                description="This will generate and download a detailed report of the event."
                confirmText="Download"
                variant="info"
                showIcon={false}
                onConfirm={() => showToast("Report Downloaded", "Event report has been downloaded.")}
                trigger={
                  <Button variant="secondary" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </Button>
                }
              />
            </div>
          </div>

          {/* Success - Positive Actions */}
          <div className="space-y-3">
            <h4 className="font-medium text-green-600">Success Actions</h4>
            <div className="space-y-2">
              <ConfirmationAlert
                title="Publish Event Gallery"
                description="This will make the event gallery visible to all participants."
                confirmText="Publish"
                variant="success"
                onConfirm={() => showToast("Gallery Published", "The event gallery is now live and visible to participants.")}
                trigger={
                  <Button className="w-full" size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Publish Gallery
                  </Button>
                }
              />
              
              <ConfirmationAlert
                title="Create New Event"
                description="This will create a new event with the current settings."
                confirmText="Create Event"
                variant="success"
                onConfirm={() => showToast("Event Created", "Your new event has been successfully created.")}
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Use</CardTitle>
          <CardDescription>Implementation examples for common scenarios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Basic Delete Confirmation</h4>
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-sm font-mono">
                <pre className="text-xs overflow-x-auto">{`<DeleteConfirmation
  itemName="Photo Name"
  itemType="photo"
  onConfirm={() => handleDelete()}
  trigger={
    <Button variant="destructive">
      Delete Photo
    </Button>
  }
/>`}</pre>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Custom Confirmation Alert</h4>
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-sm font-mono">
                <pre className="text-xs overflow-x-auto">{`<ConfirmationAlert
  title="Custom Action"
  description="Custom description"
  confirmText="Confirm"
  variant="warning"
  onConfirm={() => handleAction()}
  trigger={<Button>Action</Button>}
/>`}</pre>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Available Variants</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">destructive</code> - Red theme for permanent deletion actions</li>
              <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">warning</code> - Amber theme for reversible warning actions</li>
              <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">info</code> - Blue theme for informational actions</li>
              <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">success</code> - Green theme for positive actions</li>
              <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">default</code> - Standard theme for general confirmations</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}