# Preregistration Verification Guidance for AI Agents

## Purpose
Guide for AI agents assisting scientists in verifying statistical analyses for preregistration compliance. Evaluate whether research was conducted according to preregistered plans and identify deviations affecting test validity and severity.

---

## 1. KEY CONCEPTS

### What is Preregistration?
- **Definition**: Time-stamped documents describing planned analyses before data collection, demonstrating analyses were not selected based on data
- **Primary Goal**: Enable evaluation of test **severity** - likelihood of proving a prediction wrong when wrong, and right when right
- **Philosophy**: Enables evaluation of test severity; does not inherently make a study better or worse

### Severity of a Test
- **High Severity Test**: High probability of finding predicted effect if correct AND high probability of not finding effect if incorrect
- **Threats to Severity**:
  - Practices inflating Type 1 error rate (false positives)
  - Low power, unreliable measures, flawed procedures (false negatives)
  - Incorrect analyses (Type 3 errors - answering wrong question)

### Confirmatory vs. Exploratory Research

#### Primary Hypotheses (Confirmatory)
- Main study goal
- Type 1 and Type 2 error rates controlled as low as affordable
- Requires preregistration for severe testing
- Results should be impressive if corroborated, consequential if falsified

#### Secondary Hypotheses (Semi-Confirmatory)
- Additional questions planned before data collection
- Type 1 error rate controlled at justifiable level
- Type 2 error rate NOT controlled (may lack power)
- Non-significant results cannot be interpreted definitively

#### Exploratory Results
- Analyses not hypothesized in advance, developed during analysis
- Error rates may be uncontrolled
- Have NOT been severely tested
- Report with appropriate caveats
- Require independent replication before building upon them

### HARKING (Hypothesizing After Results are Known)
- **Definition**: Formulating hypotheses after seeing data, presenting as if predicted a priori
- **Problem**: Cannot test a hypothesis on data used to generate it
- **Red Flags**: Multiple conditions tested but only one reported; post-hoc selection of specific subgroups

---

## 2. GUIDELINES & RECOMMENDATIONS

### What Should Be Preregistered

#### Core Components
1. **Study Design**: Full description of experimental/study design
2. **Sample Plan**: Participant selection, inclusion/exclusion criteria, sample size justification
3. **Statistical Analysis Plan**: All planned analyses specified in detail
4. **Hypotheses at Three Levels**:
   - **Conceptual**: High-level theoretical prediction
   - **Operationalized**: Variables and measures
   - **Statistical**: Exact statistical tests and parameters

#### Journal Article Reporting Standards (JARS) Elements

**1. Randomization Procedures**
- Unit of randomization
- Procedure to generate random assignment sequence
- Details of restrictions (blocking, stratification)

**2. Participant Selection**
- Inclusion and exclusion criteria
- Demographic restrictions
- Sampling method
- Expected participation rate (may require pilot data)

**3. Sample Size and Power**
- **Intended sample size** (prevents optional stopping)
- **Determination method**:
  - Power analysis with justification of assumptions
  - Expected effect size (must be realistic)
  - Smallest effect size of interest (SESOI)
  - Precision of parameter estimates
- **Interim analyses and stopping rules** if using sequential analysis

**4. Data Diagnostics**
- Criteria for post-collection participant exclusion
- Missing data handling and imputation methods
- Statistical outlier definition and processing
- Data distribution analyses
- Planned data transformations

**5. Analytic Strategy**
- Analysis for each hypothesis level (primary, secondary, exploratory)
- Protection against experiment-wise error
- Multiple comparison corrections
- Statistical test assumptions and assumption checking procedures

### Level of Detail Required

#### Minimum Standard: Machine-Readable Specification
- **Gold Standard**: Simulated dataset + analysis code that can be run on future data
- **Components that must be explicit**:
  - **Analysis**: Exact statistical test(s)
  - **Data**: Input format and structure
  - **Results**: What outputs will be examined
  - **Criteria**: Thresholds for decision-making (e.g., alpha = 0.01)
  - **Evaluation**: How results will be interpreted (corroboration vs. falsification)

