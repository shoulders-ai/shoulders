# Meta-Analysis Verification Guidance for AI Agents

## Core Purpose
Meta-analysis combines data from multiple studies to provide more precise parameter estimates than individual studies can achieve. Every single study is a data point in a future meta-analysis.

## Key Concepts

### Effect Size Precision
- **Standard Error (SE)**: The standard deviation of the sampling distribution of the sample mean
  - Formula: SE = σx / √n
  - Larger sample sizes yield smaller standard errors and more precise estimates
  - Effect sizes are weighted by precision (inverse of standard error) in meta-analysis

### Meta-Analysis Models

#### Fixed Effect Model (Equal-Effects Model)
- **Assumption**: One true effect size generates all study data
- **When to use**:
  - All studies are functionally equivalent
  - Goal is NOT to generalize beyond the included studies
- **Weighting**: Based solely on within-study variance

#### Random Effects Model
- **Assumption**: True effect sizes vary across studies (randomly distributed)
- **When to use**:
  - Studies differ in meaningful ways (MOST COMMON SCENARIO)
  - Goal is to generalize to broader populations
- **Weighting**: Incorporates both within-study and between-study variance
- **Default choice**: Generally recommended for literature meta-analyses
- **Trade-off**: Gives relatively more weight to smaller studies (which may be more biased)

### Effect Size Measures

#### For Continuous Outcomes
- **Hedges' g**: Unbiased version of Cohen's d (preferred)
  - Calculated with correction factor: J = (1 - 3/(4df - 1))
  - g = J × (X̄₁ - X̄₂) / Swithin
  - Variance: Vg = J² × [(n₁ + n₂)/(n₁n₂) + g²/(2(n₁ + n₂))]

- **Required for calculation**: Effect size (yi) and variance (vi)
- **Can be computed from**: Means, SDs, and sample sizes per group

#### For Dichotomous Outcomes
- **Odds Ratio (OR)**: Most common for meta-analysis
  - Calculation: OR = (AD)/(BC) from 2×2 table
  - **Meta-analysis uses log(OR)** for symmetry
  - Variance: Var(log OR) = 1/A + 1/B + 1/C + 1/D

- **Alternatives**: Risk ratios, risk differences (less common)

### Heterogeneity

**Definition**: Variation among study effect sizes beyond what would be expected from random sampling error alone.

#### Cochran's Q Statistic
- **Purpose**: Statistical test for presence of heterogeneity
- **Calculation**: Weighted sum of squared differences from meta-analytic estimate
- **Test**: Compare Q to chi-square distribution with df = k-1 (k = number of studies)
- **Limitation**: Low power with small number of studies
- **Interpretation**: Can reject null of no heterogeneity, but test itself has Type I and Type II error rates

#### I² Index
- **Purpose**: Quantify percentage of variability due to heterogeneity
- **Formula**: I² = [(Q - k - 1)/Q] × 100%
- **Range**: 0% to 100%
- **Interpretation guidelines**:
  - 25% = low heterogeneity
  - 50% = medium heterogeneity
  - 75% = high heterogeneity
- **Limitation**: Tends toward 100% in very large studies (dependent on precision)

#### τ² (Tau-squared)
- **Purpose**: Estimate variance of true effects
- **Advantage**: Not dependent on precision like I²
- **Disadvantage**: More difficult to interpret (scale-dependent)
- **τ**: Estimated standard deviation of true effects

## Decision Rules

### Fixed vs Random Effects Model
1. **Use Random Effects when**:
   - Studies come from published literature (almost always)
   - Studies differ in populations, settings, or methods
   - Want to generalize beyond included studies
   - Heterogeneity is present (I² > 0)

2. **Use Fixed Effects when**:
   - All studies are functionally identical (e.g., internal simulations)
   - Only want to make inferences about the specific included studies
   - Studies are exact replications

### Handling Heterogeneity
1. **Do NOT ignore it**: Heterogeneity provides valuable scientific information
2. **Report it**: Always report Q, I², τ² with confidence intervals
3. **Explore it**: Conduct subgroup analyses or meta-regression
4. **Explain it**: Code potential moderators during data extraction
5. **Consider if meta-analysis is appropriate**: Extremely high heterogeneity may indicate studies should not be pooled

