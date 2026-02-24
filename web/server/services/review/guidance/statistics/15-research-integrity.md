# Research Integrity - AI Agent Guidance Document

## Purpose
This document provides actionable knowledge for AI agents assisting scientists in verifying statistical analyses for research integrity compliance.

---

## 1. KEY CONCEPTS

### Research Integrity vs Research Ethics
- **Research Integrity**: Professional standards based on codes of conduct
- **Research Ethics**: Moral principles (autonomy, beneficence, non-maleficence, justice)
- Both are complementary; integrity focuses on professional conduct, ethics on moral principles

### Core Principles of Research Integrity
All research must demonstrate:
- **Honesty**: Truthful reporting of methods, results, and interpretations
- **Transparency**: Open disclosure of processes, data, and decisions
- **Scrupulousness**: Meticulous attention to detail and accuracy
- **Accountability**: Responsibility for research quality and integrity
- **Reliability**: Reproducible and trustworthy findings
- **Respect**: For participants, colleagues, and scientific community
- **Independence**: Freedom from undue external influences

### Research Waste Prevention
Research waste occurs when studies:
- Address the wrong research questions
- Are unnecessary duplications without added value
- Use poor study designs that cannot answer the research question
- Fail to be reported promptly or at all
- Produce biased or unusable reports

**Critical verification**: Confirm research design can actually answer the stated research question.

---

## 2. MISCONDUCT CATEGORIES

### Fabrication
**Definition**: Making up results and recording them as if they were real data.

**Examples**:
- Creating entire fake datasets
- Inventing demographic data for participants when forgotten
- Presenting simulated data as real collected data

**Key distinction**: Simulation for power analysis is acceptable IF clearly labeled as simulated data.

### Falsification
**Definition**: Manipulating research aspects (including data) without scientific justification.

**Examples**:
- Changing data values to achieve statistical significance
- Removing or altering results without proper justification
- Modifying outliers to support hypotheses

**Critical requirement**: Any data changes require:
1. Explicit documentation of what was changed
2. Proper scientific justification for the change
3. Transparent reporting in publications

### Plagiarism
**Definition**: Using others' work/ideas without proper credit.

**Includes**:
- Using text without quotation marks and citations
- Self-plagiarism (text recycling) without disclosure
- Reusing substantial portions of previous work to inflate publication count

**Acceptable text recycling**:
- Method section descriptions (with citation of original)
- Standard procedural descriptions
- When cited and disclosed

**Unacceptable text recycling**:
- Undisclosed overlap in results, discussion, or conclusions
- Republishing same content to appear more productive

---

## 3. QUESTIONABLE RESEARCH PRACTICES (QRPs)

### Critical Note
"Questionable Research Practices" is a misnomer - most are direct violations of research integrity codes, not merely questionable.

### Common QRPs (High Prevalence)

#### Selective Reporting of Studies/Analyses (40-80% admission rates)
- Publishing only studies with significant results
- Withholding null results from publication
- Failing to report all experiments conducted

**Violation**: Codes of conduct require researchers to "Do justice to all research results obtained"

**Mitigation**: Registered Reports help ensure null results are publishable

#### Selective Reporting of Outcomes/Measures (22-64% admission rates)
- Reporting only dependent variables that "worked"
- Hiding measures that didn't support hypotheses
- Cherry-picking from multiple outcome measures

#### Failing to Report All Conditions (3-45% admission rates)
- Omitting experimental conditions from reports
- Reporting subset of manipulations tested

#### Optional Stopping (11-60% admission rates)
- Repeatedly checking for significance during data collection
- Stopping when p < 0.05 is achieved
- Continuing collection only when results are non-significant

**Proper alternative**: Sequential analysis with pre-specified stopping rules

#### Excluding Data Based on Impact on Results (19-40% admission rates)
- Removing outliers only when they hurt significance
- Excluding participants selectively to obtain desired results

**Proper procedure**: Pre-specify exclusion criteria before seeing results

#### HARKing (Hypothesizing After Results are Known) (9-58% admission rates)
- Presenting post-hoc hypotheses as a priori predictions
- Reframing exploratory findings as confirmatory

#### Selectively Reporting Performed Analyses (22-67% admission rates)
- Running multiple analyses, reporting only significant ones
- Switching between analysis methods based on results
- Selectively including/excluding covariates

#### Opportunistically Rounding p-values (3-33% admission rates)
- Reporting p = 0.054 as p < 0.05
- Manipulating precision to suggest significance

#### Data Fabrication (0-45% admission rates)
- Creating fake data points
- Inventing missing values
- Falsifying results

**Note**: Prevalence estimates around 4% in large-scale surveys, but varies by field