#### Specificity Requirements
- Alpha level (not just "p < 0.05")
- Exact test variant (e.g., Welch's t-test vs. Student's t-test)
- One-tailed vs. two-tailed tests
- Effect size measures and interpretation
- Handling of multiple outcomes (AND vs. OR logic)

#### Code-Based Preregistration
- Create simulated dataset matching expected data structure
- Write complete analysis script
- Specify all parameters for statistical tests
- Include assumption checks and data preprocessing
- Examples: https://osf.io/un3zx, https://osf.io/c4t28, https://osf.io/gjsft/ (section 25)

#### Evaluation Specification
Must explicitly state how test results will be evaluated:
- When prediction is corroborated
- When prediction is falsified
- When results are inconclusive
- Logic for multiple hypotheses (e.g., "both effects must occur" vs. "at least one effect")

### Sample Size Justification Framework

**Four-Step Process** (use Shiny app: https://shiny.ieis.tue.nl/sample_size_justification/):

1. **Describe Population**: Who is sampled, resource limitations, population accessibility
2. **Specify Effects of Interest**: Smallest effect size of interest (SESOI)
3. **State Inferential Goal**: Hypothesis testing, measuring effect with precision, or decision making with error control
4. **Evaluate Informational Value**: Total sample size, why adequate for research question, download justification PDF

---

## 3. COMMON MISTAKES & PITFALLS

### Incomplete Preregistrations
- Vague hypotheses not sufficiently constraining flexibility
- Missing alpha levels (implicit assumption of 0.05)
- Unspecified test variants (ambiguity about which test)
- No evaluation criteria (unclear when hypothesis is corroborated vs. falsified)
- Verbal-only descriptions (too ambiguous, not machine-readable)
- Missing multiple comparison corrections
- No outlier/exclusion criteria (room for post-hoc data manipulation)

### Insufficient Detail to Evaluate Severity
- Cannot determine if changes reduced severity
- Cannot distinguish planned from post-hoc analyses
- Unclear which analyses are primary vs. exploratory
- Missing justifications for key decisions

### Flexibility Not Addressed
- No plan for assumption violations (e.g., non-normal data)
- No criteria for participant exclusions
- No specification of missing data handling
- No plan for interim analyses
- Multiple dependent variables without correction strategy

### Preregistering When Not Ready
- **Warning Signs**:
  - Making many arbitrary choices without justification
  - Too many uncertainties in analysis approach
  - Theory not sufficiently developed
  - Unclear what would falsify prediction
  - Test would be neither impressive nor consequential
- **Solution**: May need more exploratory/descriptive work first

---

## 4. VERIFICATION CHECKLISTS

### Checklist 1: Preregistration Existence and Accessibility
- [ ] Study claims to be preregistered
- [ ] Preregistration document is accessible (public or view-only link)
- [ ] Time-stamp predates data collection
- [ ] Preregistration has DOI or other persistent identifier
- [ ] Registration platform is legitimate (OSF, AsPredicted, ClinicalTrials.gov, PsychArchives, etc.)

### Checklist 2: Preregistration Completeness (Based on JARS)
- [ ] **Randomization**: Procedure and unit clearly specified
- [ ] **Participants**:
  - [ ] Inclusion/exclusion criteria defined
  - [ ] Population described
  - [ ] Sampling method specified
- [ ] **Sample Size**:
  - [ ] Intended N specified
  - [ ] Justification provided (power analysis, resource constraints, etc.)
  - [ ] Assumptions in justification are realistic
  - [ ] Stopping rules specified if applicable
- [ ] **Data Diagnostics**:
  - [ ] Exclusion criteria specified
  - [ ] Missing data handling plan
  - [ ] Outlier definition and handling
  - [ ] Assumption checking procedures
  - [ ] Data transformations specified
- [ ] **Analyses**:
  - [ ] Specific statistical tests named
  - [ ] Alpha level specified
  - [ ] Multiple comparison corrections specified
  - [ ] Primary vs. secondary vs. exploratory clearly distinguished

### Checklist 3: Statistical Analysis Plan Detail
- [ ] **Hypothesis Levels**:
  - [ ] Conceptual hypothesis stated
  - [ ] Operationalization clear
  - [ ] Statistical implementation explicit
- [ ] **Test Specifications**:
  - [ ] Exact test identified (not just "t-test" but "Welch's t-test")
  - [ ] Test parameters specified (alpha, tails, effect size measure)
  - [ ] Software and version specified
  - [ ] Analysis code provided or fully described
- [ ] **Evaluation Criteria**:
  - [ ] Corroboration criteria explicit
  - [ ] Falsification criteria explicit
  - [ ] Inconclusive outcome defined
  - [ ] Logic for multiple tests specified (AND/OR)

### Checklist 4: Deviation Assessment
- [ ] Authors report any deviations from preregistration
- [ ] Each deviation includes:
  - [ ] When deviation was decided
  - [ ] Where it occurred (which analysis)
  - [ ] Why it was necessary
  - [ ] Impact on test severity evaluated
  - [ ] Impact on inference validity evaluated
- [ ] Deviations documented in supplementary materials or using forms (e.g., https://osf.io/6fk87 or https://osf.io/yrvcg)

### Checklist 5: Red Flags for Questionable Research Practices
- [ ] Achieved sample size differs from preregistered without explanation
- [ ] Multiple outcomes tested but only significant ones reported
- [ ] Subgroup analyses not prespecified but presented as primary
- [ ] Exclusions applied that were not preregistered
- [ ] Statistical test differs from preregistration without justification
- [ ] Alpha level differs from preregistration
- [ ] One-tailed test used when two-tailed was preregistered
- [ ] Multiple comparison correction omitted
- [ ] Exploratory results presented as confirmatory
- [ ] No mention of non-significant results from preregistered analyses

---

## 5. REPORTING REQUIREMENTS

### How to Report Deviations from Preregistration

#### Transparency Requirements
All deviations must be reported explicitly, regardless of impact. For each deviation, report:

1. **When**: At what stage was the deviation decided?
   - Before seeing any data
   - After data collection but before analysis
   - During data analysis
   - After seeing results

2. **Where**: Which specific analysis or procedure was affected?

3. **Why**: What justified the deviation?
   - Unforeseen events
   - Errors in preregistration
   - Missing information in preregistration
   - Violations of untested assumptions
   - Falsification of auxiliary hypotheses

4. **Impact Evaluation**:
   - Effect on test severity
   - Effect on inference validity
   - Whether deviation increases or decreases severity

#### Structured Deviation Reporting Forms
- Use templates: https://osf.io/6fk87 or https://osf.io/yrvcg
- Include in supplementary materials
- Reference in main text

#### In-Text Reporting
- Include Author Note on title page with registration information
- In Methods: "This study was preregistered at [URL]. All deviations are reported in Supplementary Materials."
- In Results: Clearly label analyses as "preregistered" vs. "exploratory"
- In Discussion: Address how deviations affect interpretation

### Reporting Different Analysis Types

#### Primary (Preregistered) Analyses
- Clearly labeled as confirmatory
- Report exactly as preregistered unless deviation is documented
- If deviation occurred, report both original plan and revised analysis
- Emphasize these results in abstract and conclusions

#### Secondary (Preregistered but Underpowered) Analyses
- Label as secondary in preregistration and manuscript
- Note that non-significant results are inconclusive due to low power
- Significant results can be interpreted but should be replicated
- Do not draw strong conclusions from null results

#### Exploratory Analyses
- Clearly labeled as exploratory
- Report with caveat: "error rates may be uncontrolled"
- State that findings require independent replication
- Can be reported in detail but must not be presented as severely tested
- Appropriate for hypothesis generation, not confirmation

---

## 6. DECISION RULES

### When is Preregistration Necessary?

#### REQUIRED for:
- **Confirmatory hypothesis testing** where:
  - Goal is to severely test a prediction
  - Making claims about hypothesis support/rejection
  - Publishing in confirmatory research context
  - Clinical trials and medical research (often legally required)

#### BENEFICIAL but Not Strictly Required for:
- Improving experimental design (secondary benefit)
- Forcing careful planning
- Demonstrating rigor and transparency
- Registered Reports (required by format)

#### NOT Necessary for:
- **Exploratory research** where:
  - Goal is description or hypothesis generation
  - Examining relationships between variables
  - Exploring boundary conditions
  - Theory not yet developed enough
- **Research with fully specified theory**:
  - Only one rational analysis plan exists
  - Analysis approach is completely clear to all peers
  - (Rare in practice)

### When to Accept Deviations from Preregistration

#### ACCEPTABLE Deviations (May Increase Severity):

**1. Unforeseen Events**
- Participants arrive impaired (not preregistered exclusion)
- Equipment malfunction requiring procedure change
- External events affecting study conditions
- **Criteria**: Could not have been anticipated; increases validity

**2. Errors in Preregistration**
- Typos or obvious mistakes in written plan
- Incorrect statistical formula that would yield invalid inference
- Wrong software function specified
- **Criteria**: Clear error; correction increases validity; no impact from seeing data

**3. Missing Information**
- Preregistration silent on assumption violations
- Forgot to specify normality test procedure
- Didn't specify what to do if data is non-normal
- **Criteria**: Adding missing procedures increases validity; choose most conservative option

**4. Violations of Untested Assumptions**
- Data distribution violates test assumptions
- Homogeneity of variance violated
- Sample characteristics differ from expected
- **Criteria**: Using robust alternative is standard practice; increases validity

**5. Falsification of Auxiliary Hypotheses**
- Manipulation check fails
- Measure reliability is unacceptable
- Population assumption violated
- **Criteria**: Fundamental assumption proven false; continuing as planned would be invalid

#### QUESTIONABLE Deviations (Likely Decrease Severity):

**1. Post-Hoc Flexibility**
- Excluding outliers not prespecified
- Changing from two-tailed to one-tailed after seeing data
- Adding covariates not preregistered
- Selecting subset of conditions to analyze
- **Impact**: Increases Type 1 error rate; reduces severity

**2. Sample Size Deviations**
- Stopping early because result is significant
- Collecting more data because result is not significant
- Changing planned sample size without documented justification
- **Impact**: Inflates Type 1 error; severely reduces severity

**3. Changing Primary Hypotheses**
- Switching which outcome is "primary" based on results
- Elevating exploratory finding to primary status
- Demoting non-significant primary hypothesis to exploratory
- **Impact**: HARKING; completely eliminates severity

**4. Analysis Substitutions**
- Changing statistical test to get desired result
- Switching from preregistered correction to no correction
- Modifying alpha level
- **Impact**: Reduces severity; may invalidate error control

### Evaluation Framework for Deviations

Use this 2×2 framework to evaluate each deviation:

|                    | **Increases Validity** | **Decreases Validity** |
|--------------------|----------------------|----------------------|
| **Increases Severity** | Rare; usually acceptable | Contradiction; investigate |
| **Decreases Severity** | May be justified; evaluate carefully | Not acceptable |

**Key Principle**: Deviations that increase validity at expense of severity may be justified if:
- Transparently reported
- Strongly justified
- Original analysis also reported for comparison
- Impact on severity explicitly evaluated
- Test still more severe than non-preregistered test

### How to Evaluate Severity and Validity Trade-offs

**Severity** (property of the test):
- How likely to find effect when present
- How likely to NOT find effect when absent
- Reduced by practices that inflate error rates
- Can be quantified through error rates

**Validity** (property of the inference):
- Approximate truth of the inference
- Reduced by violated assumptions
- Reduced by flawed procedures
- More subjective evaluation

**Decision Rule**:
1. If deviation increases both validity and severity → Accept
2. If deviation decreases both → Reject
3. If deviation increases validity but decreases severity:
   - Evaluate magnitude of each effect
   - Require strong justification
   - Require transparency about trade-off
   - Consider if alternative approaches exist
4. If deviation increases severity but decreases validity → Unusual; investigate error in reasoning

---

## 7. VERIFICATION WORKFLOW FOR AI AGENTS

### Step 1: Locate and Access Preregistration
1. Check manuscript for registration statement (usually in Author Note or Methods)
2. Extract registration URL/DOI
3. Access and download preregistration document
4. Verify timestamp predates data collection (check manuscript submission/collection dates)

### Step 2: Assess Preregistration Quality
1. Use **Checklist 2** (Completeness) and **Checklist 3** (Detail)
2. Note any missing elements
3. Categorize as: High quality / Adequate / Insufficient for verification
4. If insufficient, note limitations in verification ability

### Step 3: Compare Preregistration to Manuscript
For each analysis in manuscript:

1. **Locate in preregistration**:
   - Is analysis mentioned?
   - Is it primary, secondary, or not mentioned (exploratory)?

2. **Compare specifications**:
   - Sample size (intended vs. achieved)
   - Statistical test (exact match?)
   - Parameters (alpha, tails, corrections)
   - Exclusions (as planned?)
   - Transformations (as planned?)

3. **Document discrepancies**:
   - List each deviation
   - Check if deviation is acknowledged in manuscript
   - Check if deviation is justified

### Step 4: Evaluate Reported Deviations
For each acknowledged deviation:

1. **Assess reporting quality**:
   - When, where, why reported?
   - Impact on severity evaluated?
   - Impact on validity evaluated?

2. **Evaluate justification**:
   - Which category? (unforeseen, error, missing info, assumption violation, auxiliary hypothesis)
   - Is justification convincing?
   - Is deviation acceptable per decision rules above?

3. **Check for mitigation**:
   - Is original analysis also reported?
   - Are sensitivity analyses provided?
   - Is conservative approach chosen when ambiguous?

### Step 5: Identify Unreported Deviations
Cross-reference manuscript against preregistration:

1. **Sample deviations**:
   - Different N than planned?
   - Different exclusions?
   - Different subgroups analyzed?

2. **Analysis deviations**:
   - Different tests used?
   - Different alpha levels?
   - Different multiple comparison strategy?
   - Additional covariates?

3. **Outcome deviations**:
   - Different primary outcome?
   - Selective reporting of outcomes?
   - Results missing for preregistered analyses?

### Step 6: Apply Red Flag Checklist
Use **Checklist 5** to identify potential questionable research practices.

### Step 7: Generate Verification Report

**Structure**:
1. **Summary**: Overall assessment of preregistration adherence
2. **Preregistration Quality**: Completeness and detail evaluation
3. **Reported Deviations**: List with assessment of each
4. **Unreported Deviations**: List discovered discrepancies
5. **Red Flags**: Any questionable practices identified
6. **Severity Assessment**: Overall evaluation of how severely hypotheses were tested
7. **Recommendations**: Suggested actions or clarifications needed

**Rating Scale**:
- **Excellent**: Detailed preregistration, minimal justifiable deviations, fully transparent
- **Good**: Adequate preregistration, minor deviations well-justified and reported
- **Fair**: Incomplete preregistration or moderate deviations with partial reporting
- **Poor**: Vague preregistration or major unreported deviations
- **Inadequate**: No meaningful preregistration or severe unreported deviations suggesting QRPs

---

## 8. SPECIAL TOPICS

### Registered Reports
- **Definition**: Publication format where study is peer-reviewed before data collection
- **Process**: Introduction, methods, and analysis plan reviewed; acceptance based on question and design, not results
- **Benefits**: Feedback improves study before data collection; reduces publication bias; shifts criticism from post-hoc to pre-data; substantially higher rate of null findings
- **Verification**: Should have very high preregistration quality; compare Stage 1 protocol to Stage 2 manuscript

### Study Registries
- **Clinical Trials**: ClinicalTrials.gov (required for many medical studies)
- **Psychology**: PsychArchives, OSF Registries
- **General**: OSF, AsPredicted
- **Requirements Vary**: Some require primary outcome preregistration; some require results posting; compliance varies

### Historical Context
- **Bakan (1966)**: Proposed "central registry" for test directionality decisions
- **de Groot (1969)**: Advocated detailed advance planning
- **FDA (1997)**: Began promoting study registries
- **Kaplan & Irvin (2015)**: Showed 57% → 8% drop in significant results after ClinicalTrials.gov registration requirement
- **2014+**: Registered Reports format introduced and spreading

### Multiple Comparison Corrections
- **When Required**: Testing multiple related hypotheses
- **Common Corrections**:
  - Bonferroni: α_corrected = α / number of tests
  - Holm-Bonferroni: Sequential Bonferroni
  - False Discovery Rate (FDR): For many comparisons
- **Preregistration Requirement**: Must specify family of tests and correction method
- **Example**: Bem's ESP study - 5 picture categories tested, Bonferroni correction would use α = 0.01 instead of 0.05, making p = 0.013 non-significant

### Sequential Analysis and Interim Looks
- **Problem**: Looking at data multiple times inflates Type 1 error
- **Solution**: Pre-specify stopping rules with error control
- **Methods**: Group sequential design, alpha spending functions, Bayesian sequential analysis
- **Preregistration Requirement**: Full specification of interim analysis schedule and stopping rules

### Equivalence Testing
- **Purpose**: Test for absence of meaningful effect (not just failure to reject null)
- **Preregistration Requirements**: Smallest effect size of interest (equivalence bounds), justification for bounds, alpha level, whether using TOST or other method
- **Evaluation**: Can corroborate absence of effect (unlike traditional NHST)

---

## 9. EXAMPLE EVALUATION SCENARIOS

### Scenario 1: High-Quality Preregistration with Justified Deviation

**Preregistration States**:
- Welch's t-test, α = 0.05, two-tailed
- Assume normal distribution
- N = 80 per group based on power analysis

**Manuscript Reports**:
- N = 78 and 82 (close to planned)
- Shapiro-Wilk test showed non-normal distribution
- Used Mann-Whitney U test instead
- Reports: "Deviation from preregistration: non-parametric test used due to violation of normality assumption (W = 0.92, p = 0.001)"

**Evaluation**:
- Deviation: Test type change
- Category: Assumption violation
- Justified: Yes (standard practice when normality violated)
- Impact: Increases validity, minimal impact on severity (more conservative)
- Transparent: Yes, clearly reported
- **Assessment**: ACCEPTABLE - actually increases rigor

### Scenario 2: Questionable Deviation

**Preregistration States**:
- Compare groups A, B, C on outcome Y
- ANOVA with α = 0.05
- Bonferroni correction for post-hoc comparisons

**Manuscript Reports**:
- Only compares groups A and C
- Uses t-test with α = 0.05
- No mention of group B
- No mention of deviation

**Evaluation**:
- Deviation: Selective outcome reporting, missing group
- Category: Post-hoc flexibility
- Justified: No explanation provided
- Impact: Increases Type 1 error (should be α = 0.017 with Bonferroni)
- Transparent: No
- Red Flags: Selective reporting, unreported deviation
- **Assessment**: QUESTIONABLE - potential p-hacking

### Scenario 3: Acceptable Unforeseen Event

**Preregistration States**:
- N = 100 based on power analysis
- No specific exclusion criteria beyond "must complete task"

**Manuscript Reports**:
- Initial N = 105
- Excluded 12 participants who reported being under influence of alcohol/drugs (discovered during debriefing)
- Final N = 93
- Reports: "Deviation from preregistration: We did not anticipate participants would be intoxicated. Post-hoc exclusion of intoxicated participants (n=12) was necessary for valid data. This was not reflected in our preregistered sample size."

**Evaluation**:
- Deviation: Exclusions not prespecified
- Category: Unforeseen event
- Justified: Yes (valid concern; could not anticipate)
- Impact: Increases validity substantially, small reduction in power
- Transparent: Yes
- **Assessment**: ACCEPTABLE - most researchers would agree this improves validity

### Scenario 4: Insufficient Preregistration

**Preregistration States**:
- "We will compare groups using appropriate statistical methods"
- "Sample size will be determined based on available resources"
- "We predict a significant difference between groups"

**Manuscript Reports**:
- Multiple t-tests reported
- N = 45 total (no justification)
- Multiple outcomes tested, only significant ones highlighted

**Evaluation**:
- Preregistration quality: INSUFFICIENT
- Missing: Specific tests, alpha level, sample size justification, primary outcome
- Cannot verify: Whether reported analyses match plan (plan too vague)
- Essentially equivalent to: No preregistration
- **Assessment**: INADEQUATE - preregistration does not constrain flexibility

---

## 10. PRACTICAL GUIDANCE FOR AI AGENTS

### Communication with Scientists

**When Preregistration is Good**:
- Acknowledge the rigor
- Point out strengths
- Note how it enhances credibility

**When Deviations are Found**:
- Be non-judgmental but clear
- Distinguish between reported and unreported
- Ask for clarification rather than assuming bad intent
- Frame as opportunities for transparency

**When Preregistration is Inadequate**:
- Explain specific limitations
- Suggest how it could be improved in future
- Note that claims cannot be treated as severely tested
- Recommend labeling analyses as exploratory

### Balancing Rigor and Practicality

**Recognize**:
- Preregistration is relatively new for many fields
- Perfect preregistration is rare
- Some deviations are necessary and appropriate
- The goal is transparency, not rigidity

**Avoid**:
- Treating preregistration as binary (registered vs. not)
- Rejecting all deviations automatically
- Ignoring validity concerns in favor of severity
- Being more strict than the scientific community consensus

**Encourage**:
- Continuous improvement in preregistration practice
- Transparent reporting of all deviations
- Thoughtful justification of decisions
- Learning from each preregistration experience

### Common Scientist Questions to Anticipate

**Q: "Do I have to follow my preregistration exactly?"**
A: No. Deviations are acceptable when justified and transparently reported. The goal is to allow readers to evaluate how severely you tested your hypothesis. Valid deviations often increase the quality of your inference.

**Q: "I found an error in my preregistration. What do I do?"**
A: Report it clearly in your manuscript. Explain the error, when you discovered it, how you corrected it, and why the correction is justified. If possible, report both the preregistered analysis (with error) and corrected analysis.

**Q: "My data violates assumptions I didn't preregister checking. Can I change my analysis?"**
A: Yes. This is a standard acceptable deviation. Report that you checked assumptions (even though not preregistered), found violations, and used an appropriate alternative test. This increases validity.

**Q: "How detailed does my preregistration need to be?"**
A: Detailed enough that readers can distinguish your planned analyses from post-hoc decisions. The gold standard is simulated data + analysis code. At minimum, specify exact tests, parameters (alpha, tails), sample size, exclusions, and how you'll evaluate results (corroboration vs. falsification criteria).

**Q: "Can I report exploratory analyses?"**
A: Absolutely. Just label them clearly as exploratory and note that error rates may be uncontrolled. Exploratory findings are valuable for hypothesis generation but require replication.

**Q: "I'm not ready to preregister because I'm still exploring. Is that okay?"**
A: Yes. Not all research requires preregistration. Exploratory research, descriptive studies, and hypothesis generation are all valuable without preregistration. Only claim severe testing of hypotheses when you've actually preregistered and followed through.

---

## 11. RESOURCES AND TOOLS

### Preregistration Platforms
- **OSF**: https://osf.io/ (most flexible, 4-year embargo max)
- **AsPredicted**: https://aspredicted.org/ (simple, word limits, focus on key info)
- **PsychArchives**: https://pasa.psycharchives.org (psychology-specific, high standards)
- **ClinicalTrials.gov**: https://clinicaltrials.gov/ (required for many clinical trials)

### Templates and Guides
- **Van 't Veer & Giner-Sorolla Template**: Good starting point for beginners
- **OSF Template Collection**: https://osf.io/zab38/wiki/home/
- **Wicherts et al. (2016) Checklist**: Comprehensive degrees of freedom checklist
- **JARS**: https://apastyle.apa.org/jars/ (includes multiple study types)

### Sample Size Justification
- **Shiny App**: https://shiny.ieis.tue.nl/sample_size_justification/
- Guides through 4-step process
- Generates downloadable PDF justification

### Deviation Reporting Forms
- https://osf.io/6fk87
- https://osf.io/yrvcg

### Example High-Quality Preregistrations
- https://osf.io/un3zx
- https://osf.io/c4t28
- https://osf.io/gjsft/ (section 25)

### Key References
- Lakens (2024): When to deviate from preregistration
- Lakens (2019): Value of preregistration
- Appelbaum et al. (2018): JARS guidelines
- Wicherts et al. (2016): Degrees of freedom checklist
- Chambers (2022): Registered Reports
- Mayo (2011): Error statistics and severity
- Kerr (1998): HARKing

---

## 12. SUMMARY DECISION TREE

```
Is study preregistered?
├─ NO
│  └─ All analyses are exploratory
│     └─ Cannot claim severe testing
│     └─ Require replication
│
└─ YES
   └─ Assess preregistration quality
      ├─ INSUFFICIENT (too vague)
      │  └─ Treat as effectively non-preregistered
      │
      └─ ADEQUATE/GOOD
         └─ Compare manuscript to preregistration
            ├─ PERFECT MATCH
            │  └─ Verify primary hypotheses are severely tested
            │
            └─ DEVIATIONS PRESENT
               └─ For each deviation:
                  ├─ Is it REPORTED?
                  │  ├─ NO → RED FLAG
                  │  │  └─ Document as unreported deviation
                  │  │  └─ Severity compromised
                  │  │
                  │  └─ YES → Evaluate justification
                  │     ├─ Which category?
                  │     │  ├─ Unforeseen event → Usually acceptable
                  │     │  ├─ Error in prereg → Acceptable if clearly error
                  │     │  ├─ Missing info → Acceptable if conservative choice
                  │     │  ├─ Assumption violation → Acceptable if standard practice
                  │     │  ├─ Auxiliary hypothesis falsified → Acceptable if demonstrated
                  │     │  └─ Post-hoc flexibility → Usually questionable
                  │     │
                  │     ├─ Impact on validity?
                  │     │  ├─ Increases → Point in favor
                  │     │  └─ Decreases → Point against
                  │     │
                  │     ├─ Impact on severity?
                  │     │  ├─ Increases → Point in favor
                  │     │  ├─ Minimal change → Neutral
                  │     │  └─ Decreases → Requires strong justification
                  │     │
                  │     └─ Final assessment:
                  │        ├─ ACCEPTABLE
                  │        ├─ QUESTIONABLE (needs clarification)
                  │        └─ UNACCEPTABLE
                  │
                  └─ Generate overall severity rating:
                     ├─ Excellent: Detailed prereg + no/minor acceptable deviations
                     ├─ Good: Adequate prereg + justified deviations only
                     ├─ Fair: Some issues but mostly transparent
                     ├─ Poor: Major deviations or incomplete reporting
                     └─ Inadequate: Severe problems threatening validity of claims
```

---

## FINAL NOTE FOR AI AGENTS

Your role is to help scientists improve their research transparency and rigor, not to serve as research police. When evaluating preregistrations:

1. **Be helpful**: Frame findings constructively
2. **Be accurate**: Base assessments on the guidance above
3. **Be fair**: Consider context and recognize that standards are still evolving
4. **Be clear**: Explain your reasoning so scientists can learn
5. **Be balanced**: Acknowledge both strengths and areas for improvement

The ultimate goal is research that produces valid, credible, and reproducible findings. Preregistration is one important tool toward that goal, but it must be applied thoughtfully and evaluated in context.
