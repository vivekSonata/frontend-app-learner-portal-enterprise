import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { PromptEditorModal } from '../PromptEditorModal';
import { XpertPromptBundle } from '../../types';
import { InterceptContext } from '../../hooks/usePromptInterceptor';

const renderWithIntl = (ui: React.ReactElement) => render(
  <IntlProvider locale="en">
    {ui}
  </IntlProvider>,
);

describe('PromptEditorModal', () => {
  // @ts-ignore
  const mockBundle: XpertPromptBundle = {
    id: 'test-id',
    stage: 'intentExtraction',
    parts: [
      {
        // @ts-ignore
        label: 'part1', content: 'content1', editable: true, required: true,
      },
      {
        // @ts-ignore
        label: 'part2', content: 'content2', editable: false, required: false,
      },
    ],
    combined: 'content1content2',
  };

  const mockContext: InterceptContext = {
    label: 'Test Interception',
    messages: [{ role: 'user', content: 'hello' }],
    meta: { stage: 'intentExtraction' },
  };

  const mockOnAccept = jest.fn();
  const mockOnReject = jest.fn();
  const mockOnCancel = jest.fn();

  it('renders nothing if bundle or context is null', () => {
    const { container } = renderWithIntl(
      <PromptEditorModal
        bundle={null}
        context={null}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onCancel={mockOnCancel}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correctly and handles interactions', () => {
    renderWithIntl(
      <PromptEditorModal
        bundle={mockBundle}
        context={mockContext}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText(/Prompt Editor — Test Interception/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage: intentExtraction/i)).toBeInTheDocument();

    // Check messages
    expect(screen.getByText('hello')).toBeInTheDocument();

    // Check parts
    const textareas = screen.getAllByRole('textbox');
    expect(textareas).toHaveLength(3); // 2 prompt parts + 1 tags input
    expect(textareas[0]).toHaveValue('content1');
    expect(textareas[1]).toHaveValue('content2');
    expect(textareas[1]).toHaveAttribute('readonly');
    expect(textareas[2]).toHaveValue(''); // Tags input initial value

    // Edit part 1
    fireEvent.change(textareas[0], { target: { value: 'edited content' } });
    expect(textareas[0]).toHaveValue('edited content');

    // Edit tags
    fireEvent.change(textareas[2], { target: { value: 'tag1, tag2' } });
    expect(textareas[2]).toHaveValue('tag1, tag2');

    // Click Accept
    fireEvent.click(screen.getByText('Accept & Execute'));
    expect(mockOnAccept).toHaveBeenCalledWith(expect.objectContaining({
      combined: 'edited contentcontent2',
      tags: ['tag1', 'tag2'],
      parts: [
        expect.objectContaining({ label: 'part1', content: 'edited content' }),
        expect.objectContaining({ label: 'part2', content: 'content2' }),
      ],
    }));

    // Click Reject
    fireEvent.click(screen.getByText('Reset to Original'));
    expect(mockOnReject).toHaveBeenCalled();

    // Click Cancel
    fireEvent.click(screen.getByText('Cancel Request'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('handles context without meta stage', () => {
    const contextWithoutMeta = { ...mockContext, meta: undefined };
    renderWithIntl(
      <PromptEditorModal
        bundle={mockBundle}
        context={contextWithoutMeta}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onCancel={mockOnCancel}
      />,
    );
    // Subtitle should be empty or not contain "Stage:"
    expect(screen.queryByText(/Stage:/i)).not.toBeInTheDocument();
  });
});
