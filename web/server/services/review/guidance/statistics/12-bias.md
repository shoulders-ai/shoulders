# Bias Detection in Statistical Analysis - AI Agent Guidance

## Overview
Bias can be introduced throughout the research process and severely undermines the validity of scientific claims. This document provides actionable guidance for detecting and preventing bias in statistical analyses and research publications.

## Key Concepts

### Types of Bias

#### 1. Research Misconduct
- **Definition**: Making up data or results, changing or omitting data such that research isn't accurately represented
- **Examples**:
  - Wakefield's fraudulent MMR-autism vaccine study (1998)
  - Vicary's fabricated subliminal priming study
- **Detection**: Retraction Watch database tracks scientific fraud cases

#### 2. Publication Bias
- **Definition**: Selective submitting and publishing of research based on statistical significance
- **Prevalence**: 97% of articles in psychology journals (Sterling, 1959), 94% (Bozarth & Roberts, 1972), 96% in standard reports vs 44% in Registered Reports (Scheel et al., 2021)
- **Impact**: Creates incomplete view of evidence; can lead to false conclusions even with hundreds of significant results
- **File-drawer problem**: Non-significant results hidden away, not available to scientific community

#### 3. Reporting Bias
- **Statistical reporting errors**: Incorrect degrees of freedom, misreported p-values (e.g., p = 0.056 reported as p < 0.05)
- **Prevalence**: Common across scientific literature
- **Prevention**: Use Statcheck.io to automatically verify reported statistics

#### 4. Selective Reporting
- **Definition**: Choosing which analyses to report based on results
- **Impact**: Most likely affects main hypothesis test; less likely for descriptive correlation tables
- **Ethical consideration**: Greenwald (1975) considers it an ethical violation

## Detection Methods

### 1. GRIM Test (Granularity-Related Inconsistency of Means)
**Purpose**: Detect mathematically impossible means given sample size

**How it works**:
- Check if reported means are consistent with sample size and scale
- Example: With n=20 and scale -5 to 5, all means must end in multiples of 1/20 (0.05)
- Means ending in .X8 or .X2 are impossible

**When to apply**: Any study reporting means with discrete scales

**Red flags**:
- Means that don't align with possible values given sample size
- May indicate missing data reporting or misconduct

### 2. Statcheck
**Purpose**: Automatically detect statistical reporting errors

**How it works**:
- Extracts statistics from articles (APA format)
- Recomputes p-values from test statistics and df
- Checks internal consistency

**Limitations**:
- Makes Type 1 errors (false positives)
- Only works with APA-formatted statistics

**Usage**: Run on manuscripts before submission

### 3. Funnel Plots
**Purpose**: Visualize potential publication bias in meta-analyses

**Structure**:
- X-axis: Effect size
- Y-axis: Precision (standard error)
- White pyramid: Non-significant region

**Interpretation - Unbiased pattern**:
- Effect sizes randomly distributed around true effect
- ~95% of studies within funnel
- Symmetrical distribution

**Interpretation - Biased pattern**:
- Asymmetrical distribution
- Missing studies in lower-left region
- Studies cluster at edge of significance
- Effect sizes decrease with larger samples (smaller SE)
- Studies "hug" the edge of the significance pyramid

**Red flags**:
- All studies just barely significant
- Smaller effects in larger studies
- Missing small, non-significant studies

### 4. Test of Excessive Significance
**Purpose**: Test if number of significant results is "too good to be true"

**Method**:
- Calculate average power from observed effect sizes
- Use binomial probability to test if observed significant results exceed expected
- Alpha typically set at 0.10

**Interpretation**:
- If p < 0.10: Suggests publication bias or selective reporting
- Indicates unlikely number of significant results given estimated power

**Example**: Francis (2014) found 36 of 44 articles in Psychological Science had p < 0.10, suggesting bias

### 5. Trim-and-Fill
**Purpose**: Estimate and adjust for missing studies in meta-analysis

**Method**:
- "Trim" small studies that bias effect size
- Estimate true effect size
- "Fill" funnel plot with hypothetical missing studies
- Recalculate meta-analytic effect size

**Limitations**:
- **Strong assumption of funnel plot symmetry**
- Performs poorly when bias is based on p-values
- Does NOT provide reliable corrected effect size
- Outdated method with better alternatives available

