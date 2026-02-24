# Effect Size Verification Guidance for AI Agents

## Purpose
This document provides distilled guidance for AI agents helping scientists verify statistical analyses, focusing on effect size reporting, calculation, and interpretation.

---

## 1. KEY CONCEPTS

### 1.1 Fundamental Definitions

**Effect Size**: A quantitative description of the strength of a phenomenon expressed as a number on a scale.

**Unstandardized Effect Size**: Expressed on the original measurement scale (e.g., 6 cm growth per year). Use when the scale is intuitively interpretable.

**Standardized Effect Size**: Scaled in terms of sample variability to enable comparison across different measurement scales (e.g., Cohen's d, r).

### 1.2 Effect Size Families

**d Family (Standardized Mean Differences)**:
- Based on difference between observations divided by standard deviation
- Examples: Cohen's d_s, d_z, d_av, Hedges' g
- Range: -∞ to +∞ (practically limited by data)
- Zero = no effect

**r Family (Strength of Association)**:
- Proportion of variance explained by group membership
- Examples: correlation (r), eta-squared (η²), partial eta-squared (η_p²)
- Range: -1 to +1 for correlations; 0 to 1 for variance-explained measures
- r² = proportion of variance explained (e.g., r = 0.5 means 25% variance explained)

### 1.3 Specific Effect Size Measures

**Cohen's d_s** (Independent Groups):
- Formula: d_s = (M̄₁ - M̄₂) / SD_pooled
- Used for comparing two independent groups
- Can be calculated from t-value: d_s = t × √(1/n₁ + 1/n₂)

**Cohen's d_z** (Within-Subjects):
- Formula: d_z = M_dif / SD_dif
- Based on difference scores and their standard deviation
- Can be calculated from paired t-value: d_z = t / √n
- NOT directly comparable to d_s due to correlation between measures

**Cohen's d_av** (Within-Subjects, Alternative):
- Formula: d_av = M_dif / [(SD₁ + SD₂) / 2]
- Ignores correlation, allows comparison with d_s
- Preferred when comparing across designs

**Hedges' g**:
- Bias-corrected version of Cohen's d
- Correction particularly important for small samples
- Should be preferred over Cohen's d for population estimates

**Eta-squared (η²)**:
- Formula: η² = SS_effect / SS_total
- Compares effects within a study
- NOT comparable between studies (depends on total variability)

**Partial Eta-squared (η_p²)**:
- Formula: η_p² = SS_effect / (SS_effect + SS_error)
- Better for comparing between studies
- Can compute from F-value: η_p² = (F × df_effect) / (F × df_effect + df_error)

**Omega-squared (ω²) and Epsilon-squared (ε²)**:
- Less biased alternatives to η²
- Should be preferred for population estimates
- Formulas use F-values and degrees of freedom

**Cohen's f** (ANOVA):
- Used for power analysis in ANOVA designs
- For two groups: f = 0.5 × d
- Relationship to eta-squared: f = √(η² / (1 - η²))

### 1.4 Effect Size Conversions

**d to r** (equal sample sizes):
- r = d_s / √(d_s² + N² - 2N) / (n₁ × n₂))
- Use for meta-analyses combining different effect types

**η² to d**:
- d = 2 × f where f² = η² / (1 - η²)

**CAUTION**: Cohen's benchmarks for d and r are NOT equivalent
- d = 0.2, 0.5, 0.8 (small, medium, large)
- r = 0.1, 0.3, 0.5 (NOT equivalent transformations)
- Do not use benchmarks anyway (see Section 3)

---

## 2. GUIDELINES & RECOMMENDATIONS

### 2.1 When to Use Which Effect Size

**Use Cohen's d_s when**:
- Comparing two independent groups
- Sample means and pooled SD available
- Reporting standardized mean differences

**Use Cohen's d_z when**:
- Within-subjects/repeated measures design
- Conducting power analysis for paired designs
- Software (e.g., G*Power) requires d_z as input

**Use Cohen's d_av when**:
- Within-subjects design but need comparison with between-subjects studies
- Want to ignore correlation between measures

