# Confidence Intervals: Verification Guidance for AI Agents

**Purpose**: This document provides comprehensive guidance for AI agents assisting scientists in verifying the correct use, calculation, interpretation, and reporting of confidence intervals (CIs) in statistical analyses.

---

## 1. KEY CONCEPTS

### 1.1 Definition of Confidence Intervals

**Core Definition**: Confidence intervals are a statement about the percentage of confidence intervals that contain the true parameter value in repeated sampling.

- A 95% CI means that if the study were repeated many times, 95% of the calculated CIs would contain the true population parameter
- CIs quantify the **precision** of an estimate
- CIs provide a range of values that contain the true parameter with a desired percentage (assuming all test assumptions are met)

### 1.2 Population vs. Sample Distinction

**Parameter**: Characteristic of the population (unknown, estimated)
**Statistic**: Characteristic of the sample (observed, calculated)

**Critical Cases**:
- When the **entire population** is measured:
  - No hypothesis test needed
  - Population effect size is known
  - No confidence interval to compute
  - No population to generalize to

- When population size is known but not fully measured:
  - Apply **Finite Population Correction (FPC)**:
    - FPC = √[(N - n)/(N - 1)]
    - Where N = population size, n = sample size
    - When N >> n, FPC ≈ 1 (can be ignored)
    - When n = N, FPC = 0 (variance becomes 0)
    - Example: N=100, n=35 → FPC = 0.81

### 1.3 Capture Percentages (NOT the same as confidence level)

**Critical Distinction**: A 95% CI does NOT mean 95% of future means will fall within that specific interval.

**Capture Percentage**: The percentage of future means that fall within a single observed CI
- On average, in the long run, a 95% CI has an **83.4%** capture probability
- Only when the observed effect equals the true parameter does the CI have a 95% capture percentage
- The farther the sample mean is from the true population mean, the lower the capture percentage
- Can range dramatically (e.g., 42.1% when sample mean is far from true mean)

**Implication**: Cannot claim "95% of future studies will find effects in this range"

### 1.4 CI Width Determinants

**Formula for 95% CI around a mean**:
```
μ ± t(df, 1-α/2) × SE
where SE = σ/√n
```

**Key Factors**:
1. **Sample size (n)**: Larger n → narrower CI
2. **Standard deviation (σ)**: Larger σ → wider CI
3. **Confidence level**: Higher confidence → wider CI (e.g., 99% CI > 95% CI)
4. **Degrees of freedom**: Affects critical t-value

**Asymptotic behavior**: CI width → 0 as n → population size

---

## 2. GUIDELINES & RECOMMENDATIONS

### 2.1 When to Report Confidence Intervals

**Always report CIs when**:
- Reporting point estimates (means, effect sizes, differences)
- Publishing results in scientific journals
- Making inferences from sample to population
- Communicating precision of estimates

**Journal Article Reporting Standards (JARS)** recommendation:
"Report effect-size estimates and confidence intervals on estimates that correspond to each inferential test conducted, when possible."

### 2.2 How to Use CIs

**As Resolution Indicators**:
- Narrow CI (high resolution): Effect estimated with sufficient precision
  - Example: M = 0.52, 95% CI [0.49; 0.55] with SESOI = 0.05 → sufficient precision
- Wide CI (low resolution): Effect not estimated with sufficient precision
  - Example: M = 0.52, 95% CI [0.09; 0.95] with meaningful difference ~1 → insufficient precision

**For Hypothesis Testing**:
- If 95% CI excludes 0 → effect is significant at α = 0.05 (two-sided)
- Can test non-zero null hypotheses by checking CI overlap with null value
- Can test range predictions by examining CI boundaries

### 2.3 Appropriate CI Levels for Different Tests

**Standard correspondence**:
- Two-sided t-test at α = 0.05 → 95% CI
- One-sided t-test at α = 0.05 → 90% one-sided CI (other bound at ±∞)
- F-test (ANOVA) at α = 0.05 → **90% CI** for effect sizes (η², ω²)
  - Because squared effect sizes are inherently one-sided
  - 95% CI around Cohen's d = 90% CI around η² for same test
  - Lower bound for η² cannot be < 0, report as [.00; XX] when non-significant

