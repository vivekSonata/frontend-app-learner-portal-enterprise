import React, { useCallback } from 'react';
import {
  Card,
  Badge,
  Button,
  Stack,
  Alert,
  CardCarousel,
} from '@openedx/paragon';
import {
  AIPathwaysResponseModel,
  FacetSnapshotTrace,
  RulesFirstMappingTrace,
  CatalogTranslationTrace,
  RetrievalLadderTrace,
  PromptDebugEntry,
  CourseRetrievalHit,
  TieredSkillTrace,
} from '../types';
import { exportResponseModel } from '../utils/exportResponseModel';
import SearchCourseCard from '../../search/SearchCourseCard';
import { mapRetrievalHitToSearchCard } from '../utils/courseMapper';
import { CARDGRID_COLUMN_SIZES } from '../../search/constants';

// ─── Small reusable helpers ───────────────────────────────────────────────────

const JsonDetails = ({
  title, value, open: defaultOpen = false,
}: { title: string; value: unknown; open?: boolean }) => (
  <details open={defaultOpen}>
    <summary className="small text-muted cursor-pointer">{title}</summary>
    <pre className="small mt-1 overflow-auto bg-light border rounded p-2" style={{ maxHeight: 300 }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  </details>
);

const StringList = ({
  title, values, emptyLabel = 'None',
}: { title: string; values?: string[]; emptyLabel?: string }) => (
  <div className="mb-1">
    <strong className="small">{title}: </strong>
    {values?.length ? values.join(', ') : <em className="text-muted small">{emptyLabel}</em>}
  </div>
);

const TIER_BADGE_VARIANT: Record<string, string> = {
  broad_anchor: 'success',
  role_differentiator: 'primary',
  narrow_signal: 'info',
  noise: 'light',
};

const TierBadge = ({ tier, 'aria-label': ariaLabel }: { tier?: string; 'aria-label'?: string }) => (
  tier
    ? <Badge variant={TIER_BADGE_VARIANT[tier] || 'secondary'} className="mr-1" aria-label={ariaLabel || `Tier: ${tier}`}>{tier}</Badge>
    : null
);

const DECISION_BADGE_VARIANT: Record<string, string> = {
  strict: 'success',
  boost: 'info',
  unmatched: 'light',
  dropped: 'dark',
};

const DecisionBadge = ({ decision, 'aria-label': ariaLabel }: { decision?: string; 'aria-label'?: string }) => (
  decision
    ? <Badge variant={DECISION_BADGE_VARIANT[decision] || 'secondary'} className="mr-1" aria-label={ariaLabel || `Decision: ${decision}`}>{decision}</Badge>
    : null
);

const SEARCH_MODE_VARIANT: Record<string, string> = {
  'hybrid-broad': 'success',
  'facet-first': 'warning',
  'text-boost': 'info',
  'text-fallback': 'secondary',
};

const SEARCH_MODE_LABEL: Record<string, string> = {
  'hybrid-broad': 'Hybrid Broad',
  'facet-first': 'Strict-Only (Legacy)',
  'text-boost': 'Boosted Text',
  'text-fallback': 'Text Fallback',
};

const LEVEL_COMPATIBILITY_VARIANT: Record<string, string> = {
  matched: 'success',
  near: 'warning',
};

const levelCompatibilityVariant = (levelCompatibility?: string) => (
  LEVEL_COMPATIBILITY_VARIANT[levelCompatibility || ''] || 'danger'
);

// ─── Skill Tiering Table ──────────────────────────────────────────────────────

const SkillTieringTable = ({ rows }: { rows?: TieredSkillTrace[] }) => {
  if (!rows?.length) {
    return <em className="small text-muted">No tiering data</em>;
  }
  return (
    <div className="overflow-auto" style={{ maxHeight: 400 }}>
      <table className="small w-100" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <th className="pr-2 pb-1">Skill</th>
            <th className="pr-2 pb-1">Source</th>
            <th className="pr-2 pb-1">Tier</th>
            <th className="pr-2 pb-1">Decision</th>
            <th className="pr-2 pb-1">Catalog Match</th>
            <th className="pr-2 pb-1">Method</th>
            <th className="pr-2 pb-1">Sig.</th>
            <th className="pr-2 pb-1">Postings</th>
            <th className="pb-1">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td className="pr-2 py-1">{row.name}</td>
              <td className="pr-2 py-1"><small>{row.source}</small></td>
              <td className="pr-2 py-1"><TierBadge tier={row.tier} aria-label={`Tier value: ${row.tier || 'none'}`} /></td>
              <td className="pr-2 py-1"><DecisionBadge decision={row.decision} aria-label={`Decision value: ${row.decision || 'none'}`} /></td>
              <td className="pr-2 py-1">{row.catalogSkill || '—'}</td>
              <td className="pr-2 py-1"><small>{row.matchMethod || '—'}</small></td>
              <td className="pr-2 py-1">{row.significance ?? '—'}</td>
              <td className="pr-2 py-1">{row.uniquePostings ?? '—'}</td>
              <td className="py-1">{row.score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Section components ───────────────────────────────────────────────────────

const CourseRetrievalSection = ({ hits }: { hits: CourseRetrievalHit[] }) => {
  if (hits.length === 0) {
    return <p className="text-muted font-italic small mb-0">No courses returned for the winning step.</p>;
  }
  return (
    <div className="d-flex flex-wrap mt-3">
      {hits.map((hit) => (
        <div key={hit.objectID} className="mr-3 mb-3" style={{ width: '300px' }}>
          {/* @ts-ignore */}
          <SearchCourseCard
            hit={mapRetrievalHitToSearchCard(hit)}
            parentRoute={{ label: 'AI Pathways Debug', to: '#' }}
          />
        </div>
      ))}
    </div>
  );
};

const StepCarousel = ({ hits, label }: { hits: CourseRetrievalHit[], label: string }) => {
  if (hits.length === 0) { return null; }

  return (
    <div className="mt-2 border-top pt-2">
      <p className="small text-muted mb-2">Returned Courses:</p>
      <CardCarousel
        ariaLabel={`${label} courses carousel`}
        columnSizes={CARDGRID_COLUMN_SIZES}
        hasInteractiveChildren
      >
        {hits.map((hit) => (
          <div key={hit.objectID} className="h-100 pb-3">
            {/* @ts-ignore */}
            <SearchCourseCard
              hit={mapRetrievalHitToSearchCard(hit)}
              parentRoute={{ label: 'AI Pathways Debug', to: '#' }}
            />
          </div>
        ))}
      </CardCarousel>
    </div>
  );
};

interface DebugConsoleProps {
  response: AIPathwaysResponseModel | null;
}

const FacetSnapshotSection = ({ trace }: { trace: FacetSnapshotTrace }) => (
  <div>
    <p className="mb-1"><strong>skill_names:</strong> {trace.skillNamesCount} values — sample: {trace.sampleSkillNames.join(', ')}</p>
    <p className="mb-1"><strong>skills.name:</strong> {trace.skillsDotNameCount} values</p>
    <p className="mb-1"><strong>subjects:</strong> {trace.subjectsCount} values — sample: {trace.sampleSubjects.join(', ')}</p>
    <p className="mb-1"><strong>level_type:</strong> {trace.levelTypeCount} values</p>
    <p className="mb-0"><strong>partners.name:</strong> {trace.partnersNameCount} values</p>
  </div>
);

const RulesFirstSection = ({ trace }: { trace: RulesFirstMappingTrace }) => (
  <Stack gap={2}>
    <p className="mb-1"><strong>Terms considered:</strong> {trace.termsConsidered}</p>
    <p className="mb-1"><strong>Exact matches ({trace.exactMatchCount}):</strong> {trace.exactMatches.join(', ') || '—'}</p>
    <p className="mb-1"><strong>Alias matches ({trace.aliasMatchCount}):</strong> {trace.aliasMatches.join(', ') || '—'}</p>
    <p className="mb-1"><strong>Unmatched ({trace.unmatchedCount}):</strong> {trace.unmatched.join(', ') || '—'}</p>
    {(trace.broadAnchorMatches?.length ?? 0) > 0 && (
      <StringList title="Broad anchors (strict)" values={trace.broadAnchorMatches} />
    )}
    {((trace.roleDifferentiatorMatches?.length ?? 0) > 0 || (trace.narrowSignalMatches?.length ?? 0) > 0) && (
      <>
        <StringList title="Role differentiators (boost)" values={trace.roleDifferentiatorMatches} emptyLabel="None" />
        <StringList title="Narrow signals (boost)" values={trace.narrowSignalMatches} emptyLabel="None" />
      </>
    )}
    {(trace.noiseDropped?.length ?? 0) > 0 && (
      <StringList title="Noise dropped" values={trace.noiseDropped} />
    )}
    {trace.strictCandidateCount !== undefined && (
      <p className="mb-1 small text-muted">
        Strict candidates: {trace.strictCandidateCount} | Boost candidates: {trace.boostCandidateCount ?? 0}
      </p>
    )}
    {(trace.tieringTrace?.length ?? 0) > 0 && (
      <div className="mt-2">
        <strong className="small">Skill Tiering Detail:</strong>
        <div className="mt-1">
          <SkillTieringTable rows={trace.tieringTrace} />
        </div>
      </div>
    )}
    <JsonDetails title="Raw Trace JSON" value={trace} />
  </Stack>
);

const CatalogTranslationSection = ({ trace }: { trace: CatalogTranslationTrace }) => (
  <Stack gap={2}>
    <p className="mb-1">
      <strong>Search mode:</strong>{' '}
      <Badge variant={SEARCH_MODE_VARIANT[trace.courseSearchMode] || 'secondary'}>
        {SEARCH_MODE_LABEL[trace.courseSearchMode] || trace.courseSearchMode}
      </Badge>
    </p>
    {trace.querySource && (
      <p className="mb-1"><strong>Query source:</strong> <code>{trace.querySource}</code></p>
    )}
    <p className="mb-1">
      <strong>Facet match rate:</strong> {Math.round(trace.facetMatchRate * 100)}%
      ({trace.facetMatchCount} of {trace.facetMatchCount + trace.droppedSkillCount} skills mapped)
    </p>
    <p className="mb-1"><strong>Query:</strong> {trace.query || <em className="text-muted">&lt;empty&gt;</em>}</p>
    {trace.queryAlternates.length > 0 && (
      <p className="mb-1"><strong>Text fallback:</strong> {trace.queryAlternates.join(', ')}</p>
    )}
    <p className="mb-1">
      <strong>Broad facet anchors ({trace.strictSkillCount}):</strong> {trace.strictSkills.join(', ') || '—'}
    </p>
    {trace.strictSelectionReason && (
      <p className="mb-1 small text-muted font-italic">{trace.strictSelectionReason}</p>
    )}
    <p className="mb-1">
      <strong>Specific optional boosts ({trace.boostSkillCount}):</strong> {trace.boostSkills.join(', ') || '—'}
    </p>
    {trace.boostSelectionReason && (
      <p className="mb-1 small text-muted font-italic">{trace.boostSelectionReason}</p>
    )}
    <p className="mb-0"><strong>Dropped skills ({trace.droppedSkillCount})</strong></p>
    {trace.tierCounts && Object.keys(trace.tierCounts).length > 0 && (
      <p className="mb-1 small">
        <strong>Tier counts: </strong>
        {Object.entries(trace.tierCounts).map(([tier, count]) => (
          <span key={tier} className="mr-2">
            <TierBadge tier={tier} /> {count}
          </span>
        ))}
      </p>
    )}
    <JsonDetails title="Raw Trace JSON" value={trace} />
  </Stack>
);

const decisionBadgeVariant = (decision: PromptDebugEntry['decision']) => {
  if (decision === 'accepted') { return 'success'; }
  if (decision === 'rejected') { return 'warning'; }
  return 'danger';
};

const PromptDebugSection = ({ entries }: { entries: PromptDebugEntry[] }) => (
  <Stack gap={3}>
    {entries.map((entry, idx) => (
      // eslint-disable-next-line react/no-array-index-key
      <div key={`${entry.label}-${idx}`} className="border rounded p-2">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <strong>{entry.label}</strong>
          <div>
            <Badge variant={decisionBadgeVariant(entry.decision)} className="mr-2">
              {entry.decision}
            </Badge>
            <span className="small text-muted">{entry.timestamp}</span>
          </div>
        </div>
        <details>
          <summary className="small cursor-pointer">Original prompt ({entry.original.stage})</summary>
          <pre className="small bg-light border rounded p-2 mt-1" style={{ whiteSpace: 'pre-wrap' }}>
            {entry.original.combined}
          </pre>
        </details>
        {entry.edited && (
          <details className="mt-1">
            <summary className="small cursor-pointer text-warning">Edited prompt (sent to Xpert)</summary>
            <pre className="small bg-light border rounded p-2 mt-1" style={{ whiteSpace: 'pre-wrap' }}>
              {entry.edited.combined}
            </pre>
          </details>
        )}
        {entry.validationWarnings && entry.validationWarnings.length > 0 && (
          <div className="mt-2">
            <strong className="small">Validation issues:</strong>
            <ul className="mb-0 mt-1 small">
              {entry.validationWarnings.map((w) => (
                <li key={`${w.code}-${w.severity}`} className={w.severity === 'error' ? 'text-danger' : 'text-warning'}>
                  <Badge variant={w.severity === 'error' ? 'danger' : 'warning'} className="mr-1">{w.severity}</Badge>
                  [{w.code}] {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ))}
  </Stack>
);

const RetrievalLadderSection = ({ trace }: { trace: RetrievalLadderTrace }) => (
  <Stack gap={2}>
    <p className="mb-1"><strong>Winner step:</strong> {trace.winnerStep ?? 'none'}</p>
    {trace.attempts.map((attempt) => (
      <div key={`${attempt.step}-${attempt.label}`} className="border rounded p-2">
        <div className="d-flex align-items-center mb-1 flex-wrap" style={{ gap: '0.25rem' }}>
          <Badge variant={attempt.winner ? 'success' : 'secondary'} className="mr-1">Step {attempt.step}</Badge>
          {attempt.searchMode && (
            <Badge variant={SEARCH_MODE_VARIANT[attempt.searchMode] || 'secondary'} className="mr-1">
              {attempt.searchMode}
            </Badge>
          )}
          <strong>{attempt.label}</strong>
          <span className="ml-2 text-muted">— {attempt.hitCount} hits</span>
        </div>
        <p className="mb-1 small">
          <strong>Query:</strong> {attempt.query || <em className="text-muted">&lt;empty&gt;</em>}
        </p>
        {(attempt.strictSkillsUsed?.length ?? 0) > 0 && (
          <StringList title="Strict facets" values={attempt.strictSkillsUsed} />
        )}
        {(attempt.boostSkillsUsed?.length ?? 0) > 0 && (
          <StringList title="Boost signals" values={attempt.boostSkillsUsed} />
        )}
        {attempt.rerankApplied && attempt.rerankTrace && (
          <details className="mt-1">
            <summary className="small cursor-pointer text-muted">
              Rerank applied — {attempt.rerankTrace.courseScores?.length ?? 0} courses scored
            </summary>
            <div className="mt-1 small">
              {attempt.rerankTrace.courseScores?.slice(0, 5).map((cs, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="mb-1">
                  <span className="mr-1">#{cs.finalRank + 1}</span>
                  <strong>{cs.title || cs.objectID}</strong>
                  <span className="text-muted ml-1">(score: {cs.score})</span>
                  {cs.levelCompatibility && cs.levelCompatibility !== 'unknown' && (
                    <Badge
                      variant={levelCompatibilityVariant(cs.levelCompatibility)}
                      className="ml-1"
                    >
                      level: {cs.levelCompatibility}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
        {attempt.hits && attempt.hits.length > 0 && (
          <StepCarousel hits={attempt.hits} label={attempt.label} />
        )}
      </div>
    ))}
  </Stack>
);

export const DebugConsole = ({
  response,
}: DebugConsoleProps) => {
  const handleExport = useCallback(() => {
    if (!response) { return; }
    exportResponseModel(response);
  }, [response]);

  if (!response) {
    return null;
  }

  const stages = response.stages || {};

  return (
    <Card className="mt-5 border-warning">
      <Card.Header
        title="AI Pathways Debug Console"
        subtitle={`Request ID: ${response.requestId}`}
        actions={(
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleExport}
          >
            Export JSON
          </Button>
        )}
      />
      <Card.Body>
        <Stack gap={3}>
          {/* Request Tags Visibility */}
          <div className="mb-3">
            <strong>Tags used in this request:</strong>{' '}
            {response.tags?.length ? (
              response.tags.map(tag => <Badge key={tag} variant="dark" className="mr-1">{tag}</Badge>)
            ) : (
              <span className="text-muted font-italic">None (field omitted)</span>
            )}
          </div>

          {/* Intent Extraction */}
          <details>
            <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <span>Stage 2: Xpert Intent Extraction</span>
                {stages.intentExtraction?.repairPromptUsed && (
                  <Badge variant="warning" className="ml-2">Repaired</Badge>
                )}
              </div>
              <Badge variant={stages.intentExtraction?.success ? 'success' : 'danger'}>
                {stages.intentExtraction?.durationMs}ms
              </Badge>
            </summary>
            <div className="py-2">
              <Stack gap={3}>
                {stages.intentExtraction?.validationErrors?.length > 0 && (
                  <Alert variant="danger">
                    <strong>Validation Errors:</strong>
                    <ul>
                      {stages.intentExtraction.validationErrors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
                <div>
                  <strong>System Prompt:</strong>
                  <pre className="small bg-light border rounded p-2" style={{ whiteSpace: 'pre-wrap' }}>
                    {stages.intentExtraction?.systemPrompt}
                  </pre>
                </div>
                <div>
                  <strong>Raw Response:</strong>
                  <pre className="small bg-light border rounded p-2" style={{ whiteSpace: 'pre-wrap' }}>
                    {stages.intentExtraction?.rawResponse}
                  </pre>
                </div>
                <div>
                  <strong>Parsed Intent:</strong>
                  <pre className="small bg-light border rounded p-2">
                    {JSON.stringify(stages.intentExtraction?.parsedResponse, null, 2)}
                  </pre>
                </div>
                <p className="mb-1"><strong>Discovery RAG used:</strong> {stages.intentExtraction?.wasDiscoveryUsed ? 'Yes' : 'No'}</p>
                {stages.intentExtraction?.discovery && (
                  <div>
                    <strong>Discovery Data (RAG):</strong>
                    <pre className="small bg-light border rounded p-2">
                      {JSON.stringify(stages.intentExtraction.discovery, null, 2)}
                    </pre>
                  </div>
                )}
              </Stack>
            </div>
          </details>

          {/* Career Retrieval */}
          <details>
            <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
              <span>Stage 3: Career Retrieval (Algolia)</span>
              <div>
                <Badge variant="info" className="mr-2">{stages.careerRetrieval?.resultCount} hits</Badge>
                <Badge variant={stages.careerRetrieval?.success ? 'success' : 'danger'}>
                  {stages.careerRetrieval?.durationMs}ms
                </Badge>
              </div>
            </summary>
            <div className="py-2">
              <Stack gap={2}>
                {stages.careerRetrieval?.trace && (
                  <>
                    <StringList title="Query" values={[stages.careerRetrieval.trace.query ?? '']} emptyLabel="(empty)" />
                    <StringList title="Learner level" values={[stages.careerRetrieval.trace.learnerLevel ?? 'unspecified']} />
                    <StringList title="Required broad filters" values={stages.careerRetrieval.trace.requiredSkillFilters} />
                    <StringList title="Preferred specific filters" values={stages.careerRetrieval.trace.preferredSkillFilters} />
                    {(stages.careerRetrieval.trace.droppedSkillInputs?.length ?? 0) > 0 && (
                      <div className="mb-1">
                        <strong className="small">Dropped inputs: </strong>
                        {stages.careerRetrieval.trace.droppedSkillInputs!.map((d) => (
                          <span key={d.skill} className="mr-2">
                            <Badge variant="warning">{d.skill}</Badge>
                            <small className="text-muted ml-1">{d.reason}</small>
                          </span>
                        ))}
                      </div>
                    )}
                    {(stages.careerRetrieval.trace.resultSummaries?.length ?? 0) > 0 && (
                      <details>
                        <summary className="small cursor-pointer text-muted">
                          {stages.careerRetrieval.trace.resultSummaries!.length} results
                        </summary>
                        {stages.careerRetrieval.trace.resultSummaries!.map((r) => (
                          <div key={r.id} className="small mb-1 ml-2">
                            <strong>{r.title}</strong> ({r.skillCount} skills)
                            {(r.topSkills?.length ?? 0) > 0 && (
                              <span className="text-muted ml-1">— {r.topSkills!.map((s) => s.name).join(', ')}</span>
                            )}
                          </div>
                        ))}
                      </details>
                    )}
                  </>
                )}
                <JsonDetails title="Raw JSON" value={stages.careerRetrieval} />
              </Stack>
            </div>
          </details>

          {/* Facet Snapshot */}
          {stages.catalogFacetSnapshot && (
            <details>
              <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
                <span>Stage 3b: Catalog Facet Snapshot</span>
                <Badge variant={stages.catalogFacetSnapshot.success ? 'success' : 'danger'}>
                  {stages.catalogFacetSnapshot.durationMs}ms
                </Badge>
              </summary>
              <div className="py-2">
                <FacetSnapshotSection trace={stages.catalogFacetSnapshot.trace} />
              </div>
            </details>
          )}

          {/* Rules-First Mapping */}
          {stages.rulesFirstMapping && (
            <details>
              <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
                <span>Stage 3c: Rules-First Taxonomy Mapping</span>
                <Badge variant={stages.rulesFirstMapping.success ? 'success' : 'danger'}>
                  {stages.rulesFirstMapping.durationMs}ms
                </Badge>
              </summary>
              <div className="py-2">
                <RulesFirstSection trace={stages.rulesFirstMapping.trace} />
              </div>
            </details>
          )}

          {/* Catalog Translation */}
          {stages.catalogTranslation && (
            <details>
              <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
                <span>Stage 3d: Catalog Translation</span>
                <Badge variant={stages.catalogTranslation.success ? 'success' : 'danger'}>
                  {stages.catalogTranslation.durationMs}ms
                </Badge>
              </summary>
              <div className="py-2">
                <CatalogTranslationSection trace={stages.catalogTranslation.trace} />
              </div>
            </details>
          )}

          {/* Retrieval Ladder */}
          {stages.retrievalLadder && (
            <details>
              <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
                <span>Stage 4a: Course Retrieval Ladder</span>
                <Badge variant={stages.retrievalLadder.success ? 'success' : 'danger'}>
                  {stages.retrievalLadder.trace.attempts.length} attempts
                </Badge>
              </summary>
              <div className="py-2">
                <RetrievalLadderSection trace={stages.retrievalLadder.trace} />
              </div>
            </details>
          )}

          {/* Course Retrieval */}
          <details open>
            <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
              <span>Stage 4: Course Retrieval (Algolia)</span>
              <div>
                <Badge variant="info" className="mr-2">{stages.courseRetrieval?.resultCount} hits</Badge>
                <Badge variant={stages.courseRetrieval?.success ? 'success' : 'danger'}>
                  {stages.courseRetrieval?.durationMs}ms
                </Badge>
              </div>
            </summary>
            <div className="py-2">
              <Stack gap={2}>
                {stages.courseRetrieval?.winnerStep != null && (
                  <p className="mb-1"><strong>Winner step:</strong> {stages.courseRetrieval.winnerStep}</p>
                )}
                {stages.courseRetrieval?.requestSummary?.winningQuery !== undefined && (
                  <p className="mb-1">
                    <strong>Winning query:</strong>{' '}
                    {stages.courseRetrieval.requestSummary.winningQuery || <em className="text-muted">&lt;empty&gt;</em>}
                  </p>
                )}
                {(stages.courseRetrieval?.selectedCourseTitles?.length ?? 0) > 0 && (
                  <StringList title="Selected courses" values={stages.courseRetrieval!.selectedCourseTitles} />
                )}
                <CourseRetrievalSection hits={stages.courseRetrieval?.hits || []} />
                <JsonDetails title="Raw JSON" value={stages.courseRetrieval} />
              </Stack>
            </div>
          </details>

          {/* Prompt Debug */}
          {response.promptDebug && response.promptDebug.length > 0 && (
            <details>
              <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
                <span>Prompt Interceptions ({response.promptDebug.length})</span>
                <Badge variant="info">{response.promptDebug.length} recorded</Badge>
              </summary>
              <div className="py-2">
                <PromptDebugSection entries={response.promptDebug} />
              </div>
            </details>
          )}

          {/* Pathway Enrichment */}
          <details>
            <summary className="h5 cursor-pointer py-2 border-bottom d-flex align-items-center justify-content-between">
              <span>Stage 5: Xpert Pathway Enrichment</span>
              <Badge variant={stages.pathwayEnrichment?.success ? 'success' : 'danger'}>
                {stages.pathwayEnrichment?.durationMs}ms
              </Badge>
            </summary>
            <div className="py-2">
              <Stack gap={3}>
                <div>
                  <strong>System Prompt:</strong>
                  <pre className="small bg-light border rounded p-2" style={{ whiteSpace: 'pre-wrap' }}>
                    {stages.pathwayEnrichment?.systemPrompt}
                  </pre>
                </div>
                <div>
                  <strong>Raw Response:</strong>
                  <pre className="small bg-light border rounded p-2" style={{ whiteSpace: 'pre-wrap' }}>
                    {stages.pathwayEnrichment?.rawResponse}
                  </pre>
                </div>
                <p className="mb-1"><strong>Discovery RAG used:</strong> {stages.pathwayEnrichment?.wasDiscoveryUsed ? 'Yes' : 'No'}</p>
                {stages.pathwayEnrichment?.discovery && (
                  <div>
                    <strong>Discovery Data (RAG):</strong>
                    <pre className="small bg-light border rounded p-2">
                      {JSON.stringify(stages.pathwayEnrichment.discovery, null, 2)}
                    </pre>
                  </div>
                )}
              </Stack>
            </div>
          </details>
        </Stack>
      </Card.Body>
    </Card>
  );
};