**Use Hedges' g when**:
- Estimating population effect sizes
- Small sample sizes (correction more important)
- Meta-analyses (always preferred)

**Use η_p² when**:
- ANOVA designs with multiple factors
- Comparing effect sizes across studies
- Fixed factors (not measured factors or covariates)

**Use ω_p² or ε_p² when**:
- Need unbiased estimates of population variance explained
- Reporting effect sizes for publication

**Use correlation (r) when**:
- Two continuous variables
- Examining strength of linear relationship
- Meta-analyses combining correlational and experimental studies

### 2.2 Reporting Requirements

**Minimum Requirements**:
1. Report BOTH unstandardized and standardized effect sizes when possible
2. Include confidence intervals (95% CI) for all effect sizes
3. Specify which version of effect size used (e.g., d_s vs d_z)
4. Report sample sizes used in calculations
5. For meta-analyses: use bias-corrected measures (Hedges' g, ω²)

**Best Practices**:
- Prioritize unstandardized effect sizes when measurement scale is interpretable
- Provide context for interpretation (not just benchmarks)
- For ANOVA: report pattern of means alongside effect sizes
- Include standard deviations when reporting means
- State whether effects are corrected for bias

### 2.3 Effect Size in Different Contexts

**Meta-analyses**:
- Use Hedges' g (not Cohen's d)
- Account for publication bias and truncation
- Report heterogeneity measures
- Check for implausibly large effects

**Power analyses**:
- Use d_z for within-subjects designs
- Use f for ANOVA designs
- Specify pattern of means, not just single effect size
- Consider minimal statistically detectable effect

**Registered Reports**:
- Provide unbiased effect size estimates
- Expect smaller effects than selective literature
- Average replication effect size ≈ 0.5 × original study

---

## 3. COMMON MISTAKES & PITFALLS

### 3.1 Interpretation Errors

**NEVER**:
1. **Use Cohen's benchmarks (d = 0.2/0.5/0.8 as small/medium/large)**
   - Arbitrary values with no justification
   - Circular reasoning ("small because d = 0.2")
   - Ignores context and practical significance
   - Benchmarks don't align between d and r

2. **Confuse d_s and d_z**
   - d_z includes correlation, d_s does not
   - Not directly comparable
   - Using wrong version invalidates power analyses

3. **Ignore variability when interpreting standardized effects**
   - Same d can reflect different mean differences
   - Same d can reflect different standard deviations
   - Standardized effects can show opposite patterns to raw effects

4. **Assume effect applies to all individuals**
   - Effects are probabilistic and population-level
   - Considerable overlap even for large effects (d = 2)
   - Individual variation expected

5. **Equate statistical significance with practical significance**
   - Large samples make tiny effects significant
   - Effect size independent of sample size
   - p-value alone insufficient for inference

### 3.2 Calculation Errors

**Common Mistakes**:
1. **Using η² instead of η_p² when comparing across studies**
   - η² depends on total design variability
   - Not generalizable across different designs

2. **Not correcting for bias in small samples**
   - Cohen's d overestimates population effect
   - Use Hedges' g instead
   - Use ω² or ε² instead of η²

3. **Incorrect conversion between effect sizes**
   - Different formulas for different designs
   - Sample size matters in conversions
   - Equal sample sizes often assumed

4. **Computing d_z from between-subjects formulas**
   - Requires different standardizer
   - Cannot use pooled SD formula

### 3.3 Reporting Errors

**Watch For**:
1. **Missing effect sizes in publications**
   - Can calculate from t, F values if needed
   - Use MOTE or effectsize packages

2. **Incomplete information**
   - No confidence intervals
   - Version of effect size not specified
   - Sample sizes not reported

3. **Selective reporting of significant effect sizes**
   - Creates publication bias
   - Inflates meta-analytic estimates
   - Truncates distribution

### 3.4 Plausibility Checks

**Red Flags - Effect Too Large**:
- d > 2 in psychology (rare exceptions exist)
- Larger than maximum positive controls
- Exceeds effects of obvious phenomena (e.g., height differences between sexes ≈ d = 2)
- Contradicts lived experience (would notice in daily life)
- Replicates multiple times per day with same magnitude