**Alpha adjustments**:
- If α corrected (e.g., Bonferroni: α = 0.05/3 = 0.0167)
- Corresponding CI level: 1 - 0.0167 = 0.9833 (98.33% CI)
- **Critical**: Always adjust CI level to match adjusted alpha

### 2.4 Reporting Formats

**Recommended formats**:
1. **Bracket notation**: M = 0.52, 95% CI [0.09; 0.95]
2. **Subscript notation** (useful for tables): ₀.₀₉0.52₀.₉₅
3. Include CI level, lower bound, upper bound
4. Report exact p-values alongside CIs for:
   - Secondary analyses and re-use
   - Allowing readers to apply their preferred α

### 2.5 Software Tools for Computing CIs

**R Packages**:
- `MOTE`: Effect sizes and CIs for wide range of tests (also web interface)
- `MBESS`: Confidence intervals for effect sizes
- `effectsize`: State-of-the-art effect size calculations
  - Supports Hedges' g*s for Welch's t-test
  - Example: `cohens_d(x, y, pooled_sd = FALSE)`
- `superb`: Population-corrected confidence intervals
- `metafor`: Meta-analytic CIs

**Free Software**:
- **jamovi**: ESCI module for effect sizes and CIs
- **JASP**: Frequentist and Bayesian analyses, ω² and CIs

### 2.6 Special Cases

**Confidence Intervals around Standard Deviations**:
- Rarely reported but important for:
  - Understanding measurement precision
  - A-priori power analyses based on pilot data
  - Theoretical predictions about variability changes
- Formula uses chi-square distribution:
  ```
  c_l = √[(n-1)/χ²(α/2, n-1, lower.tail=FALSE)]
  c_u = √[(n-1)/χ²(α/2, n-1, lower.tail=TRUE)]
  CI = [σ × c_l, σ × c_u]
  ```
- Distribution is asymmetric (SD cannot be < 0)
- Example: n=100, σ=1 → 95% CI [0.88; 1.16]
- Example: n=20, σ=1 → 95% CI [0.76; 1.46] (very wide!)
- For precision within ±0.05 of σ=1, need n ≈ 849

**Prediction Intervals**:
- Much wider than CIs
- Contain single future observations (not means)
- Formula: SE = σ√(1 + 1/n) instead of σ/√n
- 95% PI contains 95% of individual future values
- 95% CI contains 95% of future sample means

---

## 3. COMMON MISTAKES & PITFALLS

### 3.1 Misinterpretations of a Single CI

**INCORRECT Interpretations**:
1. "We can be 95% confident that our interval includes μ"
   - Violates frequentist interpretation
   - Example: 61/100 coin flips, 95% CI [0.506; 0.705]
   - Reasonable to believe true rate is 0.50, not "95% confident it's in CI"

2. "Lower and upper limits are likely bounds for μ"
   - Different samples yield different CIs with different bounds
   - Only true if you collected infinite data

3. "There is a 95% probability this interval contains the true parameter"
   - This is a Bayesian interpretation
   - Loses frequentist error control
   - After data collection, frequentist view: CI either contains parameter or doesn't

4. "95% of future means will fall within this CI"
   - Confuses CI with capture percentage
   - Actual capture percentage ≈ 83.4% on average

**CORRECT Interpretation**:
- "If we repeated this study many times, 95% of the CIs would contain the true parameter"
- CI indicates the **resolution** of the estimate
- Useful for evaluating whether precision is sufficient for practical purposes

### 3.2 Overlapping CIs and Significance

**Common Error**: "If CIs around two means overlap, the difference is not significant"

**Truth**: Statistical significance depends on the CI around the **mean difference**, not overlap of individual CIs.

**Visual Overlap Rule** (independent groups only):
- When CIs overlap slightly (upper bound of one CI overlaps with lower ~25% of other CI)
- Difference is approximately significant at p ≈ 0.05
- Can have overlapping CIs and still p < 0.05
- **Does NOT apply to dependent groups**

**Best Practice**: Check if 95% CI around the **difference** excludes 0

### 3.3 Mismatched CI Levels and Alpha