---

## 4. QUESTIONABLE vs QUESTIONABLE REPORTING PRACTICES

### Important Distinction
- **Questionable Research Practices**: Problematic data collection/analysis decisions
- **Questionable Reporting Practices**: Failing to transparently report legitimate decisions

### When in Doubt Rule
Transparently report ALL decisions made during data analysis. Readers should have complete information to evaluate:
- Whether deviations from plans decrease test severity
- What flexibility was used in analyses
- What alternative analyses were considered

---

## 5. RED FLAGS FOR INTEGRITY VIOLATIONS

### Intent-Based Classification

#### Violations Requiring Intent
- Data fabrication (intentionally creating false data)
- Data falsification (manipulating data for desired outcome)
- Selective reporting to support preferred conclusions
- Changes to data/analyses without scientific justification

#### Honest Errors vs Misconduct
**Honest mistake example**: Forgetting to collect demographic data and transparently reporting the gap

**Misconduct example**: Inventing demographic data to hide the mistake

**Key differentiator**: Whether the action is taken to conceal errors or manipulate outcomes

### Statistical Red Flags
Use bias detection tests to identify systematic QRP use:
- p-curve analysis
- z-curve analysis
- Test for Excess Significance (TES)
- GRIM test (for means)
- SPRITE test (for distributions)

---

## 6. TRANSPARENCY & REPORTING REQUIREMENTS

### Data Sharing Standards
**Requirement**: "Make research findings and research data public subsequent to completion of the research"

**Exceptions**: Valid reasons for non-disclosure must be established (e.g., privacy concerns)

**GDPR Compliance**:
- Remove all personal identifiers before public sharing
- Remove: names, IP addresses, panel ID numbers, location data
- Check version control history (entire file history is accessible)
- Obtain consent for data sharing in advance

**Special category data requiring explicit consent**:
- Racial/ethnic origin
- Political opinions
- Religious/philosophical beliefs
- Genetic/biometric data
- Sexual orientation/sex life data

### Informed Consent Requirements
Must include:
- Study goals
- Voluntary participation statement
- Right to withdraw
- Risks and benefits (including payment)
- Data privacy information
- Data controller contact details
- Data Protection Officer contact
- Participant rights (withdrawal timeline)
- Data storage and sharing plans
- Retention period

### Required Disclosures

#### Conflicts of Interest
**Must disclose**:
- Financial relationships with entities related to research
- Consulting arrangements
- Advocacy organization affiliations
- Personal relationships with reviewed work
- Any situation where personal advantage could interfere with truth-seeking

**Note**: Having conflicts is not misconduct; failing to disclose them is.

#### Analysis Decisions
**Must report**:
- All data exclusions and justifications
- All data transformations and why performed
- All tested conditions and measures
- Deviations from pre-registered plans
- Rationale for any data-driven analytical decisions

---

## 7. VERIFICATION CHECKLISTS

### Pre-Analysis Verification

- [ ] Research design can answer the stated research question
- [ ] Sample size is justified (not arbitrary)
- [ ] Study has scientific/scholarly/societal relevance (not just publishability)
- [ ] Analysis plan is documented before seeing results
- [ ] Data exclusion criteria are pre-specified
- [ ] All measures and conditions are planned to be reported

### Data Collection Verification

- [ ] Informed consent obtained from all participants
- [ ] Consent form includes data sharing permissions
- [ ] Special category data collection is necessary and consented
- [ ] Data collection procedures are documented
- [ ] Mistakes are recorded rather than concealed
- [ ] No fabrication of missing data

### Analysis Verification

- [ ] No data changes without explicit justification
- [ ] Outlier handling follows pre-specified rules
- [ ] No optional stopping without sequential analysis framework
- [ ] All planned analyses are reported, not just significant ones
- [ ] Exploratory analyses are clearly labeled as such
- [ ] p-values are reported with full precision (not rounded opportunistically)

### Reporting Verification

- [ ] All conditions/measures are reported
- [ ] Null results are included
- [ ] Data exclusions are documented with justifications
- [ ] Analysis deviations from plan are explained
- [ ] Data and materials are shared (or valid reasons given)
- [ ] Conflicts of interest are disclosed
- [ ] Methods allow others to reproduce the study
- [ ] Negative results are given equal weight to positive findings

### Publication Verification

- [ ] All studies conducted are reported (not just significant ones)
- [ ] Results section matches pre-registered hypotheses
- [ ] Post-hoc hypotheses are clearly labeled
- [ ] Text recycling (if any) is disclosed and cited
- [ ] Proper attribution for all ideas and text
- [ ] No undisclosed overlap with previous publications

