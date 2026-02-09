## Google

Docs:

- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/GenerationConfig#ThinkingConfig
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking#budget

Fields:

- `includeThoughts`: boolean
- `thinkingBudget`: integer, token budget for the request
- `thinkingLevel`: enum, `MINIMAL/LOW/MEDIUM/HIGH`, also `THINKING_LEVEL_UNSPECIFIED`, which I assume is 0

Other notes:

- `MINIMAL` and `MEDIUM` are Gemini 3 Flash only
- Thinking cannot be turned off for Gemini 3 Pro
- I _think_ for Gemini 2.5 and ealier, only `thinkingBudget` is supported

## OpenAI

Docs:

- https://platform.openai.com/docs/api-reference/chat/create

Fields:

- `reasoning_effort`: string, currently supported values are `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`

Other notes:

- gpt-5.1 defaults to none, which does not perform reasoning. The supported reasoning values for gpt-5.1 are none, low, medium, and high.
- All models before gpt-5.1 default to medium reasoning effort, and do not support none.
- The gpt-5-pro model defaults to (and only supports) high reasoning effort.
- xhigh is supported for all models after gpt-5.1-codex-max.

## Anthropic

Docs:

- https://platform.claude.com/docs/en/api/messages/create

Fields:

- `thinking`: object of the shape `{ type, budget }`, where `type` can be `enabled`, `disabled` or `adaptive` and `budget` is a max tokens integer

Other notes:

- When enabled, responses include thinking content blocks showing Claude's thinking process before the final answer. Might have to filter the thinking blocks out.
- `budget` minimum is 1024

## Grok

Docs:

- https://docs.x.ai/developers/api-reference#chat-completions

Fields:

- `reasoning_effort`: string, values are `low` and `high`

Other notes:

- `reasoning_effort` not supported by grok-4 and will result in error if used with grok-4
- Other docs say "Only grok-3-mini supports reasoning_effort," so vanilla grok-3 might not...?