**Error**: Reporting 95% CI for a test with adjusted α
- Example: Bonferroni correction α = 0.0167, but reporting 95% CI
- Breaks direct CI-p-value correspondence

**Solution**: Adjust CI level to match alpha
- α = 0.0167 → report 98.33% CI
- α = 0.05 for F-test → report 90% CI for η²

### 3.4 Single Study Interpretation

**Pitfall**: Overconfidence in a single CI
- With small sample sizes, CI is wide but represents just one sample
- Any other researcher would observe different CI
- Problem diminishes with thousands of observations (remaining uncertainty negligible)

**Mitigation**:
- Emphasize replication
- Report CIs to communicate precision limitations
- Acknowledge uncertainty explicitly

### 3.5 Ignoring CI Asymmetry

**For squared effect sizes** (η², ω², R²):
- Cannot be negative
- Lower bound truncated at 0
- For non-significant effects: report 90% CI [.00; XX]
- Upper bound still informative

**For standard deviations**:
- Cannot be negative
- Distribution is asymmetric
- Lower bound closer to point estimate than upper bound

### 3.6 Using Pilot Study SDs in Power Analysis

**Problem**: Small pilot studies yield imprecise SD estimates
- n=50, true σ=1.2 → 95% CI [1.002; 1.495]
- Cohen's d = 0.5/1.002 = 0.50 vs. 0.5/1.495 = 0.33
- Power analysis: n=86 (lower CI) vs. n=189 (upper CI)
- Risk of underpowered main study if pilot SD underestimated true SD

**Solution**: Use validated measures with known SDs from literature

### 3.7 Forest Plot Interpretation Errors

**In meta-analysis forest plots**:
- Horizontal line touching 0 → not significant
- Line not touching 0 → significant
- Meta-analytic CI (diamond) always narrower than single studies
- Don't confuse individual study CIs with meta-analytic CI

---

## 4. VERIFICATION CHECKLISTS

### 4.1 CI Reporting Checklist

- [ ] CI accompanies every point estimate (mean, effect size, difference)
- [ ] CI level explicitly stated (e.g., "95% CI")
- [ ] Both lower and upper bounds reported
- [ ] Bounds reported with appropriate precision (matching data precision)
- [ ] Format is clear and consistent (brackets or subscripts)
- [ ] Units specified where applicable
- [ ] Exact p-value also reported (in addition to CI)

### 4.2 CI Level Appropriateness Checklist

- [ ] 95% CI for two-sided t-test at α=0.05
- [ ] 90% CI for F-test (ANOVA) effect sizes at α=0.05
- [ ] One-sided CI for one-sided tests (one bound at ±∞)
- [ ] CI level adjusted to match adjusted alpha (e.g., Bonferroni)
- [ ] For multiple comparisons: each comparison has appropriately adjusted CI

### 4.3 CI Calculation Verification Checklist

**For means**:
- [ ] Standard error calculated correctly: SE = σ/√n
- [ ] Correct degrees of freedom used (typically n-1)
- [ ] Appropriate critical t-value for df and α level
- [ ] Formula: μ ± t(df, 1-α/2) × SE

**For effect sizes (Cohen's d, Hedges' g)**:
- [ ] Correct pooling method (Student's vs. Welch's)
- [ ] For Welch's t-test: Hedges' g*s reported
- [ ] Sample size entered correctly
- [ ] Means and SDs match reported descriptives

**For squared effect sizes (η², ω²)**:
- [ ] 90% CI reported (not 95%) for F-test at α=0.05
- [ ] Lower bound not < 0
- [ ] Non-significant effects: CI reported as [.00; XX]

**For finite populations**:
- [ ] FPC applied if N is known and n is substantial fraction of N
- [ ] FPC = √[(N-n)/(N-1)]
- [ ] If n=N, no CI reported (parameter is known)

### 4.4 Interpretation Verification Checklist

- [ ] Interpretation uses frequentist language (long-run probability)
- [ ] No claims about "95% probability parameter is in this CI"
- [ ] No claims about "95% of future results in this CI"
- [ ] CI described as indicator of precision/resolution
- [ ] Uncertainty acknowledged for single study
- [ ] For overlapping CIs: significance based on difference CI, not overlap
- [ ] Practical significance evaluated (CI width relative to SESOI)

