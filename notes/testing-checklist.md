# Feature Testing Checklist

Organized by area, prioritized by impact within each area (high-impact first).

---

## Authentication & Account

- [ ] Create a new account (get token, copy it, dismiss modal)
- [ ] Log in with an existing token
- [ ] Log out
- [ ] Copy Account ID from Account page

---

## Prompts (Core Workflow)

- [ ] Create a new prompt (from Home onboarding or Prompts page)
- [ ] Set a prompt as active (from Prompts list)
- [ ] Switch active prompt via PromptSwitcher dropdown
- [ ] Close active prompt
- [ ] Add an existing block to a prompt (BlockSearchDialog)
- [ ] Add a new block inline to a prompt
- [ ] Remove a block from a prompt
- [ ] Reorder blocks via drag-and-drop
- [ ] Copy prompt output to clipboard
- [ ] Toggle Comma Separated on prompt output (checkbox in output bar)
- [ ] Randomize wildcards (output bar button)
- [ ] Convert to Block (collapses rendered output into a single new block+prompt)
- [ ] Select multiple blocks and remove them (select mode)
- [ ] Select multiple blocks and merge them (select mode, 2+ blocks)
- [ ] Create a snapshot from StackEditor
- [ ] View snapshots overlay from StackEditor
- [ ] View prompt revision history from StackEditor
- [ ] Restore a prompt revision
- [ ] Create a template from StackEditor
- [ ] Rename a prompt inline (click title on Prompts list)
- [ ] Duplicate a prompt
- [ ] Delete a prompt
- [ ] Edit prompt settings (name, display ID, comma separated, negative, output style, folder, notes)
- [ ] Prompt output minimize/maximize toggle

---

## Prompts: LLM Features

- [ ] Generate a new block (concept input, star pattern results, select one)
- [ ] Regenerate block suggestions (center button)
- [ ] Edit concept text inline (click center concept)
- [ ] Enrich prompt (adds AI-generated enrichment block)

---

## Blocks

- [ ] Create a new block (from Blocks page)
- [ ] Edit a block's text (inline click-to-edit in TextBlock)
- [ ] Edit a block via full form (double-click header or Edit Block button)
- [ ] Delete a block
- [ ] Copy block text to clipboard
- [ ] Rename a block inline (click name in active state)
- [ ] Insert a wildcard into block text (WildcardBrowser)
- [ ] View block revision history (clock icon)
- [ ] Restore a block revision
- [ ] Duplicate a block (from StackEditor context)
- [ ] Disable/enable a block in a prompt (eye icon)
- [ ] Click a type badge to browse blocks of that type
- [ ] Click a label to browse blocks with that label
- [ ] Search blocks by name, display ID, or text content
- [ ] Paginate through blocks
- [ ] Edit block settings (name, display ID, labels, type, folder, notes)

---

## Blocks: LLM Features

- [ ] More Descriptive transform
- [ ] Less Descriptive transform
- [ ] Variation: Slightly Different
- [ ] Variation: Fairly Different
- [ ] Variation: Very Different
- [ ] Explore Variations (star pattern, select one)
- [ ] Generate a new block from Blocks page (same GenerateBlockDialog)

---

## Text Selection & Modifiers

- [ ] Select text in a block to trigger TextSelectionMenu
- [ ] Emphasize selected text (adds parentheses)
- [ ] Deemphasize selected text (adds brackets)
- [ ] Adjust weight up/down on emphasized/deemphasized text
- [ ] Clear modifiers from selected text
- [ ] Escape key closes TextSelectionMenu

---

## Wildcards

- [ ] Create a new wildcard (manual form)
- [ ] Edit a wildcard
- [ ] Delete a wildcard
- [ ] Rename a wildcard inline (click name)
- [ ] Change wildcard format (JSON / YAML / Lines / Plain Text)
- [ ] Validate wildcard content on save (format-specific validation)
- [ ] Search wildcards
- [ ] Paginate through wildcards

---

## Wildcards: LLM Feature

- [ ] Generate a new wildcard (concept input, parallel LLM calls, review form, create)

---

## Snapshots

- [ ] Browse all snapshots on Snapshots page
- [ ] Rename a snapshot inline
- [ ] Copy snapshot content to clipboard
- [ ] Edit snapshot notes
- [ ] Delete a snapshot
- [ ] Search snapshots
- [ ] Paginate through snapshots

---

## Templates

- [ ] Browse templates on Templates page
- [ ] Use a template (creates a new prompt from it, sets active)
- [ ] Edit a template (name, comma separated, negative, output style)
- [ ] Add an existing block to a template
- [ ] Remove a block from a template
- [ ] Reorder blocks in a template (drag-and-drop)
- [ ] Rename a template inline
- [ ] Edit template notes
- [ ] Delete a template
- [ ] Search templates
- [ ] Paginate through templates

---

## Folders (Prompts & Blocks)

- [ ] Create a new prompt folder
- [ ] Create a new block folder
- [ ] Expand/collapse a folder
- [ ] Rename a folder inline
- [ ] Delete a folder (blocks/prompts inside are preserved)
- [ ] Move a prompt to a folder (via prompt settings)
- [ ] Move a block to a folder (via block form)

---

## LLM Settings (Account Page)

- [ ] Configure and test LLM functionality with Anthropic
- [ ] Configure and test LLM functionality with OpenAI
- [ ] Configure and test LLM functionality with Google Vertex
- [ ] Configure and test LLM functionality with Grok
- [ ] Configure and test LLM functionality with LM Studio
- [ ] Set active LLM platform via radio button
- [ ] Verify "Current LLM Settings" display updates after saving
- [ ] Verify LLM-gated buttons enable after configuring a platform
- [ ] Verify LLM-gated buttons show tooltip when no platform configured
- [ ] Verify tooltip link scrolls to LLM Settings section on Account page
- [ ] Toggle Thinking on/off
- [ ] Change Thinking level (Low / Medium / High)

---

## ComfyUI Integration (Account Page)

- [ ] Generate a ComfyUI API key
- [ ] Copy the generated key
- [ ] Regenerate an existing key
- [ ] Revoke an existing key

---

## Scratchpad

- [ ] Open scratchpad (bottom-left icon)
- [ ] Type text and verify it persists after closing and reopening
- [ ] Verify auto-save (500ms debounce)

---

## Cross-Cutting Concerns

- [ ] Global error banners appear for failed mutations (no local handler)
- [ ] Friendly error messages for unique constraint violations (duplicate display ID)
- [ ] Search debounce behavior (300ms) across all search inputs
- [ ] Pagination controls (First / Prev / Next / Last) work correctly
- [ ] Keyboard: Enter submits in all forms and inline editors
- [ ] Keyboard: Escape cancels inline rename editors
- [ ] Keyboard: drag-and-drop reorder via keyboard in StackEditor and TemplateEditor
- [ ] Content length limits enforced (block text, notes, display IDs, names, labels)
- [ ] Block limit enforcement (buttons disabled when at limit)
