# Confirmation Bias: Guidance for Statistical Analysis Verification

## Core Definitions

**Confirmation Bias**: The seeking or interpreting of evidence in ways that are partial to existing beliefs, expectations, or a hypothesis in hand.

**Organized Skepticism**: The scrutiny of beliefs in terms of empirical and logical criteria - claims are only accepted after surviving scrutiny by peers.

**Motivated Reasoning**: The tendency for scientists to have strong personal commitment to their work, leading to emotional investment that can distort objectivity.

---

## Key Concepts

### 1. Researcher Degrees of Freedom
- Flexibility in research methods can be exploited to increase probability of finding support for hypotheses
- "Hunting with a shot-gun" for significant differences across many tests
- Analyzing data in many different ways until a significant result is observed
- The distinction between intentional dishonesty and bias through lack of understanding is often unclear

### 2. The Paradox of Scientific Commitment
- Scientists need emotional commitment to persist through difficult research
- This same commitment creates risk of confirmation bias
- Scientists are not objective, emotionally disinterested beings - this is a fiction
- "Every scientific idea needs a personal representative who will defend and nourish that idea so that it doesn't suffer a premature death"

### 3. Mertonian Norms of Science
Scientists subscribe to these norms but don't always follow them:
- **Universalism**: Claims accepted/rejected based on merit, not personal attributes
- **Communism**: Findings belong to the community; secrecy is antithetical
- **Disinterestedness**: Claims should be truthful, not spurious (institutional norm)
- **Organized Skepticism**: Empirical and logical scrutiny before acceptance

### 4. Types of Bias in Research

#### Data Fabrication
- Students and researchers fabricate data when procedures are too difficult or burdensome
- Pressure to succeed can lead to fabrication rather than admitting failure
- Code of conduct violations should be reported, not hidden

#### Citation Bias
- Selectively citing research that supports desired claims
- Ignoring evidence to the contrary
- Citing one's own work or friends disproportionately
- Avoiding citation of criticism or rival scientists
- Statistically significant results cited more than non-significant ones
- **Prevention**: Always read what you cite, systematically search literature

#### Experimenter Effects
- Treating experimental conditions differently than control conditions
- Recording errors biased toward hypotheses
- Observer error due to wishful thinking or threshold interactions

#### Investigator Analysis Effects
- Choosing hypotheses after looking at data ("eyeballing")
- Selecting which test to perform after identifying interesting patterns
- Opportunistic use of analytical flexibility

---

## Common Mistakes and Pitfalls

### 1. Biased Double-Checking
**Problem**: Researchers are more likely to double-check unexpected results than expected ones, leading to selective error correction.

**Manifestation**:
- Repeating calculations only when results are "distressing" or unexpected
- Accepting errors that support the hypothesis
- Greater care evident in repeated calculations for unwanted results

### 2. Post-hoc Hypothesis Selection
**Problem**: Collecting large amounts of data without pre-planned analyses, then selecting hypotheses after studying the data.

**Risk**: Inflated Type 1 error rates; claiming confirmatory evidence for exploratory findings.

### 3. Wason Task Phenomenon
**Pattern**: People naturally test sets that would confirm their rule rather than attempting falsification.

**Implication**: Researchers need explicit procedures to encourage falsification attempts, not just confirmation.

### 4. Parental Affection for Theories (Chamberlin, 1890)
**Progression**:
1. Offer original explanation → affection springs into existence
2. Explanation becomes theory → parental affections cluster
3. Unconscious selection and magnifying of supporting phenomena
4. Unconscious neglect of contradictory evidence
5. Special searching-out of confirmatory phenomena
6. Pressing theory to fit facts and facts to fit theory

### 5. Strategic Ambiguity
**Problem**: Remaining vague about which results would/wouldn't be predicted by a theory to avoid falsification.

**Context**: Particularly problematic in adversarial collaborations where clear predictions are needed.

