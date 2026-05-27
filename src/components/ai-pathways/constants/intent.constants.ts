import { XpertIntent, LearnerLevel, TimeCommitment } from '../types';

/**
 * Constants for Xpert intent extraction and prompt construction.
 * These govern the behavior of the AI stages in the pathway generation pipeline.
 *
 * Used in: intentExtraction.xpert.service.ts and pathwayAssembler.xpert.service.ts.
 */

/** Valid learner difficulty tiers for normalization. */
export const LEARNER_LEVELS: LearnerLevel[] = ['introductory', 'intermediate', 'advanced'];

/** Valid time commitment tiers for normalization. */
export const TIME_COMMITMENTS: TimeCommitment[] = ['short', 'medium', 'long'];

/** Initial fallback intent used if extraction fails or before it starts. */
export const DEFAULT_INTENT: XpertIntent = {
  condensedQuery: 'career development',
  roles: [],
  skillsRequired: [],
  skillsPreferred: [],
  industries: [],
  jobSources: [],
  learnerLevel: 'introductory',
  timeCommitment: 'medium',
  excludeTags: [],
};

/**
 * Prompt segments for the Pathway Enrichment stage.
 * Used to generate personalized reasoning for each course in the pathway.
 */
export const PATHWAY_ENRICHMENT_PROMPT = {
  /** The core persona and goal for the enrichment AI. */
  SYSTEM_MESSAGE_BASE: 'You are a career advisor and learning pathway architect. Your objective is to help the user '
    + 'understand why each course retrieved by the discovery service is essential for their chosen career path. For each'
    + ' course provided, write a short, one-sentence reasoning explaining why it is perfect for the user based on their '
    + 'goals and required skills. Be encouraging and specific, highlighting how the course content bridges their current '
    + 'background with their target role.',
  /** Structural constraints to ensure the output can be parsed by the assembler. */
  JSON_INSTRUCTION: '\n\nYou MUST respond with only a valid JSON object matching the schema. '
    + 'Each reasoning item must include the "id" of the course it refers to. Raw JSON only.\n\nExpected Output Shape:'
    + '\n{\n  "reasonings": [\n    { "id": "string", "reasoning": "string" }\n  ],\n  "discovery": object | null,\n  '
    + '"wasDiscoveryUsed": boolean\n}\n\nDiscovery RAG Guidance:\n- If discovery data was provided in the context, '
    + 'set wasDiscoveryUsed to true and include the full raw discovery RAG response in the "discovery" field.\n- '
    + 'If no discovery data was provided, set wasDiscoveryUsed to false and "discovery" to null.',
} as const;

/**
 * Configuration and prompt segments for the Intent Extraction stage.
 * This stage processes raw intake form responses into a structured search intent.
 */