### 4.5 Relationship to Hypothesis Testing Checklist

- [ ] For two-sided test: 95% CI excludes 0 ↔ p < 0.05
- [ ] CI level matches alpha level (adjusted if necessary)
- [ ] Non-zero null hypotheses: CI overlap with null value checked
- [ ] For equivalence testing: CI boundaries relative to equivalence bounds
- [ ] One-sided tests: one-sided CI or appropriate two-sided CI

### 4.6 Meta-Analysis Forest Plot Checklist

- [ ] Each study shows point estimate and CI
- [ ] Significant studies: CI does not overlap 0
- [ ] Non-significant studies: CI overlaps 0
- [ ] Meta-analytic estimate (diamond) shown separately
- [ ] Meta-analytic CI narrower than individual studies
- [ ] Weights of studies considered in interpretation

---

## 5. DECISION RULES

### 5.1 CI Width Selection

**Determining adequate precision**:
1. Define Smallest Effect Size of Interest (SESOI)
2. Evaluate CI width relative to SESOI
   - If CI width < SESOI: sufficient precision
   - If CI width >> SESOI: insufficient precision
3. Plan sample size for desired CI width

**Sample size for desired CI width**:
- Desired CI half-width = h
- Required n ≈ (t × σ / h)²
- Iterative calculation accounting for df dependency

### 5.2 Choosing CI Level

**Default**: 95% CI for α = 0.05 two-sided tests

**Adjust when**:
- Multiple comparisons: CI level = 1 - (α/k) for k comparisons
- One-sided tests: Consider one-sided CI or note interpretation
- F-tests for squared effect sizes: 90% CI
- Exploratory vs. confirmatory: May use 90% for exploratory

**Higher confidence (99%, 99.9%)**:
- When Type I errors very costly
- Requires larger sample sizes
- CIs substantially wider

### 5.3 Relationship to Hypothesis Testing

**Null Hypothesis Testing**:
- H₀: θ = 0
- Reject if 95% CI excludes 0 (α = 0.05)
- Equivalent to p < 0.05

**Non-zero Null Hypothesis**:
- H₀: θ = θ₀
- Reject if 95% CI excludes θ₀
- Example: test if effect < 0.5 by checking if CI entirely below 0.5

**Equivalence Testing**:
- H₀: |θ| ≥ Δ (effect is large)
- Reject if 90% CI entirely within [-Δ, Δ]
- Uses 90% CI because two one-sided tests (TOST) at α = 0.05

**Range Predictions**:
- Predict effect within range [L, U]
- Supported if CI entirely within [L, U]
- Rejected if CI entirely outside [L, U]
- Inconclusive if CI partially overlaps

### 5.4 When Not to Compute CIs

**Skip CI computation when**:
1. Entire population measured (n = N)
   - Parameter is known exactly
   - No inference needed
   - Exception: metaphorical population argument
2. Sample is not random/representative
   - CI assumes random sampling
   - Convenience samples: CI interpretation problematic
3. Reporting exploratory/descriptive statistics only
   - If no inference intended, SD may suffice
   - Though CI around SD can still be informative

---

## 6. COMMON SCENARIOS & RESPONSES

### 6.1 Scenario: Wide CI in Small Study

**Observation**: M = 5.2, 95% CI [1.3, 9.1], n = 15

**Verification**:
- [ ] CI width = 7.8 scale points
- [ ] Is this precision adequate for research question?
- [ ] Should study be described as "underpowered" or "imprecise"?

**Guidance**:
- Acknowledge low precision
- Do not over-interpret point estimate
- Consider as pilot study or combine with other studies
- Plan replication with larger n

### 6.2 Scenario: Overlapping CIs, Significant Difference

**Observation**:
- Group 1: M = 10.5, 95% CI [9.1, 11.9]
- Group 2: M = 13.2, 95% CI [11.8, 14.6]
- Difference: 2.7, 95% CI [0.5, 4.9], p = 0.018

**Verification**:
- [ ] Individual CIs overlap (11.8-11.9)
- [ ] Difference CI excludes 0
- [ ] p < 0.05
- [ ] Conclusion: significant difference despite CI overlap