### 6. Tricks to Make Claims Sound More Convincing
- Citing weak or incorrect work
- Making claims not backed by evidence
- Overgeneralizing beyond evidence
- Selectively quoting or citing out of context
- Downplaying limitations
- Using AI tools that create fake references

---

## Detection Checklist

### Questions to Ask About Any Analysis

#### Pre-Analysis Phase
- [ ] Was the analysis plan specified before seeing the data?
- [ ] Was the hypothesis formulated before data collection?
- [ ] Were all planned analyses documented?
- [ ] Was the alpha level set in advance using a "round number" (e.g., 5%)?
- [ ] Were auxiliary assumptions explicitly stated?

#### During Analysis
- [ ] Are researchers checking all analyses or only unexpected results?
- [ ] Is there evidence of "hunting" through multiple tests?
- [ ] Were any tests chosen after identifying interesting patterns?
- [ ] Has the same data been analyzed multiple ways without correction?
- [ ] Are researchers able to specify what would falsify their hypothesis?

#### Post-Analysis
- [ ] Were there deviations from the pre-registered plan? If so, are they justified?
- [ ] Are negative results reported alongside positive ones?
- [ ] Is the literature review balanced or selective?
- [ ] Are limitations honestly acknowledged?
- [ ] Would results survive scrutiny from someone motivated to find flaws?

#### Reporting Phase
- [ ] Are all conducted analyses reported (including non-significant ones)?
- [ ] Is citation of the literature systematic rather than cherry-picked?
- [ ] Are criticisms of methods/measures acknowledged?
- [ ] Is the distinction between exploratory and confirmatory clear?

---

## Prevention Strategies

### 1. Error Control
**Method**: Use fixed alpha levels specified before looking at data.

**Rationale**:
- Prevents "gerrymandering" critical values to prove a point
- Avoids suggestion that criteria were picked post-hoc
- Uses round numbers (5%) to signal objectivity
- "If researchers are allowed to set alpha after looking at data, confirmation bias can influence conclusions"

### 2. Preregistration
**Purpose**: Specify analysis plan before data access.

**Benefits**:
- Prevents choosing tests after "eyeballing" data
- Allows peers to scrutinize whether analyses were truly pre-planned
- Deviations can still be justified but must be transparent
- Institutional implementation of organized skepticism

**Key**: Preregistration alone is insufficient - must combine with fixed alpha and transparent reporting.

### 3. Blinding Strategies

#### Double-Blind Studies
- Neither participant nor experimenter knows condition assignment
- Prevents participant effects and experimenter effects

#### Blind Analysis
- Data file has no identifying information about which observations belong to which condition
- Colleague uninvolved in analysis creates adjusted data
- Analyses performed on blinded data
- "Unblinding party" reveals actual results
- Prevents bias during data analysis

#### Anonymous Manuscript Submission
- Removes author identity to prevent reviewer bias
- Prevents reputation effects from influencing evaluation

### 4. Adversarial Collaboration
**Structure**: Scientists with opposing theoretical predictions collaborate on research design and execution.

**Requirements**:
- Ability to design experiments that differentiate between theories (strong inference)
- Clear predictions from each theory specified in advance
- Agreement on what results would support/falsify each position
- Joint execution and interpretation

**Example**: Multi-lab adversarial collaboration on facial feedback hypothesis (Coles et al., 2022)

**Challenges**:
- May not always be possible to design critical tests
- Requires testing auxiliary assumptions first
- Risk of strategic ambiguity about predictions

### 5. Devil's Advocate
**Role**: Person assigned to argue against accepted/desired position regardless of personal belief.

**Benefits**:
- Shields critic from interpersonal backlash
- Ensures at least one voice raises criticism
- Promotes diversity of viewpoints
- Counters pressure to conform

**Requirements for Effectiveness**:
- Must be genuinely listened to, not ceremonial
- Needs sufficient knowledge for quality counter-arguments
- Transparency about criticism raised and how addressed
- Authentic minority dissent may be even better

### 6. Red Team Science
**Structure**: Diverse group of scientific critics who examine research from all angles at each phase.

