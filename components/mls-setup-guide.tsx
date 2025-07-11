import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface MLSSetupGuideProps {
  show: boolean
}

export function MLSSetupGuide({ show }: MLSSetupGuideProps) {
  if (!show) return null

  const providers = [
    {
      name: "Bridge API",
      status: !!process.env.BRIDGE_API_TOKEN,
      description: "Primary MLS data provider with nationwide coverage",
      setup: "Add BRIDGE_API_TOKEN to your environment variables",
    },
    {
      name: "RETS",
      status: !!(process.env.RETS_LOGIN_URL && process.env.RETS_USERNAME),
      description: "Fallback MLS provider for regional data",
      setup: "Add RETS_LOGIN_URL, RETS_USERNAME, and RETS_PASSWORD",
    },
    {
      name: "Fal AI",
      status: !!process.env.FAL_KEY,
      description: "AI video and voiceover generation",
      setup: "FAL_KEY is already configured in v0",
    },
  ]

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          MLS Integration Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.name} className="flex items-start gap-3">
            {provider.status ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{provider.name}</p>
              <p className="text-sm text-gray-600">{provider.description}</p>
              {!provider.status && <p className="text-xs text-red-600 mt-1">{provider.setup}</p>}
            </div>
          </div>
        ))}

        <Alert>
          <AlertDescription>
            To use real MLS data, you'll need to sign up for Bridge API at{" "}
            <a href="https://bridgedataoutput.com" className="underline" target="_blank" rel="noopener noreferrer">
              bridgedataoutput.com
            </a>{" "}
            and add your API token to the environment variables.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