**Red Flags - Effect Too Small**:
- d < 0.001 unlikely to be practically meaningful
- Below just-noticeable difference threshold
- Requires thousands of observations to detect single instance

---

## 4. VERIFICATION CHECKLISTS

### 4.1 Pre-Analysis Checklist

**Before data collection**:
- [ ] Specify expected effect size with justification
- [ ] Distinguish d_s, d_z, d_av based on design
- [ ] Plan both unstandardized and standardized reporting
- [ ] Define smallest effect size of interest (SESOI)
- [ ] Consider minimal statistically detectable effect

### 4.2 Effect Size Calculation Checklist

**For independent t-test (d_s)**:
- [ ] Correct pooled SD formula used
- [ ] Sample sizes correctly specified
- [ ] Direction of effect clear (M₁ - M₂)
- [ ] Bias correction applied (Hedges' g)
- [ ] Confidence interval calculated

**For paired t-test (d_z)**:
- [ ] Using difference scores, not separate groups
- [ ] Correct standardizer (SD of differences)
- [ ] Sample size is number of pairs
- [ ] Not confused with d_s
- [ ] Alternative d_av calculated if comparing across designs

**For ANOVA (η_p², ω_p²)**:
- [ ] Partial effect sizes used (not simple η²)
- [ ] F-value and degrees of freedom correct
- [ ] Bias-corrected version computed
- [ ] Pattern of means reported
- [ ] Not generalizing across different designs

**For correlations (r)**:
- [ ] Range checked (-1 to 1)
- [ ] Sample size reported
- [ ] r² computed for variance explained
- [ ] Confidence interval included
- [ ] Not converted incorrectly to d

### 4.3 Reporting Review Checklist

**Essential elements present**:
- [ ] Effect size measure specified (which type of d, η², r)
- [ ] Point estimate reported with precision
- [ ] 95% confidence interval included
- [ ] Sample sizes stated
- [ ] Unstandardized effect provided when interpretable
- [ ] Standard deviations reported with means

**Quality indicators**:
- [ ] No reliance on verbal benchmarks (small/medium/large)
- [ ] Context-based interpretation provided
- [ ] Practical significance addressed
- [ ] Plausibility discussed (comparison to known effects)
- [ ] Limitations acknowledged

### 4.4 Publication Bias Detection Checklist

**When reviewing literature/meta-analyses**:
- [ ] Check for selective reporting of significant results
- [ ] Calculate minimal statistically detectable effect
- [ ] Compare observed effect to critical effect size
- [ ] Look for Registered Reports (unbiased estimates)
- [ ] Consider truncated distribution adjustment
- [ ] Check for implausibly large effects
- [ ] Verify all non-significant results reported

---

## 5. DECISION RULES

### 5.1 Choosing Effect Size Measures

**Decision Tree**:

```
Study Design?
├─ Two independent groups
│  └─ Report: d_s (or Hedges' g), unstandardized difference, pooled SD
│
├─ Two paired/repeated measures
│  ├─ For power analysis → d_z
│  ├─ For comparison with between-subjects → d_av
│  └─ Report: unstandardized difference, SD of differences
│
├─ ANOVA (2+ groups/factors)
│  ├─ Within-study comparison → η_p²
│  ├─ Across-study comparison → ω_p² or ε_p²
│  └─ Report: pattern of means, SDs, η_p² or ω_p²
│
├─ Two continuous variables
│  └─ Report: r, r², scatterplot if possible
│
└─ Meta-analysis
   ├─ Mean differences → Hedges' g
   ├─ Mixed designs → convert to common metric (r or d)
   └─ Report: bias assessment, heterogeneity, forest plots
```

### 5.2 Interpretation Guidelines

**Step 1: Plausibility Check**
- Compare to known effects in literature
- Check against maximum positive controls
- Verify against lived experience
- Flag if implausibly large or small

**Step 2: Context Analysis**
- What is the measurement scale?
- Is unstandardized effect interpretable?
- What are related effects in the literature?
- What is the smallest effect of interest?

**Step 3: Practical Significance**
- Does effect exceed just-noticeable difference?
- What is probability of superiority?
- What is number needed to treat?
- Cost-benefit analysis of effect magnitude

**Step 4: Statistical Properties**
- Check confidence interval width
- Assess precision of estimate
- Consider power/minimal detectable effect
- Check for publication bias indicators

### 5.3 Sample Size Justification Rules

**Using effect sizes for justification**:

1. **A priori power analysis**:
   - Base on smallest effect size of interest (SESOI)
   - NOT on "expected" or "typical" effect
   - Account for publication bias (literature likely inflated)
   - Consider: observed effects ≈ 0.5 × published effects

2. **Minimal detectable effect**:
   - Compute critical effect size for planned sample
   - Verify acceptable relative to SESOI
   - Formula for independent t: d_crit = t_crit × √(1/n₁ + 1/n₂)
   - Ensure meaningful effects are detectable

3. **Precision-based**:
   - Target specific confidence interval width
   - Not dependent on effect size estimate
   - More robust to publication bias

### 5.4 Publication Bias Assessment Rules

**When effect size estimate may be inflated**:

1. **Calculate minimal statistically detectable effect** (d_crit)
   - All observed effects should exceed this if selection occurred
   - α = 0.05, N = 50 per group → d_crit ≈ 0.4
   - α = 0.05, N = 30 → r_crit ≈ 0.36

2. **Apply truncation adjustment**
   - Use Taylor & Muller (1996) method
   - Implemented in R packages
   - Provides adjusted estimate accounting for censoring

3. **Consider Type M (magnitude) error**
   - Effects selected for significance are inflated on average
   - Inflation greater when:
     * True effect closer to zero
     * Sample sizes smaller
     * More of distribution truncated

4. **Solution hierarchy**:
   - Best: Stop selective reporting (Registered Reports)
   - Good: Large single studies (multi-lab replications)
   - Acceptable: Truncation-adjusted estimates
   - Avoid: Ignoring the problem

---

## 6. SPECIFIC VERIFICATION SCENARIOS

### 6.1 Reviewing Published Paper

**Step-by-step verification**:

1. **Identify all statistical tests**
2. **For each test, check**:
   - Effect size reported? (if not, can calculate from t/F)
   - Correct type for design?
   - Confidence interval included?
   - Plausible magnitude?
3. **Calculate if missing**:
   - Use MOTE package/app or effectsize package in R
   - From t-value: d_s = t × √(1/n₁ + 1/n₂)
   - From F-value: η_p² = (F × df_effect) / (F × df_effect + df_error)
4. **Flag issues**:
   - Missing effect sizes
   - Benchmark interpretations
   - Implausible values
   - No confidence intervals

### 6.2 Verifying Meta-Analysis

**Critical checks**:

1. **Effect size measure**:
   - Hedges' g (not Cohen's d)?
   - Consistent across studies?
   - Properly converted when necessary?

