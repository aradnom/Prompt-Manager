export const PREDEFINED_MODELS = {
  vertex: {
    'gemini-3-flash-preview': 'Gemini 3 Flash (Preview)',
    'gemini-3-pro-preview': 'Gemini 3 Pro (Preview)',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  },
  openai: {
    'gpt-5.2': 'GPT 5.2',
    'gpt-5-mini': 'GPT 5 Mini',
    'gpt-5-nano': 'GPT 5 Nano',
    'gpt-4.1': 'GPT 4.1',
  },
  anthropic: {
    'claude-haiku-4-5': 'Claude 4.5 Haiku',
    'claude-sonnet-4-5': 'Claude 4.5 Sonnet',
    'claude-opus-4-5': 'Claude 4.5 Opus',
    'claude-sonnet-4-0': 'Claude 4 Sonnet',
    'claude-opus-4-1': 'Claude 4.1 Opus',
  },
  grok: {
    'grok-4-1-fast-non-reasoning': 'Grok 4.1 Fast Non-Reasoning',
    'grok-4-1-fast-reasoning': 'Grok 4.1 Fast',
    'grok-4-fast-non-reasoning': 'Grok 4 Fast Non-Reasoning',
    'grok-4-fast-reasoning': 'Grok 4 Fast',
    'grok-3-mini': 'Grok 3 Mini',
    'grok-3': 'Grok 3'
  }
} as const