### Subgroup Analysis
- **Purpose**: Test if categorical moderators explain heterogeneity
- **Approach**: Meta-regression using 'mods' argument
- **Interpretation**:
  - Significant test of moderators = groups differ in effect size
  - Check residual heterogeneity within subgroups
  - Conceptually similar to ANOVA

## Verification Checklist

### Data Extraction
- [ ] Effect sizes calculated correctly (verify formulas)
- [ ] Variance of effect sizes computed correctly
- [ ] Sample sizes recorded per condition (not just total N)
- [ ] Appropriate effect size measure used (SMD, OR, correlation, etc.)
- [ ] Effect size calculation method specified (d vs g, OR vs RR)
- [ ] Assumptions documented when data is missing (e.g., equal n per group)
- [ ] Two independent coders extracted data (preferred)
- [ ] Quotes from original studies included to justify coding decisions

### Statistical Analysis
- [ ] Appropriate model chosen (FE vs RE) and justified
- [ ] Heterogeneity statistics reported (Q, p-value, I², τ²)
- [ ] Heterogeneity confidence intervals reported
- [ ] Meta-analytic effect size estimate reported
- [ ] Confidence interval around meta-analytic estimate reported
- [ ] Z-test statistic and p-value reported
- [ ] Alpha level appropriate (consider α < 0.05 for high-powered meta-analyses)
- [ ] Subgroup analyses conducted when heterogeneity present
- [ ] Test of moderators reported when applicable

### Reporting Requirements (Forest Plots)
- [ ] Individual study effect sizes shown (black squares)
- [ ] Square size proportional to study weight
- [ ] Confidence intervals for each study (horizontal lines)
- [ ] Meta-analytic estimate shown (diamond)
- [ ] Diamond center = pooled estimate
- [ ] Diamond endpoints = CI bounds
- [ ] Vertical reference line at null effect
- [ ] Model type labeled (FE or RE)
- [ ] Study identifiers and sample sizes included
- [ ] Numerical values printed alongside plot

### Essential Reporting Elements
- [ ] Number of studies (k)
- [ ] Total sample size
- [ ] Effect size and 95% CI for each study
- [ ] Pooled effect size and 95% CI
- [ ] Heterogeneity indices: Q (df, p), I² (95% CI), τ² (95% CI)
- [ ] Statistical test result (Z, p-value)
- [ ] Subgroup results if applicable
- [ ] Publication bias assessment (see Chapter on Bias Detection)

## Common Mistakes and Pitfalls

### Garbage In, Garbage Out
- **Problem**: Meta-analysis cannot turn low-quality data into good estimates
- **Verification**:
  - Check study quality criteria
  - Assess risk of bias in included studies
  - Consider sensitivity analyses excluding low-quality studies
  - Do NOT blindly accept all published studies
  - Look for methodological flaws in individual studies

### Publication Bias
- **Problem**: Published literature overrepresents significant results
- **Impact**: Meta-analytic estimate may be inflated
- **Mitigation**: Use bias detection techniques (p-curve, z-curve - see Chapter on Bias Detection)

### Selective Inclusion
- **Problem**: Researchers choose which studies to include/exclude
- **Risk**: Can lead to disagreement between meta-analyses on same topic
- **Prevention**: Pre-register inclusion/exclusion criteria

### Internal Meta-Analysis Risks
- **Benefit**: Reduces file-drawer problem by publishing mixed results
- **Risk**: Additional flexibility if researchers selectively report studies
- **Solution**: Report ALL well-designed studies in research line

### Incorrect Weighting
- **Mistake**: Simply averaging effect sizes
- **Correct**: Weight by precision (1/SE²)
- **Verify**: Larger studies have larger squares in forest plot

### Model Misspecification
- **Mistake**: Using fixed effects when random effects appropriate
- **Consequence**:
  - Confidence intervals too narrow
  - Type I error rate inflated
  - Cannot generalize beyond included studies

### Heterogeneity Misinterpretation
- **Mistake**: Ignoring heterogeneity when present
- **Mistake**: Treating high I² as necessarily problematic
- **Correct**: View heterogeneity as opportunity to understand moderators

### Missing Data Assumptions
- **Mistake**: Not documenting assumptions about missing information
- **Examples**:
  - Assuming equal n per group when not reported
  - Imputing unreported effect sizes
  - Assuming correlations for within-subjects designs
- **Solution**: Document all assumptions explicitly

