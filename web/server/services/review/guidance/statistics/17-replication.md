# Replication Studies: AI Agent Guidance for Verifying Statistical Analyses

## Key Concepts

### Types of Replication

**Direct Replication Study**
- Methods and measures as similar to original as possible
- Goal: Identify Type 1 or Type 2 errors in literature
- Secondary aim: Identify factors deemed irrelevant but actually crucial

**Conceptual Replication Study**
- Intentionally introduces differences from original
- Tests generalization of effect
- Systematically explores impact of changes or uses different methods when original unavailable

**Replication and Extension Studies**
- Original replicated plus additional conditions testing novel hypotheses
- "Baseline technique" - original effect always in design
- Excellent for building cumulative knowledge

**Reproducibility vs. Replication**
- **Reproducibility**: Same data, reproduce results (identifies analysis errors)
- **Replication**: New data collected

### Important Distinctions

**Self-Replication vs. Independent Replication**
- **Self-replication**: Same researchers repeat experiment
  - Reduces Type 1 error
  - Same systematic errors remain
- **Independent replication**: Different researchers repeat
  - Reduces Type 1 error
  - Additionally reduces systematic error
  - Tests generalizability across experimenters, locations, time

**Ceteris Paribus Clause**
- Factors relegated to "all equal" status
- Not all factors deemed irrelevant are actually irrelevant
- Challenge: Identify which auxiliary hypotheses explain replication failures

### The Replication Crisis

**Reproducibility Project: Psychology (2015)**
- 100 studies replicated from 2008 psychology journals
- Original: 97 of 100 significant
- Expected replications at 92% power: 89
- Actual: Only 35 of 97 replicated (36% rate)

**Key Point**
- Single studies almost never provide definitive resolution
- Science is cumulative uncertainty reduction
- Science must remain the greatest skeptic of its own claims

## Guidelines & Recommendations

### Designing Replication Studies

**1. Protocol Development**
- Stay close to original where possible
- Deviate only when necessary with clear justification
- Share reproducible code and materials

**2. Sample Size Planning**
- High power to detect observed effect size
- A-priori power analysis for equivalence tests against SESOI
- Consider: Two studies at α = 0.05 may be more efficient than one at α = 0.0025 (especially one-sided tests at 80% power)

**3. Constraints on Generalizability Statement**
- Specify contexts where effect is theoretically expected to replicate
- Identify where variability would not be problematic for original claim
- Clarifies theoretically relevant factors

**4. Collaboration Approaches**
- **Adversarial collaboration**: Opposing teams resolve inconsistencies
- Systematically vary crucial auxiliary hypotheses
- Engage original authors (but authors have low success predicting which hypotheses matter)

### When to Conduct Replications

**Essential When:**
- Claim becomes increasingly important
- Building cumulative knowledge
- Type 1 errors costly
- Individual researchers require lower error rates
- Testing robustness across contexts

**May Not Be Needed When:**
- Researchers study unrepeatable events
- Must make different arguments for research value
- Still requires specification of necessary conditions

### Statistical Power Considerations

**Comparison: One Study at α = 0.0025 vs. Two at α = 0.05**

Two-sided t-tests:
- One study slightly more efficient at high power
- d = 0.5, 80% power: N = 244 vs. 256 total (saves 12 participants)

One-sided t-tests:
- Two studies more efficient at 80% power
- d = 0.5, 80% power: N = 218 vs. 204 total (saves 14 participants)

**Recommendation**: Prefer two-study approach with one-sided tests given non-statistical benefits

## Statistical Analysis Approaches

### 1. Direct Test of Difference Between Effect Sizes (Recommended)

**For Independent t-tests:**
```
Z_Diff = (δ₁ - δ₂) / √(V_δ₁ + V_δ₂)
```

**Three equivalent implementations:**
1. Z-test with p-value
2. Heterogeneity analysis
3. Moderator analysis

**For Correlations:**
```
Z = [ln(1+r) - ln(1-r)] / 2
```

**Limitations:**
- Low power with small original samples
- Large uncertainty in original increases variance of difference estimate

### 2. Significance in Replication Study

**Approach:**
- Test if replication yields significant result
- Question: "Did repeating the procedure yield a significant effect?"

**Problem:**
- Some significant effects are statistically smaller than original
- Should these be considered 'replicated'?

### 3. Combined Criteria (Significance + Heterogeneity)

**Successful Replication:**
- Effect statistically different from 0 (p < .05), AND
- Difference in effect sizes NOT statistically different (p > .05 heterogeneity)