2. **Bias assessment**:
   - Publication bias examined?
   - Funnel plot symmetric?
   - Registered Reports included?
   - File-drawer problem addressed?

3. **Heterogeneity**:
   - I² statistic reported?
   - Sources of heterogeneity explored?
   - Random vs. fixed effects justified?

4. **Interpretation**:
   - No benchmark labels?
   - Context provided?
   - Comparison to unbiased estimates?

### 6.3 Verifying Power Analysis

**Essential checks**:

1. **Effect size input**:
   - d_z used for within-subjects?
   - Pattern of means specified for interactions?
   - Correlation specified for paired designs?
   - SESOI-based (not "expected" effect)?

2. **Critical values**:
   - Minimal detectable effect computed?
   - Compared to SESOI?
   - Acceptable for research question?

3. **Assumptions**:
   - Sample sizes per group specified?
   - Alpha level stated?
   - One-tailed vs. two-tailed?
   - Effect direction justified if one-tailed?

### 6.4 Interaction Effects in ANOVA

**Special considerations**:

1. **Type of interaction**:
   - Ordinal (no crossover) vs. disordinal (crossover)
   - Disordinal effects are larger for same means
   - Pattern of means more informative than single effect size

2. **Effect size calculation**:
   - Interaction effect = cell mean - (grand mean + marginal effects)
   - Cohen's f computed from pattern
   - Single effect size may mask important patterns