### Test Statistics
- **Note**: Meta-analyses use Z-tests (assumes normal distribution)
- **Comparison**: Individual studies use t-tests
- **Justification**: Difference is tiny with adequate sample sizes (common in meta-analysis)
- **Not inherently problematic**: Accepted practice in meta-analysis

## Best Practices and Guidelines

### Pre-Analysis
1. **Pre-register the protocol**: Use PROSPERO or similar registry
2. **Specify inclusion/exclusion criteria** in advance
3. **Consult librarian** for literature search strategy
4. **Consult statistician** for effect size calculation approach
5. **Plan for heterogeneity exploration**: Identify potential moderators to code

### During Analysis
1. **Use open-source software**: R with metafor package (enables sharing code)
2. **Avoid commercial software**: Lacks transparency, cannot share code/data
3. **Independent double-coding**: Two researchers extract data independently
4. **Document all decisions**: Include quotes from original studies
5. **Calculate effect sizes systematically**: Use escalc() function or equivalent
6. **Check for heterogeneity**: Always examine Q, I², τ²
7. **Explore heterogeneity**: Subgroup analyses, meta-regression

### Reporting
1. **Follow JARS guidelines**: [JARS Quantitative Meta-Analysis Reporting Standards](https://apastyle.apa.org/jars/quant-table-9.pdf)
2. **Follow PRISMA guidelines**: Comprehensive reporting checklist
3. **Create forest plots**: Visual summary of all studies and meta-analytic result
4. **Report exact p-values**: Not p < .05 or p = ns
5. **Report full test statistics**: Effect size, CI, test statistic, p-value
6. **Distinguish confirmatory from exploratory**: Based on pre-registration

### Reproducibility (CRITICAL)
1. **Share raw meta-analytic data**: Effect sizes, sample sizes, test statistics
2. **Share analysis code**: Complete reproducible scripts in R or other software
3. **Share data extraction details**: Quotes, coding decisions, assumptions
4. **Make it directly analyzable**: Provide spreadsheet or R data file
5. **Future-proof the data**: Enable continuously accumulating meta-analyses
6. **Note**: Only 1 of 150 meta-analyses in Psychological Bulletin shared code (unacceptable)

### What Original Studies Should Report
To facilitate future meta-analyses, original studies must report:

1. **Sample sizes**:
   - Total N
   - N per condition
   - Final N after exclusions

2. **Descriptive statistics**:
   - Means per group
   - Standard deviations per group
   - Correlations between dependent variables (for within-subjects designs)

3. **Effect sizes**:
   - Calculated effect size with method specified (d vs g)
   - For ALL tests (significant and non-significant)

4. **Test statistics**:
   - Full test results (F, t, etc. with df)
   - Exact p-values
   - Never report "F < 1, ns" or "p < .05"

5. **Best practice**: Share anonymized raw data and analysis code

## Statistical Formulas Reference

### Standard Error of Mean
SE = σx / √n

### Standard Error of Correlation
SEr = (1 - r²xy) / √(n - 2)

### Hedges' g Correction Factor
J = (1 - 3/(4df - 1))

### Hedges' g
g = J × (X̄₁ - X̄₂) / Swithin

### Variance of Hedges' g
Vg = J² × [(n₁ + n₂)/(n₁n₂) + g²/(2(n₁ + n₂))]

### Odds Ratio
OR = (A × D) / (B × C)

### Variance of Log Odds Ratio
Var(log OR) = 1/A + 1/B + 1/C + 1/D

### Cochran's Q
Q = Σwi(yi - ȳ)²
where wi = 1/vi (inverse variance weights)

### I² Statistic
I² = [(Q - df)/Q] × 100%
where df = k - 1

## Critical Questions for Verification

### Study Selection
1. Were inclusion/exclusion criteria specified a priori?
2. Are the criteria justified and appropriate?
3. Was the literature search systematic and comprehensive?
4. Is there evidence of selective inclusion?

### Data Quality
1. Were effect sizes extracted independently by multiple coders?
2. Are calculations documented and verifiable?
3. Are assumptions about missing data stated explicitly?
4. Do reported effect sizes match original studies?

### Statistical Appropriateness
1. Is the effect size measure appropriate for the outcome type?
2. Is the chosen model (FE vs RE) justified?
3. If heterogeneity is present, was it explored?
4. Are confidence intervals and heterogeneity indices reported?
5. Is the alpha level appropriate given the sample size?

### Reporting Completeness
1. Can the analysis be reproduced from the reported information?
2. Are data and code shared?
3. Does the forest plot match the reported statistics?
4. Are all studies shown in the forest plot?
5. Are reporting guidelines (JARS, PRISMA) followed?

### Interpretation
1. Are conclusions warranted given the heterogeneity?
2. Has publication bias been assessed?
3. Are limitations acknowledged?
4. Is the meta-analytic estimate treated as definitive or as current best evidence?

## Red Flags

### Immediate Concerns
- No heterogeneity statistics reported
- Forest plot missing or incomplete
- Fixed effects used without justification when studies differ
- Commercial software used with no shared data/code
- No assessment of publication bias
- Confidence intervals suspiciously narrow
- I² = 0% in published literature (extremely unlikely)
- Only significant studies included
- Selective subgroup analyses not pre-specified

### Data Extraction Issues
- Single coder
- No documentation of assumptions
- Missing sample sizes
- Inconsistent effect size calculations
- No quotes from original studies
- Effect sizes don't match original papers

### Reporting Issues
- P-values without effect sizes
- "Non-significant" without statistics
- No pre-registration mentioned
- Data/code not shared
- Deviations from protocol not acknowledged
- Cherry-picked reporting of subgroups

## Tools and Software

### Recommended: R with metafor package
- **Advantages**:
  - Free and open source
  - Transparent and reproducible
  - Can share code and data
  - Comprehensive functionality
  - Active development and support

- **Key functions**:
  - `escalc()`: Calculate effect sizes and variances
  - `rma()`: Run meta-analysis (FE or RE)
  - `forest()`: Create forest plots
  - `confint()`: Get heterogeneity confidence intervals

### Avoid: Commercial software
- Cannot share analysis code
- Cannot verify calculations
- Not reproducible
- Creates vendor lock-in

## Integration with Other Chapters

### Effect Sizes (Chapter reference)
- Cohen's d vs Hedges' g
- Effect size interpretation
- Confidence intervals around effect sizes

### Bias Detection (Chapter reference)
- P-curve analysis
- Z-curve analysis
- Publication bias assessment
- Essential component of any meta-analysis

### Sample Size Justification (Chapter reference)
- Studies need less N for hypothesis testing than for accurate estimation
- Meta-analysis provides better estimates by combining studies
- Consider lower alpha levels in high-powered meta-analyses

### Error Control (Chapter reference)
- Alpha level justification
- Consider α < 0.05 for meta-analyses
- Type I error rates in heterogeneity tests

## Summary: Six Recommendations for Quality

| What? | How? |
|-------|------|
| **Facilitate cumulative science** | Disclose all meta-analytic data (effect sizes, sample sizes, test statistics, means, SDs, correlations). Quote relevant text from studies. Specify subjective decisions. |
| **Facilitate quality control** | Specify effect size calculations and assumptions. Document who extracted data. Prefer independent double-coding. |
| **Use reporting guidelines** | Adhere to PRISMA or JARS standards. Provide completed checklist. |
| **Preregister** | Use PROSPERO or similar. Distinguish confirmatory from exploratory analyses. Conduct prospective meta-analyses when possible. |
| **Facilitate reproducibility** | Share data files directly analyzable in statistical software. Provide completely reproducible scripts in R or spreadsheet at minimum. |
| **Recruit expertise** | Consult librarian for literature search. Consult statistician for effect size calculations. |

## Final Notes for AI Verification

When reviewing a meta-analysis:

1. **Start with reproducibility**: Can you re-run the analysis? If not, major red flag.
2. **Check heterogeneity**: Is it reported? Is it explored? Is it explained?
3. **Verify weighting**: Larger studies should have more influence (bigger squares in forest plot).
4. **Assess model choice**: Random effects is almost always appropriate for published literature.
5. **Look for bias**: Has publication bias been assessed? Are bias detection methods used?
6. **Check completeness**: Are all required statistics reported (Q, I², τ², effect size, CI, p)?
7. **Verify forest plot**: Does it match the reported statistics? Are all studies shown?
8. **Question the pool**: Should these studies be combined? Or is heterogeneity too extreme?
9. **Check original studies**: If possible, verify a few effect sizes were extracted correctly.
10. **Think critically**: Meta-analysis provides current best estimate, not final truth.

Remember: "Every single study is just a data-point in a future meta-analysis." Ensure studies report enough detail to be included in future meta-analyses, and ensure meta-analyses are reproducible enough to be updated as new evidence accumulates.
