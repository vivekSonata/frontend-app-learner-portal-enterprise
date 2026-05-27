import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Badge,
  Form,
  Spinner,
  Alert,
} from '@openedx/paragon';
import { ContentCopy } from '@openedx/paragon/icons';
import type { LearnerProfile, CareerOption, CareerCardModel } from '../../types';
import { formatCareersAsText } from '../../utils/copyUtils';

interface UserProfileProps {
  /** The learner profile data to display */
  profile: LearnerProfile;
  /** The currently selected career match */
  selectedCareer: CareerCardModel | null;
  /** Callback when a career match is selected */
  onSelectCareer: (career: CareerOption) => void;
  /** Callback to trigger pathway generation */
  onBuildPathway: () => void;
  /** Whether the pathway is currently being generated */
  isGenerating?: boolean;
  /** Any error that occurred during profile update */
  error?: Error | null;
  /** Callback when the profile is updated */
  onUpdateProfile?: (updatedFields: Partial<LearnerProfile>) => Promise<void>;
}

/**
 * UserProfile component displays the AI-generated learner profile summary.
 *
 * It provides:
 * - A summary of the learner's goals, background, and motivation.
 * - Inline editing capabilities for profile refinement.
 * - A selection interface for AI-matched career paths.
 * - An overview of skills required for the selected career.
 * - A primary action to trigger the final pathway generation.
 */