**Non-Replication:**
- Effect NOT statistically different from 0 (p > .05), AND
- Difference in effect sizes IS statistically different (p < .05 heterogeneity)

**Major Problem:**
- Low power of heterogeneity test makes many studies "statistically unfalsifiable"
- Most tests inconclusive

### 4. Small Telescopes Approach (Inferiority Test)

**Procedure:**
- Test against effect original had 33% power to detect
- Significant if 90% CI around replication excludes conservative estimate

**Criticism:**
- 33% power threshold arbitrary
- Better to specify SESOI

### 5. Smallest Effect Size of Interest (SESOI) Approach (Recommended)

**Methods to Set SESOI:**

1. **Original authors specify**: Smallest effect they care about
2. **Theoretical predictions**: Theory-based meaningful threshold
3. **Larger than crud factor**: r = 0.1 or d = 0.2 (observed for nonsensical variables)

**Analysis:**
- Perform inferiority test against SESOI
- Use equivalence test to examine if difference too small to matter

**Example:**
- Original: d = 3.01
- Multi-lab replication: d = 0.06, 95% CI [0.01, 0.12]
- Effect statistically different from original AND significant
- But d = 0.06 too small to matter (needs N = 4,362 per condition for 80% power)
- Conclusion: Equivalent to null (practically insignificant)

### 6. Meta-Analysis of Original and Replication (Use With Caution)

**Approach:**
- Combine effect sizes in fixed-effect meta-analysis
- Test if meta-analytic effect significantly differs from zero

**Problems:**
- Publication/selection bias inflates effect sizes
- Meta-analytic effect also inflated
- Only useful when bias demonstrably absent

## Common Mistakes & Pitfalls

### Design Mistakes

1. **Insufficient Power**
   - Not planning adequate sample size
   - Not performing power analysis for equivalence test

2. **Ignoring SESOI**
   - Treating all significant effects as successful replications
   - Not considering if effect too small to matter

3. **Testing Against Original Point Estimate**
   - Ignoring uncertainty in original effect size
   - Equivalent to changing independent t-test to one-sample (inappropriate)

4. **Not Specifying Auxiliary Hypotheses**
   - Not documenting assumed relevant vs. irrelevant factors
   - Not creating constraints on generalizability statement

5. **Inadequate Protocol Documentation**
   - Not sharing sufficient detail

### Analysis Mistakes

1. **Using Only p-value from Replication**
   - Not testing difference between effect sizes directly

2. **Arbitrary Benchmarks**
   - Using 33% power threshold without justification

3. **Ignoring Statistical Power of Comparison**
   - Not recognizing heterogeneity tests have low power with small original samples

4. **Combining Biased Studies in Meta-Analysis**
   - Meta-analyzing likely biased original with replication

### Interpretation Mistakes

1. **Binary Thinking**
   - Not considering three possible interpretations:
     a. Type 2 error in replication
     b. Type 1 error in original
     c. Relevant auxiliary hypothesis differs

2. **Over-Interpreting Single Replication**
   - Expecting definitive resolution
   - Not recognizing cumulative uncertainty reduction

3. **Uncritical Acceptance of Hidden Moderators**
   - Accepting post-hoc explanations without evidence
   - Ignoring that authors have low success predicting which hypotheses matter (Many Labs 5)

4. **Ignoring Systematic Error**
   - Not recognizing independent replication's value
   - Treating self-replication and independent replication as equivalent

5. **Temporal Changes**
   - Not acknowledging human behavior changes over time
   - Good theories should specify necessary conditions
   - "If one knows something to be true, he is in a position to predict; where prediction is impossible there is no knowledge"

## Verification Checklists

### Pre-Replication Planning Checklist

- [ ] Direct or conceptual replication? (Document justification)
- [ ] Documented all intentional deviations from original?
- [ ] Specified auxiliary hypotheses assumed relevant?
- [ ] Created constraints on generalizability statement?
- [ ] Consulted original authors (if appropriate)?
- [ ] Performed a-priori power analysis for:
  - [ ] Detecting original effect size?
  - [ ] Equivalence test against SESOI?
  - [ ] Test of difference between effect sizes?
- [ ] Specified smallest effect size of interest?
- [ ] Determined one-sided or two-sided tests?
- [ ] Shared materials and reproducible code?
- [ ] Study preregistered (ideally Registered Report)?

### During Data Collection Checklist

- [ ] Documenting procedural details differing from original?
- [ ] Tracking factors that might be relevant auxiliary hypotheses?
- [ ] Maintaining data quality standards?
- [ ] Experimenter behaviors consistent with protocol?

