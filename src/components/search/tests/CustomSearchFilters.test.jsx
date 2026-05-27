import { render, screen } from '@testing-library/react';
import { SearchContext } from '@2uinc/frontend-enterprise-catalog-search';
import '@testing-library/jest-dom';
import CustomSearchFilters from '../CustomSearchFilters';

const capturedTransforms = {};

jest.mock('@2uinc/frontend-enterprise-catalog-search', () => {
  const actual = jest.requireActual('@2uinc/frontend-enterprise-catalog-search');
  return {
    ...actual,
    FacetListRefinement: ({ attribute, title, transformItems }) => {
      capturedTransforms[attribute] = transformItems;
      return <div data-testid={`facet-${attribute}`}>{title}</div>;
    },
    LearningTypeRadioFacet: () => (
      <div data-testid="learning-type-facet">LearningType</div>
    ),
  };
});

const baseFacets = [
  { attribute: 'skill_names', title: 'Skills' },
  { attribute: 'subjects', title: 'Subject' },
];

const renderWithContext = (searchFacetFilters, refinements = {}) => render(
  <SearchContext.Provider value={{ refinements, searchFacetFilters }}>
    <CustomSearchFilters />
  </SearchContext.Provider>,
);

describe('CustomSearchFilters', () => {
  const originalLearningTypeFacet = process.env.LEARNING_TYPE_FACET;
  beforeEach(() => {
    Object.keys(capturedTransforms).forEach((key) => delete capturedTransforms[key]);
  });
  afterEach(() => {
    if (originalLearningTypeFacet === undefined) {
      delete process.env.LEARNING_TYPE_FACET;
    } else {
      process.env.LEARNING_TYPE_FACET = originalLearningTypeFacet;
    }
  });

  it('renders one cell per facet from SearchContext', () => {
    renderWithContext(baseFacets);
    expect(screen.getByTestId('facet-skill_names')).toBeInTheDocument();
    expect(screen.getByTestId('facet-subjects')).toBeInTheDocument();
  });

  it('renders LearningTypeRadioFacet when LEARNING_TYPE_FACET env is set', () => {
    process.env.LEARNING_TYPE_FACET = 'true';
    renderWithContext(baseFacets);
    expect(screen.getByTestId('learning-type-facet')).toBeInTheDocument();
  });

  it('does not render LearningTypeRadioFacet when LEARNING_TYPE_FACET env is unset', () => {
    process.env.LEARNING_TYPE_FACET = '';
    renderWithContext(baseFacets);
    expect(screen.queryByTestId('learning-type-facet')).not.toBeInTheDocument();
  });

  it('transformItems for is_new_content keeps only the true row with original label preserved', () => {
    const facets = [
      { attribute: 'is_new_content', title: 'Recently added', isEndOfRow: true },
    ];
    renderWithContext(facets);
    const transform = capturedTransforms.is_new_content;
    const result = transform([
      { label: 'true', count: 181, isRefined: false },
      { label: 'false', count: 77, isRefined: false },
    ]);
    expect(result).toEqual([
      { label: 'true', count: 181, isRefined: false },
    ]);
  });

  it('renders end-of-row facets after LearningTypeRadioFacet', () => {
    process.env.LEARNING_TYPE_FACET = 'true';
    const facets = [
      ...baseFacets,
      { attribute: 'is_new_content', title: 'Recently added', isEndOfRow: true },
    ];
    const { container } = renderWithContext(facets);
    const order = Array.from(container.querySelectorAll('[data-testid]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(order).toEqual([
      'facet-skill_names',
      'facet-subjects',
      'learning-type-facet',
      'facet-is_new_content',
    ]);
  });
});
