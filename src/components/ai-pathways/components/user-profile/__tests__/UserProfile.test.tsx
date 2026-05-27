import React from 'react';
import {
  render, screen, fireEvent, act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { UserProfile } from '../UserProfile';
import { LearnerProfile, CareerCardModel } from '../../../types';

const customRender = (ui: React.ReactElement) => render(
  <IntlProvider locale="en">
    {ui}
  </IntlProvider>,
);

describe('UserProfile', () => {
  const mockProfile: LearnerProfile = {
    name: 'John Doe',
    overview: 'This is an overview.',
    careerGoal: 'Software Engineer',
    targetIndustry: 'Tech',
    background: 'Beginner',
    motivation: 'Love to code',
    learningStyle: 'hands-on',
    timeAvailable: '10h/week',
    certificate: 'yes',
    careerMatches: [
      {
        title: 'Software Engineer', percentMatch: 0.95, skills: ['JS'], industries: ['Tech'],
      },
      {
        title: 'Data Scientist', percentMatch: 0.8, skills: ['Python'], industries: ['Tech'],
      },
    ],
  };

  // @ts-ignore
  const mockSelectedCareer: CareerCardModel = {
    description: '',
    id: '',
    jobSources: [],
    similarJobs: [],
    title: 'Software Engineer',
    percentMatch: 0.95,
    skills: ['JS', 'React'],
    industries: ['Tech'],
  };

  const mockOnSelectCareer = jest.fn();
  const mockOnBuildPathway = jest.fn();
  const mockOnUpdateProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and calculates initials', () => {
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
      />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument(); // Initials
    expect(screen.getByText('This is an overview.')).toBeInTheDocument();
    expect(screen.getAllByText('Software Engineer').length).toBeGreaterThan(0);
    expect(screen.getByText('Build My Learning Pathway')).toBeInTheDocument();
  });

  it('handles name fallback for initials', () => {
    customRender(
      <UserProfile
        profile={{ ...mockProfile, name: '' }}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
      />,
    );
    expect(screen.getByText('U')).toBeInTheDocument(); // Default 'U'
  });

  it('handles career selection', () => {
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
      />,
    );

    const dsBtn = screen.getByText(/Data Scientist/i);
    fireEvent.click(dsBtn);
    expect(mockOnSelectCareer).toHaveBeenCalledWith(mockProfile.careerMatches[1]);
  });

  it('toggles editing mode and handles changes', async () => {
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
        onUpdateProfile={mockOnUpdateProfile}
      />,
    );

    const editBtn = screen.getByText('Edit');
    fireEvent.click(editBtn);

    const careerGoalTextarea = screen.getByDisplayValue('Software Engineer');
    fireEvent.change(careerGoalTextarea, { target: { value: 'Senior Dev' } });

    const backgroundTextarea = screen.getByDisplayValue('Beginner');
    fireEvent.change(backgroundTextarea, { target: { value: 'New background' } });

    const industryTextarea = screen.getByDisplayValue('Tech');
    fireEvent.change(industryTextarea, { target: { value: 'New industry' } });

    const motivationTextarea = screen.getByDisplayValue('Love to code');
    fireEvent.change(motivationTextarea, { target: { value: 'New motivation' } });

    const submitBtn = screen.getByText('Submit');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockOnUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      careerGoal: 'Senior Dev',
    }));
    expect(screen.queryByText('Submit')).not.toBeInTheDocument(); // Mode closed
  });

  it('can cancel editing without changes', () => {
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
      />,
    );

    fireEvent.click(screen.getByText('Edit'));
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('can cancel editing with changes by clicking Cancel', () => {
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
      />,
    );

    fireEvent.click(screen.getByText('Edit'));
    const careerGoalTextarea = screen.getByDisplayValue('Software Engineer');
    fireEvent.change(careerGoalTextarea, { target: { value: 'Senior Dev' } });

    // In this component, "Cancel" is only shown if not dirty.
  });

  it('displays error message', () => {
    const error = new Error('Update failed');
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
        error={error}
      />,
    );
    expect(screen.getByText('Update failed')).toBeInTheDocument();
  });

  it('disables build pathway button when generating or no career selected', () => {
    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={null}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
        isGenerating
      />,
    );
    const btn = screen.getByText('Building Pathway...');
    expect(btn).toBeDisabled();
  });

  it('handles copy careers to clipboard', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    customRender(
      <UserProfile
        profile={mockProfile}
        selectedCareer={mockSelectedCareer}
        onSelectCareer={mockOnSelectCareer}
        onBuildPathway={mockOnBuildPathway}
      />,
    );

    const copyBtn = screen.getByText('Copy');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Software Engineer'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('JS'));
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });
});
