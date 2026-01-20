import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useSettings } from '@/contexts/SettingsContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function DeveloperSettings() {
  const navigate = useNavigate()
  const { data: config, isLoading } = api.config.getSettings.useQuery()
  const { preferredLLMTarget, setPreferredLLMTarget } = useSettings()

  useEffect(() => {
    if (!isLoading && !config?.devSettingsEnabled) {
      navigate('/')
    }
  }, [config, isLoading, navigate])

  if (isLoading) {
    return (
      <main className="container mx-auto p-8 pt-20">
        <div className="text-center py-12 text-cyan-medium">
          Loading...
        </div>
      </main>
    )
  }

  if (!config?.devSettingsEnabled) {
    return null
  }

  const allowedTargets = config.llm?.allowedTargets || []
  const currentTarget = preferredLLMTarget && allowedTargets.includes(preferredLLMTarget) 
    ? preferredLLMTarget 
    : allowedTargets[0] || 'lm-studio'

  return (
    <main className="container mx-auto p-8 pt-20">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Developer Settings</h1>
        <p className="text-cyan-medium">
          Advanced settings and tools for development
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>LLM Configuration</CardTitle>
            <CardDescription>
              Configure how the application interacts with Language Models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Preferred LLM Target</label>
              <div className="w-[300px]">
                <Select
                  value={currentTarget}
                  onValueChange={setPreferredLLMTarget}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a target" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTargets.map((target) => (
                      <SelectItem key={target} value={target}>
                        {target === 'lm-studio' ? 'LM Studio' : 
                         target === 'vertex' ? 'Google Vertex AI' : 
                         target === 'openai' ? 'OpenAI' :
                         target === 'anthropic' ? 'Anthropic' : target}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-cyan-medium">
                Select which service to use for text transformations and variations.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Development Tools</CardTitle>
            <CardDescription>
              This page contains developer-only settings and utilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-cyan-medium">
              Developer settings are currently enabled via the DEV_SETTINGS environment variable.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
