import React from 'react';
import {
  render, screen, fireEvent, act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { AiPathwaysPage } from '../routes/AiPathwaysPage';
import { usePathways } from '../hooks/usePathways';
import { usePromptInterceptor } from '../hooks';
import * as appUtils from '../../app/data/utils';
import {
  mockLearnerProfile,
  mockPathwayResponse,
} from '../fixtures';
import type { XpertPromptBundle, PromptPartLabel } from '../types';
import type { InterceptContext } from '../hooks/usePromptInterceptor';

jest.mock('../hooks/usePathways');
jest.mock('../hooks', () => ({
  ...jest.requireActual('../hooks'),
  usePromptInterceptor: jest.fn(),
}));

// Mock components that might be too complex for simple integration test.
// IntakeForm is stubbed globally so interception tests can trigger onSubmit
// directly without navigating the multi-step wizard.
jest.mock('../components', () => ({
  ...jest.requireActual('../components'),
  DebugConsole: () => <div data-testid="debug-console">Debug</div>,
  // IntakeForm stub: single button that calls onSubmit({}) immediately
  IntakeForm: ({ onSubmit }: { onSubmit: (args: object) => Promise<void> }) => (
    <button type="button" onClick={() => onSubmit({})}>Trigger Submit</button>
  ),
  // PromptEditorModal is NOT mocked — we render it for real so we can assert its buttons
}));

const mockUsePromptInterceptor = usePromptInterceptor as jest.Mock;

const mockUsePathways = usePathways as jest.Mock;

const renderWithIntl = (ui: React.ReactElement) => render(
  <IntlProvider locale="en">
    {ui}
  </IntlProvider>,
);

/** Minimal valid XpertPromptBundle for test stubs. */
const makeBundle = (label: PromptPartLabel): XpertPromptBundle => ({
  id: `test-bundle-${label}`,
  stage: 'intentExtraction',
  parts: [{
    label, content: `content for ${label}`, editable: true, required: true,
  }],
  combined: `content for ${label}`,
});

/** Default usePathways return value reused across most tests. */
const defaultPathwaysReturn = (overrides: object = {}) => ({
  currentStep: 'intake',
  learnerProfile: null,
  selectedCareer: null,
  pathway: null,
  pathwayResponse: null,
  isLoading: false,
  error: null,
  generateProfile: jest.fn(),
  selectCareer: jest.fn(),
  generatePathway: jest.fn(),
  setCurrentStep: jest.fn(),
  ...overrides,
});

/** Minimal no-op interceptor hook return value. */
const makeInterceptorReturn = (overrides: object = {}) => ({
  isPending: false,
  pendingInterception: null,
  interceptPrompt: jest.fn(),
  accept: jest.fn(),
  reject: jest.fn(),
  cancel: jest.fn(),
  ...overrides,
});

describe('AiPathwaysPage Full Flow Test', () => {
  const mockGenerateProfile = jest.fn();
  const mockGeneratePathway = jest.fn();
  const mockSelectCareer = jest.fn();
  const mockSetCurrentStep = jest.fn();

  beforeEach(() => {
    jest.spyOn(appUtils, 'getSupportedLocale').mockReturnValue('en');
    jest.clearAllMocks();
    // Reset URL to non-debug by default
    window.history.pushState({}, '', '/');
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn());
    mockUsePathways.mockReturnValue({
      currentStep: 'intake',
      learnerProfile: null,
      selectedCareer: null,
      pathway: null,
      pathwayResponse: null,
      isLoading: false,
      error: null,
      generateProfile: mockGenerateProfile,
      selectCareer: mockSelectCareer,
      generatePathway: mockGeneratePathway,
      setCurrentStep: mockSetCurrentStep,
    });
  });

  test('renders the main heading and the intake form by default', () => {
    renderWithIntl(<AiPathwaysPage />);
    expect(screen.getByText(/AI Learning Pathways/i)).toBeInTheDocument();
    // IntakeForm is globally stubbed as a "Trigger Submit" button in this test file
    expect(screen.getByRole('button', { name: /trigger submit/i })).toBeInTheDocument();
  });

  test('shows debug component when ?debug=true is present', () => {
    window.history.pushState({}, '', '/?debug=true');
    renderWithIntl(<AiPathwaysPage />);
    expect(screen.getByTestId('debug-console')).toBeInTheDocument();
  });

  test('transitions to Profile page when profile is generated', () => {
    mockUsePathways.mockReturnValue({
      currentStep: 'profile',
      learnerProfile: {
        ...mockLearnerProfile,
        careerMatches: [{ title: 'Software Engineer', percentMatch: 0.9, skills: ['JS'] }],
      },
      selectedCareer: { title: 'Software Engineer', percentMatch: 0.9, skills: ['JS'] },
      pathway: null,
      isLoading: false,
      error: null,
      generateProfile: mockGenerateProfile,
      selectCareer: mockSelectCareer,
      generatePathway: mockGeneratePathway,
      setCurrentStep: mockSetCurrentStep,
    });

    renderWithIntl(<AiPathwaysPage />);
    expect(screen.getAllByText(/Software Engineer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Build My Learning Pathway/i)).toBeInTheDocument();
  });

  test('transitions to Pathway page when pathway is generated', () => {
    mockUsePathways.mockReturnValue({
      currentStep: 'pathway',
      learnerProfile: mockLearnerProfile,
      selectedCareer: { title: 'Software Engineer', percentMatch: 0.9, skills: ['JS'] },
      pathway: {
        courses: [{
          id: 'course-1', title: 'Modern React', status: 'not started', skills: ['React'],
        }],
      },
      pathwayResponse: mockPathwayResponse,
      isLoading: false,
      error: null,
      generateProfile: mockGenerateProfile,
      selectCareer: mockSelectCareer,
      generatePathway: mockGeneratePathway,
      setCurrentStep: mockSetCurrentStep,
    });

    renderWithIntl(<AiPathwaysPage />);
    expect(screen.getByText(/Modern React/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Prompt interception integration tests
// ---------------------------------------------------------------------------

/**
 * `usePromptInterceptor` is mocked globally so we can control `pendingInterception`
 * synchronously (the real hook uses useRef, which doesn't trigger re-renders).
 *
 * IntakeForm is restored to the real module in the first suite; in the interception
 * suite we override it per-test using jest.spyOn so we can trigger onSubmit directly
 * without navigating a multi-step wizard.
 */

describe('AiPathwaysPage — prompt interception', () => {
  const mockInterceptPrompt = jest.fn();
  const mockAccept = jest.fn();
  const mockReject = jest.fn();
  const mockCancel = jest.fn();

  beforeEach(() => {
    jest.spyOn(appUtils, 'getSupportedLocale').mockReturnValue('en');
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');
    // Default: no pending interception, pass-through interceptPrompt
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn({
      interceptPrompt: mockInterceptPrompt,
      accept: mockAccept,
      reject: mockReject,
      cancel: mockCancel,
    }));
    mockUsePathways.mockReturnValue(defaultPathwaysReturn());
  });

  /** Render in debug mode with given generateProfile mock. */
  const renderDebug = (generateProfile: jest.Mock = jest.fn()) => {
    mockUsePathways.mockReturnValue(defaultPathwaysReturn({ generateProfile }));
    window.history.pushState({}, '', '/?debug=true');
    return renderWithIntl(<AiPathwaysPage />);
  };

  /** Click stub submit and settle async effects. */
  const clickSubmit = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /trigger submit/i }));
    });
  };

  // ── wiring tests ──────────────────────────────────────────────────────────

  test('does NOT render PromptEditorModal when debug mode is off', () => {
    // URL is '/' from beforeEach; no ?debug=true
    renderWithIntl(<AiPathwaysPage />);
    // PromptEditorModal is inside the isDebug guard — buttons are absent
    expect(screen.queryByRole('button', { name: /accept & execute/i })).not.toBeInTheDocument();
  });

  test('passes interceptPrompt to generateProfile when debug is enabled', async () => {
    const generateProfile = jest.fn();
    renderDebug(generateProfile);
    await clickSubmit();

    expect(generateProfile).toHaveBeenCalledTimes(1);
    const [, interceptArg] = generateProfile.mock.calls[0];
    // In debug mode the hook's interceptPrompt function is passed as the second arg
    expect(interceptArg).toBe(mockInterceptPrompt);
  });

  test('does NOT pass interceptPrompt to generateProfile when debug is off', async () => {
    const generateProfile = jest.fn();
    mockUsePathways.mockReturnValue(defaultPathwaysReturn({ generateProfile }));
    // URL is '/' — no debug flag
    renderWithIntl(<AiPathwaysPage />);
    await clickSubmit();

    expect(generateProfile).toHaveBeenCalledTimes(1);
    const [, interceptArg] = generateProfile.mock.calls[0];
    expect(interceptArg).toBeUndefined();
  });

  // ── modal rendering tests ─────────────────────────────────────────────────

  test('PromptEditorModal renders when pendingInterception is non-null', () => {
    const bundle = makeBundle('base');
    const context: InterceptContext = { label: 'Intent Extraction', messages: [] };

    // Simulate the hook reporting an active pending interception
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn({
      interceptPrompt: mockInterceptPrompt,
      pendingInterception: { bundle, context },
      accept: mockAccept,
      reject: mockReject,
      cancel: mockCancel,
    }));

    window.history.pushState({}, '', '/?debug=true');
    renderWithIntl(<AiPathwaysPage />);

    expect(screen.getByRole('button', { name: /accept & execute/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to original/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel request/i })).toBeInTheDocument();
  });

  test('PromptEditorModal is NOT rendered when debug is off, even with pending interception', () => {
    const bundle = makeBundle('base');
    const context: InterceptContext = { label: 'Intent Extraction', messages: [] };
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn({
      pendingInterception: { bundle, context },
      accept: mockAccept,
      reject: mockReject,
      cancel: mockCancel,
    }));
    // Non-debug URL
    renderWithIntl(<AiPathwaysPage />);
    expect(screen.queryByRole('button', { name: /accept & execute/i })).not.toBeInTheDocument();
  });

  // ── modal callback wiring tests ───────────────────────────────────────────

  test('Accept button calls the hook accept() method', () => {
    const bundle = makeBundle('base');
    const context: InterceptContext = { label: 'Intent Extraction', messages: [] };
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn({
      pendingInterception: { bundle, context },
      accept: mockAccept,
      reject: mockReject,
      cancel: mockCancel,
    }));

    window.history.pushState({}, '', '/?debug=true');
    renderWithIntl(<AiPathwaysPage />);

    fireEvent.click(screen.getByRole('button', { name: /accept & execute/i }));
    expect(mockAccept).toHaveBeenCalledTimes(1);
    // Accept is called with the (possibly edited) bundle
    expect(mockAccept).toHaveBeenCalledWith(expect.objectContaining({ combined: bundle.combined }));
  });

  test('Reject button calls the hook reject() method', () => {
    const bundle = makeBundle('base');
    const context: InterceptContext = { label: 'Catalog Translation', messages: [] };
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn({
      pendingInterception: { bundle, context },
      accept: mockAccept,
      reject: mockReject,
      cancel: mockCancel,
    }));

    window.history.pushState({}, '', '/?debug=true');
    renderWithIntl(<AiPathwaysPage />);

    fireEvent.click(screen.getByRole('button', { name: /reset to original/i }));
    expect(mockReject).toHaveBeenCalledTimes(1);
  });

  test('Cancel button calls the hook cancel() method', () => {
    const bundle = makeBundle('base');
    const context: InterceptContext = { label: 'Intent Extraction', messages: [] };
    mockUsePromptInterceptor.mockReturnValue(makeInterceptorReturn({
      pendingInterception: { bundle, context },
      accept: mockAccept,
      reject: mockReject,
      cancel: mockCancel,
    }));

    window.history.pushState({}, '', '/?debug=true');
    renderWithIntl(<AiPathwaysPage />);

    fireEvent.click(screen.getByRole('button', { name: /cancel request/i }));
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });
});