**Advantages over peer review**:
- Occurs before data collection, not after manuscript completion
- Faster, more extensive communication
- Greater diversity and expertise than typical peer review
- Members chosen for specific expertise (content, statistics, measurement)

**Best uses**: Highly sensitive or expensive research projects.

### 7. Co-Pilot Model for Statistical Analysis
**Method**: Share data with colleagues for double-checking all analyses.

**Rationale**:
- Errors happen and are more likely in direction of hypotheses
- Universal checking removes bias from selective checking
- Becomes normal practice, not signal of distrust
- One layer in "Swiss cheese" model of error prevention

**Implementation**: Build habit of mutual checking within research groups.

### 8. Separation of Roles

#### Theorists vs. Experimentalists
- Common in physics, rare in psychology
- Experimentalists don't test their own theories
- Reduces confirmation bias in data collection
- Models fully defined by theorists before testing

#### Professional Experimenters
- Emotional investment in accurate data collection, not hypothesis support
- Rewards based on data quality, not supporting predictions
- Less incentive for biased data than scientist-experimenters

#### Outsourced Discussion Sections
- Other researchers write interpretation of results
- Reduces personal biases in theoretical interpretation
- Original authors provide data and results only

### 9. Method of Multiple Working Hypotheses (Chamberlin, 1890)
**Approach**: Actively develop many competing hypotheses simultaneously.

**Logic**:
- None has preferential status
- "Parent of a family of hypotheses" forbidden to favor any one
- Becomes conflict between ideas, not between men
- Enables aiming at conclusive disproofs without combativeness

**Requirements**:
- Expertise in each theoretical model
- Skills to test all different hypotheses
- Mental capacity to embrace multiple ideas simultaneously

### 10. Strong Inference (Platt, 1964)
**Steps**:
1. Devise alternative hypotheses
2. Design crucial experiment with alternative possible outcomes
3. Carry out experiment to get clean result
4. Recycle procedure to refine surviving hypotheses

**Benefit**: "Daily life in the laboratory takes on interest and excitement...students can hardly wait to get to work to see how the detective story will come out."

### 11. Independent Replication
**Purpose**: Test whether findings survive when tested by researchers without same biases.

**What it reduces likelihood of**:
- Subtle characteristics specific to original study
- Fraud or fabrication
- Inflated Type 1 errors due to analytical flexibility
- Suggestion or willingness to accept results from prestigious investigators

**Interpretation**:
- Successful replication: Increases confidence but doesn't eliminate all concerns
- Failed replication: Difficult to interpret (may be genuine differences, botched replication, or original finding was false)
- Multiple failed replications: Serious cause for concern

### 12. Peer Review
**Function**: Subject hypotheses and evidential reasoning to critical scrutiny.

**Limitations**:
- Only as good as the peers
- Often occurs too late (after research complete)
- Reviewers may lack statistical expertise
- Time demands reduce thoroughput review
- Typically no access to materials, data, scripts
- Confidentiality can entrench established views

**Evolution**:
- Open peer review (content available)
- Signed reviews (reviewers identified)
- Post-publication peer review (e.g., PubPeer)

**Reality Check**: Cannot trust all peer-reviewed manuscripts are error-free.

### 13. Computational Reproducibility
**Methods**:
- Computationally reproducible manuscripts prevent copy-paste errors
- Automated analysis pipelines reduce manual errors
- Version control tracks all changes
- Makes errors discoverable by others

---

## Decision Rules: When to Be Especially Vigilant

### High-Risk Situations

1. **When results align perfectly with your predictions**
   - "The intensity of conviction that a hypothesis is true has no bearing on whether it is true"
   - Most vulnerable to overlooking errors in favorable results
   - Implement mandatory double-checking regardless of outcome

2. **When you have strong career incentives for positive results**
   - Pressure for jobs, funding, promotions
   - Competitive advantage gained by sacrificing rigor
   - Need for external accountability mechanisms

3. **When testing your own theory**
   - Parental affection for intellectual offspring
   - Unconscious selection of supporting phenomena
   - Consider separation of theorist and experimentalist roles