**Appropriate use**:
- Only as sensitivity analysis
- DO NOT report trim-and-fill estimate as true effect size
- Use only when assumptions clearly met

### 6. PET-PEESE Meta-Regression
**Purpose**: Estimate population effect size corrected for publication bias

#### PET (Precision-Effect Test)
- **Formula**: d = β₀ + β₁SE_i + u_i
- **Interpretation**: Tests if meta-regression can reject d = 0 at SE = 0
- **Note**: Underestimates effect when true effect exists

#### PEESE (Precision-Effect Estimate with Standard Error)
- **Formula**: Uses variance (SE²) instead of SE
- **When to use**: Only if PET rejects null hypothesis
- **Rationale**: Reduces bias in effect size estimate

**Procedure**:
1. Run PET to test if null can be rejected
2. If yes: Use PEESE estimate for effect size
3. If no: Effect may be zero or very small

**Limitations**:
- Requires many studies (low power with few studies)
- Needs wide range of sample sizes (15-200 per group recommended)
- Performs poorly with:
  - Few studies in meta-analysis
  - All small sample sizes
  - Large heterogeneity
- May be confounded if sample sizes correlate with true effect sizes

**Visual interpretation**:
- PET: Straight diagonal line through funnel plot
- PEESE: Curved line through funnel plot
- Effect estimate: Where line intersects SE = 0

### 7. Fail-Safe N
**Status**: **OUTDATED - DO NOT USE**

**Why deprecated**:
- Becker (2005): "Should be abandoned in favor of other, more informative analyses"
- Only useful to identify outdated meta-analyses
- Better methods now exist

### 8. P-curve Analysis
**Purpose**: Detect evidential value in significant results

**Method**:
- Analyzes only statistically significant results (p < 0.05)
- Examines distribution of p-values in 5 bins: 0-.01, .01-.02, .02-.03, .03-.04, .04-.05
- Assumes all significant results are published

**Two key tests**:

1. **Test for evidential value**:
   - Checks if p-curve is right-skewed (more small p-values than large)
   - Rejects uniform distribution expected under H₀
   - Significant = pattern suggests true effect with some power

2. **Test for inadequate power**:
   - Checks if p-curve is flatter than 33% power
   - Significant = studies underpowered, resembles null hypothesis pattern
   - 33% threshold is arbitrary but represents minimum useful power

**Interpretation**:

**Right-skewed p-curve**:
- More p-values near 0.01 than 0.05
- Suggests true effect with adequate power
- Does NOT prove no bias or that theory is true

**Flat p-curve**:
- More p-values near 0.05 than 0.01
- Suggests selection bias and low/no power
- Does NOT prove theory is incorrect

**Red flags**:
- Predominantly high p-values (0.04-0.05)
- Almost no low p-values (0.00-0.01)
- Flatter than 33% power line

**Tool**: http://www.p-curve.com/app4/

### 9. P-uniform*
**Purpose**: Estimate bias-adjusted effect size using significant and non-significant results

**Advantages over p-curve**:
- Uses both significant AND non-significant studies
- Provides bias-adjusted effect size estimate
- Uses selection model: significant results more likely published

**Method**:
- Random-effects model for each study
- Weights based on publication probability
- Tests if adjusted effect differs from zero

**R package**: `puniform`

### 10. Z-curve Analysis
**Purpose**: Meta-analysis of observed power to detect publication bias

**Key metrics**:

1. **Observed Discovery Rate (ODR)**:
   - Percentage of significant results
   - Observed power across all studies

2. **Expected Discovery Rate (EDR)**:
   - Proportion expected to be significant under estimated effect distribution
   - Calculated from fitted z-curve model

3. **Expected Replication Rate (ERR)**:
   - Expected proportion of successful replications
   - Based only on significant studies

**Method**:
- Converts p-values to absolute z-scores
- Fits mixture of normal distributions (means 0-6)
- Estimates underlying effect size distribution
- Can correct for selection bias (under assumptions)

**Interpretation**:

**Unbiased literature (H₀ true)**:
- ~5% z-scores exceed critical value (1.96 for α=0.05)
- Distribution centered on 0

**Unbiased literature (H₁ true)**:
- Distribution shifts right
- Higher proportion exceed critical value
- Shift magnitude depends on power

