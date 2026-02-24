# Equivalence Testing: Guidance for Statistical Analysis Verification

## Overview

Equivalence testing is a statistical approach for demonstrating the **absence of meaningful effects**, as opposed to traditional null hypothesis significance testing (NHST) which tests for the presence of effects. This document provides distilled guidance for verifying equivalence testing analyses.

---

## Key Concepts

### Core Definitions

**Equivalence Testing**: A statistical method that tests whether observed effects are small enough to be considered practically equivalent to zero by rejecting effects more extreme than specified bounds.

**Two One-Sided Tests (TOST)**: The standard procedure for equivalence testing. Performs two one-sided tests to examine whether data is:
1. Surprisingly larger than a lower equivalence boundary (ΔL)
2. Surprisingly smaller than an upper equivalence boundary (ΔU)

**Smallest Effect Size of Interest (SESOI)**: The boundary defining which effects are too small to be theoretically or practically meaningful. Also known as:
- Minimal important difference
- Clinically significant difference
- Equivalence range
- Region of practical equivalence (ROPE)

**Interval Hypothesis Tests**: Tests against a non-nil null hypothesis (a range of effect sizes) rather than a nil null hypothesis (effect = 0).

**Minimum Effect Test**: The reverse of equivalence testing - designed to reject effects smaller than the SESOI, demonstrating an effect is large enough to be meaningful.

**Non-inferiority Test**: One-sided test examining if an effect is larger than the lower bound of an equivalence range (e.g., showing a new intervention is not noticeably worse than existing treatment).

---

## When to Use Equivalence Tests vs. Traditional Tests

### Use Equivalence Testing When:

1. **Demonstrating absence of confounds**: Showing groups don't differ on variables that might confound experimental design
2. **Comparing interventions**: Demonstrating two treatments work equally well (especially when one is cheaper/easier)
3. **Testing theoretical predictions of no effect**: When theory predicts absence of an effect
4. **Replication studies**: Demonstrating a previous finding was a false positive
5. **Quality control**: Showing two methods/products are functionally equivalent

### Use Traditional NHST When:

- Testing for the presence of an effect
- Effect size of zero is not the research question

### Combine Both Tests When:

- You want comprehensive answers: either reject all effects too small to matter OR reject all effects large enough to matter
- You need to distinguish between statistical and practical significance
- Designing well-powered studies that plan for both presence and absence of effects

---

## Decision Rules & Interpretation

### Four Possible Outcomes

| NHST Result | Equivalence Test Result | Interpretation |
|-------------|------------------------|----------------|
| Not significant | Not significant | **INCONCLUSIVE** - Need more data |
| Not significant | Significant | Effect is absent (too small to matter) |
| Significant | Not significant | Effect exists and may be meaningful |
| Significant | Significant | Effect exists but is **too small to be meaningful** |

### Rejection Criteria

**For equivalence test to be significant:**
- BOTH one-sided tests must be significant
- The 90% CI must fall completely within the equivalence range (for α = 0.05)
- Report the larger p-value of the two one-sided tests

**For minimum effect test to be significant:**
- The 95% CI must fall completely beyond the SESOI (for α = 0.05)

### Confidence Interval Relationships

- **90% CI** used for equivalence tests with α = 0.05
- General formula: CI = 100 - (2 × α)
- If using non-standard alpha, adjust CI width accordingly
- If alpha is justified or corrected for multiple comparisons, use corresponding CI

---

## Setting Equivalence Bounds (SESOI)

### Critical Principles

1. **Specify in advance** - Pre-register your SESOI
2. **Justify your choice** - Document rationale thoroughly
3. **Use raw scales when possible** - Avoid bias from using standardized effect sizes
4. **Make falsifiable predictions** - Define what would contradict your hypothesis

### Methods for Determining SESOI

#### 1. Theory-Based SESOI

**Just Noticeable Differences (JND)**:
- Use perceptual/cognitive thresholds that individuals can detect
- Example: Facial redness increases during fertile phase must be detectable by naked eye
- Provides lower bound on effects that can influence individuals

**Computational Models**:
- Derive parameters from models that explain observed findings
- Lower bounds from model predictions

#### 2. Anchor-Based Methods

**Procedure**:
- Collect measurements at two timepoints
- Use independent anchor measure (often patient self-report)
- Ask: "Do you feel the same, better, or worse?"
- Calculate average change for those reporting "a little" change
- This represents minimal subjectively noticeable change

