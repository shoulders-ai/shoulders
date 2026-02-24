# Error Control Guidance for AI Verification of Statistical Analyses

## Core Concepts & Definitions

### Four Possible Outcomes of Statistical Tests

1. **False Positive (Type I Error, α)**: Concluding there is a true effect when there is no true effect (H₀ is true)
   - Controlled by the alpha level

2. **False Negative (Type II Error, β)**: Concluding there is no true effect when there is a true effect (H₁ is true)
   - Inverse of statistical power (β = 1 - power)

3. **True Negative (1 - α)**: Correctly concluding there is no true effect when H₀ is true

4. **True Positive (1 - β, Statistical Power)**: Correctly concluding there is a true effect when H₁ is true
   - This is the statistical power of the study

### Positive Predictive Value (PPV) & False Positive Report Probability (FPRP)

**PPV Formula**: True Positives / (True Positives + False Positives)

**FPRP Formula**: False Positives / (True Positives + False Positives)

**Critical Distinction**:
- Type I error rate (α): Probability of false positive GIVEN H₀ is true
- PPV: Probability of true effect GIVEN a significant result was observed
- FPRP: Probability of false positive GIVEN a significant result was observed

**Key Dependencies**:
- PPV depends on: (1) statistical power, (2) alpha level, (3) prior probability that H₁ is true
- In literature with publication bias, FPRP can be much higher than α

### Error Statistical Principles

**Frequentist Goal**: Control long-run error rates, not probability of single hypothesis being true

**Severity**: A test is severe when it has high probability of detecting problems if they exist and low probability of false alarms

**Inductive Behavior**: Using data to make decisions while controlling long-run error rates

---

## Critical Verification Checklist

### 1. Alpha Level Verification

**Check if alpha is stated**:
- [ ] Alpha level explicitly stated (required for NHST)
- [ ] If not 0.05, justification provided
- [ ] Alpha level appropriate for claims being made

**Red Flags**:
- No alpha level specified
- Alpha changed after seeing data
- Different alpha levels used across tests without justification
- Alpha level not appropriate for severity of claims