### Analysis Checklist

**Primary Analyses:**
- [ ] Test of statistical significance in replication
- [ ] Test of difference between effect sizes (heterogeneity or moderator)
- [ ] Equivalence test against SESOI
- [ ] Inferiority test against SESOI (if appropriate)

**Power Analyses:**
- [ ] Achieved power of replication?
- [ ] Power of test for difference between effect sizes?
- [ ] Power of equivalence test?

**Effect Size Estimation:**
- [ ] Point estimate with confidence intervals for replication
- [ ] Compared to original with confidence intervals
- [ ] Forest plot showing both studies (recommended)

**Meta-Analysis (if appropriate):**
- [ ] Fixed-effect meta-analysis of original and replication
- [ ] Only if bias not a concern
- [ ] Report heterogeneity statistics (Q, I², τ²)

### Interpretation Checklist

- [ ] Is replication effect statistically significant?
- [ ] Is replication effect significantly different from original?
- [ ] Is replication effect practically/theoretically meaningful?
- [ ] If non-replication, considered all three explanations?
  - [ ] Type 2 error in replication?
  - [ ] Type 1 error in original?
  - [ ] Relevant auxiliary hypothesis differs?
- [ ] Avoided binary "success/failure" language?
- [ ] Acknowledged uncertainty in conclusions?
- [ ] Specified what would resolve discrepancies?

## Reporting Requirements

### Minimum Reporting Standards (APA)

1. **Introduction**
   - Clear statement this is replication
   - Type: direct, conceptual, or replication-and-extension
   - Full citation of original
   - Justification for replication

2. **Rationale for Deviations**
   - Document all intentional deviations
   - Justify necessity
   - Explain factors relegated to ceteris paribus

3. **Method Section**
   - Detailed protocol
   - Comparison table original vs. replication (recommended)
   - Sample size justification with power analyses
   - SESOI specification with justification

4. **Auxiliary Hypotheses**
   - Explicit statement of assumed relevant hypotheses
   - Factors expected to moderate effect
   - Constraints on generalizability statement

5. **Results Section**
   - Effect size with CIs for replication
   - Effect size with CIs for original (if available)
   - Test of significance in replication
   - Test of difference between effect sizes
   - Equivalence test results (if applicable)
   - Inferiority test results (if applicable)
   - Forest plot (highly recommended)
   - Meta-analysis (if appropriate and unbiased)

6. **Power Reporting**
   - Achieved power in replication
   - Power of test for difference
   - Power of equivalence/inferiority tests
   - Sensitivity analyses

7. **Interpretation**
   - Avoid binary "replicated/did not replicate" where possible
   - Acknowledge all three explanations for discrepancies
   - Discuss whether effect too small to matter
   - Address limitations and uncertainty
   - Specify what additional studies would resolve discrepancies

8. **Open Science Practices**
   - Link to preregistration
   - Link to materials, data, analysis code
   - Statement about computational reproducibility

### Optional But Recommended

- Adversarial collaboration section
- Systematic replication framework
- Sample size comparison efficiency analysis
- Multi-analyst approach results

## Decision Rules

### When to Conclude "Successful Replication"

**Conservative (Recommended):**
1. Effect statistically significant in replication (p < α)
2. AND effect sizes not statistically different (heterogeneity p > α)
3. AND effect larger than SESOI (equivalence test rejects equivalence)

**Liberal:**
1. Effect statistically significant (p < α)
2. OR effect sizes not statistically different (heterogeneity p > α)

**Practical:**
1. Effect statistically significant
2. AND effect practically/theoretically meaningful (> SESOI)
3. AND 95% CI of replication overlaps with 95% CI of original

### When to Conclude "Failed Replication"

**Conservative (Recommended):**
1. Effect NOT statistically significant (p > α)
2. AND effect sizes ARE statistically different (heterogeneity p < α)
3. OR replication effect statistically equivalent to zero or below SESOI

**Liberal:**
1. Effect NOT statistically significant (p > α)
2. AND replication 90% CI excludes effect original had 33% power to detect

**Practical:**
1. Effect NOT statistically significant
2. AND effect smaller than SESOI (equivalence test succeeds)
3. AND adequate power (>80%) to detect original effect or SESOI

### When to Conclude "Inconclusive"

**Indicators:**
1. Replication not significant AND heterogeneity not significant (low power)
2. Replication significant but smaller, no significant difference
3. Wide CIs encompassing both meaningful and null effects
4. Inadequate power (<80%) to detect original effect or SESOI