**Example**:
- PANAS affect scale: ~0.26-0.28 Likert points for "a little" change
- BDI depression: 17.5% reduction from baseline

#### 3. Cost-Benefit Analysis

**Calculate**:
- Cost of intervention
- Probability and cost of negative outcome
- Required effect size to justify intervention cost

**Example**:
- Cognitive training for elderly drivers
- Cost \$247.50, accident probability 0.0710, accident cost \$22,000
- Minimum 25% reduction in collision risk needed

#### 4. Small Telescopes Approach (for replications)

**Definition**: Effect size giving original study 33% power (2:1 odds against detecting if present)

**Rationale**:
- Original study had low probability of detecting effect if real
- Cannot reliably distinguish signal from noise

**Calculation**:
```r
pwr::pwr.t.test(n = [original_n],
                sig.level = 0.05,
                power = 1/3,
                type = "two.sample",
                alternative = "two.sided")
```

**Properties**:
- Only requires knowing original sample size
- One-sided test (effects in opposite direction also rejected)
- 2.5× original sample size gives ~80% power for equivalence test

**Limitations**:
- Arbitrary (why not 30% or 35% power?)
- May not reflect theoretical meaningfulness
- With very large original studies, may set SESOI too small

#### 5. Minimal Statistically Detectable Effect

**Definition**: Smallest effect that could have been statistically significant in original study

**Critical d-value**: Depends only on:
- Sample size per group
- Alpha level
- NOT on true effect size

**Use cases**:
- Replication studies: "Effect is smaller than what could have been significant in your study"
- Resource questions: "Sample sizes typically used in this field are insufficient"
- Related to 50% post-hoc power for observed effect

**Calculation**: Transform critical t-value to critical d-value given sample size and alpha

---

## Common Mistakes & Pitfalls

### Interpretation Errors

1. **NEVER conclude "there is no effect"**
   - Equivalence test rejects effects larger than SESOI
   - Small effects may still exist
   - Correct: "We can reject effects more extreme than [bounds]"

2. **NEVER say effect is "absent" or "zero"**
   - Cannot prove exactly zero
   - Correct: "Effect, if any, is too small to be meaningful"

3. **Avoid vague descriptions**
   - Don't say groups are "similar" or "comparable"
   - Be specific: "We rejected effects more extreme than ±0.5"

4. **Don't confuse non-significant with equivalent**
   - p > 0.05 in NHST ≠ equivalence
   - "Absence of evidence is not evidence of absence"
   - Need actual equivalence test

### Design Errors

1. **Setting bounds in standardized units**
   - Using Cohen's d for bounds introduces bias
   - Observed SD needed to convert to raw scale
   - Bias not huge but accumulates across field
   - TOSTER will warn: "Setting bound type to SMD produces biased results!"

2. **Not justifying SESOI**
   - Arbitrary bounds undermine conclusions
   - Peers must agree bounds are reasonable
   - Document justification thoroughly

3. **Insufficient sample size**
   - CI must fall within equivalence range
   - Narrow CI requires large N
   - Power can be 0% with small samples and narrow bounds
   - Design for both presence AND absence of effect

4. **Wrong confidence interval width**
   - Must match alpha level: CI = 100 - (2 × α)
   - 90% CI for α = 0.05
   - 80% CI for α = 0.10

### Analysis Errors

1. **Not performing both tests**
   - Must test against both upper and lower bounds
   - Exception: Directional predictions (one-sided)

2. **Assuming true effect = 0 in power analysis**
   - If expecting small non-zero effect, need larger N
   - Specify expected effect in `delta` parameter
   - False assumption leads to underpowered studies

3. **Ignoring inconclusive results**
   - When both NHST and equivalence test non-significant
   - Only solution: collect more data
   - Don't force conclusion

---

## Verification Checklist

### Pre-Analysis Verification

- [ ] SESOI specified a priori (ideally pre-registered)
- [ ] SESOI justified using one of the approved methods
- [ ] SESOI specified on raw scale (not standardized)
- [ ] Alpha level justified or stated
- [ ] Sample size adequate for desired power
- [ ] Power analysis accounts for expected effect (not just assuming 0)
- [ ] Decision to use one-sided vs two-sided test justified

### Analysis Verification