3. **Verification**:
   - Pattern of means reported?
   - Simple effects examined?
   - Visualization provided?
   - Not over-relying on omnibus effect size

---

## 7. COMPUTATIONAL FORMULAS

### 7.1 Core Formulas

**Independent t-test**:
- t = (M̄₁ - M̄₂) / (SD_pooled × √(1/n₁ + 1/n₂))
- d_s = (M̄₁ - M̄₂) / SD_pooled
- d_s = t × √(1/n₁ + 1/n₂)

**Paired t-test**:
- d_z = M_dif / SD_dif
- d_z = t / √n
- d_av = M_dif / [(SD₁ + SD₂) / 2]

**ANOVA**:
- η² = SS_effect / SS_total
- η_p² = SS_effect / (SS_effect + SS_error)
- η_p² = (F × df_effect) / (F × df_effect + df_error)
- ω_p² = (F - 1) / (F + (df_error + 1) / df_effect)
- ε_p² = (F - 1) / (F + df_error / df_effect)

**Cohen's f**:
- f = σ_m / σ where σ_m = √(Σ(m_i - m)² / k)
- For two groups: f = 0.5 × d
- f² = η² / (1 - η²)

**Conversions**:
- r = d_s / √(d_s² + (N² - 2N)/(n₁ × n₂))
- d = 2 × f where f² = η² / (1 - η²)

**Critical effect sizes**:
- d_crit = t_crit × √(1/n₁ + 1/n₂)
- M_crit = t_crit × √(sd₁²/n₁ + sd₂²/n₂)

### 7.2 Software Tools

**R packages**:
- `effectsize`: Calculate and convert effect sizes
- `MOTE`: Effect sizes with confidence intervals
- `metafor`: Meta-analytic effect sizes
- `Superpower`: ANOVA power and effect sizes

**Online calculators**:
- MOTE Shiny app: https://doomlab.shinyapps.io/mote/
- Effect size visualization: http://rpsychologist.com/d3/cohend/
- Correlation visualization: http://rpsychologist.com/d3/correlation/

**Statistical software**:
- G*Power: Power analysis, critical values
- JASP/jamovi: Effect sizes in output
- R/Python: Full computational control

---

## 8. INTERPRETIVE AIDS

### 8.1 Probability of Superiority

Definition: Probability that randomly selected individual from Group 1 scores higher than randomly selected individual from Group 2.

**Key values**:
- d = 0.001 → ~50% (essentially equal)
- d = 0.43 → ~62%
- d = 2.0 → ~92%

**Use**: Helps communicate practical meaning to non-statisticians

### 8.2 Number Needed to Treat (NNT)

Definition: Number of individuals who need to receive intervention before observing one additional success compared to control.

**Application**:
- Cost-benefit analysis
- Clinical significance
- Resource allocation decisions

**Note**: Depends on control event rate (CER)

### 8.3 Variance Explained (r²)

**Key values**:
- r = 0.1 → 1% variance explained
- r = 0.21 → 4.4% variance explained (median in psychology)
- r = 0.5 → 25% variance explained

**Warning**: Small percentages don't necessarily mean unimportant effects (Funder & Ozer, 2019)

### 8.4 Overlap Between Distributions

**Visual checks**:
- Use visualization tools to see distribution overlap
- Even large effects (d = 2) show substantial overlap
- Individual predictions unreliable even with group differences

---

## 9. LITERATURE CONTEXT

### 9.1 Reference Points

**Median effect sizes in psychology**:
- r = 0.21 (d ≈ 0.43) in meta-meta-analysis
- Effects in replication studies ≈ 0.5 × original studies
- Registered Reports yield unbiased estimates

**Benchmark effects for context** (not for labeling):
- Personality stability over time: r = 0.66 (d = 1.76)
- Height difference men vs. women: d ≈ 2
- Social loafing: d = 0.43
- Group rejection of deviants: r = 0.6 (d = 1.5)

**Implausibly large**:
- d > 2 in behavioral interventions (very rare)
- Effects larger than obvious physical differences
- Effects that would reorganize society if true

### 9.2 Domain-Specific Considerations

