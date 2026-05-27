import React, { useState, useEffect } from 'react';
import {
  Button,
  Stack,
  Badge,
  Form,
  ModalDialog,
} from '@openedx/paragon';
import { XpertPromptBundle, PromptPart } from '../types';
import { InterceptContext } from '../hooks/usePromptInterceptor';
import { sanitizeTags } from '../utils/tagUtils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PromptEditorModalProps {
  /** The bundle currently being intercepted. `null` means the modal is hidden. */
  bundle: XpertPromptBundle | null;
  /** The context associated with this interception (label, messages, meta). */
  context: InterceptContext | null;
  /**
   * Called when the user clicks Accept.
   * Receives the (possibly edited) bundle — callers should pass this into
   * the interceptor's `accept()` convenience method.
   */
  onAccept: (editedBundle: XpertPromptBundle) => void;
  /** Called when the user clicks Reject (caller uses the original bundle). */
  onReject: () => void;
  /** Called when the user clicks Cancel (caller aborts the Xpert call). */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Sub-component: single editable prompt part
// ---------------------------------------------------------------------------

interface PromptPartEditorProps {
  part: PromptPart;
  onChange: (label: PromptPart['label'], value: string) => void;
}

const PromptPartEditor = ({ part, onChange }: PromptPartEditorProps) => (
  <Form.Group className="mb-3">
    <div className="d-flex align-items-center mb-1">
      <Form.Label className="mb-0 mr-2">
        <code className="small font-weight-bold">{part.label}</code>
      </Form.Label>
      <Stack direction="horizontal" gap={1}>
        {part.required && <Badge variant="primary">required</Badge>}
        {!part.editable && <Badge variant="secondary">read-only</Badge>}
      </Stack>
    </div>
    <Form.Control
      as="textarea"
      value={part.content}
      readOnly={!part.editable}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(part.label, e.target.value)}
      rows={Math.max(6, part.content.split('\n').length + 2)}
      className="text-monospace small"
      style={{
        resize: 'vertical',
        backgroundColor: part.editable ? '#ffffff' : '#f8f9fa',
      }}
    />
  </Form.Group>
);

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

/**
 * `PromptEditorModal` renders a functional (no-CSS-framework-complexity) editor
 * for an `XpertPromptBundle` before it is dispatched to Xpert.
 *
 * It is intentionally unstyled beyond inline layout — visual polish is deferred
 * to the integration step (Prompt 6).  The component is self-contained and does
 * NOT register itself with the interceptor hook; the parent is responsible for
 * wiring `onAccept` / `onReject` / `onCancel` to `usePromptInterceptor`.
 */
export const PromptEditorModal = ({
  bundle,
  context,
  onAccept,
  onReject,
  onCancel,
}: PromptEditorModalProps) => {
  // Local copy of parts so edits don't mutate the original bundle.
  const [editedParts, setEditedParts] = useState<PromptPart[]>([]);
  // Local copy of tags input string.
  const [editedTags, setEditedTags] = useState<string>('');

  // Sync local state whenever a new bundle is passed in.
  useEffect(() => {
    if (bundle) {
      setEditedParts(bundle.parts.map(p => ({ ...p })));
      setEditedTags(bundle.tags?.join(', ') || '');
    }
  }, [bundle]);

  // Not visible when there is no active interception.
  if (!bundle || !context) {
    return null;
  }

  const handlePartChange = (label: PromptPart['label'], value: string) => {
    setEditedParts(prev => prev.map(p => (p.label === label ? { ...p, content: value } : p)));
  };

  const handleAccept = () => {
    const combined = editedParts.map(p => p.content).join('');
    const rawTags = editedTags.split(',');
    const sanitized = sanitizeTags(rawTags);
    const editedBundle: XpertPromptBundle = {
      ...bundle,
      parts: editedParts,
      combined,
      tags: sanitized,
    };
    onAccept(editedBundle);
  };

  return (
    <ModalDialog
      isOpen
      onClose={onCancel}
      size="xl"
      title={`Prompt Editor — ${context.label}`}
      hasCloseButton
      isOverflowVisible={false}
    >
      <ModalDialog.Header>
        <ModalDialog.Title>
          <span>Prompt Editor — {context.label}</span>
          {context.meta?.stage && (
            <div className="small text-muted font-weight-normal">
              Stage: {String(context.meta.stage)}
            </div>
          )}
        </ModalDialog.Title>
      </ModalDialog.Header>
      <ModalDialog.Body>
        {/* Context summary */}
        <div className="mb-4">
          <h4 className="h6 font-weight-bold">Outbound messages ({context.messages.length})</h4>
          <div
            className="bg-light border rounded p-2 overflow-auto"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              maxHeight: '10rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {context.messages.map((m, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i}>
                <Badge variant="secondary" className="mr-1">{m.role}</Badge>
                {m.content}
              </div>
            ))}
          </div>
        </div>

        {/* Editable prompt parts */}
        <div className="mb-4">
          <h4 className="h6 font-weight-bold mb-3">
            Prompt parts ({editedParts.length})
          </h4>
          {editedParts.map(part => (
            <PromptPartEditor
              key={part.label}
              part={part}
              onChange={handlePartChange}
            />
          ))}
        </div>

        {/* Request-level configuration (Tags) */}
        <div className="pt-3 border-top">
          <Form.Group controlId="request-tags">
            <Form.Label className="font-weight-bold small">Request Tags</Form.Label>
            <Form.Control
              type="text"
              value={editedTags}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedTags(e.target.value)}
              placeholder="discovery, edx-available-course"
              className="text-monospace small"
            />
            <Form.Text className="text-muted small">
              Comma-separated tags used to scope RAG retrieval. Clearing this field will omit tags from the request.
            </Form.Text>
          </Form.Group>
        </div>
      </ModalDialog.Body>
      <ModalDialog.Footer>
        <Button variant="outline-danger" onClick={onCancel}>
          Cancel Request
        </Button>
        <div className="flex-grow-1" />
        <Button variant="outline-secondary" onClick={onReject}>
          Reset to Original
        </Button>
        <Button variant="primary" onClick={handleAccept}>
          Accept & Execute
        </Button>
      </ModalDialog.Footer>
    </ModalDialog>
  );
};