- [ ] Correct test type used (TOST for equivalence)
- [ ] Both one-sided tests performed (if two-sided)
- [ ] Correct equivalence bounds entered
- [ ] Correct confidence interval width (90% for α = 0.05)
- [ ] Appropriate test for data type (t-test, correlation, etc.)
- [ ] Variance equality assumption checked (if Student's t-test)

### Results Verification

- [ ] Both one-sided test results reported
- [ ] Larger p-value of the two tests reported
- [ ] Confidence interval reported
- [ ] Observed effect size reported
- [ ] Effect size relative to bounds discussed (not just p-values)
- [ ] All four possible outcomes considered (see decision table)

### Interpretation Verification

- [ ] No claims that effect is "zero" or "absent"
- [ ] No vague terms like "similar" or "comparable"
- [ ] Proper language: "reject effects more extreme than..."
- [ ] SESOI bounds stated in any summary (abstract, etc.)
- [ ] Inconclusive results acknowledged if applicable
- [ ] Practical vs statistical significance distinguished
- [ ] All p-value misconceptions avoided

---

## Reporting Requirements

### Minimal Reporting Standards

**Always report:**
1. **Equivalence bounds**: Specific values and units
2. **Justification**: How bounds were determined
3. **Test statistic**: Larger p-value of two one-sided tests
4. **Confidence interval**: Width matching alpha level
5. **Effect estimate**: Observed effect size
6. **Alpha level**: If non-standard
7. **Sample size**: Actual N collected
8. **Power**: Achieved or planned (with assumptions)

### Example Reports

**Significant equivalence test:**
> "Based on an equivalence test with bounds of d = ±0.2, we rejected the presence of effects more extreme than these bounds (t = 2.45, p = 0.008, 90% CI [-0.15, 0.12]). We can conclude that the effect, if any, is smaller than what we deemed meaningful based on [justification]."

**Non-significant equivalence test:**
> "The equivalence test against bounds of ±0.5 was not significant (t = 1.23, p = 0.11, 90% CI [-0.62, 0.18]). We cannot reject the possibility of effects larger than 0.5."

**Inconclusive result:**
> "Both the null hypothesis test (p = 0.18) and equivalence test (p = 0.22, bounds = ±0.3) were non-significant. The result is inconclusive - we can neither reject the null nor reject effects we consider meaningful."

**Statistically significant but practically trivial:**
> "The effect was statistically different from zero (p = 0.03) but we could reject effects more extreme than ±0.2 (p = 0.01), indicating the effect is too small to be practically meaningful based on our SESOI justification."

### Abstract/Summary Requirements

**Always include in summaries:**
- Equivalence bounds used
- Whether test was significant
- Brief justification for bounds

**Example:**
> "Using equivalence bounds of ±0.3 (justified via cost-benefit analysis), we demonstrated the effect was too small to be meaningful."

NOT:
> "We concluded there was no effect using equivalence testing."

---

## Power Analysis

### Key Principles

1. **Plan for both outcomes**: Design for detecting effects AND demonstrating absence
2. **Specify expected effect**: Don't always assume true effect = 0
3. **Account for directional predictions**: One-sided tests more efficient
4. **Consider inconclusive results**: Risk increases when true effect near SESOI

### Power Determinants

- Alpha level
- Sample size
- Equivalence bounds (SESOI)
- True effect size (expected)

### Sample Size Requirements

**Closer true effect to SESOI → larger N needed**
- If true effect = SESOI, neither equivalence nor minimum effect test can be correctly rejected
- If expecting small non-zero effect, specify in power analysis

**Narrower equivalence range → larger N needed**
- CI must fall within range
- Very small bounds (e.g., ±0.1) may require thousands of participants

**Example calculations:**

```r
# Basic equivalence test (assuming true effect = 0)
TOSTER::power_t_TOST(power = 0.9,
                     delta = 0,
                     alpha = 0.05,
                     type = "two.sample",
                     low_eqbound = -0.5,
                     high_eqbound = 0.5)

# With expected non-zero effect
TOSTER::power_t_TOST(power = 0.9,
                     delta = 0.1,  # expect small effect
                     alpha = 0.05,
                     type = "two.sample",
                     low_eqbound = -0.5,
                     high_eqbound = 0.5)

# One-sided test (more efficient)
TOSTER::power_t_TOST(power = 0.9,
                     delta = 0,
                     alpha = 0.05,
                     type = "two.sample",
                     low_eqbound = -5,     # set extreme
                     high_eqbound = 0.5)   # actual bound
```

### Power Can Be 0%

Unlike NHST where power ≥ alpha:
- With small N and two-sided equivalence test, power can approach 0%
- Occurs when CI is so wide it can't fall within equivalence range
- Always check power before collecting data

---

## Statistical Software

### R Packages

**TOSTER** (recommended):
- `t_TOST()` - from data
- `tsum_TOST()` - from summary statistics
- `TOSTmeta()` - for meta-analyses
- `power_t_TOST()` - power analysis
- Supports t-tests, correlations, proportions

**BEST**:
- Bayesian ROPE procedure
- `BESTmcmc()` - MCMC sampling
- Results very similar to TOST with broad priors

### Key Functions

```r
# Equivalence test from summary stats
TOSTER::tsum_TOST(m1 = 4.55, m2 = 4.87,
                  sd1 = 1.05, sd2 = 1.11,
                  n1 = 15, n2 = 15,
                  low_eqbound = -0.5,
                  high_eqbound = 0.5,
                  eqbound_type = "raw")

# Minimum effect test
TOSTER::tsum_TOST(m1 = 5.73, m2 = 4.87,
                  sd1 = 1.05, sd2 = 1.11,
                  n1 = 200, n2 = 200,
                  low_eqbound = -0.5,
                  high_eqbound = 0.5,
                  hypothesis = "MET")

# Small telescopes SESOI
pwr::pwr.t.test(n = 20,
                sig.level = 0.05,
                power = 1/3,
                type = "two.sample",
                alternative = "two.sided")
```

---

## Bayesian ROPE Procedure

### Similarities to TOST

- Both specify equivalence range a priori
- Both examine if credible/confidence interval falls within range
- With uniform prior and same CI width, results identical
- Philosophical differences in interpretation only

### Differences from TOST

- Uses Highest Density Interval (HDI) from posterior
- Incorporates prior information
- Mean estimate combines prior and data
- No automatic error rate control (unless computed via simulation)

### When to Use ROPE

**Advantages:**
- Can incorporate reliable prior information
- Useful with limited data
- Full posterior distribution available

**Requirements:**
- Justify prior choice
- Perform sensitivity analysis
- Compute frequentist error rates if making claims
- Or don't make claims - present full posterior

### HDI Width Selection

**Problem**: No principled basis for HDI width in Bayesian context
- Kruschke suggests 95% (arbitrary)
- McElreath suggests 67%, 89%, 97% (because prime numbers)

**Solutions:**
1. Compute frequentist error rates (Bayesian/Frequentist hybrid)
2. Don't make binary claims - present full posterior

---

## Special Applications

### Replication Studies

**Goals:**
1. Show effect smaller than original study could reliably detect
2. Make findings falsifiable
3. Avoid "perpetual non-replication" (p > 0.05 doesn't falsify)

**Approach:**
1. Set SESOI using small telescopes or minimal detectable effect
2. Collect 2.5× original N (for ~80% power)
3. Perform equivalence test
4. If significant: "Effect smaller than original had 33% power to detect"

**Don't:**
- Automatically use 2.5N heuristic without thought
- Ignore context (very large original studies)
- Forget to justify approach

### Meta-Analysis

- Can perform equivalence tests on meta-analytic estimates
- Use `TOSTmeta()` function
- Requires effect size and standard error
- Particularly useful for gender differences, null effects

### Correlational Research

**The Crud Factor**:
- Real but trivial correlations exist between most variables
- Nil null hypothesis (r = 0) likely false in large datasets
- Rejecting r = 0 not a severe test

**Solution:**
- Set SESOI at r = 0.1 (common crud threshold)
- Perform minimum effect test
- Only claim meaningful correlation if r > 0.1 rejected

---

## Advanced Considerations

### Combining Tests for Complete Inference

**Minimum effect test + Equivalence test:**
- Most informative combination when SESOI specified
- Always yields answer if sufficient data collected
- Either reject too-small effects OR reject too-large effects
- Exception: true effect exactly equals SESOI (need more data)

**Requirements:**
- Confidence in SESOI location
- Ability to collect large sample
- True effect not too close to SESOI

### One-Sided vs. Two-Sided Tests

**One-sided appropriate when:**
- Directional prediction (e.g., replication expects same direction)
- Non-inferiority test
- Only care about one boundary

**Implementation:**
- Set irrelevant bound to extreme value
- More efficient (requires less data)
- ~70 observations vs ~88 for two-sided (example)

### Practical vs. Statistical Significance

**Minimum effect test advantage:**
- No distinction needed
- Test value = minimum effect of interest
- Rejection = both statistically and practically significant

**Traditional NHST problem:**
- Can reject nil null with tiny, meaningless effects
- Need separate judgment about practical importance

**Equivalence test solution:**
- Demonstrates effects too small to matter
- Distinguishes statistical from practical significance

---

## Quality Assurance Questions

Before finalizing any equivalence testing analysis, verify:

1. **Is the SESOI defensible?** Would peers agree it's reasonable?

2. **Is the analysis correct?** Both tests performed, right CI width?

3. **Is the interpretation appropriate?** No "no effect" claims?

4. **Is reporting complete?** Bounds, justification, statistics all included?

5. **Is the conclusion warranted?** Does it match the actual test results?

6. **Was the study adequately powered?** For the expected effect size?

7. **Are limitations acknowledged?** Arbitrary choices, assumptions stated?

8. **Is the full story told?** All four possible outcomes considered?

9. **Would the finding be useful?** Answers a meaningful question?

10. **Is it falsifiable?** Clear what would contradict the claim?

---

## Common Scenarios & Recommendations

### Scenario 1: Confound Check
**Situation**: Need to show manipulation didn't affect potential confound
**Recommendation**:
- Use anchor-based SESOI (what participants notice)
- Or use minimal detectable effect from typical studies
- One-sided test often sufficient

### Scenario 2: Treatment Equivalence
**Situation**: Show new cheaper treatment works as well as standard
**Recommendation**:
- Cost-benefit SESOI
- Non-inferiority test may be sufficient
- Consider regulatory guidelines if applicable

### Scenario 3: Replication
**Situation**: Previous finding suspected to be false positive
**Recommendation**:
- Small telescopes approach for SESOI
- 2.5× original N for 80% power
- One-sided test (effects in opposite direction also count as failure)
- Be clear this doesn't test theoretical meaningfulness

### Scenario 4: Null Prediction
**Situation**: Theory predicts no effect
**Recommendation**:
- Theory-based SESOI (JND, model parameters)
- Two-sided equivalence test
- Combine with minimum effect test if possible
- High power essential for credibility

### Scenario 5: Resource Question
**Situation**: Are typical sample sizes in field adequate?
**Recommendation**:
- Minimal detectable effect based on typical N
- Demonstrates what field's methods can/cannot detect
- Doesn't test theory, but useful for methods

---

## Further Considerations

### Falsifiability

Equivalence testing makes research falsifiable:
- Specifies what would contradict hypothesis
- Prevents "effect is just a bit smaller" excuse
- Essential for scientific progress
- Avoids slide toward unfalsifiability

### Error Control

- Type 1 error: Claiming equivalence when effect is meaningful
- Type 2 error: Failing to demonstrate equivalence when true
- Intersection-union approach: no correction needed for two tests
- Both tests must be significant to claim equivalence

### Relationship to Traditional NHST

Equivalence testing is:
- Same statistical test (t-test)
- Different null hypothesis (non-nil vs. nil)
- Same error control logic
- More informative questions possible
- Better for theory testing (range predictions)

---

## Key Takeaways

1. **Absence of evidence ≠ evidence of absence** - Need equivalence test
2. **Always specify SESOI a priori** - Essential for valid inference
3. **Justify your bounds** - Thoroughly document rationale
4. **Use raw scales** - Avoid bias from standardized effect sizes
5. **Plan for null results** - Power for both presence and absence
6. **Never claim "no effect"** - Can only reject effects larger than SESOI
7. **Report bounds in summaries** - Essential context for interpretation
8. **Inconclusive is okay** - Sometimes need more data
9. **Combine with NHST** - Most informative approach
10. **Make research falsifiable** - Specify what would be wrong

---

## Resources & Tools

### R Packages
- TOSTER: Frequentist equivalence testing
- BEST: Bayesian ROPE procedure
- pwr: Power analysis for small telescopes approach

### Online Tools
- d-p-power shiny app: https://shiny.ieis.tue.nl/d_p_power/
- f-p-power shiny app: https://shiny.ieis.tue.nl/f_p_power/

### Key References
- Lakens, D. (2017). Equivalence tests: A practical primer
- Schuirmann, D. L. (1987). A comparison of the TOST procedure
- Simonsohn, U. (2015). Small telescopes
- Wellek, S. (2010). Testing statistical hypotheses of equivalence

---

## Document Version
Version 1.0 - Distilled from "Equivalence Testing and Interval Hypotheses" chapter
