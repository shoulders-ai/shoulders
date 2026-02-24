# Statistical Questions: Guidance for Verifying Statistical Analyses

## Overview
This guide provides actionable knowledge for verifying that statistical analyses are properly aligned with research questions. The core principle: **information quality** depends on clearly specifying the goal of data collection, the statistical modeling approach, and the usefulness of data to draw conclusions about effects of interest.

---

## 1. KEY CONCEPTS

### 1.1 Three Types of Statistical Questions

**Description**
- **Purpose**: Answer questions about features of empirical manifestations (duration, quantity, location)
- **Method**: Estimation statistics
- **Output**: Point estimates with precision intervals
- **Use case**: When you need to characterize a phenomenon, not explain or predict it
- **Key consideration**: Both means AND variances are valuable for theory formation

**Prediction**
- **Purpose**: Apply algorithms or models to predict future observations
- **Method**: Machine learning, cross-validation
- **Output**: Prediction accuracy, prediction error
- **Use case**: When goal is to minimize prediction error on new data
- **Key consideration**: Balance bias-variance tradeoff

**Explanation**
- **Purpose**: Test causal assumptions or explanations derived from theories
- **Method**: Hypothesis testing, experimental manipulation
- **Output**: Support/rejection of theoretical predictions
- **Use case**: When testing if a theory explains observed data
- **Key consideration**: Never testing theory alone - always includes auxiliary hypotheses

### 1.2 Research Phases: Loosening vs. Tightening

**Loosening Phase** (Generation)
- Focus: Creating variation, generating new ideas
- Examples: Unstructured interviews, exploratory experiments, building prediction models on training data
- Goal: Hypothesis generation

**Tightening Phase** (Selection)
- Focus: Distinguishing useful variants from less useful ones
- Examples: Structured interviews, confirmatory hypothesis tests, evaluating prediction error on holdout data
- Goal: Hypothesis testing

**Critical Error**: Testing hypotheses prematurely before adequate exploration

### 1.3 Three Statistical Philosophies

Each answers a different question:

1. **Bayesian**: "What do I believe now that I have this observation?"
   - Updates prior beliefs with data
   - Outputs posterior probabilities

2. **Neyman-Pearson (Frequentist)**: "What should I do now that I have this observation?"
   - Focuses on decision-making with controlled error rates
   - Outputs actionable decisions with known long-run error rates

3. **Likelihood**: "What does this observation tell me about A versus B?"
   - Focuses on quantifying evidence
   - Outputs relative evidence for competing hypotheses

**Key Insight**: These are complementary, not mutually exclusive. Choose based on your actual research question, not what someone claims you "should want to know."

### 1.4 Falsification Approaches

**Dogmatic Falsificationism** (Rejected)
- Claims clear distinction between theory and facts
- Believes observations alone can falsify theories
- Problem: Ignores theory-laden nature of observations

**Methodological Falsificationism** (Popper)
- Accepts theory-laden observations as "unproblematic background knowledge"
- Separates rejection (methodological) from disproof (logical)
- Allows probabilistic theories via specified rejection rules

**Sophisticated Falsificationism** (Lakatos)
- Tests series of theories against each other across experiments
- Theory falsified if new theory: (1) predicts novel facts, (2) explains success of previous theory, (3) has corroborated novel predictions
- Evaluates progressive vs. degenerative research programs

---

## 2. GUIDELINES & RECOMMENDATIONS

### 2.1 Formulating Good Statistical Questions

**Before designing a study, ask:**

1. **What is the goal?** Description, prediction, or explanation?
2. **What phase am I in?** Loosening (exploration) or tightening (confirmation)?
3. **Which statistical philosophy matches my question?** Belief update, decision-making, or evidence quantification?
4. **Is my question interesting?** Can it lead to informative conclusions?

### 2.2 Designing Severe Tests

**Severity Principle**: A claim is severely tested when it has been subjected to and passed a test that probably would have found flaws if they were present.