**Biased literature**:
- ODR >> EDR (observed much higher than expected)
- Confidence intervals don't overlap
- Clear sign of selection bias

**Red flags**:
- ODR 95%+ when EDR is much lower
- Missing z-scores between 0 and 1.96
- Low ERR despite high ODR

**R package**: `zcurve`

## Common Mistakes & Pitfalls

### 1. Forest Plot Red Flags
- All confidence intervals just barely exclude zero
- Studies systematically just significant
- No variation in significance status despite varying sample sizes
- Suggests p-hacking or selective reporting

### 2. Meta-Analysis Without Bias Assessment
- 43% of meta-analyses don't assess publication bias (Polanin et al., 2020)
- 82% in education use outdated methods (Ropovik et al., 2021)
- **Best practice**: Always assess bias using multiple modern methods

### 3. Misinterpreting Bias-Corrected Estimates
- **NEVER assume bias-corrected estimates are accurate**
- They depend on model assumptions about bias-generating mechanisms
- True effect could still be zero even with corrected positive estimate
- Use as sensitivity analysis, not definitive answer

### 4. Ignoring Mixed Results
- Expecting all results to be significant is unrealistic
- With 80% power, expect 1 in 5 null results when H₁ is true
- Exclusively significant results are surprising and suspicious
- Mixed results can be strong evidence FOR alternative hypothesis

### 5. Wrong P-curve Interpretation
- Right-skewed p-curve does NOT prove:
  - No bias exists
  - Theory is true
  - All studies are valid
- Flat p-curve does NOT prove:
  - Theory is incorrect
  - All results are Type 1 errors
  - Data is fabricated

### 6. Applying Bias Tests Inappropriately
**PET-PEESE limitations**:
- Low power with < 20 studies
- Unreliable with all small samples
- Confounded by heterogeneity

**Trim-and-fill limitations**:
- Assumes symmetrical funnel plot
- Fails when bias based on p-values
- Should never be sole correction method

**P-curve limitations**:
- Requires p < 0.05 results
- Doesn't work with all null results
- Assumptions about publication process

## Prevention Strategies

### 1. Pre-Registration
- Register hypothesis, design, and analysis plan before data collection
- Prevents selective reporting and p-hacking
- Shows which analyses were planned vs exploratory

### 2. Registered Reports
- Peer review BEFORE data collection
- In-principle acceptance based on introduction, methods, analysis plan
- Guarantees publication regardless of results
- Dramatically reduces positive result rate (96% → 44%)

### 3. Share All Results
- Make all research results available, regardless of p-value
- Upload null results to repositories
- Prevents file-drawer problem
- Ethical responsibility to scientific community

### 4. Data and Code Sharing
- Makes errors easier to detect and correct
- Facilitates verification by other researchers
- "Reputations depend on how researchers respond to flaws, not whether flaws exist" (Bishop, 2018)

### 5. Use Statcheck Before Submission
- Automatically detect reporting inconsistencies
- Fix errors before peer review
- Reduces error rate in published literature

### 6. Power Analysis and Transparency
- Report statistical power for main analyses
- Acknowledge when studies are underpowered
- Don't claim effects with insufficient power

### 7. Avoid Questionable Research Practices
- Don't selectively report dependent variables
- Don't add covariates post-hoc to achieve significance
- Don't stop data collection when p < 0.05
- Don't exclude data to achieve significance

## Checklists for AI Agents

### When Reviewing a Single Paper

**Statistical Reporting**:
- [ ] Run Statcheck on reported statistics
- [ ] Check GRIM test for impossible means
- [ ] Verify p-values match reported test statistics
- [ ] Check for inconsistencies in degrees of freedom

**Results Pattern**:
- [ ] Are all results in predicted direction?
- [ ] Are all main tests p < 0.05?
- [ ] Are all p-values clustered near 0.05?
- [ ] Are there suspiciously few null results?
- [ ] Do multi-study papers show 100% success rate?

**Transparency**:
- [ ] Are methods and analyses pre-registered?
- [ ] Is data and code available?
- [ ] Are null results reported?
- [ ] Are exploratory analyses clearly labeled?
- [ ] Is statistical power reported?

### When Reviewing a Meta-Analysis