**Action:**
- Do not draw strong conclusions
- Specify what additional evidence needed
- Consider larger replication or meta-analysis of multiple replications
- Identify specific auxiliary hypotheses to test

### Interpreting Failures to Replicate

**Three Explanations (Always Consider All):**

1. **Type 2 Error in Replication**
   - Check achieved power
   - Check sample size adequacy
   - Consider variability
   - Was equivalence test performed?

2. **Type 1 Error in Original**
   - Check original sample size and power
   - Consider publication bias
   - Check p-hacking indicators
   - Was original preregistered?

3. **Auxiliary Hypothesis Differs**
   - Identify potential moderators
   - Post-hoc explanations easy to generate, hard to verify
   - Many Labs 5: Authors poor at predicting which hypotheses matter
   - Requires systematic testing

**Next Steps:**

1. **If Type 2 suspected**: Larger replication with higher power
2. **If Type 1 suspected**: Update confidence, consider equivalence testing
3. **If auxiliary hypothesis suspected**:
   - Identify specific hypothesis
   - Design systematic replication varying that factor
   - Consider adversarial collaboration
   - Perform replication-and-extension testing multiple conditions

**Galileo's Babylonian Egg Test:**
- Test proposed moderators empirically rather than accepting post-hoc explanations

### Special Cases

**Original Effect Very Large (d > 2):**
- Be especially skeptical
- Even small replication effects may be significant with large samples
- Apply SESOI criteria strictly
- Consider plausibility given theory

**Replication Significant but Smaller:**
- Perform formal test of difference
- Consider whether difference meaningful
- Regression to mean expected
- Don't automatically declare "successful"

**Original Had Very Small Sample:**
- Test of difference has low power
- Consider small telescopes or SESOI inferiority test
- Be explicit about low heterogeneity test power
- May need to accept inconclusive result

**Society/Context Changed:**
- Acknowledge temporal changes
- Theory should account for why findings no longer replicate
- Specify necessary conditions
- Don't accept "times have changed" without theoretical justification

## Systematic Replications Framework

### Falsifiable Auxiliary Hypotheses

**Core Principle:**
- Specify auxiliary hypotheses assumed relevant
- Infinite possible hypotheses exist
- Most relegated to ceteris paribus
- Challenge: Identify which explain non-replication

### Framework Steps

1. **Initial Replication**
   - Direct replication staying close to original
   - Document all varied factors

2. **If Non-Replication:**
   - Generate specific auxiliary hypotheses
   - Prioritize based on:
     - Theoretical plausibility
     - Original authors' concerns
     - Systematic differences

3. **Systematic Testing**
   - Design studies varying specific hypotheses
   - Use factorial designs where possible
   - Test multiple hypotheses simultaneously
   - Consider adversarial collaboration

4. **Resolution**
   - Identify which hypotheses actually matter
   - Update theory to specify necessary conditions
   - Document in constraints on generalizability statement

### Evidence on Auxiliary Hypotheses (Many Labs 5)

**Study:**
- 10 failed replications from RP:P re-examined
- Original authors provided specific concerns
- New replications with both RP:P protocol and revised protocol

**Results:**
- 6 of 10: Clear non-replication, author concerns didn't matter
- 2 of 10: Replicated with revised protocol but trivially small effects
- 1 of 10: Significant difference but revised protocol yielded effect FURTHER from original
- Only 1 showed improvement toward original

**Conclusion:**
- Authors have low success predicting which hypotheses matter
- Post-hoc explanations should be tested empirically, not accepted
- Most failures not due to missing auxiliary hypotheses identified by authors

## Why Replication Studies vs. Lower Alpha Levels?

### Statistical Equivalence

Type 1 error probability identical:
- One study α = 0.0025
- Two studies each α = 0.05 (0.05 × 0.05 = 0.0025)

### Why Replications Still Necessary

**Reason 1: Unpredictable Importance**
- Cannot predict claim's future importance
- Claims may become important as follow-ups build on them
- Community may decide to reduce Type 1 error after publication
- Replications allow flexible error rate reduction
- Cannot increase sample size retroactively

**Reason 2: Individual Differences in Error Tolerance**
- Researchers have different thresholds
- Some satisfied with 10% Type 1 error, others require 0.1%
- Science has "no natural end"
- Single alpha can't accommodate all standards
- Replications give flexibility to lower error rates as needed