**Requirements for severe tests:**
1. The test could have proven the claim wrong if it was wrong
2. Error rates are adequately controlled
3. The study design provides sufficient power to detect effects
4. The analysis plan is prespecified (not HARKed)

**To increase severity:**
- Preregister statistical analysis plans
- Avoid questionable research practices
- Design studies with adequate statistical power
- Make risky predictions (see below)

### 2.3 Making Risky Predictions

**Riskiness = Proportion of possible outcomes that would falsify your prediction**

**Levels of riskiness (from least to most):**

1. **Two-sided null hypothesis test**: Only infinitely small point (effect = 0) is forbidden
   - Riskiness: ~0%
   - Nearly any outcome corroborates prediction

2. **One-sided null hypothesis test**: Half of possible outcomes forbidden (effect ≤ 0)
   - Riskiness: 50%
   - Directional prediction

3. **Range/interval predictions**: Specify effect must fall within specific bounds
   - Riskiness: Variable (can be >95%)
   - Example: "Effect between 0.4 and 0.6 on scale"

**When to use each:**
- **Early research**: Two-sided tests acceptable when theories can't predict more than "something vs. nothing"
- **Mature theories**: Should make range predictions, test with interval hypothesis tests
- **Directional theories**: Use one-sided tests when only one direction is theoretically meaningful

### 2.4 One-Sided vs. Two-Sided Tests

**Use one-sided tests when:**
- Theoretical prediction is genuinely directional
- Effects in opposite direction would not support your theory
- You're willing to describe (but not claim support for) unexpected opposite effects

**Benefits:**
- ~20% reduction in required sample size
- More risky prediction (higher verisimilitude if confirmed)
- Maintains Type 1 error control at specified alpha

**Common objections (addressed):**
- "Weaker evidence": Conflates evidence strength with error control. Error rate is controlled at alpha regardless
- "Ignores opposite effects": One-sided test doesn't prevent describing unexpected patterns - it prevents claiming they confirm your prediction
- "Surprising opposite findings matter": Yes - test them as new hypotheses on new data

**Important distinction:**
- t-tests can be directional (one-sided) or non-directional (two-sided)
- F-tests are always non-directional (due to squared nature)
- Cannot perform "one-sided F-test" logically

### 2.5 When NOT to Test a Hypothesis

**Two requirements for interesting hypothesis tests:**

1. **Both competing models must be plausible**
   - If null hypothesis is extremely implausible, test is uninteresting
   - Example: Testing if you're better at darts than world champion is not informative

2. **Study must be sufficiently informative**
   - Must have adequate power to detect effects
   - Must control error rates appropriately
   - Design must provide severe test

**Alternative approaches if hypothesis test is inappropriate:**
- Estimation with confidence intervals
- Bayesian belief updating
- Likelihood ratios
- Prediction modeling

---

## 3. COMMON MISTAKES & PITFALLS

### 3.1 The Statistician's Fallacy

**Error**: Declaring what researchers "really want to know" without acknowledging context-specific needs

**Example**: "What you really want to know is the posterior probability of H0" or "What you really want to know is the effect size"

**Reality**: Different research contexts require different statistical approaches. Your choice should match YOUR specific question, not someone else's philosophical preference.

### 3.2 Hypothesizing After Results are Known (HARKing)

**Problem**: Creating hypothesis after seeing which tests are significant

**Why it's problematic**:
- Test is completely insevere - no way it could have proven claim wrong
- May reach correct conclusion, but test provides no evidence of this
- Readers misled into thinking claim was severely tested

**Solution**: Preregister hypotheses and analysis plans

### 3.3 Questionable Research Practices (QRPs)

**Impact**: Greatly inflate Type 1 error rate, reduce test severity

**Problem**: Even if conclusion is correct, test lacks capacity to prove researcher wrong

**Solution**:
- Transparent reporting of all analyses
- Preregistration
- Adherence to planned analysis

### 3.4 The Crud Factor (Systematic Noise)

**Definition**: In non-experimental or imperfect experimental studies, tiny causal factors create non-zero effects unrelated to theoretical interest