4. **When facing difficult/tedious procedures**
   - Temptation to cut corners or fabricate
   - Students particularly vulnerable
   - Bring problems to attention rather than violate conduct

5. **When conducting many tests without pre-planning**
   - "Hunting with a shot-gun" for significance
   - High-speed computers enable hundreds of tests
   - Require explicit pre-registration or correction

6. **When criticism threatens your work**
   - Tendency to not cite criticism
   - Selective citation to make claims more convincing
   - Implement systematic literature reviews

7. **After observing unexpected results**
   - Risk of biased double-checking
   - May repeat analyses with "greater care" only for unwanted results
   - Adopt co-pilot model for all analyses

8. **In fields without institutionalized skepticism**
   - No preregistration requirements
   - Limited peer review of materials/data
   - No tradition of independent replication
   - Individual responsibility to implement safeguards

### Protective Actions by Scenario

| Scenario | Primary Protection | Secondary Protection |
|----------|-------------------|---------------------|
| Testing own theory | Adversarial collaboration | Devil's advocate |
| Multiple analyses possible | Preregistration | Blind analysis |
| Strong career pressure | Red team review | Separation of roles |
| Subjective measurements | Double-blind procedures | Independent verification |
| Complex calculations | Co-pilot checking | Computational reproducibility |
| Controversial claims | Independent replication | Open materials/data |
| Literature review | Systematic search | Citation audit |
| Post-hoc patterns | Clear exploratory labeling | Replication study |

---

## Guidelines for AI Agents Verifying Statistical Analyses

### Primary Verification Objectives

1. **Detect undisclosed flexibility**
   - Check if analysis plan existed before data access
   - Identify multiple testing without correction
   - Flag post-hoc hypotheses presented as a priori

2. **Assess error checking patterns**
   - Verify all analyses checked, not just unexpected ones
   - Identify computational reproducibility
   - Check for independent verification

3. **Evaluate citation patterns**
   - Assess balance of cited literature
   - Flag missing criticism or contrary evidence
   - Identify disproportionate self-citation

4. **Examine role separation**
   - Note if same person developed theory and tested it
   - Check for blinding procedures
   - Assess independence of replication attempts

### Specific Questions to Pose

**About the Analysis Plan:**
- "Was this analysis specified before data collection?"
- "How many other analyses were conducted?"
- "Were any tests selected after examining data patterns?"
- "What would constitute evidence against the hypothesis?"

**About Error Prevention:**
- "Were all calculations independently verified?"
- "Is the analysis computationally reproducible?"
- "Were any errors found and corrected? Which direction did they point?"

**About Literature Integration:**
- "What evidence contradicts these claims?"
- "Were criticisms of this method/measure considered?"
- "How was the literature search conducted?"

**About Bias Controls:**
- "What blinding procedures were used?"
- "Who had access to unblinded data when?"
- "Were any adversarial or devil's advocate roles employed?"

### Red Flags Requiring Escalation

1. Results that are "too good to be true" (statistically implausible precision)
2. No acknowledgment of limitations or contrary evidence
3. Post-hoc analyses presented as confirmatory
4. Selective reporting of subset of conducted analyses
5. Claims that generalize far beyond the evidence
6. Absence of any error-control mechanisms
7. Lack of transparency about materials, data, or procedures
8. Resistance to sharing materials for verification

### Recommended Actions

**For routine analyses:**
- Verify preregistration or analysis plan
- Check computational reproducibility
- Assess citation balance
- Confirm appropriate error corrections

**For high-stakes analyses:**
- Require independent verification (co-pilot model)
- Request red team review
- Mandate blinding procedures
- Organize adversarial collaboration if possible

**For problematic analyses:**
- Document specific concerns
- Request additional transparency
- Recommend independent replication
- Consider post-publication review

---

## Core Principles to Remember

1. **"You must not fool yourself - and you are the easiest person to fool"** (Feynman)
   - Self-deception is the primary threat
   - External accountability is essential
   - Procedures must be specified before outcomes known

