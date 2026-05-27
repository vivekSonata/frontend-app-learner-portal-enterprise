import React from 'react';
import { AiPathwaysPage } from './routes/AiPathwaysPage';

/**
 * AIPathwaysTab is the primary entry point when AI Pathways is embedded as a tab
 * within the Learner Dashboard.
 *
 * It initializes the necessary Algolia InstantSearch context (used for facet
 * discovery) and renders the core AiPathwaysPage component.
 */
export const AIPathwaysTab = () => (
  <AiPathwaysPage />
);

export default AIPathwaysTab;