**When it matters**:
- **Correlational studies**: "Everything correlates with everything"
- **Gender differences**: Men taller → asked to reach high shelves more → appears more helpful (unrelated to trait helpfulness)
- **Large samples**: With enough participants, will always reject null hypothesis due to systematic noise

**Warning signs**:
- No randomization possible
- Very large sample sizes
- Non-experimental designs
- Multiple interconnected variables

**Solutions**:
1. **Justify nil null hypothesis**: Is effect = 0 actually plausible?
2. **Use minimal effect tests**: Define smallest effect size of interest (SESOI)
3. **Focus on estimation**: Estimate effect sizes rather than test against zero
4. **Consider effect size**: Even if significant, is effect large enough to matter?

**Examples where nil null IS plausible** (from multi-lab replications):
- Facial feedback hypothesis: 0.03 scale units [-0.11, 0.16] (n=1894)
- Ego depletion: d = 0.04 [-0.07, 0.15] (n=2141)
- Priming with professor/hooligan: 0.14% difference [-0.71%, 1.00%] (n=4493)

### 3.5 Confusion About Theory, Hypothesis, and Observations

**Critical distinction (Meehl)**:
- **Substantive theory**: Theoretical framework
- **Statistical hypothesis**: Operationalized prediction
- **Observations**: Collected data

**Error**: Assuming confirmation of statistical hypothesis = corroboration of theory

**Reality**:
- Statistical inference only addresses statistical hypothesis
- Requires auxiliary hypotheses about measures, instruments, conditions
- Failure could be due to theory OR auxiliary hypotheses
- Requires systematic testing of auxiliary hypotheses

### 3.6 Premature Hypothesis Testing

**Error**: Testing hypotheses before adequate exploration phase

**Better approach**: Follow clinical trial model
- **Phase 1**: Explore safety, dose range (small n, exploratory)
- **Phase 2**: Find optimal dose, systematically explore parameters
- **Phase 3**: Large RCT with prespecified analysis plan (strict error control)
- **Phase 4**: Long-term effects, generalizability, interactions

**Key insight**: Phase 3 requires enormous preparation - don't rush to confirmatory testing

### 3.7 Ignoring the Ceteris Paribus Clause

**Definition**: "All other things being equal" assumption in theories

**Problem**: Theories make predictions only when combined with this clause

**Implication**: Failed predictions could be due to:
- False theory
- Violated ceteris paribus conditions
- Problematic auxiliary hypotheses

**Solution**: Systematically test auxiliary hypotheses in research programs

---

## 4. VERIFICATION CHECKLISTS

### 4.1 Pre-Study Checklist: Information Quality

- [ ] **Goal clarity**: Is the research goal clearly specified? (description/prediction/explanation)
- [ ] **Phase identification**: Is this loosening (exploratory) or tightening (confirmatory)?
- [ ] **Statistical approach**: Does chosen statistical approach match the research goal?
- [ ] **Utility definition**: What effects are deemed interesting and useful?
- [ ] **Informational value**: Does the planned study have potential to achieve the analysis goal?
- [ ] **Sample size**: Is sample size adequate for the precision/power required?
- [ ] **Sampling plan**: Is the sampling plan representative enough to minimize selection bias?
- [ ] **Measurement**: Are measures reliable and valid?

### 4.2 Hypothesis Formulation Checklist

- [ ] **Falsifiability**: Can the prediction be proven wrong?
- [ ] **Specificity**: How risky is the prediction? (What % of outcomes would falsify it?)
- [ ] **Directionality**: Is a one-sided or two-sided test appropriate?
- [ ] **Plausibility**: Are both competing hypotheses plausible?
- [ ] **Theoretical grounding**: Is the hypothesis derived from theory (not HARKed)?
- [ ] **Auxiliary hypotheses**: Have auxiliary hypotheses been identified and justified?
- [ ] **Smallest effect size of interest**: Has a SESOI been defined if appropriate?
- [ ] **Crud factor**: Has the potential for systematic noise been considered?