**Bias Assessment**:
- [ ] Is publication bias assessed?
- [ ] Are multiple bias detection methods used?
- [ ] Is funnel plot visually inspected?
- [ ] Are modern methods used (not just fail-safe N or trim-and-fill alone)?

**Funnel Plot Inspection**:
- [ ] Is plot symmetrical around meta-analytic estimate?
- [ ] Are small studies missing from one side?
- [ ] Do studies cluster at significance boundary?
- [ ] Do effect sizes decrease with precision?

**Recommended Tests**:
- [ ] Visual funnel plot inspection
- [ ] PET-PEESE (if sufficient studies with varied sample sizes)
- [ ] P-curve analysis (for significant results)
- [ ] P-uniform* (if non-significant results available)
- [ ] Z-curve (for power analysis)

**Red Flags**:
- [ ] Only fail-safe N or trim-and-fill reported
- [ ] No bias assessment conducted
- [ ] Authors claim "no bias detected" without evidence
- [ ] Bias-corrected estimate treated as definitive
- [ ] Heterogeneity ignored in bias assessment

### For Study Design Verification

**Pre-registration**:
- [ ] Were hypotheses pre-registered?
- [ ] Was analysis plan specified in advance?
- [ ] Were deviations from pre-registration noted?
- [ ] Is registration time-stamped before data collection?

**Sample Size**:
- [ ] Was sample size justified?
- [ ] Was power analysis conducted?
- [ ] Is achieved power reported?
- [ ] Were stopping rules pre-specified?

**Transparency**:
- [ ] Are all measured variables reported?
- [ ] Are all conditions reported?
- [ ] Are exclusion criteria pre-specified?
- [ ] Are failed studies disclosed?

## Guidelines & Recommendations

### For Conducting Meta-Analyses

1. **Always assess publication bias** - Use multiple methods, not just one
2. **Report multiple estimates** - Unadjusted and bias-adjusted with multiple methods
3. **Check assumptions** - Each method has specific assumptions; verify they're met
4. **Be transparent** - Report all methods tried, not just favorable ones
5. **Use sensitivity analyses** - Test robustness under different assumptions
6. **Code test statistics** - Not just effect sizes; enables p-curve, z-curve
7. **Seek unpublished studies** - Contact authors, check registries
8. **Check for heterogeneity** - High heterogeneity reduces bias test effectiveness

### For Interpreting Published Research

1. **Maintain skeptical attitude** - "Are results due to selective reporting?" (Mayo, 2018)
2. **Don't expect perfection** - Everyone makes errors; assess response to errors
3. **Look for patterns** - One suspicious result vs systematic bias
4. **Consider context** - Field norms, incentive structures, replication attempts
5. **Check for red flags** - Multiple indicators suggest problems
6. **Demand transparency** - Data, code, pre-registration should be standard

### For Reporting Results

1. **Report all analyses** - Not just significant ones
2. **Distinguish planned vs exploratory** - Clearly label post-hoc analyses
3. **Share null results** - Contribute to unbiased literature
4. **Use Registered Reports** - When possible
5. **Make data available** - Enable verification and meta-analysis
6. **Report effect sizes and CIs** - Not just p-values
7. **Acknowledge limitations** - Power, assumptions, potential biases

## Effect Size Impact of Bias

**Meta-analytic effect size WITH publication bias**:
- Systematically HIGHER than true effect
- Filters out smaller (non-significant) effects
- Can be severely inflated
- Unknown degree of inflation

**Examples**:
- Ego-depletion: Published d = 0.62, Unbiased estimate d = -0.1 (effectively 0)
- Could represent largest research waste in psychology

**Key insight**: With extreme bias, can have:
- 100% significant individual studies
- Large meta-analytic effect size
- True effect size of ZERO

## Technical Details

### Expected P-value Distributions

**Under H₀ (null true)**:
- P-values uniformly distributed
- Equal probability in each bin (0-.01, .01-.02, etc.)
- ~5% below alpha threshold

**Under H₁ (alternative true)**:
- P-values right-skewed
- More small p-values (0-.01) than large (0.04-.05)
- Proportion below alpha = power
- Higher power → more extreme skew