**Guidance**: Overlapping CIs around means ≠ non-significant difference

### 6.3 Scenario: Mismatched Alpha and CI

**Observation**:
- Bonferroni correction for 5 comparisons: α = 0.01
- Reported: 95% CI [1.2, 3.4]

**Verification**:
- [ ] Alpha level = 0.01
- [ ] CI level should be 99%, not 95%
- [ ] Mismatch detected

**Guidance**: Recalculate CI at 99% level or note that 95% CI does not correspond to adjusted alpha

### 6.4 Scenario: F-test with 95% CI on η²

**Observation**:
- ANOVA F(2,87) = 4.32, p = 0.016
- η² = 0.09, 95% CI [0.00, 0.21]

**Verification**:
- [ ] F-test is one-sided
- [ ] Should report 90% CI, not 95% CI
- [ ] 95% CI [0.00, 0.21] may include 0 despite p < 0.05

**Guidance**: Recalculate as 90% CI for correct correspondence with α = 0.05

### 6.5 Scenario: Negative Lower Bound for Squared Effect Size

**Observation**:
- ω² = 0.03, 95% CI [-0.02, 0.11]

**Verification**:
- [ ] Squared effect sizes cannot be negative
- [ ] Lower bound should be truncated at 0
- [ ] Should be 90% CI for F-test

**Guidance**:
- Report as 90% CI [.00, 0.09] (recalculated)
- Note effect is not significant (CI includes 0)

### 6.6 Scenario: Interpreting Meta-analytic CI

**Observation**:
- Study 1: d = 0.45, 95% CI [0.12, 0.78]
- Study 2: d = 0.22, 95% CI [-0.15, 0.59]
- Study 3: d = 0.61, 95% CI [0.28, 0.94]
- Meta-analysis: d = 0.43, 95% CI [0.25, 0.61]

**Verification**:
- [ ] Studies 1 and 3 significant (CI excludes 0)
- [ ] Study 2 not significant (CI includes 0)
- [ ] Meta-analytic CI narrower than all individual studies
- [ ] Meta-analytic effect significant

**Guidance**:
- Combined evidence stronger than individual studies
- Meta-analytic CI provides more precise estimate
- Individual study CIs show heterogeneity in estimates

---

## 7. ADVANCED CONSIDERATIONS

### 7.1 Standard Error vs. Standard Deviation

**Critical distinction**:

**Standard Deviation (SD)**:
- Describes variability of individuals within sample
- Descriptive statistic
- Formula: √[Σ(x - x̄)² / (n-1)]
- Does not decrease with increasing n
- Converges to population σ as n → ∞

**Standard Error (SE)**:
- Estimates variability between sample means from same population
- Inferential statistic
- Formula: σ / √n
- Decreases with increasing n
- Approaches 0 as n → ∞
- Used to construct CIs

**Verification**: Never confuse SE and SD in CI calculations

### 7.2 Critical t-value Selection

**Factors**:
- Degrees of freedom (typically n-1 for one sample)
- Alpha level (typically 0.05)
- One-sided vs. two-sided test

**Examples** (two-sided, α = 0.05):
- df = 10: t = 2.228
- df = 19: t = 2.093
- df = 30: t = 2.042
- df = 100: t = 1.984
- df = ∞: t = 1.960 (z-value)

**Verification**:
- t-value increases as df decreases (thicker tails)
- For large df, t ≈ 1.96 (z-distribution)
- Never use z when df < 30 unless justified

### 7.3 Welch's t-test and Hedges' g*s

**Modern recommendation**: Use Welch's t-test by default
- Does not assume equal variances
- More robust
- Different df calculation

**Effect size for Welch's t-test**: Hedges' g*s
- Not pooled SD: use SD from control group or √(SD₁² + SD₂²)/2
- Adjust CI calculation accordingly
- `effectsize::cohens_d(x, y, pooled_sd = FALSE)`

**Verification**: If Welch's t-test used, check that effect size is g*s not g

### 7.4 Bootstrap and Non-parametric CIs

**When parametric assumptions violated**:
- Non-normal distributions
- Small samples with skewness
- Ordinal data