### 4.3 Severity Checklist

- [ ] **Falsification potential**: Could the test prove the claim wrong if it is wrong?
- [ ] **Power**: Is statistical power adequate to detect effects of interest?
- [ ] **Error control**: Are Type 1 and Type 2 error rates adequately controlled?
- [ ] **Preregistration**: Is the analysis plan preregistered?
- [ ] **QRP avoidance**: Are questionable research practices avoided?
- [ ] **Transparency**: Are all analyses (not just significant ones) reported?
- [ ] **Replicability**: Can the study be closely replicated to verify claims?

### 4.4 Statistical Philosophy Alignment Checklist

- [ ] **Question clarity**: What specific question am I trying to answer?
- [ ] **Belief update**: Do I want to update my degree of belief? → Consider Bayesian
- [ ] **Decision-making**: Do I want to make a decision with controlled error rates? → Consider frequentist
- [ ] **Evidence quantification**: Do I want to quantify relative evidence? → Consider likelihood
- [ ] **Method-question match**: Does my chosen method actually answer my question?
- [ ] **Interpretation limits**: Am I interpreting results within the bounds of what the method can answer?

### 4.5 Post-Study Checklist: Dealing with Inconsistencies

- [ ] **Mixed results**: Are inconsistencies due to expected Type 1/Type 2 errors given power?
- [ ] **Bias assessment**: Could publication bias explain inconsistencies?
- [ ] **Meta-analysis**: Would combining studies in meta-analysis provide clarity?
- [ ] **Moderators**: Could identified moderators explain inconsistencies?
- [ ] **Auxiliary hypotheses**: Could different auxiliary hypotheses explain differences?
- [ ] **Reproducibility**: Do reproducible effects emerge, or are results unreliable?
- [ ] **Type S errors**: Could opposite-direction effects be rare statistical flukes?

---

## 5. DECISION RULES

### 5.1 Matching Question Types to Analyses

| Research Goal | Phase | Appropriate Method | Output |
|--------------|-------|-------------------|--------|
| Description | Loosening | Unstructured interviews, exploratory data analysis | Hypotheses for testing |
| Description | Tightening | Structured surveys, estimation statistics | Point estimates + CIs, variance estimates |
| Prediction | Loosening | Build models on training data | Candidate prediction models |
| Prediction | Tightening | Cross-validation on holdout data | Prediction error, model performance |
| Explanation | Loosening | Exploratory experiments, pilot studies | Candidate hypotheses |
| Explanation | Tightening | Hypothesis tests with preregistered plans | Corroboration/falsification of predictions |

### 5.2 Choosing Hypothesis Test Approach

```
START: Do you want to make a claim with controlled error rates?
│
├─ NO → Consider:
│       - Estimation with confidence intervals
│       - Bayesian credible intervals
│       - Likelihood ratios
│       - Descriptive statistics
│
└─ YES → Are both competing hypotheses plausible?
         │
         ├─ NO → Don't perform hypothesis test
         │       (If null implausible: estimate or use minimal effect test)
         │
         └─ YES → Can you design an informative study?
                  │
                  ├─ NO → Don't perform hypothesis test
                  │       (Improve design or collect more data)
                  │
                  └─ YES → What does theory predict?
                           │
                           ├─ "Something vs. nothing" (early research)
                           │   → Two-sided null hypothesis test
                           │
                           ├─ Specific direction only
                           │   → One-sided test
                           │
                           └─ Specific range
                               → Interval hypothesis test / equivalence test
```

### 5.3 Determining Appropriate Test Directionality

| Condition | Use Two-Sided | Use One-Sided |
|-----------|---------------|---------------|
| Theory predicts direction | No | Yes |
| Opposite effects theoretically impossible/irrelevant | No | Yes |
| Early exploratory research | Yes | No |
| Want to test effects in either direction | Yes | No |
| Maximize power for directional prediction | No | Yes |
| Theory makes no directional prediction | Yes | No |

### 5.4 Nil Null vs. Minimal Effect Test Decision