2. **Bias is universal, not personal**
   - All researchers are susceptible
   - Implementing safeguards is professional, not accusatory
   - Trust processes, not intentions

3. **Organized skepticism is institutional**
   - Individual commitment insufficient
   - Requires structural mechanisms
   - Science works despite human limitations, not because of superhuman objectivity

4. **Transparency enables scrutiny**
   - Open materials, data, and code
   - Documented decision-making
   - Clear distinction between exploratory and confirmatory

5. **The negative instance is most powerful**
   - Seek falsification, not just confirmation
   - "Duly and regularly impartial" between affirmatives and negatives
   - Tests that could prove you wrong are most informative

6. **Emotional commitment is double-edged**
   - Necessary for persistence and motivation
   - Creates risk of bias
   - Requires explicit countermeasures, not denial

7. **Science is collective, not individual**
   - No single safeguard is sufficient
   - Multiple layers of protection needed
   - Independent verification is fundamental

---

## Recommended Implementation Priority

### Tier 1: Essential for All Analyses
1. Fixed alpha level before data access
2. Preregistration or documented analysis plan
3. Systematic double-checking (co-pilot model)
4. Computational reproducibility

### Tier 2: Important for Most Analyses
5. Blind analysis where feasible
6. Systematic literature review
7. Independent verification of key results
8. Clear exploratory vs. confirmatory labeling

### Tier 3: For High-Stakes or Controversial Work
9. Adversarial collaboration
10. Red team review
11. Independent replication
12. Role separation (theorist/experimentalist)

### Tier 4: Advanced Safeguards
13. Devil's advocate procedures
14. Multiple working hypotheses
15. Professional experimenter model
16. Outsourced interpretation

---

## Final Wisdom

**On the human condition in science** (Beck, 1957):
"Each successive step in the method of science calls for a greater emotional investment and adds to the difficulty of remaining objective. When the ego is involved, self-criticism may come hard."

**On the solution** (Bacon, 1620):
"In establishing any true axiom the negative instance is the most powerful."

**On the necessity** (Medawar, 1979):
"The intensity of the conviction that a hypothesis is true has no bearing on whether it is true or not. The importance of the strength of our conviction is only to provide a proportionately strong incentive to find out if the hypothesis will stand up to critical evaluation."

**On the practice** (Scientist B, quoted in Mitroff, 1974):
"You've got to make a clear distinction between not being objective and cheating. A good scientist will not be above changing his theory if he gets a preponderance of evidence that doesn't support it, but basically he's looking to defend it."

**On eternal vigilance** (Goethe, 1792):
"Thus we can never be too careful in our efforts to avoid drawing hasty conclusions from experiments...For here at this pass, this transition from empirical evidence to judgment, cognition to application, all the inner enemies of man lie in wait: imagination; impatience; haste; self-satisfaction; rigidity; formalistic thought; prejudice; ease; frivolity; fickleness—this whole throng and its retinue."

---

## Quick Reference: Bias Mitigation Toolkit

| Bias Risk | Mitigation Tool | Implementation Cost | Effectiveness |
|-----------|----------------|---------------------|---------------|
| Post-hoc hypothesis | Preregistration | Low | High |
| Selective testing | Fixed alpha | Minimal | High |
| Calculation errors | Co-pilot model | Medium | High |
| Experimenter effects | Double-blind | Medium-High | High |
| Analytical bias | Blind analysis | Medium | High |
| Theory attachment | Multiple hypotheses | High | Medium |
| Selective citation | Systematic review | Medium | Medium-High |
| Interpretation bias | Adversarial collaboration | High | High |
| Confirmation seeking | Devil's advocate | Low | Medium |
| Overall bias | Red team | High | Very High |

---

*This guidance distills Chapter 16: Confirmation Bias and Organized Skepticism from statistical_inferences-master. For verification of statistical analyses, prioritize transparency, independent checking, and procedures specified before outcomes are known.*