**Under selection bias**:
- P-values clustered near alpha
- Predominantly 0.04-0.05 range
- Missing p-values << 0.01
- Flat or left-skewed distribution

### Meta-Regression Assumptions

**PET-PEESE assumes**:
- Linear relationship between ES and SE (PET) or variance (PEESE)
- Publication bias causes this relationship
- Extrapolation to SE=0 gives unbiased estimate

**Violations occur when**:
- Heterogeneity in true effects
- Sample sizes correlate with true effects
- Non-linear publication bias mechanisms
- Insufficient range of sample sizes

### Z-curve Model

**Fitting process**:
- Uses mixture of normal distributions (means 0-6)
- Expectation-maximization algorithm
- Bootstrap for confidence intervals
- Estimates underlying effect distribution

**Key assumption**:
- Can model publication process
- Selection based on significance
- Can extrapolate from significant results

## Red Flags Summary

### Immediate Concerns
- GRIM test failures (impossible means)
- Statcheck inconsistencies
- All p-values clustered near 0.05
- 100% success rate in multi-study papers
- No null results reported
- Asymmetrical funnel plot
- ODR >> EDR in z-curve

### Moderate Concerns
- No bias assessment in meta-analysis
- Only outdated methods used (fail-safe N alone)
- No pre-registration
- No data/code sharing
- Underpowered studies claiming large effects
- Post-hoc covariates added
- Exploratory analyses not labeled

### Pattern Recognition
Multiple red flags together increase concern:
- All p-values significant + clustered near 0.05 + asymmetric funnel = high concern
- No pre-registration + no null results + suspicious p-curve = high concern
- Single error in isolation = moderate concern, verify and contextualize

## State-of-the-Art Recommendations

**Current best practices** (as of 2025):
1. Use **multiple modern methods**: PET-PEESE, p-curve, p-uniform*, z-curve
2. **Avoid outdated methods**: Fail-safe N, trim-and-fill as sole correction
3. **Visual inspection**: Always examine funnel plots
4. **Report transparently**: Show all methods, not just favorable results
5. **Acknowledge uncertainty**: No method provides definitive answer
6. **Prevent rather than correct**: Pre-registration, Registered Reports, share all results

**Emerging consensus**:
- Publication bias cannot be fully corrected, only detected
- Prevention through transparency is only real solution
- Multiple converging methods more convincing than single test
- Context matters: field norms, replication attempts, methodological quality

## Final Principles

1. **No silver bullet**: No single method detects/corrects all bias
2. **Assumptions matter**: Each method relies on specific assumptions
3. **Publication bias cannot be fixed post-hoc**: Only detected
4. **Prevention is key**: Share all results, use Registered Reports
5. **Multiple methods**: Convergence across methods increases confidence
6. **Transparency**: Best protection against and response to errors
7. **Skepticism**: Healthy default when evaluating claims
8. **Ethical responsibility**: Selective reporting is unethical; harms science

## Additional Resources

- Doing Meta-Analysis in R: https://bookdown.org/MathiasHarrer/Doing_Meta_Analysis_in_R/pub-bias.html
- P-curve app: http://www.p-curve.com/app4/
- Statcheck: http://statcheck.io/
- Retraction Watch database: http://retractiondatabase.org
- GRIM test: http://nickbrown.fr/GRIM

## Quick Reference: When to Use Which Method

| Method | Best For | Requires | Avoid When |
|--------|----------|----------|------------|
| Funnel plot | Visual inspection | Effect sizes, SEs | N/A - always inspect |
| PET-PEESE | Effect estimation | 20+ studies, varied n | Small k, all small n, high heterogeneity |
| P-curve | Evidential value test | Significant results, test statistics | All null results |
| P-uniform* | Effect estimation | Mix of sig/non-sig results | Only significant results |
| Z-curve | Power analysis, bias detection | P-values from studies | Very few studies |
| Trim-and-fill | Sensitivity analysis only | Effect sizes, SEs | As primary method |
| Fail-safe N | Identifying outdated meta-analyses | N/A | Never use for actual bias detection |
| Test of excessive significance | Quick bias screen | Effect sizes to calculate power | As only method |
| GRIM | Detecting impossible means | Means, n, scale info | Non-integer scales |
| Statcheck | Detecting reporting errors | APA-formatted statistics | Non-APA formats |