```
Is systematic noise (crud) likely in your design?
│
├─ YES (correlational, no randomization, large n)
│   └─ Is nil null hypothesis plausible?
│      │
│      ├─ NO → Use minimal effect test
│      │      (Define SESOI, test if effect exceeds this)
│      │
│      └─ YES → Can justify nil null
│             → Proceed with null hypothesis test
│
└─ NO (randomized experiment, smaller n)
    └─ Is nil null hypothesis plausible?
       │
       ├─ YES → Null hypothesis test appropriate
       │
       └─ NO → Consider minimal effect test or estimation
```

### 5.5 Sample Size Adequacy Decision

**For Estimation (Description):**
- Required precision → Calculate n for desired confidence interval width
- More observations → Higher precision
- Representative sampling → Lower bias

**For Prediction:**
- Split into training and holdout sets
- Sufficient data for model to learn patterns
- Sufficient data for reliable cross-validation

**For Hypothesis Testing (Explanation):**
- Define SESOI (smallest effect size of interest)
- Set desired power (typically 0.80 or 0.90)
- Set alpha level (typically 0.05)
- Calculate required n via power analysis
- For one-sided tests: multiply two-sided n by ~0.80

---

## 6. PRACTICAL VERIFICATION QUESTIONS

### 6.1 Questions to Ask Before Data Collection