**Reason 3: Systematic Error Detection**
- Random errors average to zero
- Systematic errors do NOT
- Sources: measurement instruments, experimenter effects, confounds, local factors

**Independent Replication Benefits:**
- Reduces Type 1 error (like lower alpha)
- PLUS reduces systematic error probability
- Tests generalizability across factors deemed irrelevant
- Confidence increases when different researchers, locations, experimenters, measures yield same result

### Practical Recommendation

**Use Lower Alpha:**
- Type 1 errors especially costly
- Can predict claim importance in advance
- Research community can reach consensus on error rate
- Want to justify alpha choice

**Plan for Replications:**
- Claim may become important for future research
- Want flexibility to reduce error rates later
- Want to test robustness to systematic error
- Want to demonstrate generalizability
- Building cumulative research program

**Best Practice:**
- Thoughtfully choose alpha for initial study
- Plan replications in cumulative programs
- Use both strategies complementarily

## Philosophical Foundation: Methodological Falsificationism

### Popper's Problem

"Probability statements will not be falsifiable"
- All possible data patterns have non-zero probability
- Even extremely rare events can occur by chance
- Makes strict logical falsification impossible

### Popper's Solution

**Pragmatic Falsification:**
- "Practical falsification can be obtained only through a methodological decision to regard highly improbable events as ruled out — as prohibited"
- Low probability events CAN occur
- But NOT reproducible at will
- Must see "predictable and reproducible occurrence of systematic deviations"

### Why Replication is the "Cardinal Rule"

**Core Principle:**
- Single p < 0.05 insufficient for falsification
- Only replicable occurrence of low probability events allows "practical falsification"
- This is why replication is cornerstone of scientific method in methodological falsificationism
- Science works pragmatically, not according to formal logical rules

### Implications for Practice

- Never treat single study as definitive
- Build confidence through repeated observations
- Failures to replicate challenge theoretical predictions
- Success of replications supports (never proves) theories
- Science is "cumulative process of uncertainty reduction"
- "Science itself remains the greatest skeptic of its explanatory claims"

## Resources and Tools

### Statistical Packages

**R packages:**
- `metafor`: Heterogeneity and moderator analyses
- `cocor`: Testing differences between correlations
- `pwrss`: Power analysis of correlation differences
- `pwr`: Power analysis of t-tests

**Other Software:**
- G*Power: Power analysis of various designs

### Databases and Registries

- **Curate Science**: Database of replication studies
- **Replication WIKI**: Catalog of replications
- **Replication Database**: Searchable database

### Publication Venues

- Journals accepting replication studies
- Registered Reports (can be replications)
- Peer Community In: Registered Reports initiative

### Funding

- Some funders offer grants for replication research
- Check national funding agencies for replication calls

### Reporting Guidelines

- APA: JARS-Quant Table 6 for replications

## Summary of Best Practices

1. **Always specify SESOI** when planning replications
2. **Perform multiple statistical tests**: significance, difference, equivalence
3. **Report effect sizes with CIs** for both original and replication
4. **Create forest plots** showing both studies
5. **Avoid binary replicated/not-replicated language**
6. **Consider all three explanations** for non-replication
7. **Document auxiliary hypotheses** explicitly
8. **Use adversarial collaboration** to resolve discrepancies
9. **Preregister replication studies** (ideally Registered Reports)
10. **Share materials, data, code** for computational reproducibility
11. **Engage original authors** but test their predictions empirically
12. **Plan adequate power** for all relevant tests
13. **Use one-sided tests** for replications when appropriate
14. **Write constraints on generalizability statements**
15. **Acknowledge uncertainty** in all conclusions

## Critical Warnings

1. **Do not test against original point estimate only** - ignores uncertainty
2. **Do not assume hidden moderators** - test empirically (Many Labs 5: authors poor at predicting)
3. **Do not meta-analyze biased originals with replications** - inflates evidence
4. **Do not declare replication successful** just because significant if too small to matter
5. **Do not ignore power of heterogeneity test** - often too low to be informative
6. **Do not use arbitrary benchmarks** (like 33% power) without justification
7. **Do not treat self-replication and independent replication as equivalent** - only latter tests systematic error
8. **Do not expect single replication to be definitive** - science is cumulative
9. **Do not ignore temporal changes** - but demand theoretical account of necessary conditions
10. **Do not assume journals won't publish replications** - landscape has improved

---

*This guidance document distills actionable knowledge from Chapter 17: Replication Studies. For detailed examples and pedagogical content, refer to the original chapter at /Users/waqr/Desktop/statistical_inferences-master/17-replication.qmd*