**Bootstrap CI**:
- Resample data with replacement
- Calculate statistic for each resample
- Use percentiles of bootstrap distribution
- More robust, especially for skewed data

**Verification**: If non-parametric or bootstrap CI used, ensure method is justified and clearly described

---

## 8. COMPUTATIONAL VERIFICATION

### 8.1 Manual Calculation Check (Independent t-test example)

**Given**:
- Group 1: n₁ = 30, M₁ = 10.5, SD₁ = 2.3
- Group 2: n₂ = 35, M₂ = 12.1, SD₂ = 2.7

**Steps**:
1. Pooled SD: sp = √[(29×2.3² + 34×2.7²) / (30+35-2)] = 2.52
2. SE of difference: SE = 2.52 × √(1/30 + 1/35) = 0.627
3. df = 30 + 35 - 2 = 63
4. Critical t (df=63, α=0.05, two-sided): t = 2.00
5. Mean difference: 12.1 - 10.5 = 1.6
6. 95% CI: 1.6 ± 2.00 × 0.627 = [0.35, 2.85]

**Verification checklist**:
- [ ] Pooled SD calculation correct
- [ ] SE formula correct
- [ ] df calculation correct
- [ ] Critical t-value appropriate
- [ ] CI bounds computed correctly
- [ ] CI excludes 0 → significant difference

### 8.2 Software Output Verification

**Check software output for**:
- [ ] Sample sizes match input data
- [ ] Means match descriptive statistics
- [ ] SDs match descriptive statistics
- [ ] df matches expected formula
- [ ] CI level is as specified
- [ ] Lower bound < Upper bound
- [ ] Effect size type correctly labeled (d, g, g*s, η², ω²)
- [ ] One-sided vs. two-sided test matches CI type

### 8.3 Cross-software Validation

**Best practice**: Verify important results across multiple tools
- R packages: `effectsize`, `MOTE`, `MBESS`
- jamovi, JASP
- Online calculators (MOTE website)

**Small discrepancies acceptable** due to:
- Rounding differences
- Slightly different formulas (bias corrections)
- Different default assumptions

**Large discrepancies indicate**:
- Data entry error
- Wrong analysis type
- Software bug
- Mismatched assumptions (pooled vs. unpooled, etc.)

---

## 9. REPORTING TEMPLATES

### 9.1 Independent t-test

"An independent samples t-test revealed a statistically significant difference between Group A (M = 10.5, SD = 2.3, n = 30) and Group B (M = 12.1, SD = 2.7, n = 35), t(63) = 2.55, p = .013, Cohen's d = 0.64, 95% CI [0.14, 1.13]."

**Elements**:
- Test type
- Descriptive statistics (M, SD, n) for each group
- Test statistic and df
- Exact p-value
- Effect size with type
- 95% CI around effect size

### 9.2 One-way ANOVA

"A one-way ANOVA revealed a statistically significant difference between the three conditions, F(2, 87) = 5.32, p = .007, ω² = 0.08, 90% CI [0.01, 0.17]."

**Note**: 90% CI for squared effect size from F-test

### 9.3 Paired t-test

"A paired samples t-test showed a significant increase from pre-test (M = 45.2, SD = 8.3) to post-test (M = 52.1, SD = 9.1), t(49) = 4.23, p < .001, Cohen's dz = 0.60, 95% CI [0.30, 0.89]."

**Note**: dz for within-subjects design

### 9.4 Correlation

"The correlation between X and Y was moderate and statistically significant, r(98) = .42, 95% CI [.24, .57], p < .001."

### 9.5 Meta-analysis

"The fixed-effects meta-analysis of 8 studies (total N = 1,245) yielded a small to medium effect size, Hedges' g = 0.34, 95% CI [0.23, 0.45], p < .001. Individual study effect sizes ranged from g = -0.12 to g = 0.68."

---

## 10. KEY FORMULAS REFERENCE

### 10.1 Confidence Interval around a Mean

```
CI = μ ± t(df, 1-α/2) × SE
where SE = σ / √n
      df = n - 1 (for single sample)
```

### 10.2 Prediction Interval

```
PI = μ ± t(df, 1-α/2) × SE
where SE = σ √(1 + 1/n)
```

### 10.3 CI around Standard Deviation