1. **"What hypothesis does this experiment disprove?"** (Platt's Question)
   - If you can't answer this, you may not be testing a hypothesis

2. **"Am I in a loosening or tightening phase?"**
   - Loosening: Generate hypotheses, explore
   - Tightening: Test prespecified hypotheses

3. **"Can I actually make risky predictions?"**
   - If no: May need more theoretical development
   - If yes: Specify what outcomes would falsify prediction

4. **"Is the nil null hypothesis plausible?"**
   - If no: Consider minimal effect test or estimation
   - If yes: Justify why null is a reasonable competing model

5. **"Do I really want to test a hypothesis?"**
   - Or do I want to: estimate? predict? update beliefs? quantify evidence?

6. **"Will this test be severe?"**
   - Could it prove me wrong if I'm wrong?
   - Is power adequate?
   - Are error rates controlled?

### 6.2 Questions to Ask After Data Collection

1. **"Did I test the hypothesis I preregistered?"**
   - If no: Results are exploratory, require confirmation

2. **"Are results consistent with what's expected given the error rates?"**
   - Mixed results with low power are expected
   - 5% false positives with α=0.05 are expected

3. **"If results are inconsistent with literature, why?"**
   - Publication bias?
   - Unidentified moderators?
   - Failed auxiliary hypotheses?
   - Type S error?

4. **"Is the effect size large enough to matter?"**
   - Even if significant, does it exceed SESOI?
   - Example: 1ms difference may be significant but not psychologically plausible

5. **"Does this corroborate my theory or just the statistical hypothesis?"**
   - Remember Meehl's distinction
   - Consider auxiliary hypotheses

6. **"Has the theory gained verisimilitude?"**
   - Novel predictions confirmed?
   - Risky predictions withstood?
   - More correct predictions than competing theories?

---

## 7. ADVANCED CONCEPTS

### 7.1 Verisimilitude (Truth-Likeness)

**Concept**: Degree to which a theory is similar to truth

**Not the same as**:
- Belief in the theory (epistemological)
- Evidence for the theory
- Confirmation of the theory

**A theory gains verisimilitude when**:
- Makes novel predictions that are confirmed
- Makes risky predictions that are confirmed
- Makes more correct (and fewer incorrect) predictions than competing theories
- Survives severe tests

**Practical application**:
- "Box score" of successfully predicted features
- More specific predictions (narrower intervals) that are confirmed yield more verisimilitude
- Progressive research programs accumulate verisimilitude over time

### 7.2 Progressive vs. Degenerative Research Programs

**Progressive research program** (Lakatos):
- Predicts novel facts
- Explains success of previous theories
- Has novel predictions that are corroborated
- Theory appears in textbooks
- Discussion meetings disappear
- Theory is improved, not tested

**Degenerative research program**:
- Makes no novel predictions
- Explains away failures post-hoc
- Adds auxiliary hypotheses that aren't tested
- Generates continuing debate without resolution

**Ensconcement**: Theory becomes accepted (50-year rule for proxy of truth)

### 7.3 Adversarial Collaboration

**Purpose**: Resolve inconsistencies between competing claims

**Process**:
1. Two teams with opposing views collaborate
2. Establish reliable empirical basis (reduce Type 1/Type 2 errors and bias)
3. Systematically test hypotheses proposed to explain inconsistencies
4. Test auxiliary hypotheses and moderators
5. Reach consensus or identify unresolvable differences

**Requirements**:
- Mutual respect and good faith
- Shared methodological standards
- Preregistered joint protocols
- Transparent reporting of all results

---

## 8. KEY PRINCIPLES SUMMARY

1. **Match method to question**: Different statistical approaches answer different questions - choose based on YOUR question

2. **Specify before you test**: Preregister hypotheses and analysis plans to ensure severe tests

3. **Risky predictions gain more**: More specific, falsifiable predictions yield more verisimilitude when confirmed

4. **Consider the crud**: In correlational/non-experimental studies, nil null may be implausible due to systematic noise

5. **Don't confuse statistical hypothesis with theory**: Confirming predictions doesn't automatically corroborate theory

6. **Severity is essential**: Tests must have capacity to prove you wrong if you're wrong

7. **Context determines appropriateness**: Null hypothesis tests aren't always wrong or right - depends on research context and phase

8. **Inconsistencies are resolvable**: Through meta-analysis, testing moderators, adversarial collaboration, and systematic research programs

9. **Distinguish phases**: Loosening (exploration) and tightening (confirmation) require different approaches

10. **Progressive programs win**: Science progresses through lines of research that make novel predictions, not single studies

---

## 9. RECOMMENDED DECISION FRAMEWORK

### Step 1: Define Your Research Goal
- [ ] Description: Characterize phenomenon
- [ ] Prediction: Forecast future observations
- [ ] Explanation: Test causal theory

### Step 2: Identify Your Research Phase
- [ ] Loosening: Generate hypotheses
- [ ] Tightening: Test prespecified hypotheses

### Step 3: Select Statistical Philosophy
- [ ] Bayesian: Update beliefs
- [ ] Frequentist: Control decision errors
- [ ] Likelihood: Quantify relative evidence

### Step 4: Evaluate Hypothesis Test Appropriateness
- [ ] Both hypotheses plausible?
- [ ] Can design informative study?
- [ ] Can control error rates?
- [ ] Can achieve adequate power?

If NO to any: Consider alternative approaches

### Step 5: Maximize Test Severity
- [ ] Preregister analysis plan
- [ ] Make risky predictions
- [ ] Avoid QRPs
- [ ] Design for adequate power
- [ ] Use directional tests when appropriate

### Step 6: Account for Context
- [ ] Consider crud factor
- [ ] Define SESOI if needed
- [ ] Test auxiliary hypotheses
- [ ] Plan for replication

### Step 7: Interpret Within Limits
- [ ] Statistical hypothesis ≠ theory
- [ ] Consider auxiliary hypotheses
- [ ] Evaluate verisimilitude gained
- [ ] Plan next test in research program

---

## 10. COMMON SCENARIOS & RECOMMENDATIONS

### Scenario 1: Early Exploratory Research
- **Phase**: Loosening
- **Approach**: Descriptive statistics, exploration, hypothesis generation
- **Test type**: Two-sided if testing, but consider if hypothesis test is even needed
- **Sample size**: Adequate for initial estimates
- **Output**: Candidate hypotheses for confirmatory testing

### Scenario 2: Confirmatory Test of Mature Theory
- **Phase**: Tightening
- **Approach**: Preregistered hypothesis test
- **Test type**: One-sided if directional, interval if theory predicts range
- **Sample size**: High power (≥0.90) for smallest effect size of interest
- **Output**: Corroboration or falsification of risky prediction

### Scenario 3: Large Correlational Study
- **Crud concern**: High
- **Approach**: Estimation or minimal effect test
- **Null hypothesis**: Likely implausible (nil null)
- **Focus**: Is effect size large enough to matter?
- **Output**: Effect size estimates with precision, practical significance assessment

### Scenario 4: Randomized Experiment with Moderate Sample
- **Crud concern**: Low to moderate
- **Approach**: Hypothesis test if both models plausible
- **Null hypothesis**: May be plausible
- **Test type**: Match to theoretical prediction
- **Output**: Decision with controlled error rates

### Scenario 5: Inconsistent Literature
- **First step**: Meta-analysis to quantify heterogeneity
- **Second step**: Test for publication bias
- **Third step**: Test moderators or boundary conditions
- **Fourth step**: Adversarial collaboration if needed
- **Output**: Systematic understanding of when effects occur

### Scenario 6: Replication Study
- **Goal**: Assess reproducibility of effect
- **Approach**: Close replication with preregistered plan
- **Sample size**: High power for original effect size
- **Analysis**: Primary test plus equivalence test
- **Output**: Evidence for/against reproducibility

---

## 11. RED FLAGS IN STATISTICAL QUESTIONS

Watch for these warning signs:

1. **"We found p < 0.05, therefore our theory is correct"**
   - Ignores distinction between statistical hypothesis and theory
   - Ignores auxiliary hypotheses

2. **"We'll see what's significant and then explain it"**
   - HARKing - insevere test
   - Confuses exploration with confirmation

3. **"The null hypothesis is never exactly true, so why test it?"**
   - May indicate crud factor concern
   - Could be valid criticism in correlational research
   - Not valid dismissal of all null hypothesis tests

4. **"We used a two-tailed test to be conservative"**
   - May indicate theoretical prediction is actually directional
   - "Conservative" conflates error control with evidence strength

5. **"We found p = 0.051, so there's no effect"**
   - Fails to distinguish "no evidence for effect" from "evidence for no effect"
   - Ignores power considerations

6. **"Different studies show different results, so we can't know anything"**
   - Ignores expected variation due to sampling error
   - Ignores meta-analytic approaches

7. **"We made no predictions, so we tested everything two-tailed"**
   - May indicate insufficient theoretical development
   - Suggests loosening phase - should be labeled exploratory

8. **"The effect was significant but small, so we'll look for moderators"**
   - Post-hoc moderator search
   - Potential HARKing if moderators not preregistered

9. **"We used an alpha of 0.10 to increase power"**
   - Confuses alpha with power
   - May indicate inadequate sample size planning

10. **"This theory can explain any result"**
    - Not falsifiable
    - Degenerative research program

---

## 12. FINAL VERIFICATION PROTOCOL

Before finalizing any statistical analysis, verify:

**Alignment**
- ✓ Statistical question matches research goal
- ✓ Method matches statistical philosophy needed
- ✓ Analysis matches research phase (loosening/tightening)

**Rigor**
- ✓ Hypotheses preregistered (if confirmatory)
- ✓ Test is severe (could prove wrong if wrong)
- ✓ Error rates adequately controlled
- ✓ Power adequate for effects of interest

**Plausibility**
- ✓ Both competing models are plausible
- ✓ Nil null justified OR minimal effect test used
- ✓ Crud factor considered
- ✓ Auxiliary hypotheses identified

**Completeness**
- ✓ All planned analyses reported
- ✓ Unexpected patterns described (even if not confirming)
- ✓ Limitations acknowledged
- ✓ Next steps for research program specified

**Interpretation**
- ✓ Conclusions limited to what method can answer
- ✓ Statistical hypothesis distinguished from theory
- ✓ Verisimilitude gain assessed appropriately
- ✓ Need for replication acknowledged

---

This guidance document should be used as a reference for designing studies and verifying that statistical questions and analyses are properly formulated and aligned with research goals.