---

## 8. DECISION RULES & GUIDELINES

### When Data Changes Are Acceptable

**Acceptable IF**:
1. Explicit documentation of what was changed
2. Proper scientific justification exists
3. Transparent reporting in publication
4. Decision not motivated by impact on results

**Example**: Changing 117 to 17 for age
- **Acceptable**: If justified by reasonable belief participant meant 17, documented, and reported
- **Unacceptable**: If done only because it makes results significant

### When to Exclude Data

**Pre-specify exclusion criteria including**:
- Failed attention checks
- Non-completion
- Technical errors
- Outlier definitions (e.g., ±3 SD)

**Never acceptable**: Excluding data after seeing it affects significance (without pre-specification)

### When Multiple Analyses Are Acceptable

**Acceptable approaches**:
1. Pre-register all planned analyses, report all of them
2. Clearly label exploratory vs confirmatory analyses
3. Use correction for multiple comparisons if conducting many tests
4. Report sensitivity analyses alongside main analysis

**Unacceptable**: Running many analyses, reporting only significant ones without disclosure

### When Not to Report a Study

**Acceptable reasons**:
- Fatal programming error in experiment
- All participants misunderstood instructions
- Manipulation completely failed (after manipulation check)

**Still recommended**: Share even flawed studies in supplementary materials or repositories to help others avoid same mistakes

**Never acceptable**: Not reporting because results were non-significant

### Supervisor/Power Dynamics

**Violations include**:
- Pressuring junior researchers to violate integrity codes
- Creating environments where integrity violations are expected
- Rewarding misconduct or punishing ethical behavior

**Junior researchers**: Have right to refuse unethical requests; should contact confidential advisors

---

## 9. ETHICAL REVIEW REQUIREMENTS

### When Ethics Review is Required
Before conducting research involving:
- Human participants (ERB/IRB review)
- Medical interventions (METC review)
- Animal subjects (Animal Ethics Committee)

### Ethics Review Balance
Two goals to balance:
1. Protect research subjects from harm
2. Enable research that benefits society

### Risk-Benefit Evaluation
Consider:
- Potential harm (physical, psychological, social)
- Study benefits (scientific knowledge, societal impact)
- Alternative designs with lower risk
- Necessity of potentially harmful elements

### Required Protections
- **Self-determination**: Participants choose whether to participate
- **Informed consent**: Truthful information before participation
- **Right to withdraw**: Can stop at any time without penalty
- **Confidentiality**: Protect participant identities
- **Debriefing**: Explain deception if necessary for study
- **No coercion**: Especially important with vulnerable populations

---

## 10. AI AGENT VERIFICATION PROTOCOLS

### When Reviewing Statistical Analyses

#### Level 1: Basic Integrity Check
1. Are sample size, exclusions, and analytical choices justified?
2. Is the research design appropriate for the research question?
3. Are all measures and conditions reported?
4. Are data transformations documented?
5. Are conflicts of interest disclosed?

#### Level 2: Transparency Assessment
1. Can another researcher reproduce this analysis?
2. Are analysis decisions explained?
3. Are deviations from plans (if any) documented?
4. Is it clear which analyses were planned vs exploratory?
5. Are materials and data available or is there valid reason for non-sharing?

#### Level 3: Red Flag Detection
1. Are only significant results reported across multiple tests?
2. Are p-values suspiciously close to 0.05?
3. Are sample sizes round numbers without justification?
4. Are there unexplained exclusions?
5. Do results seem "too good to be true"?
6. Are there inconsistencies in reported numbers?

#### Level 4: Deep Verification
1. Request raw data and verify reported statistics
2. Check for GRIM/SPRITE test violations
3. Conduct p-curve/z-curve analysis if meta-analyzing
4. Verify computational reproducibility
5. Check for selective reporting across researcher's publications

### Recommended AI Agent Actions

#### When Detecting Potential Issues
1. **Flag, don't accuse**: Present concerns as questions, not accusations
2. **Request clarification**: Ask for justification of questionable decisions
3. **Suggest transparency**: Recommend additional disclosures
4. **Offer alternatives**: Propose integrity-preserving solutions
5. **Document concerns**: Keep record of issues for potential review

#### When Assisting Researchers
1. **Proactive reminders**: Prompt for pre-registration before analysis
2. **Documentation assistance**: Help create transparent reporting
3. **Template provision**: Offer disclosure templates for conflicts, exclusions
4. **Best practice suggestions**: Recommend Registered Reports, open data
5. **Error prevention**: Catch honest mistakes before they become issues