**Special Cases Requiring Lower Alpha**:
- Very large sample sizes (risk of Lindley's paradox)
- High-stakes claims requiring more severe testing
- Studies with very high power (e.g., 99%) creating imbalance

**Justifiable Higher Alpha** (must meet ALL criteria):
- Study has practical implications requiring decision-making
- Cost-benefit analysis provided for Type I vs Type II errors
- Prior probability H₁ is false is relatively low
- Not feasible to collect more data
- Typically: power around 70% where maintaining α = 0.05 creates severe imbalance

### 2. Power Analysis & Type II Error Control

**Required Elements**:
- [ ] A priori power analysis reported
- [ ] Target power level justified (not just defaulting to 80%)
- [ ] Effect size assumption for power analysis clearly stated and justified
- [ ] Sample size determination documented

**Power Analysis Assumptions**:
- Power analysis is conditional on assumed effect size
- Goal is NOT to achieve power for "true" effect (unknown)
- Goal IS to achieve power for smallest effect size of interest

**Check Power-Alpha Balance**:
- Default: α = 0.05, power = 80% (implies Type I errors 4x more serious than Type II)
- With more resources: Should error rates be more balanced?
- With very high power (>95%): Should alpha be lowered for severity?

**Red Flags**:
- No power analysis
- Post-hoc power analysis based on observed effect
- Underpowered study (<50% power) with no acknowledgment
- Power analysis assumptions not justified

### 3. Multiple Comparisons Control

**Union-Intersection Approach** (correction REQUIRED):
- Claim made when AT LEAST ONE test is significant
- Examples: "treatment works on any of these 3 outcomes"
- Must use correction (Bonferroni, Holm-Bonferroni, FDR)

**Intersection-Union Approach** (correction NOT required):
- Claim made when ALL tests are significant
- Each test supports a distinct prediction
- No correction needed, but theory must justify all predictions

**Verification Questions**:
- [ ] What is the specific claim being made?
- [ ] Does the claim depend on one test or multiple tests?
- [ ] If multiple tests inform one claim, is correction applied?
- [ ] If multiple claims, is each theoretically justified?

**Red Flags**:
- Many tests (e.g., 10x10 correlation matrix) without correction or clear theoretical justification
- Selective reporting of subset of tests
- "Exploratory" analyses informing confirmatory claims without correction

**Common Misconception to Reject**:
- "You must correct for all tests in your lifetime" - FALSE
- Correct principle: Control error rates at the level of the CLAIM

### 4. Optional Stopping & Sequential Analysis

**Optional Stopping (PROBLEMATIC)**:
- Repeatedly analyzing data
- Stopping when p < α
- Continuing when p > α
- No pre-specified stopping rules
- Inflates Type I error rate substantially

**Verification**:
- [ ] Were interim analyses performed?
- [ ] If yes, were stopping boundaries pre-specified?
- [ ] Were error rates controlled across looks (e.g., Pocock boundary)?

**Sequential Analysis (PROPER)**:
- Pre-specified number of interim analyses
- Adjusted alpha for each look (e.g., Pocock correction)
- Maintains overall alpha control
- More efficient than fixed design

**Type I Error Inflation Examples**:
- 5 looks without correction: ~14% Type I error
- 2 looks without correction: ~8% Type I error
- 200 looks without correction: ~41% Type I error

**Red Flags**:
- Statements like "we collected data until significance"
- No mention of interim analysis plan when data collected in batches
- Sample size varies between studies without justification

### 5. Questionable Research Practices (QRPs)

**P-Hacking Indicators**:
- [ ] Flexible data analysis strategies
- [ ] Multiple DV operationalizations without pre-specification
- [ ] Selective reporting of analyses
- [ ] Optional stopping
- [ ] Subgroup analyses after nonsignificant main result
- [ ] HARKing (Hypothesizing After Results are Known)

**Specific Red Flags**:
- p-values just below 0.05 (e.g., p = 0.049, 0.048, 0.047)
- Distribution of p-values shows excess just below threshold
- Higher p-values near threshold (e.g., 0.04) more common than lower ones (e.g., 0.01)
- Same measure calculated different ways across papers by same authors
- Post-hoc hypotheses tested on same data they were derived from

**Protective Practices**:
- Pre-registration
- Analysis plans specified before data collection
- Transparent reporting of all tests performed
- Distinction between confirmatory and exploratory analyses

---

## Reporting Requirements

### Mandatory Reporting Elements

1. **Alpha Level**:
   - Must be stated explicitly
   - If not 0.05, justification required
   - Same alpha should be used throughout (or changes justified)

2. **Power Analysis**:
   - A priori power calculation
   - Target power level
   - Assumed effect size and justification
   - Sample size determination logic

3. **Multiple Comparisons**:
   - Total number of tests performed
   - Correction method if applicable
   - Rationale if no correction applied
   - Family of tests clearly defined

4. **Effect Sizes**:
   - Standardized effect sizes reported
   - Confidence intervals provided
   - Used for power calculations

5. **Sequential Analysis** (if applicable):
   - Number of interim analyses planned
   - Stopping boundaries pre-specified
   - Correction method (e.g., Pocock boundary)
   - Actual stopping point reported

### Optional But Recommended

- Positive Predictive Value estimates (especially for low-powered or novel research)
- Sensitivity analyses showing robustness
- All outcome variables collected (not just significant ones)
- Effect size equivalence bounds for non-significant results

---

## Decision Rules & Guidelines

### Setting Alpha Level

**Default Approach**:
- α = 0.05 is conventional but arbitrary
- Functional: Low enough to be taken seriously, high enough to be achievable

**Justification Required When**:
- α < 0.05: Higher severity needed, or very large N (Lindley's paradox)
- α > 0.05: Error balancing, cost-benefit analysis, limited resources

**Optimization Approaches**:

1. **Balance Errors**: Set α such that weighted Type I and Type II error rates are equal
   - Example: If Type I is 4x costlier, set α and β so that 4×α = β

2. **Minimize Combined Error**: Set α to minimize weighted sum of Type I and Type II errors
   - Formula: Minimize (cost_TypeI × α + cost_TypeII × β)

3. **Severity-Based**: Set α low enough that significant results aren't more likely under H₀ than H₁
   - Prevents Lindley's paradox in large samples

**Implementation**: Use tools like JustifyAlpha R package

### Setting Power/Beta

**Default**: 80% power (β = 0.20)
- Based on convention that Type I is 4x more serious than Type II
- Often insufficient for informative research

**Better Approaches**:
1. **Match Resources**: If collecting more participants, balance errors better (e.g., 95% power)
2. **Equal Weighting**: If errors equally serious, use 95% power with α = 0.05
3. **Context-Specific**: Base on cost-benefit analysis of decision errors

**Minimum Acceptable**:
- Below 50% power: Study likely not informative
- 50-70% power: Should be explicitly justified
- 80%+ power: Generally acceptable
- 90%+ power: Preferred for important claims

### Multiple Comparisons Corrections

**When to Correct**:
- Union-intersection tests (any significant result supports claim)
- Family of related tests informing single claim
- Exploratory analyses with many tests

**Correction Methods**:

1. **Bonferroni**: α_adjusted = α / number_of_tests
   - Simple but conservative
   - Use when tests are independent

2. **Holm-Bonferroni**: Sequential procedure
   - Slightly more powerful than Bonferroni
   - Controls familywise error rate

3. **False Discovery Rate (FDR)**: Control proportion of false discoveries
   - More powerful when many tests
   - Appropriate for exploratory large-scale testing

**When NOT to Correct**:
- Intersection-union tests (all tests must be significant)
- Each test addresses distinct theoretical prediction
- Tests inform separate claims

### Sequential Analysis Parameters

**Pocock Boundary** (equal alpha at each look):
- 2 looks: α_each = 0.029 (overall α = 0.05)
- 3 looks: α_each = 0.022
- 4 looks: α_each = 0.018
- 5 looks: α_each = 0.016

**When to Use**:
- Large or expensive studies
- Uncertainty about effect size
- Ethical reasons to stop early if effective
- Pre-specification is critical

---

## Common Mistakes & Pitfalls

### Conceptual Errors

1. **"5% of published results are false positives"** - WRONG
   - True only if: (a) all H₀ are true, (b) no publication bias, (c) no p-hacking
   - Reality: FPRP can be much higher due to publication bias and QRPs
   - PPV depends on prior probability H₁ is true and statistical power

2. **"If p < 0.05, probability of Type I error is 5%"** - WRONG
   - α = probability of Type I error GIVEN H₀ is true
   - After observing p < 0.05, this is PPV question, not alpha question
   - Depends on power and prior probability

3. **"Must correct for all tests ever performed"** - WRONG
   - Only correct for tests informing the same claim
   - Different studies/claims = different error rate control

4. **"Can never look at data multiple times"** - WRONG
   - Can use sequential analysis with proper boundaries
   - Just needs pre-specification and alpha adjustment

5. **"Power analysis ensures detecting true effect"** - WRONG
   - Power analysis is conditional on assumed effect size
   - If assumption wrong, actual power differs
   - Goal: adequate power for smallest interesting effect

### Methodological Pitfalls

1. **Post-hoc Power Analysis**
   - Calculating power after observing effect
   - Circular reasoning (observed effect ↔ power)
   - Should use a priori power for design, sensitivity analysis for interpretation

2. **Flexible Measures**
   - Same construct measured multiple ways
   - Trying all until one is significant
   - Must pre-specify or correct for multiple operationalizations

3. **Double Dipping**
   - Using data to generate hypothesis
   - Testing hypothesis on same data
   - Severely inflates Type I error
   - Requires independent confirmation sample

4. **Subgroup Mining**
   - Main analysis nonsignificant
   - Testing multiple subgroups until finding significance
   - Must pre-specify subgroups or correct for multiple tests

5. **Outcome Switching**
   - Planned to measure X
   - X not significant
   - Report Y instead
   - Must report all pre-specified outcomes

### Reporting Failures

1. **Incomplete Methods**
   - No alpha level stated
   - No power analysis
   - No mention of multiple comparisons
   - Sample size not justified

2. **Selective Reporting**
   - Only significant results reported
   - Some measures/conditions omitted
   - Failed studies not disclosed
   - Interim analyses not mentioned

3. **Post-hoc Framing**
   - Exploratory results presented as confirmatory
   - Hypotheses stated after seeing data
   - "We found" vs "We predicted"

---

## Context-Specific Guidance

### High-Powered Studies (Very Large N)

**Issues**:
- Risk of Lindley's paradox
- p-values 0.01-0.05 may favor H₀ over H₁
- Trivial effects become significant

**Recommendations**:
- Lower alpha as function of sample size
- Emphasize effect size and practical significance
- Consider equivalence testing
- Set alpha so Bayes factor wouldn't favor H₀

### Low-Powered Studies

**Issues**:
- High Type II error rate
- Low PPV even if p < 0.05
- Winner's curse (effect overestimation)

**Recommendations**:
- Acknowledge low power explicitly
- Interpret nonsignificant results cautiously
- Do not claim "no effect" from p > 0.05
- Consider sequential design to improve efficiency

### Exploratory vs Confirmatory Research

**Exploratory**:
- Can have flexibility in analysis
- Should not claim strong error control
- Transparent about flexibility
- Use FDR control for many tests
- Results generate hypotheses, don't confirm them

**Confirmatory**:
- Pre-registered analysis plan
- Strict error control
- Distinguish from exploratory analyses in same study
- Report all pre-specified tests

### Replication Studies

**Power Considerations**:
- Power depends on true effect size (unknown)
- Original effect estimate likely inflated (publication bias, winner's curse)
- Should power for smaller effect than original
- Consider sequential design

**Error Control**:
- Same alpha as original (or justified alternative)
- Pre-register to avoid QRPs
- Report regardless of outcome

---

## Verification Protocol for AI Agents

### Phase 1: Error Rate Specification

```
1. Locate alpha level statement
   - If absent → FLAG: "No alpha level specified"
   - If present but not 0.05 → Check for justification
   - If multiple alphas → Check for rationale

2. Locate power analysis
   - If absent → FLAG: "No power analysis reported"
   - If present → Extract: target power, assumed effect, sample size logic
   - Check if assumptions justified

3. Identify all statistical tests
   - Count total tests performed
   - Categorize by claim they support
   - Check if multiple tests → single claim (needs correction)
```

### Phase 2: Multiple Comparisons Assessment

```
1. Determine testing approach
   - Union-intersection? → Correction required
   - Intersection-union? → No correction needed
   - Mixed? → Analyze each family separately

2. If correction needed, verify:
   - Was correction applied?
   - Which method? (Bonferroni, Holm, FDR, etc.)
   - Correctly implemented?

3. If no correction applied, verify:
   - Each test addresses distinct prediction?
   - Theoretical justification for all predictions?
   - Not exploratory fishing presented as confirmatory?
```

### Phase 3: QRP Detection

```
1. Check p-value distribution
   - Excess just below threshold? → Possible p-hacking
   - Higher p near threshold than lower? → Possible optional stopping
   - Pattern suggests QRPs? → FLAG with evidence

2. Check for flexibility indicators
   - Multiple DV operationalizations?
   - Different transformations tried?
   - Various outlier exclusions?
   - Subgroup analyses after main result?

3. Check temporal indicators
   - Sample size varies across studies?
   - Interim analyses mentioned?
   - "Stopped when significant" phrasing?
   - Sequential design pre-specified?
```

### Phase 4: Reporting Completeness

```
1. Required elements present?
   - [ ] Alpha level
   - [ ] Power analysis (design stage)
   - [ ] Effect sizes
   - [ ] Confidence intervals
   - [ ] Sample size justification

2. Multiple comparisons documented?
   - [ ] All tests reported
   - [ ] Correction method if used
   - [ ] Justification if not used

3. Sequential analysis documented? (if applicable)
   - [ ] Number of looks pre-specified
   - [ ] Stopping boundaries defined
   - [ ] Alpha correction method
```

### Phase 5: Severity Assessment

```
1. Is test severe given claims?
   - High power for effect sizes of interest? ✓
   - Appropriate alpha level? ✓
   - Protected against QRPs? ✓

2. Error rate balance appropriate?
   - Type I vs Type II trade-off justified?
   - Resources used efficiently?
   - Severity matches importance of claim?

3. Overall error control adequate?
   - All claims properly controlled?
   - No inflated error rates?
   - Appropriate for research context?
```

### Output Format

```
VERIFICATION SUMMARY:
- Alpha level: [value] [justified? Y/N]
- Power: [value for SESOI] [adequate? Y/N]
- Multiple comparisons: [corrected? Y/N/NA] [appropriate? Y/N]
- QRP indicators: [none detected / concerns listed]
- Reporting completeness: [X/5 required elements]

FLAGS:
- [Critical issues requiring attention]

RECOMMENDATIONS:
- [Suggestions for improvement]

CONFIDENCE IN CLAIMS: [High/Medium/Low]
REASONING: [Brief explanation]
```

---

## Key Takeaways for AI Verification

1. **Error control is claim-specific**: Verify alpha control at the level of each distinct claim, not paper-wide or career-wide

2. **PPV ≠ α**: Type I error rate applies when H₀ true; Positive Predictive Value applies to significant results observed

3. **Multiple comparisons correction**: Required for union-intersection (any test supports claim), not for intersection-union (all tests must be significant)

4. **Optional stopping inflates errors**: Unless pre-specified sequential boundaries used (e.g., Pocock correction)

5. **Power is conditional**: On assumed effect size, which may be wrong; check if assumptions justified

6. **Default values are conventional**: α = 0.05 and 80% power are historical conventions, not statistically mandated; context-specific justification is better

7. **QRPs are detectable**: P-value distributions, flexibility indicators, and reporting gaps reveal questionable practices

8. **Severity matters**: High power + appropriate alpha + QRP protection = severe test that supports strong claims

9. **Balance errors**: For given sample size, optimizing alpha based on relative costs of Type I and Type II errors improves decision-making

10. **Transparency is key**: Complete reporting allows verification; selective reporting suggests inflated error rates

---

## References & Tools

**Essential Reading**:
- Neyman & Pearson (1933): Original framework for error control
- Mayo (2018): Error-statistical philosophy and severity
- Lakens et al. (2018): Justifying alpha levels

**Useful Tools**:
- JustifyAlpha R package: Optimize alpha based on cost-benefit
- PPV calculators: Assess positive predictive value
- Sequential analysis boundaries: Pocock, O'Brien-Fleming

**Related Concepts**:
- Chapter 1: P-values and their distributions
- Chapter 8: Sample size justification
- Chapter 10: Sequential analysis
- Chapter 12: Bias detection (p-curve analysis)
- Chapter 15: Research integrity and QRPs