export const UserProfile = ({
  profile,
  selectedCareer,
  onSelectCareer,
  onBuildPathway,
  isGenerating = false,
  error = null,
  onUpdateProfile,
}: UserProfileProps) => {
  const {
    overview,
    careerGoal,
    targetIndustry,
    background,
    motivation,
    learningStyle,
    timeAvailable,
    certificate,
    careerMatches,
    name,
  } = profile;

  const initials = useMemo(() => {
    if (!name) { return 'U'; }
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, [name]);

  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editDraft, setEditDraft] = useState({
    careerGoal,
    targetIndustry,
    background,
    motivation,
  });

  // Keep draft in sync if profile changes from outside while not editing
  useEffect(() => {
    if (!isEditing) {
      setEditDraft({
        careerGoal,
        targetIndustry,
        background,
        motivation,
      });
    }
  }, [careerGoal, targetIndustry, background, motivation, isEditing]);

  const isDirty = useMemo(() => (
    editDraft.careerGoal !== careerGoal
    || editDraft.targetIndustry !== targetIndustry
    || editDraft.background !== background
    || editDraft.motivation !== motivation
  ), [editDraft, careerGoal, targetIndustry, background, motivation]);

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // If we are currently editing and hit the button (which should be "Cancel" or "Submit")
      // If it's "Cancel" (not dirty), just close
      if (!isDirty) {
        setIsEditing(false);
      }
    } else {
      setIsEditing(true);
    }
  }, [isEditing, isDirty]);

  const handleCancel = useCallback(() => {
    setEditDraft({
      careerGoal,
      targetIndustry,
      background,
      motivation,
    });
    setIsEditing(false);
  }, [careerGoal, targetIndustry, background, motivation]);

  const handleSubmit = useCallback(async () => {
    if (onUpdateProfile) {
      try {
        await onUpdateProfile(editDraft);
        setIsEditing(false);
      } catch (e) {
        // Error handling should be managed by parent or here if we want inline error
        // For now, parent handles it via the refresh flow
      }
    }
  }, [onUpdateProfile, editDraft]);

  const handleChange = (field: keyof typeof editDraft, value: string) => {
    setEditDraft(prev => ({ ...prev, [field]: value }));
  };

  const handleCopy = useCallback(async () => {
    const text = formatCareersAsText(careerMatches);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy text: ', err);
    }
  }, [careerMatches]);

  const renderActionButton = () => {
    if (!isEditing) {
      return (
        <Button
          variant="link"
          size="sm"
          className="p-0"
          onClick={handleEditToggle}
          disabled={isGenerating}
        >
          Edit
        </Button>
      );
    }

    if (!isDirty) {
      return (
        <Button
          variant="link"
          size="sm"
          className="p-0 text-muted"
          onClick={handleCancel}
          disabled={isGenerating}
        >
          Cancel
        </Button>
      );
    }

    return (
      <Button
        variant="link"
        size="sm"
        className="p-0 font-weight-bold"
        onClick={handleSubmit}
        disabled={isGenerating}
      >
        {isGenerating ? <Spinner animation="border" size="sm" className="mr-1" /> : 'Submit'}
      </Button>
    );
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '900px' }}>
      <header className="mb-4 d-flex align-items-center">
        <div
          className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center mr-3"
          style={{ width: '64px', height: '64px', fontSize: '24px' }}
        >
          {initials}
        </div>
        <div>
          <h2 className="h3 font-weight-bold mb-0">{name || 'Learner'}</h2>
          <p className="text-muted mb-0">Learner Profile</p>
        </div>
      </header>

      <Card className="mb-4 shadow-sm border-0">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="h5 font-weight-bold mb-0">Your Profile</h3>
            {renderActionButton()}
          </div>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error.message || 'An error occurred while updating your profile.'}
            </Alert>
          )}
          {isEditing ? (
            <Form.Group className="mb-4">
              <Form.Label className="small text-muted text-uppercase">Overview</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={overview}
                disabled
                className="bg-light"
              />
              <Form.Text className="text-muted small">
                Overview is automatically generated based on your profile and career matches.
              </Form.Text>
            </Form.Group>
          ) : (
            <p className="mb-4">{overview}</p>
          )}

          <Row className="mb-4">
            <Col md={6} className="mb-3 mb-md-0">
              <div className="small text-muted text-uppercase mb-1">Career Goal</div>
              {isEditing ? (
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={editDraft.careerGoal}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('careerGoal', e.target.value)}
                  disabled={isGenerating}
                />
              ) : (
                <div className="font-weight-bold">{careerGoal}</div>
              )}
            </Col>
            <Col md={6}>
              <div className="small text-muted text-uppercase mb-1">Target Industry</div>
              {isEditing ? (
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={editDraft.targetIndustry}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('targetIndustry', e.target.value)}
                  disabled={isGenerating}
                />
              ) : (
                <div className="font-weight-bold">{targetIndustry}</div>
              )}
            </Col>
          </Row>

          <div className="mb-4">
            <div className="small text-muted text-uppercase mb-1">Background</div>
            {isEditing ? (
              <Form.Control
                as="textarea"
                rows={3}
                value={editDraft.background}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('background', e.target.value)}
                disabled={isGenerating}
              />
            ) : (
              <p className="mb-0">{background}</p>
            )}
          </div>

          <div className="mb-4">
            <div className="small text-muted text-uppercase mb-1">Motivation</div>
            {isEditing ? (
              <Form.Control
                as="textarea"
                rows={3}
                value={editDraft.motivation}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('motivation', e.target.value)}
                disabled={isGenerating}
              />
            ) : (
              <p className="mb-0">{motivation}</p>
            )}
          </div>

          <hr className="my-4" />

          <Row>
            <Col xs={4} className="text-center border-right">
              <div className="small text-muted mb-1">Learning Style</div>
              <div className="font-weight-bold">{learningStyle}</div>
            </Col>
            <Col xs={4} className="text-center border-right">
              <div className="small text-muted mb-1">Time / Week</div>
              <div className="font-weight-bold">{timeAvailable}</div>
            </Col>
            <Col xs={4} className="text-center">
              <div className="small text-muted mb-1">Certificate</div>
              <div className="font-weight-bold">{certificate}</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row>
        <Col lg={7} className="mb-4">
          <Card className="h-100 shadow-sm">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h5 font-weight-bold mb-0">Career Matches</h3>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-muted"
                  onClick={handleCopy}
                  iconBefore={ContentCopy}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p className="small text-muted mb-4">
                Based on your goals and current market trends, here are roles that align with your profile.
              </p>
              <div className="list-group">
                {careerMatches.map((match) => {
                  const isSelected = selectedCareer?.title === match.title;
                  return (
                    <button
                      type="button"
                      key={match.title}
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-2 rounded ${isSelected ? 'active' : ''}`}
                      onClick={() => onSelectCareer(match)}
                      disabled={isGenerating}
                    >
                      <span className="font-weight-bold">{match.title}</span>
                      <Badge variant={isSelected ? 'light' : 'info'} className="ml-2">
                        {Math.round(match.percentMatch * 100)}% match
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5} className="mb-4">
          <Card className="h-100 shadow-sm">
            <Card.Body className="p-4">
              <h3 className="h5 font-weight-bold mb-3">Skills to Develop</h3>
              <p className="small text-muted mb-4">Key skills for your target roles.</p>
              <div className="d-flex flex-wrap">
                {selectedCareer?.skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="primary"
                    className="mb-2 mr-2 p-2"
                    style={{ backgroundColor: '#EBF5FB', color: '#1D4ED8', border: 'none' }}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="text-center mt-4">
        <Button
          variant="primary"
          size="lg"
          className="px-5 font-weight-bold"
          onClick={onBuildPathway}
          disabled={isGenerating || !selectedCareer}
        >
          {isGenerating ? 'Building Pathway...' : 'Build My Learning Pathway'}
        </Button>
        <div className="mt-3">
          <Button variant="outline-primary">Connect With An Advisor</Button>
        </div>
      </div>
    </div>
  );
};