```
Critical values:
c_l = √[(n-1) / χ²(α/2, n-1, lower.tail=FALSE)]
c_u = √[(n-1) / χ²(α/2, n-1, lower.tail=TRUE)]

CI = [σ × c_l, σ × c_u]
```

### 10.4 Finite Population Correction

```
FPC = √[(N - n) / (N - 1)]
SE_corrected = SE × FPC
```

### 10.5 Cohen's d and CI (independent groups)

```
d = (M₁ - M₂) / sp
where sp = √[(n₁-1)SD₁² + (n₂-1)SD₂²] / (n₁+n₂-2)]

SE_d ≈ √[(n₁+n₂)/(n₁×n₂) + d²/(2(n₁+n₂))]
CI = d ± t(df) × SE_d
```

---

## 11. QUICK REFERENCE FLAGS

**RED FLAGS** (Likely errors):
- 95% CI for F-test squared effect size (should be 90%)
- CI around mean difference wider than CIs around individual means
- Negative lower bound for squared effect size
- CI level doesn't match alpha level (especially with corrections)
- Claims about "95% probability parameter is in CI"
- Claims about "95% of future studies will find effects in this CI"
- Very wide CI with confident interpretation
- CI calculation using SD instead of SE
- Using z-value (1.96) when n < 30

**YELLOW FLAGS** (Verify carefully):
- Overlapping CIs with claim of significant difference (check difference CI)
- CI calculation from pilot study SD (high uncertainty)
- Single study with definitive claims (acknowledge uncertainty)
- No CIs reported for effect sizes (incomplete reporting)
- Symmetric CI for clearly skewed data (consider bootstrap)
- CI interpretation without discussing precision adequacy

**GREEN FLAGS** (Good practices):
- CIs reported for all effect sizes
- CI level matches alpha level (adjusted if needed)
- Exact p-values reported alongside CIs
- Interpretation emphasizes precision/resolution
- Uncertainty acknowledged for single study
- 90% CI for F-test squared effect sizes
- Bootstrap CIs for non-normal data
- Software and package versions reported

---

## 12. FINAL VERIFICATION PROTOCOL

**Before approving any analysis with CIs**:

1. **Check completeness**:
   - [ ] All estimates accompanied by CIs
   - [ ] CI levels stated explicitly
   - [ ] Both bounds reported

2. **Verify calculations**:
   - [ ] SE calculated correctly
   - [ ] Critical values appropriate
   - [ ] Degrees of freedom correct
   - [ ] Formula matches test type

3. **Confirm appropriateness**:
   - [ ] CI level matches alpha
   - [ ] Adjustments for multiple comparisons
   - [ ] Correct CI type for test (90% for F-test, etc.)

4. **Evaluate interpretations**:
   - [ ] No frequentist-Bayesian confusion
   - [ ] No capture percentage misunderstanding
   - [ ] Precision discussed appropriately
   - [ ] Uncertainty acknowledged

5. **Assess reporting**:
   - [ ] Follows JARS guidelines
   - [ ] Clear and consistent format
   - [ ] Exact p-values included
   - [ ] Effect sizes typed correctly

6. **Cross-validate**:
   - [ ] Spot-check calculations manually
   - [ ] Compare with alternative software if available
   - [ ] Verify against published examples if possible

---

## REFERENCES & RESOURCES

**Key Citations**:
- Cumming, G. (2014). The new statistics: Why and how. *Psychological Science*.
- Morey et al. (2016). The fallacy of placing confidence in confidence intervals. *Psychonomic Bulletin & Review*.
- Cohen, J. (1994). The earth is round (p < .05). *American Psychologist*.

**Software Documentation**:
- MOTE: https://www.aggieerin.com/shiny-server/
- effectsize: https://easystats.github.io/effectsize/
- MBESS: CRAN documentation
- jamovi ESCI: https://www.jamovi.org/
- JASP: https://jasp-stats.org/

**Interactive Tools**:
- CI visualization: http://rpsychologist.com/d3/CI/
- Effect size converters and calculators

**This document version**: 1.0
**Based on**: Statistical Inferences Chapter 07-CI.qmd
**Last updated**: 2025-12-23