#### When Uncertain
1. **Default to transparency**: When in doubt, recommend fuller disclosure
2. **Consult guidelines**: Reference specific code of conduct provisions
3. **Seek human review**: Flag for ethics board or integrity officer
4. **Preserve evidence**: Document the analytical pathway
5. **Avoid assumptions**: Don't assume misconduct; verify facts

---

## 11. INSTITUTIONAL RESPONSIBILITIES

### What Institutions Must Provide
- Training in ethics and research integrity for all researchers
- Access to and awareness of relevant codes and regulations
- Open, safe, inclusive research culture
- Confidential advisors for integrity concerns
- Anonymous reporting mechanisms (e.g., SpeakUp services)
- Support for researchers facing integrity pressures

### Reporting Mechanisms
Researchers should have access to:
- Internal confidential advisors
- External confidential advisors
- Anonymous reporting systems
- Clear procedures for investigating concerns
- Protection from retaliation for reporting

---

## 12. COMMON SCENARIOS & GUIDANCE

### Scenario: Forgot to Collect Demographic Data
**Wrong approach**: Guess the demographics from memory and add to dataset
**Right approach**: Transparently report in methods: "Demographic data was inadvertently not collected for 2 participants"
**Lesson**: Honest mistakes should be admitted, not concealed

### Scenario: Results Non-Significant, Want to Collect More Data
**Wrong approach**: Keep collecting until p < 0.05, then stop
**Right approach**:
- Option 1: Pre-specify total sample size, collect all before looking
- Option 2: Use sequential analysis with predetermined stopping rules
**Lesson**: Optional stopping inflates Type I error unless properly controlled

### Scenario: Outlier Makes Result Non-Significant
**Wrong approach**: Remove outlier to achieve significance
**Right approach**:
- Pre-specify outlier handling before analysis
- Report results both with and without outlier
- Justify exclusion on scientific grounds, not statistical outcome
**Lesson**: Data exclusion decisions must be independent of their effect on results

### Scenario: Multiple Measures, Only One Significant
**Wrong approach**: Report only the significant measure
**Right approach**:
- Report all measures collected
- Correct for multiple comparisons if appropriate
- Clearly state which was primary outcome
**Lesson**: Selective reporting violates "do justice to all research results"

### Scenario: Exploratory Finding Looks Interesting
**Wrong approach**: Present as if it was the original hypothesis (HARKing)
**Right approach**:
- Clearly label as exploratory finding
- Suggest as hypothesis for future confirmatory study
- Discuss in appropriate (exploratory) context
**Lesson**: Exploratory findings are valuable but must be labeled accurately

### Scenario: Manipulation Check Failed
**Wrong approach**: Don't report the study to avoid admitting failure
**Right approach**:
- Report in supplementary materials or repository
- Explain why manipulation failed
- Help others avoid the same mistake
**Lesson**: Failed studies have value for preventing research waste

### Scenario: Supervisor Requests Questionable Practice
**Wrong approach**: Comply to complete PhD faster
**Right approach**:
- Discuss concerns with supervisor
- Consult confidential advisor if needed
- Reference specific code of conduct provisions
- Escalate if pressure continues
**Lesson**: Integrity violations under pressure are still violations; support systems exist

### Scenario: Reviewing Competitor's Paper
**Wrong approach**: Write unfairly negative review to delay publication
**Right approach**:
- Declare conflict of interest to editor
- Decline to review if cannot be objective
**Lesson**: Personal relationships can create conflicts requiring disclosure/recusal

### Scenario: Company Funds Research on Their Product
**Wrong approach**: Hide the funding source
**Right approach**:
- Disclose funding source in all publications
- Disclose any consulting relationships
- Maintain independence in analysis and reporting
**Lesson**: Conflicts must be disclosed, even if no actual bias occurred

---

## 13. SEVERITY CLASSIFICATION

### Minor Issues (Require Correction, Not Sanctions)
- Inadvertent errors in calculations
- Forgotten measurements (transparently reported)
- Minor deviations from plans (explained and justified)
- Ambiguous wording in methods
- Missing citations (unintentional)

### Moderate Issues (May Require Investigation)
- Unexplained data exclusions
- Unreported measures or conditions
- Insufficient methodological detail for reproduction
- Text recycling without disclosure
- Missing conflict of interest disclosures

### Serious Issues (Require Formal Investigation)
- Selective reporting of studies based on outcomes
- Systematic use of QRPs to achieve significance
- Data manipulation without justification
- Undisclosed conflicts affecting conclusions
- Plagiarism

### Severe Misconduct (Require Institutional Response)
- Data fabrication
- Data falsification with intent to deceive
- Large-scale plagiarism
- Systematic fraud across multiple publications
- Pressuring others to commit misconduct