**Clinical psychology**:
- Even small effects may be meaningful (suicide prevention)
- NNT important for resource allocation
- Long-term effects may accumulate

**Social psychology**:
- Effects often modest (d = 0.2 to 0.5)
- Contextual factors matter
- Replication crisis revealed inflated estimates

**Cognitive psychology**:
- Within-subject designs common (use d_z)
- Raw RTs often interpretable (prefer unstandardized)
- Practice effects and fatigue important

**Neuroscience**:
- Expensive studies, often small samples
- Publication bias particularly problematic
- Consider minimal detectable effects

---

## 10. ALGORITHMIC VERIFICATION WORKFLOW

### For AI agents performing automated checks:

```
FUNCTION verify_effect_size(study):

    # Step 1: Identify design
    design = extract_design(study)

    # Step 2: Check presence
    effect_size_present = check_for_effect_size(study)
    IF NOT effect_size_present:
        TRY calculate_from_test_statistic(study)
        FLAG "Missing effect size"

    # Step 3: Verify type matches design
    reported_type = extract_effect_size_type(study)
    expected_type = get_expected_type(design)
    IF reported_type != expected_type:
        FLAG "Potential mismatch: {reported_type} for {design}"

    # Step 4: Check calculations
    IF test_statistic_available:
        calculated_effect = compute_effect_size(test_statistic, design)
        IF abs(calculated_effect - reported_effect) > tolerance:
            FLAG "Calculation error detected"

    # Step 5: Plausibility check
    IF effect_size > plausibility_threshold(design):
        FLAG "Implausibly large effect: {effect_size}"
    IF effect_size < meaningfulness_threshold:
        FLAG "Potentially trivial effect: {effect_size}"

    # Step 6: Check confidence interval
    IF NOT confidence_interval_present:
        FLAG "Missing confidence interval"
        TRY calculate_CI(effect_size, sample_size)

    # Step 7: Verify interpretation
    IF uses_benchmarks(study):
        FLAG "Benchmark interpretation detected (small/medium/large)"
    IF NOT provides_context(study):
        SUGGEST "Add context-based interpretation"

    # Step 8: Publication bias indicators
    minimal_detectable = calculate_critical_effect(sample_size, alpha)
    IF effect_size ≈ minimal_detectable:
        FLAG "Effect near minimal detectable - possible selection bias"

    # Step 9: Generate report
    RETURN verification_report(all_flags, all_suggestions)
```

---

## 11. CRITICAL REMINDERS

**Always verify**:
1. Effect size TYPE matches study design
2. Confidence intervals are present
3. NO benchmark interpretations (small/medium/large)
4. Bias correction applied when appropriate
5. Plausibility relative to known effects

**Red flags requiring immediate attention**:
1. Missing effect sizes entirely
2. d_s and d_z confusion
3. η² used instead of η_p² or ω²
4. Implausibly large effects (d > 2 in most contexts)
5. Benchmark-based conclusions
6. No confidence intervals
7. Effect approximately equal to minimal detectable (publication bias)

**Best practices to encourage**:
1. Report both unstandardized and standardized
2. Use Hedges' g instead of Cohen's d
3. Provide context-based interpretation
4. Include visual representations
5. Report complete patterns, not just omnibus effects
6. Pre-register effect size expectations
7. Publish Registered Reports for unbiased estimates

---

## REFERENCES

Key papers for deeper understanding:
- Cohen (1988): Statistical Power Analysis for the Behavioral Sciences
- Cohen (1990): Things I've learned (so far)
- Baguley (2009): Standardized or simple effect size: What should be reported?
- Lakens (2013): Calculating and reporting effect sizes
- Funder & Ozer (2019): Evaluating effect size in psychological research
- Taylor & Muller (1996): Bias in linear model power and sample size
- Anderson et al. (2017): Sample-size planning for more accurate statistical power
- McGrath & Meyer (2006): When effect sizes disagree
- Perugini et al. (2025): Benefits of minimal statistically detectable effect

This guidance document synthesizes the evidence-based approach to effect size reporting and interpretation, designed specifically for AI agents assisting with statistical verification tasks.