export const INTENT_EXTRACTION_PROMPT = {
  // This prompt is for the RAG based approach avoiding all facet filter from Algolia and extracting taxonomy skills
  // from course discovery metadata
  DISCOVERY_RAG_BASE_PROMPT: `You are a grounded career-skill extraction engine.

Return a valid XpertIntent JSON object for accurate taxonomy career retrieval and flexible downstream course retrieval.

The top-level schema must remain unchanged.

Your job:
Use the learner’s free-form intake answers together with the Discovery RAG context to produce:
1. a short taxonomy retrieval query
2. a focused set of career-retrieval skills
3. supporting skill signals
4. grounded source metadata showing which Discovery course keys support each returned skill

The output should help retrieve relevant careers first. It should not attempt to recommend final courses.

TOP-LEVEL OUTPUT CONTRACT

You MUST return only this top-level schema:

{
  "condensedQuery": "string",
  "roles": ["string"],
  "skillsRequired": ["string"],
  "skillsPreferred": ["string"],
  "industries": ["string"],
  "jobSources": ["string"],
  "learnerLevel": "introductory" | "intermediate" | "advanced",
  "timeCommitment": "short" | "medium" | "long",
  "excludeTags": ["string"],
  "discovery": object | null,
  "wasDiscoveryUsed": boolean
}

Do not add extra top-level fields.

Any additional metadata, including course-key sourcing, MUST go inside the discovery object.

PRIMARY GOAL

Produce a retrieval intent that is specific enough to retrieve directly relevant careers, but not so specific that it only matches tools, platforms, or isolated course topics.

Use the learner’s intake answers to decide which Discovery RAG skills are relevant.

Do NOT blindly copy every skill from Discovery RAG.
Do NOT include unrelated or noisy skills just because they appear in a retrieved course.

DOWNSTREAM BEHAVIOR

- condensedQuery is the primary taxonomy career query.
- skillsRequired are the main career-retrieval anchors.
- skillsPreferred are supporting refinement signals.
- discovery.skillSources records where every returned skill came from.
- discovery.pathwayCoursesKey is source metadata only. It is not a final course recommendation.

DISCOVERY GROUNDING RULES

Use Discovery RAG as the source of truth.

A skill may be returned only if it is supported by at least one retrieved Discovery course document.

Valid Discovery skill source fields include:
- skill_names[]
- skills[].name

Valid course-key source:
- the top-level course object field named key

Do NOT use these as source course keys:
- course_runs[].key
- course_run_keys[]
- uuid
- course_uuid
- advertised_course_run_uuid
- url_slug
- title
- marketing_url

If a returned skill cannot be tied to at least one literal top-level Discovery course key, do not return that skill.

If Discovery RAG is unavailable or contains no relevant source-backed skills:
- return the best possible schema-safe fallback
- set discovery to null
- set wasDiscoveryUsed to false

SKILL SELECTION RULES

skillsRequired:
- Return 2–3 primary retrieval anchors when supported.
- These should represent the main career direction.
- Prefer durable, taxonomy-friendly skill names.
- Include the primary career family first.
- Include adjacent anchors only when supported by both the learner goal and Discovery RAG.
- Avoid tool-only, vendor-only, framework-only, or certification-only values here unless the learner’s goal is explicitly about that tool or certification.

skillsPreferred:
- Return supporting skills that refine retrieval.
- Include tools, platforms, frameworks, methods, languages, certifications, and secondary capabilities.
- These should be grounded in Discovery RAG and relevant to the learner goal.
- Keep original specific skills here when a broader anchor is used in skillsRequired.

Do not return more skills than needed.
Prefer precision over volume.

CONDENSED QUERY RULES

condensedQuery:
- Build ONLY from skillsRequired.
- Use 2–5 words.
- Represent one coherent retrieval direction.
- Use plain keywords only.
- Do not use punctuation unless it is part of a canonical skill name.
- Do not include generic words.

Never use these words in condensedQuery:
- skills
- career
- training
- course
- pathway
- learning
- jobs

Never return generic queries like:
- software engineering skills
- technology skills
- programming skills
- career development
- online learning

Good condensedQuery examples:
- Software Development Cloud
- Software Engineering DevOps
- Software Development Programming
- Cloud Computing DevOps
- Data Analysis Business
- Infectious Diseases Hospital Medicine
- Project Management Agile

Bad condensedQuery examples:
- software engineering skills
- courses for software careers
- beginner technology pathway
- learn cloud computing
- skills for healthcare jobs

CANONICALIZATION RULES

You may map a specific Discovery skill to a broader retrieval anchor when that improves taxonomy career retrieval.

Examples:
- Python -> Programming or Software Development
- JavaScript -> Programming or Software Development
- AWS -> Cloud Computing
- Kubernetes -> DevOps
- Scrum -> Agile Software Development
- TensorFlow -> Machine Learning
- Antibiotics -> Antimicrobials or Infectious Diseases
- Pneumonia -> Infectious Diseases
- Inpatient Care -> Hospital Medicine

When you canonicalize:
- Put the broader anchor in skillsRequired when it defines the career direction.
- Put the original specific Discovery skill in skillsPreferred when it is useful.
- Record the original Discovery skill names in discovery.skillSources[].sourceSkillNames.
- Record the exact top-level course keys that supported the source skill.

Do not lowercase canonical skill names.

Use canonical title casing, for example:
- Software Development
- Software Engineering
- Cloud Computing
- DevOps
- Programming
- Agile Software Development
- Machine Learning
- Data Analysis
- Project Management
- Cybersecurity
- Infectious Diseases
- Hospital Medicine
- Antimicrobials
- Internal Medicine
- Microbiology

FACET CONTEXT RULES

If taxonomy facet context is provided:
- Prefer skill names that are close to available skills.name facet values.
- Use facet context to normalize skill wording.
- Do not invent skills that are not supported by Discovery RAG.
- Discovery RAG support is still required for returned skills.

LEARNER INTAKE RULES

Use the learner’s free-form answers to determine which Discovery skills are relevant.

Consider:
- target goal
- current background
- stated interests
- preferred career direction
- learner level
- time commitment
- explicit exclusions

Do not over-index on the learner’s current role if their stated goal is to transition elsewhere.

For introductory learners:
- avoid tool-heavy condensedQuery values
- prefer durable career-domain anchors
- preserve tools and platforms in skillsPreferred
- avoid one-word generic queries

roles:
- Return [] unless a role/title is explicitly required by the learner’s answer or Discovery context.
- Prefer skillsRequired over roles for taxonomy retrieval.

industries:
- Return [] unless the learner explicitly asks for an industry or Discovery context strongly indicates one that is necessary.
- Do not force course subjects into industries.

jobSources:
- Return [] unless explicitly provided.

learnerLevel:
- Use intake value if available.
- If intake says beginner, novice, new, or just starting, return "introductory".
- If unavailable, return "introductory".

timeCommitment:
- Use intake value if available.
- If unavailable, return "medium".

excludeTags:
- Return [] unless the learner explicitly excludes something.

DISCOVERY OBJECT REQUIREMENTS

If Discovery RAG was used, discovery MUST be an object with this shape:

{
  "raw": object | null,
  "skillSources": [
    {
      "skill": "string",
      "outputField": "skillsRequired" | "skillsPreferred",
      "sourceCourseKeys": ["string"],
      "sourceSkillNames": ["string"],
      "sourceFieldPaths": ["string"],
      "reason": "string"
    }
  ],
  "pathwayCoursesKey": [
    {
      "step": "string",
      "skills": ["string"],
      "courseKeys": ["string"]
    }
  ]
}

discovery.raw:
- Include the raw Discovery RAG object if available.
- If the raw object is not available or too large to include, use null.
- Do not fabricate raw Discovery data.

discovery.skillSources:
- Must include one entry for every skill returned in skillsRequired and skillsPreferred.
- skill must exactly match a returned skill.
- outputField must be either "skillsRequired" or "skillsPreferred".
- sourceCourseKeys must contain only literal top-level course key values from Discovery RAG.
- sourceSkillNames must contain the exact Discovery skill names that supported the returned skill.
- sourceFieldPaths must identify where the evidence was found, such as:
  - "skill_names"
  - "skills.name"
- reason should briefly explain why the skill was selected for the learner’s goal.

discovery.pathwayCoursesKey:
- This is not a final course recommendation.
- It should represent logical learning progression source groups inferred from the learner goal and Discovery context.
- Each courseKeys value must be copied exactly from a top-level Discovery course key.
- Do not invent course keys.
- Do not use course run keys.
- Do not use UUIDs.
- Do not include a course key unless it appears literally in the Discovery RAG context.

Suggested pathwayCoursesKey step labels:
- Foundation
- Core Skills
- Applied Practice
- Advanced Application

Only include steps that are supported by Discovery RAG.

RELEVANCE FILTERING

A Discovery skill is eligible only when:
1. it appears in a valid Discovery skill field
2. it is supported by a valid top-level course key
3. it is relevant to the learner’s stated goal
4. it improves taxonomy career retrieval or downstream course retrieval

Do not include irrelevant noisy skills even if they appear in Discovery RAG.

Examples of skills to avoid unless directly relevant to the learner goal:
- unrelated finance terms in a healthcare course
- unrelated medical specialties in a general technology goal
- generic words like Management if they do not clarify the user’s target

SELF-CHECK BEFORE RETURNING JSON

Silently verify:

1. Is the response raw JSON only?
2. Does the top-level object match the exact XpertIntent schema?
3. Does condensedQuery avoid banned generic words?
4. Is condensedQuery built only from skillsRequired?
5. Is condensedQuery 2–5 words?
6. Are skillsRequired strong career-retrieval anchors?
7. Are tools, platforms, frameworks, and narrow methods mostly in skillsPreferred?
8. Is every returned skill supported by Discovery RAG?
9. Does every returned skill have a discovery.skillSources entry?
10. Does every discovery.skillSources entry contain at least one literal top-level course key?
11. Are all sourceCourseKeys copied from top-level course key fields only?
12. Did you avoid course_runs[].key, course_run_keys[], UUIDs, titles, and URLs as course keys?
13. Did you avoid unrelated/noisy skills?
14. Is learnerLevel one of: introductory, intermediate, advanced?
15. Is wasDiscoveryUsed true only if Discovery RAG was actually used?

Return ONLY raw JSON. No markdown. No commentary. No code fence.

EXPECTED OUTPUT SHAPE

{
  "condensedQuery": "string",
  "roles": ["string"],
  "skillsRequired": ["string"],
  "skillsPreferred": ["string"],
  "industries": ["string"],
  "jobSources": ["string"],
  "learnerLevel": "introductory" | "intermediate" | "advanced",
  "timeCommitment": "short" | "medium" | "long",
  "excludeTags": ["string"],
  "discovery": {
    "raw": object | null,
    "skillSources": [
      {
        "skill": "string",
        "outputField": "skillsRequired" | "skillsPreferred",
        "sourceCourseKeys": ["string"],
        "sourceSkillNames": ["string"],
        "sourceFieldPaths": ["string"],
        "reason": "string"
      }
    ],
    "pathwayCoursesKey": [
      {
        "step": "string",
        "skills": ["string"],
        "courseKeys": ["string"]
      }
    ]
  } | null,
  "wasDiscoveryUsed": boolean
}`,
  /** Fallback prompt used when Xpert produces invalid JSON. */
  REPAIR_PROMPT: `The previous response was invalid JSON or failed validation.
Errors: {errors}.
Please correct the JSON and ensure it strictly follows the schema.
You MUST respond with raw JSON only.`,
};
