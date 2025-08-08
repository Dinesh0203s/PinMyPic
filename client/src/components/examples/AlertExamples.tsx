import { Button } from "@/components/ui/button"
import { ConfirmationAlert, DeleteConfirmation, RemoveConfirmation } from "@/components/ui/confirmation-alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, UserX, FileX, AlertTriangle, Info, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function AlertExamples() {
  const { toast } = useToast()

  const handleDelete = () => {
    toast({
      title: "Item deleted",
      description: "The item has been successfully deleted.",
    })
  }

  const handleRemove = () => {
    toast({
      title: "Item removed",
      description: "The item has been successfully removed.",
    })
  }

  const handleGenericAction = (action: string) => {
    toast({
      title: `Action completed`,
      description: `${action} action has been performed successfully.`,
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Alert Message Components</h1>
        <p className="text-muted-foreground mb-8">
          Interactive examples of confirmation alerts for various actions like delete, remove, and other operations.
        </p>
        
        {/* Delete Confirmations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Confirmations
            </CardTitle>
            <CardDescription>
              Use these for permanent deletion actions that cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <DeleteConfirmation
                itemName="User Profile"
                itemType="profile"
                onConfirm={handleDelete}
                trigger={
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Profile
                  </Button>
                }
              />
              
              <DeleteConfirmation
                itemName="Photo Album"
                itemType="album"
                onConfirm={handleDelete}
                trigger={
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Album
                  </Button>
                }
              />
              
              <DeleteConfirmation
                itemName="Wedding Event #123"
                itemType="event"
                onConfirm={handleDelete}
                trigger={
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Event
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Remove Confirmations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-amber-500" />
              Remove/Unsave Confirmations
            </CardTitle>
            <CardDescription>
              Use these for reversible actions like removing from lists or unsaving items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <RemoveConfirmation
                itemName="John Doe"
                action="remove"
                onConfirm={handleRemove}
                trigger={
                  <Button variant="outline" size="sm">
                    <UserX className="h-4 w-4 mr-2" />
                    Remove User
                  </Button>
                }
              />
              
              <RemoveConfirmation
                itemName="Saved Photo #45"
                action="unsave"
                onConfirm={handleRemove}
                trigger={
                  <Button variant="ghost" size="sm">
                    <FileX className="h-4 w-4 mr-2" />
                    Unsave Photo
                  </Button>
                }
              />
              
              <RemoveConfirmation
                itemName="Guest from Wedding List"
                action="exclude"
                onConfirm={handleRemove}
                trigger={
                  <Button variant="secondary" size="sm">
                    <UserX className="h-4 w-4 mr-2" />
                    Exclude Guest
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Custom Confirmation Variants */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Custom Confirmation Variants</CardTitle>
            <CardDescription>
              Examples of different alert variants for various types of actions and messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Destructive */}
              <ConfirmationAlert
                title="Permanently Delete Account"
                description="This will permanently delete your account and all associated data. This action cannot be reversed."
                confirmText="Delete Account"
                variant="destructive"
                onConfirm={() => handleGenericAction("Delete account")}
                trigger={
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                }
              />

              {/* Warning */}
              <ConfirmationAlert
                title="Overwrite Existing Data"
                description="This action will overwrite existing data. Do you want to continue?"
                confirmText="Overwrite"
                variant="warning"
                onConfirm={() => handleGenericAction("Overwrite data")}
                trigger={
                  <Button variant="outline" className="w-full">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Overwrite Data
                  </Button>
                }
              />

              {/* Info */}
              <ConfirmationAlert
                title="Send Notification"
                description="This will send a notification email to all users. Are you sure?"
                confirmText="Send Email"
                variant="info"
                onConfirm={() => handleGenericAction("Send notification")}
                trigger={
                  <Button variant="secondary" className="w-full">
                    <Info className="h-4 w-4 mr-2" />
                    Send Notification
                  </Button>
                }
              />

              {/* Success */}
              <ConfirmationAlert
                title="Publish Event"
                description="This will make the event visible to all users. Ready to publish?"
                confirmText="Publish"
                variant="success"
                onConfirm={() => handleGenericAction("Publish event")}
                trigger={
                  <Button className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Publish Event
                  </Button>
                }
              />

              {/* Default */}
              <ConfirmationAlert
                title="Save Changes"
                description="Do you want to save the changes you made?"
                confirmText="Save"
                variant="default"
                onConfirm={() => handleGenericAction("Save changes")}
                trigger={
                  <Button variant="outline" className="w-full">
                    Save Changes
                  </Button>
                }
              />

              {/* Custom without icon */}
              <ConfirmationAlert
                title="Download Report"
                description="This will generate and download a detailed report. Continue?"
                confirmText="Download"
                variant="info"
                showIcon={false}
                onConfirm={() => handleGenericAction("Download report")}
                trigger={
                  <Button variant="ghost" className="w-full">
                    Download Report
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Examples</CardTitle>
            <CardDescription>
              Copy and paste these code examples to use the confirmation alerts in your components.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
              <h4 className="font-semibold mb-2">Basic Delete Confirmation:</h4>
              <pre className="text-xs overflow-x-auto">{`<DeleteConfirmation
  itemName="User Account"
  itemType="account"
  onConfirm={() => deleteAccount()}
  trigger={
    <Button variant="destructive">
      <Trash2 className="h-4 w-4 mr-2" />
      Delete Account
    </Button>
  }
/>`}</pre>
            </div>

            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
              <h4 className="font-semibold mb-2">Custom Confirmation Alert:</h4>
              <pre className="text-xs overflow-x-auto">{`<ConfirmationAlert
  title="Publish Event"
  description="This will make the event visible to all users."
  confirmText="Publish"
  variant="success"
  onConfirm={() => publishEvent()}
  trigger={
    <Button>Publish Event</Button>
  }
/>`}</pre>
            </div>

            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
              <h4 className="font-semibold mb-2">Remove with Custom Action:</h4>
              <pre className="text-xs overflow-x-auto">{`<RemoveConfirmation
  itemName="Saved Photo"
  action="unsave"
  onConfirm={() => unsavePhoto()}
  trigger={
    <Button variant="ghost">Unsave Photo</Button>
  }
/>`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AlertExamples