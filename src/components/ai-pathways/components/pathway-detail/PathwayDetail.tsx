import React from 'react';
import {
  ModalDialog,
  Button,
  Badge,
} from '@openedx/paragon';
import type { PathwayCourse } from '../../types';

interface PathwayDetailProps {
  /** The course to display details for. */
  course: PathwayCourse | null;
  /** Whether the detail view is visible. */
  isOpen: boolean;
  /** Callback for when the detail view should be closed. */
  onClose: () => void;
  /** Callback for the main action (Register/Continue). */
  onAction?: (course: PathwayCourse) => void;
}

/**
 * PathwayDetail component displays an immersive detailed view of a recommended course.
 *
 * It is presented as a modal and focuses on explaining the alignment between the
 * course content and the learner's specific goals, surfaced through AI-generated
 * reasoning and a clear skills breakdown.
 */
export const PathwayDetail = ({
  course,
  isOpen,
  onClose,
  onAction,
}: PathwayDetailProps) => {
  if (!course) {
    return null;
  }

  const {
    title,
    level,
    skills,
    reasoning,
    status,
  } = course;

  let actionText = 'Register';
  if (status === 'completed') {
    actionText = 'View Certificate';
  } else if (status === 'in_progress') {
    actionText = 'Continue Course';
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      hasCloseButton
      isOverflowVisible={false}
    >
      <ModalDialog.Header>
        <ModalDialog.Title>{title}</ModalDialog.Title>
      </ModalDialog.Header>
      <ModalDialog.Body>
        <div className="mb-4">
          <div className="d-flex align-items-center mb-3">
            <Badge
              variant="info"
              className="text-uppercase mr-2"
              style={{ backgroundColor: '#EBF5FB', color: '#3498DB', border: 'none' }}
            >
              {level}
            </Badge>
            <span className="small text-muted text-uppercase font-weight-bold">
              Status: {status}
            </span>
          </div>

          <h5 className="mb-2">Why This Fits You</h5>
          <p className="text-muted mb-4" style={{ lineHeight: '1.6' }}>
            {reasoning}
          </p>

          <h5 className="mb-2">Skills You Will Learn</h5>
          {skills && skills.length > 0 ? (
            <ul className="list-unstyled mb-0">
              {skills.map((skill) => (
                <li key={skill} className="py-2 border-bottom border-light small d-flex align-items-center">
                  <span className="mr-2 text-primary">•</span>
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted italic">No skills listed for this course.</p>
          )}
        </div>
      </ModalDialog.Body>
      <ModalDialog.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          variant={status === 'completed' ? 'success' : 'primary'}
          onClick={() => {
            onAction?.(course);
            onClose();
          }}
          style={{
            background: status !== 'completed'
              ? 'linear-gradient(135deg, #3498DB, #9B59B6)'
              : undefined,
            border: 'none',
          }}
        >
          {actionText}
        </Button>
      </ModalDialog.Footer>
    </ModalDialog>
  );
};