---

## 14. CULTURE & INCENTIVE CONSIDERATIONS

### Systemic Pressures Contributing to Misconduct
- Hypercompetition for grants and positions
- Publish-or-perish culture
- Reward systems favoring quantity over quality
- Journals preferring significant results
- Individual rewards vs collective costs (social dilemma)

### Structural Solutions
- Registered Reports (publish before results known)
- Open data and materials requirements
- Bias detection tests (p-curve, z-curve)
- Pre-registration platforms
- Reproducibility verification
- Changing incentive structures
- Rewarding transparency over significance

### Individual Responsibility
Scientists paid by public funds have duty to:
- Generate reliable knowledge
- Put science before career advancement
- Maintain public trust in science
- Follow professional standards
- Report integrity violations
- Mentor others in ethical practices

**Core principle**: Nothing done for career advancement should compromise the primary responsibility of generating trustworthy knowledge.

---

## 15. ADDITIONAL CONSIDERATIONS

### Open Science Practices
**Recommendations that align with integrity**:
- Share data in public repositories (with privacy protection)
- Share analysis code and materials
- Pre-register study plans
- Use Registered Reports format
- Publish pre-prints for rapid dissemination
- Make work accessible (not behind paywalls when possible)

### Documentation Best Practices
- Keep detailed lab notebooks
- Document all decisions and their timing
- Version control for analysis scripts
- Time-stamped pre-registrations
- Audit trails for data processing
- Communication records about analytical decisions

### When to Seek Help
Contact ethics board, integrity officer, or confidential advisor when:
- Uncertain if practice violates code
- Pressured to engage in questionable practices
- Witnessing potential misconduct
- Facing dilemmas about reporting
- Needing guidance on complex situations

---

## 16. QUICK REFERENCE: KEY QUOTES FROM CODES OF CONDUCT

### On Data Integrity
"Do not fabricate data or research results and do not report fabricated material as if it were fact. Do justice to all research results obtained. Do not remove or change results without explicit and proper justification. Do not add fabricated data during the data analysis."

### On Reporting
"Make sure that the choice of research methods, data analysis, assessment of results and consideration of possible explanations is not determined by non-scientific or non-scholarly (e.g. commercial or political) interests, arguments or preferences."

### On Negative Results
"Authors and publishers consider negative results to be as valid as positive findings for publication and dissemination."

### On Data Sharing
"As far as possible, make research findings and research data public subsequent to completion of the research. If this is not possible, establish valid reasons for their non-disclosure."

### On Supervision
"As a supervisor, principal investigator, research director or manager, refrain from any action which might encourage a researcher to disregard any of the standards in this chapter."

### On Research Design
"Make sure that your research design can answer the research question."

### On Relevance
"Conduct research that can be of scientific, scholarly and/or societal relevance."

---

## 17. RESOURCES & REFERENCES

### Key Documents
- European Code of Conduct for Research Integrity (ALLEA)
- Netherlands Code of Conduct for Research Integrity
- Declaration of Helsinki (medical research)
- GDPR regulations for research
- COPE (Committee on Publication Ethics) guidelines

### Detection Tools
- p-curve analysis (bias detection)
- z-curve analysis (bias detection)
- GRIM test (granularity inconsistency)
- SPRITE test (sample parameter reconstruction)
- statcheck (statistical reporting consistency)

### Support Services
- Institutional confidential advisors
- External confidential advisors
- Anonymous reporting platforms (e.g., SpeakUp)
- Data Protection Officers
- Ethics review boards

### Educational Resources
- Institutional research integrity training
- Code of conduct documents
- Ethics board guidelines
- Open science framework tutorials
- Pre-registration templates

---

## FINAL GUIDANCE FOR AI AGENTS

### Primary Directive
Help scientists maintain the highest standards of research integrity by:
1. Preventing integrity violations through proactive guidance
2. Detecting potential issues through systematic verification
3. Promoting transparency in all research decisions
4. Supporting honest error correction over concealment
5. Maintaining public trust in scientific research

### When in Doubt
- Default to transparency
- Recommend fuller disclosure
- Suggest consulting human experts
- Document concerns systematically
- Never assume malicious intent without evidence
- Always offer integrity-preserving alternatives

### Success Metrics
Research integrity is maintained when:
- All decisions are transparent and justified
- Methods allow reproduction
- All results are reported fairly
- Participants are protected
- Conflicts are disclosed
- Data supports conclusions
- Future researchers can build on the work
- Public trust in science is preserved

**Remember**: The goal is not to punish mistakes but to ensure reliable, trustworthy knowledge generation for the benefit of society.
