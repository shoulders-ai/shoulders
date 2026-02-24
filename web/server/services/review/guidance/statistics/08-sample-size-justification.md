# Sample Size Justification - AI Agent Verification Guide

## Overview

This document provides distilled, actionable knowledge for AI agents verifying sample size justifications in scientific research.

---

## 1. KEY CONCEPTS

### 1.1 Core Principle: Value of Information
- **Definition**: Balance cost of collecting each datapoint against information increase
- **Critical Insight**: Additional observations should meaningfully change inferences
- **Application**: Sample size justifications rest on this cost-benefit framework

### 1.2 Six Approaches to Sample Size Justification

| Approach | When Applicable | Strength |
|----------|----------------|----------|
| **Entire Population** | Population finite, identifiable, measurable | Strongest - no sampling needed |
| **Resource Constraints** | Resources are primary determinant | Honest when resources truly limit collection |
| **Accuracy (Precision)** | Focus on parameter estimation with desired accuracy | Strong when CI width justified |
| **A-priori Power Analysis** | Testing hypotheses with controlled error rates | Strong when effect size of interest justified |
| **Heuristics** | Following rules of thumb from literature | Weakest - often based on miscitations |
| **No Justification** | No specific inferential goal exists | Honest transparency better than false justification |

### 1.3 Four Possible Hypothesis Test Outcomes
1. **True Positive** (1-β, Power): Correctly reject H0 when alternative true
2. **False Positive** (α, Type I error): Incorrectly reject H0 when null true
3. **True Negative** (1-α): Correctly retain H0 when null true
4. **False Negative** (β, Type II error): Incorrectly retain H0 when alternative true

### 1.4 Types of Power Analysis

| Type | When Used | What It Does | Fixed Parameters | Computed |
|------|-----------|--------------|------------------|----------|
| **A-priori** | Before data collection | Determines required N | α, power, effect size | Sample size |
| **Sensitivity** | N already known | Shows detectable effects | α, N | Power across effect sizes |
| **Compromise** | N fixed, balance errors | Equalizes Type I/II errors | N, effect size, β/α ratio | α and β |
| **Post-hoc** | After data collection | ⚠️ NOT USEFUL - avoid | N, observed effect | Power (uninformative) |

---

## 2. SIX WAYS TO EVALUATE EFFECT SIZES OF INTEREST

### 2.1 Smallest Effect Size of Interest (SESOI)
- **Definition**: Smallest effect considered theoretically/practically meaningful
- **Determination Methods**:
  - Theoretical predictions from computational models
  - Practical considerations (cost-benefit)
  - Just-noticeable differences (e.g., d = 0.2)
  - Stakeholder consensus
- **Strength**: Most defensible basis for sample size justification
- **Importance**: Allows designing studies with known Type II error rates

### 2.2 Minimal Statistically Detectable Effect (MSDE)
- **Definition**: Smallest effect that, if observed, would yield p < α
- **Formula**: Critical value / √(n per group) for t-tests
- **Purpose**: Evaluate whether significant effects are plausible
- **Interpretation**: If MSDE > expected effects, significant results would be surprisingly large or upwardly biased

### 2.3 Expected Effect Size
- **Sources**:
  1. Meta-analysis (preferred if unbiased and homogeneous)
  2. Previous single study (requires careful evaluation)
  3. Theoretical/computational model
- **Warning**: Optimistic expectations lead to underpowered studies

### 2.4 Width of Confidence Interval
- **Calculation**: Function of SD and sample size
- **Margin of Error**: Distance from estimate to CI bound
- **Key Question**: Which effects could be rejected if true effect = 0?
- **Interpretation**: If only very large implausible effects can be rejected, study may not be informative

### 2.5 Sensitivity Power Analysis
- **Purpose**: Plot power across range of plausible effect sizes
- **Value**: Shows which effects have adequate vs. inadequate power
- **When to Use**: Sample size fixed; want to evaluate informativeness
- **Critical Insight**: No clear cutoffs - requires holistic evaluation against SESOI

### 2.6 Effect Size Distribution in Research Area
- **Purpose**: Contextualize a-priori plausible effects in field
- **Warning**: Do NOT use field averages (e.g., "medium" d = 0.5) for power analysis
- **Limited Use**: Can help evaluate if CI width permits rejecting only implausibly large effects
- **Problem**: Large heterogeneity within fields makes averages uninformative

---

## 3. GUIDELINES & RECOMMENDATIONS

### 3.1 Resource Constraints Justification

**Five Key Points to Address**:

| What to Address | How to Address |
|----------------|----------------|
| **Future meta-analysis?** | Consider plausibility that sufficient similar studies will enable meta-analysis |
| **Decision regardless?** | If mandatory, any data reduces error rates; use compromise power analysis |
| **Critical effect size?** | Report MSDE; indicate if p-values won't be interpretable |
| **CI width?** | Report expected CI width; evaluate utility with this uncertainty |
| **Sensitivity analysis?** | Report power for range of effect sizes (80%, 90%, 95%) or plot curve |

**Critical Evaluation**:
Data collection NOT worthwhile if:
- No future meta-analysis plausible
- No decision will be made with/without data
- Informativeness for effects of interest negligible

### 3.2 A-priori Power Analysis Justification

**Essential Reporting Elements**:

| Element | Specification |
|---------|---------------|
| **All primary analyses** | List every planned hypothesis test |
| **Alpha levels** | Justify α for each test; correct for multiple comparisons |
| **Desired power** | Justify power/Type II error rate (don't default to 80% without reason) |
| **Effect size metric & value** | Report metric (d, f, η²), value, and complete justification |
| **Null hypothesis consideration** | Perform power analysis for equivalence test too |
| **Reproducibility** | Include analysis code/script or exported report |

**Effect Size Justification Requirements**:
- If meta-analysis: Address similarity, homogeneity, bias (Section 3.3)
- If single study: Address similarity, bias risk, uncertainty (Section 3.4)
- If SESOI: Justify based on theory or practical implications
- Always provide full citation and direct quote if using published estimate

**Critical Insight**:
- Goal NOT to achieve power for the *true* effect (unknown)
- Goal IS to achieve power for an *assumption* about effect size of interest
- Inference conditional on this assumption being correct

### 3.3 Using Meta-Analytic Effect Size Estimates

**Three Required Checks**:

| Check | Evaluation |
|-------|------------|
| **Similarity** | Are meta-analyzed studies similar in design, measures, population? Evaluate generalizability carefully |
| **Homogeneity** | Is there heterogeneity? If yes, use estimate from most relevant homogeneous subset |
| **Bias** | Check if meta-analysis reported state-of-the-art bias detection; consider bias-corrected estimates |

**Warning**: Meta-analytic estimates may be substantially inflated due to publication bias

### 3.4 Using Single Study Effect Size Estimates

**Three Required Checks**:

| Check | Evaluation |
|-------|------------|
| **Similarity** | Consider differences in population, design, manipulations, measures. Effect sizes don't generalize to different designs |
| **Bias Risk** | Evaluate if smaller effect would have prevented publication/use. Consider safeguard power (lower bound of 60% CI) |
| **Uncertainty** | Small studies have large uncertainty. Examine 95% CI width. Consider entering both upper and lower CI limits |

**Critical Warning**: "A pilot study does not provide a meaningful effect size estimate for planning subsequent studies due to the imprecision inherent in data from small samples" (Leon, Davis, & Kraemer, 2011)

**Truncated Distribution Problem**:
- Publication bias creates truncated F distribution
- Observed effects from literature systematically overestimate true effects
- Consider bias-corrected power analysis (BUCSS package) or safeguard power

### 3.5 Planning for Precision (Accuracy)

**Sample Size Formula**:
```
N = (z × SD / error)²
```
Where: z = critical value (1.96 for 95%), SD = population SD, error = desired half-width

**Key Challenge**: Justifying desired CI width
- No established guidelines for choosing CI width
- If distinguishing effects is goal → Actually need hypothesis test (equivalence/range test)
- Without hypothesis testing: May rely on field norms for acceptable precision

**When Appropriate**:
- Can justify desired accuracy independent of hypothesis testing
- Field has established norms for acceptable precision
- Focus purely on estimation, not testing

### 3.6 Compromise Power Analysis

**When to Use**:
1. Sample size very large (power very high) → may want to lower α
2. Sample size very small (power very low) but decision mandatory → balance errors

**Required Justifications**:

| Element | Justification |
|---------|---------------|
| **Sample size** | Why is this specific N collected? |
| **Effect size** | Based on SESOI or expected effect? |
| **β/α ratio** | Relative costs of Type I vs. Type II errors |

**Convention vs. Justification**:
- Default 80% power (β = 0.20, α = 0.05) implies Type I error 4× as serious as Type II error
- Cohen's personal preference, not justified standard
- Error rates should be justified based on consequences

**Large Sample**: N = 1000/group, d = 0.2 → power ≈ 0.999; may justify lowering α to prevent Lindley's paradox

**Small Sample**: If decision mandatory and N fixed, may justify α = 0.20-0.30 when errors equally costly

### 3.7 Heuristics Justification

**Warning: Most Heuristics Are Flawed**
- Common heuristics arise from miscitations
- Example: "N = 50 minimum" from misinterpreting Green (1991)
- Cohen's "medium effect" (d = 0.5) should NOT be used; Cohen regretted these benchmarks

**Valid Heuristics Requirements**:
- Based on sound logic applicable to specific situation
- Examples: Field-wide SESOI + sequential design; "Small telescopes" (2.5× original N for replication)

**Evaluation**: Ask "Why is this heuristic used?" Trace logic. Verify applicability.

**Peer Review**: Scrutinize carefully; request underlying justification or alternative

### 3.8 No Justification (Transparency)

**When Appropriate**:
- Resources available but not fully used
- Could have done power analysis but didn't
- No specific inferential goals when collecting data

**What to Report**:
1. Explicitly state absence of justification (don't fabricate)
2. Evaluate informativeness:
   - Compute SESOI and compare to what design could detect
   - Compute MSDE
   - Report expected CI width
   - Plot sensitivity power curve
3. Ensure conclusions match what data can support

**Critical Insight**: Honesty about lack of justification better than pretending study highly informative

---

## 4. COMMON MISTAKES & PITFALLS

### 4.1 Post-hoc (Retrospective) Power Analysis

**Why It's Wrong**:
- Post-hoc power directly determined by p-value
- For z-test: p = 0.05 → post-hoc power = exactly 50%
- For t-test: p > 0.05 → post-hoc power < ~50%
- Provides NO additional information beyond p-value

**What to Do Instead**:

| Situation | Correct Approach |
|-----------|------------------|
| **During design** | Plan high power for equivalence test against SESOI |
| **After data collection** | Perform sensitivity power analysis |
| **Non-significant result** | Evaluate accuracy (CI width) or perform equivalence test |

**If Editor Requests Post-hoc Power**:
- Do NOT comply
- Explain why uninformative (cite Hoenig & Heisey, 2001; Lenth, 2007)
- Offer sensitivity power analysis instead

### 4.2 Using Cohen's Benchmarks

**Why It's Wrong**:
- d = 0.2/0.5/0.8 NOT appropriate for power analysis
- Cohen regretted proposing these
- Huge variability across topics makes any default misleading

**Cohen's Actual Statement**: "Many effects sought in personality, social, and clinical-psychological research are likely to be small effects"

**Alternatives**:
- Specify SESOI based on theory/practice
- Use well-justified meta-analytic estimate (with caution)
- Consider Brysbaert's d = 0.4 as rough psychology average (highly uncertain)

### 4.3 Misciting Heuristics

**Common Errors**:
1. **"N = 50 per condition"** - Miscites Green (1991) who concluded no specific minimum supported
2. **"N > 50"** - Simmons et al. (2011) later revised to "unless studying large effects"
3. **"Same N as previous study"** - Only valid if previous justification applies; likely too small with publication bias

### 4.4 Optimistic Effect Size Expectations

**The Problem**: Tempting to use optimistic estimates → smaller required N → systematic underpowering

**Sources of Optimism**:
- Publication bias inflates estimates
- Pilot studies with small N imprecise
- Motivated reasoning

**Safeguards**:
- Use conservative estimates (lower bound of 60% CI)
- Consider worst-case alongside best-case
- Use bias-corrected estimates
- Prefer SESOI over expected effect

### 4.5 Ignoring Heterogeneity in Meta-analyses

**Problem**: Meta-analytic mean may not represent any specific study type

**Solution**:
- Examine heterogeneity statistics (I², τ²)
- Identify most relevant homogeneous subgroup
- Use subgroup-specific estimate

### 4.6 Ignoring Statistical Power for Equivalence Tests

**Problem**: A-priori power often only for NHST; can't conclude about absence of effects without equivalence test

**Solution**:
- Perform dual power analysis: NHST + equivalence test
- Collect max(N_NHST, N_equivalence)
- Example: d = 0.4, 90% power → NHST: N = 68, Equivalence (±0.4): N = 88 → Collect N = 88

### 4.7 Not Correcting Alpha for Multiple Comparisons

**Problem**: If multiple tests with error correction, power analysis must use corrected alpha

**Solution**: 4 tests, α = 0.05, Bonferroni → use α = 0.0125 in power analysis

### 4.8 Confusing Standardized and Unstandardized Effects

**Problem**: Same d can represent very different practical magnitudes

**Best Practice**:
- Know your measure's typical SD
- Prefer reasoning about unstandardized effects when possible
- Justify assumptions about SD
- Report both standardized and unstandardized

### 4.9 Not Making Power Analysis Reproducible

**Solution**:
- **If R**: Share complete script with package versions
- **If G*Power**: Export "Protocol of Power Analysis" as PDF
- **If other software**: Save screenshot showing all inputs/outputs

---

## 5. VERIFICATION CHECKLISTS

### 5.1 General Sample Size Justification Checklist

- [ ] Is sample size justification provided?
- [ ] Is justification type clearly stated?
- [ ] Are inferential goals clearly specified?
- [ ] Is value of information considered relative to costs?
- [ ] Are conventions vs. justified choices distinguished?
- [ ] Is justification reproducible (code/protocol shared)?

### 5.2 Resource Constraints Justification Checklist

- [ ] Are resource constraints explicitly stated?
- [ ] Is it explained why N cannot be increased?
- [ ] Is future meta-analysis possibility addressed?
  - [ ] Will researchers commit to performing one?
  - [ ] Is field likely to produce sufficiently similar studies?
  - [ ] Will data be shared accessibly?
- [ ] Is necessity of decision/claim addressed?
  - [ ] If decision mandatory, is compromise power analysis performed?
- [ ] Is MSDE computed and interpreted?
- [ ] Is expected CI width computed and interpreted?
  - [ ] What will estimate with this uncertainty be useful for?
  - [ ] If null true, would rejecting effects outside CI be worthwhile?
- [ ] Is sensitivity power analysis reported?
  - [ ] Power for 80%, 90%, 95% levels OR sensitivity curve plotted?
- [ ] Is it acknowledged that study may not be informative for effects of interest?

### 5.3 A-priori Power Analysis Checklist

#### Essential Elements
- [ ] Are all primary analyses listed?
- [ ] Is alpha level specified for each analysis?
- [ ] Is alpha level justified (not just defaulted to 0.05)?
- [ ] If multiple comparisons, is correction method specified and applied?
- [ ] Is desired power specified?
- [ ] Is desired power justified (not just defaulted to 80%)?
- [ ] Is effect size metric specified (d, f, η², r)?
- [ ] Is effect size value specified?
- [ ] Is effect size justification provided?
- [ ] Is power analysis reproducible (script/protocol/screenshot)?

#### Effect Size Justification
- [ ] Is effect size based on SESOI, meta-analysis, single study, or theoretical model?
- [ ] If SESOI:
  - [ ] Is it based on theoretical prediction or practical consideration?
  - [ ] Is reasoning clearly explained?
  - [ ] Would stakeholders agree?
- [ ] If meta-analysis: (see Section 5.4)
- [ ] If single study: (see Section 5.5)
- [ ] If theoretical model:
  - [ ] Is computational model described?
  - [ ] Are parameter values justified?
  - [ ] Are predictions specific enough?

#### Equivalence Testing
- [ ] Is possibility that H0 is true considered?
- [ ] Is power analysis for equivalence test performed?
- [ ] Is sample size sufficient for both NHST and equivalence test?

#### Common Errors to Flag
- [ ] **FLAG if**: Cohen's benchmarks (0.2, 0.5, 0.8) used without strong justification
- [ ] **FLAG if**: Post-hoc power mentioned
- [ ] **FLAG if**: Heuristic (e.g., "N=50") used without justification
- [ ] **FLAG if**: Effect size from small pilot (N < 50) used without safeguards
- [ ] **FLAG if**: Meta-analytic estimate used without checking heterogeneity
- [ ] **FLAG if**: Single study estimate from potentially biased literature
- [ ] **FLAG if**: Multiple comparisons planned but alpha not corrected in power analysis

### 5.4 Meta-Analytic Effect Size Checklist

- [ ] Is meta-analysis source fully cited?
- [ ] Is specific effect size value directly quoted?
- [ ] **Similarity**:
  - [ ] Are designs similar (between/within, experimental/observational)?
  - [ ] Are measures similar (constructs, instruments)?
  - [ ] Are populations similar (age, demographics, clinical status)?
  - [ ] Are manipulations similar (strength, duration, modality)?
  - [ ] Is generalizability justified?
- [ ] **Homogeneity**:
  - [ ] Are heterogeneity statistics reported (I², τ², Q-test)?
  - [ ] If substantial heterogeneity, is subgroup analysis used?
  - [ ] Is most relevant homogeneous subset identified?
  - [ ] Is subset-specific estimate used?
- [ ] **Bias**:
  - [ ] Did meta-analysis test for publication bias?
  - [ ] Were bias tests state-of-the-art?
  - [ ] If bias detected, is bias-corrected estimate considered?
  - [ ] Is uncertainty acknowledged?
- [ ] **Additional checks**:
  - [ ] Is SD assumption justified?
  - [ ] Is uncertainty in estimate acknowledged?
  - [ ] Are consequences of uncertainty explored (power for CI bounds)?

### 5.5 Single Study Effect Size Checklist

- [ ] Is source study fully cited?
- [ ] Is specific effect size value directly quoted?
- [ ] **Similarity**:
  - [ ] Same design type?
  - [ ] Same or similar measures?
  - [ ] Same population characteristics?
  - [ ] Same manipulation characteristics?
  - [ ] Are factors affecting SD considered (e.g., age for RT)?
  - [ ] If different design, is non-generalizability acknowledged?
- [ ] **Bias Risk**:
  - [ ] Was source study pre-registered or Registered Report?
  - [ ] Would smaller effect have prevented publication?
  - [ ] Is publication bias considered?
  - [ ] Is follow-up bias considered?
  - [ ] Is bias-corrected estimate computed?
- [ ] **Uncertainty**:
  - [ ] Is source sample size large enough (N > 100)?
  - [ ] Is 95% CI around estimate reported?
  - [ ] Is CI width considered acceptable?
  - [ ] Is safeguard power considered (lower 60% CI bound)?
  - [ ] Are consequences of uncertainty explored?
- [ ] **Special case: Pilot study**:
  - [ ] **FLAG if**: Using effect from small pilot (N < 50) without safeguards
  - [ ] If pilot used, is Leon et al. (2011) warning acknowledged?

### 5.6 Planning for Precision Checklist

- [ ] Is desired CI width specified?
- [ ] Is desired CI width justified?
  - [ ] Based on established field norm?
  - [ ] Based on ability to distinguish specific effect values?
  - [ ] Based on practical requirements?
- [ ] Is SD estimate provided and justified?
- [ ] Is sample size calculation shown (N = (z × SD / error)²)?
- [ ] If goal is distinguishing effect sizes:
  - [ ] **FLAG**: Should this be equivalence/range test instead?
- [ ] Is calculation for non-zero mean (non-central t) if applicable?
- [ ] Is precision plan reproducible?

### 5.7 Compromise Power Analysis Checklist

- [ ] Is sample size fixed by external factors?
- [ ] Is reason for fixed N explained?
- [ ] Is effect size specified and justified (SESOI or expected)?
- [ ] Is β/α ratio specified?
- [ ] Is β/α ratio justified based on relative costs of errors?
- [ ] Are prior probabilities of H0/H1 considered?
- [ ] Are resulting α and β values reported?
- [ ] Is resulting α unconventional (≠ 0.05)?
  - [ ] If yes, is justification provided?
- [ ] If very large N (high power):
  - [ ] Is Lindley's paradox mentioned?
  - [ ] Is lowered α to balance errors justified?
- [ ] If very small N (low power):
  - [ ] Is mandatory nature of decision justified?
  - [ ] Is acceptance of higher error rates appropriate?

### 5.8 Heuristic Justification Checklist

- [ ] Is specific heuristic stated?
- [ ] Is source cited?
- [ ] Is logic behind heuristic explained?
- [ ] Is heuristic applicable to this study?
- [ ] **Verification of cited source**:
  - [ ] Does source actually recommend this?
  - [ ] Is citation chain accurate (no miscitations)?
  - [ ] Is context of original recommendation considered?
- [ ] **Common problematic heuristics to flag**:
  - [ ] **FLAG**: "N = 50" or "N = 20" without effect size consideration
  - [ ] **FLAG**: Cohen's benchmarks
  - [ ] **FLAG**: "Same N as previous study" without justification
  - [ ] **FLAG**: Field-average effect size for power analysis
- [ ] **If valid heuristic**:
  - [ ] Is it based on field-wide agreement?
  - [ ] Is it based on sound statistical logic?
  - [ ] Is applicability clearly demonstrated?

### 5.9 No Justification Checklist

- [ ] Is absence of justification explicitly stated?
- [ ] Is honesty about lack of planning acknowledged?
- [ ] **Informativeness evaluation**:
  - [ ] Is SESOI discussed?
  - [ ] Is MSDE computed?
  - [ ] Is expected CI width computed and interpreted?
  - [ ] Is sensitivity power analysis performed and plotted?
- [ ] **Conclusions**:
  - [ ] Are conclusions appropriately limited?
  - [ ] If non-significant, is caution emphasized?
  - [ ] Is overinterpretation avoided?
  - [ ] Is transparency maintained?

---

## 6. REPORTING REQUIREMENTS

### 6.1 Minimum Reporting Standards (All Justifications)

All sample size justifications must report:
1. **Justification Type**: Clearly state which approach(es) used
2. **Inferential Goals**: What questions will data answer?
3. **Resources Available**: What constraints existed?
4. **Reproducibility**: Provide code/protocol/screenshot
5. **Assumptions**: Document all key assumptions and their basis

### 6.2 Resource Constraints Template

```
Sample Size Justification: Resource Constraints

Resources: [Time, funding, personnel, participant pool]
Expected N: [value]

Informativeness Evaluation:
1. Future Meta-analysis: [Likely/Unlikely; commitment; data sharing]
2. Decision Requirement: [Mandatory?; compromise power if yes]
3. MSDE: [value; interpretation; plausibility]
4. CI Width: [range; interpretation]
5. Sensitivity Power: [80%: d=X, 90%: d=Y, 95%: d=Z]

Conclusion: [Justified/not justified because...]
```

### 6.3 A-priori Power Analysis Template

```
Sample Size Justification: A-priori Power Analysis

Primary Analyses:
1. [Test type]: [Comparison being tested]

Power Analysis Details per Analysis:
- Effect size metric: [d/f/η²/r]
- Effect size value: [X.XX]
- Effect size justification: [SESOI/meta-analysis/single study/model]
  [Full justification with citations]
- Alpha: [0.0X]; Justification: [Two-sided/Bonferroni/etc.]
- Desired power: [0.XX]; Justification: [90% because...]
- Required N: [X per group/total]

Final N: [max across all analyses]

Null Hypothesis: [Equivalence test performed?; bounds; N required]

Reproducibility: [See supplementary file X]

Assumptions: [SD, correlations, etc.]
```

### 6.4 Meta-Analysis Effect Size Template

```
Effect Size Source: Meta-analysis

Citation: [Full]
Effect Size: [metric] = [value] (95% CI: [lower, upper])
Quote: "[exact quote]"

Similarity: ✓/✗ Design, Measures, Population, Manipulation
Generalizability: [Justification]

Homogeneity: I²=[value], τ²=[value], Q([df])=[value], p=[value]
Interpretation: [Low/moderate/substantial heterogeneity]
[If substantial]: Subgroup [X] with I²=[value], effect=[value]

Bias: Tests=[methods]; Results=[evidence?]
[If detected]: Corrected estimate=[value]; Method=[method]
Conservative approach: [Using corrected/lower CI bound]
```

### 6.5 Single Study Effect Size Template

```
Effect Size Source: Single Study

Citation: [Full]
Effect Size: [metric] = [value] (95% CI: [lower, upper]), N=[value]
Quote: "[exact quote]"

Similarity: ✓/✗ Design, Measures, Population, Manipulation
Differences: [Any]

Bias Risk:
- Pre-registration: [Yes/No]
- Publication bias concern: [Low/Medium/High]
- Bias-corrected estimate: [value; method]
- Conservative approach: [Safeguard power using lower 60% CI: X]

Uncertainty:
- Sample size: [Large enough? N>100?]
- 95% CI: [range]
- Evaluation: [Acceptable/concerning]
- Power for lower CI: [X]%, upper CI: [Y]%
```

### 6.6 SESOI Template

```
Effect Size Justification: SESOI

SESOI: [metric] = [value] ([unstandardized: X units])

Justification Basis: [Theoretical/Practical/Both]

Theoretical: [Model, parameters, derivation]
Practical: [Cost-benefit, stakeholder input, just-noticeable difference]

Alternative Perspectives:
- Smallest skeptic might care about: [value]
- Largest implausibly large: [value]

Consensus: [Agree/disagree]; [If disagree: range]

Implications: Informative for effects ≥ [value]
```

### 6.7 Sensitivity Analysis Template

```
Sensitivity Power Analysis

N: [value] (Fixed because: [reason])
Alpha: [0.0X]; Test: [type]

Power for Specific Effect Sizes:
| d = [X] | [XX]% |
| d = [Y] | [YY]% |

For 80%/90%/95% power:
- 80%: d ≥ [X]
- 90%: d ≥ [Y]
- 95%: d ≥ [Z]

Interpretation:
SESOI: d=[X]; Power=[XX]%; [Adequate/Inadequate]
Expected range: d=[X] to [Y]; Power=[XX]%-[YY]%
MSDE: d=[X]; [Larger/smaller than expected]

Conclusion: [Adequate power for/underpowered for] effects [X] to [Y]
```

### 6.8 Compromise Power Template

```
Sample Size Justification: Compromise Power Analysis

N: [value]; Justification: [Why this N]
Effect Size: [metric]=[value]; Justification: [SESOI/Expected]

Error Rate Balancing:
- Type I [X]× as serious as Type II
- Justification: [Cost-benefit/priors]
- β/α ratio: [value]

Resulting Error Rates:
- Alpha: [0.0XX]
- Beta: [0.0XX]
- Power: [0.XX]

Comparison to Convention: α=0.05, power=0.80 → α=[X], power=[Y]

Reproducibility: [See supplementary file X]
```

---

## 7. DECISION RULES

### 7.1 When to Use Each Justification Approach

```
Decision Tree:

Can measure entire population?
  YES → "Entire Population"
  NO → Continue

Have clearly specified inferential goal?
  NO → Develop one OR "No Justification" with informativeness evaluation
  YES → Continue

Primary inferential goal?

  Testing hypotheses with controlled error rates:
    Can specify SESOI?
      YES → "A-priori Power" with SESOI (BEST)
      NO → Continue

    Can justify expected effect?
      From meta-analysis → Check similarity, homogeneity, bias
        All good → "A-priori Power" with meta-analysis
        Concerns → Conservative estimate or "Resource Constraints"
      From single study → Check similarity, bias, uncertainty
        All good → "A-priori Power" with safeguard
        Concerns → Sequential design or "Resource Constraints"
      From theory → "A-priori Power" with theoretical model
      NO → "Resource Constraints" + Sequential Design

    Sample size already fixed?
      YES → "Compromise Power"

  Estimating with desired precision:
    Can justify desired CI width?
      YES (field norm) → "Planning for Precision"
      YES (distinguishing effects) → "A-priori Power" for equivalence
      NO → Reconsider or "Resource Constraints"

  Decision must be made regardless → "Resource Constraints" + "Compromise Power"

Resources primary limiting factor?
  YES → "Resource Constraints"
    Informative enough? NO → Don't collect OR seek collaboration
```

### 7.2 When to Flag Sample Size Justification as Inadequate

**MANDATORY FLAGS (Reject or Request Major Revision)**:

1. **Post-hoc power mentioned** → Request sensitivity analysis (cite Hoenig & Heisey, 2001; Lenth, 2007)
2. **No justification** (not acknowledged) → Request justification or acknowledgment + informativeness evaluation
3. **Cohen's benchmarks without justification** → Request SESOI, meta-analysis, or justified expected effect
4. **Multiple comparisons but alpha not corrected** → Request corrected power analysis
5. **Effect from very small study (N < 30) without safeguards** → Request safeguard power (cite Leon et al., 2011)
6. **Meta-analysis with substantial heterogeneity, overall mean used** → Request subgroup-specific estimate
7. **A-priori power only for NHST when null plausible** → Request power for equivalence test

**STRONG CONCERNS (Request Revision)**:

8. **Heuristic without justification** → Request source justification and applicability
9. **Effect from potentially biased literature without acknowledgment** → Request bias assessment
10. **Meta-analysis/single study without similarity assessment** → Request generalizability evaluation
11. **Power analysis not reproducible** → Request code/protocol/screenshot
12. **Desired CI width not justified** → Request justification or reconsider
13. **Resource constraints without informativeness evaluation** → Request MSDE, CI width, sensitivity
14. **Compromise power without justifying β/α ratio** → Request justification

**MODERATE CONCERNS (Request Clarification)**:

15. **Default 80% power without justification** → Consider justifying 90-95% for single studies
16. **Alpha = 0.05 without justification when N very large/small** → Consider compromise power
17. **Within-subjects without reporting correlation assumption** → Request expected correlation
18. **Effect size uncertainty not explored** → Report power for CI bounds

### 7.3 When Different Effect Size Considerations are Most Relevant

| Consideration | Most Relevant For | Primary Value |
|--------------|-------------------|---------------|
| **SESOI** | A-priori power, Equivalence tests | Strongest justification; known error rates |
| **MSDE** | Resource constraints, Heuristics, No justification | Reality check: are significant results plausible? |
| **Expected Effect** | A-priori power when SESOI unavailable | Permits power analysis with uncertainty |
| **CI Width** | Precision planning, Resource constraints | Shows what effects could be rejected if H0 true |
| **Sensitivity Analysis** | Fixed N, No justification, Post-data | Power across range of plausible effects |
| **Field Distribution** | Contextualizing all above | Assess a-priori plausible effects in area |

**Priority Order**: (1) SESOI if possible, (2) Expected effect with safeguards, (3) Always compute MSDE, CI width, sensitivity, (4) Contextualize with field distribution, (5) Never rely solely on field distribution

### 7.4 When to Recommend Sequential Designs

**Recommend When**:
- Great uncertainty about effect size
- Effect could plausibly be much larger than SESOI
- Resources allow flexibility in N
- Interim analyses feasible

**Benefits**: Reduce average N by 25-50%, early stopping if effect large, stopping for futility

**Types**: SPRT, Group Sequential, Safe Tests, Internal Pilot

**When NOT to Recommend**: Interim analyses infeasible, N very small, SESOI well-established

---

## 8. ADDITIONAL CONSIDERATIONS

### 8.1 Increasing Power Without Increasing N

**Strategies**:

1. **Within-Subjects Designs**: N_within = N_between × (1-ρ) / 2
   - Caveat: Order effects and carryover

2. **Directional (One-Sided) Tests**: Lower critical value
   - Caveat: Can't detect opposite effects; avoid when opposite matters

3. **Increase Alpha**: Justified by compromise power analysis
   - Must justify based on relative error costs

4. **Reduce Variance**: Better screening, reliable measures, preregistered covariates
   - Caveat: May reduce external validity

5. **Unequal Allocation**: If one condition cheaper; optimal N₁/N₂ = √(C₂/C₁)

### 8.2 Know Your Measure

**Why It Matters**: Standardized effects depend on SD; power analysis requires SD estimate

**What to Know**:
1. **SD**: Typical in population; how varies with characteristics; 95% CI: [(N-1)s²/χ²_{α/2}, (N-1)s²/χ²_{1-α/2}]
2. **Correlations**: For within-subjects; how varies with time lag
3. **Reliability**: Internal consistency, test-retest
4. **Variance Components**: For hierarchical models

**Solutions for Unknown Parameters**:
- Internal pilot: Blind interim analysis to update SD
- Sequential design
- Use existing data
- Pilot for parameters (not effect size)

### 8.3 Sequential Analyses - Detailed Guidance

**Core Benefit**: Reduce average N by 25-50% while maintaining error control

**Major Approaches**:
1. **SPRT**: Analyze after every observation; most efficient
2. **Group Sequential**: Pre-planned interim points; more practical
3. **Safe Tests**: Optional stopping without error inflation
4. **Bayesian Sequential**: Bayes factors; no error rate guarantee

**Planning Requirements**: Max N, interim looks, alpha spending function, stopping rules, pre-registered plan

**Critical Rules**: Pre-specify looks, use adjusted α, don't add unplanned looks, report stopping point, adjust effect estimates

**When to Stop**: Efficacy (significant at adjusted α), futility, equivalence, conditional power < threshold

### 8.4 Conventions as Meta-Heuristics

**Common Conventions**: α = 0.05, Power = 80%, Two-sided tests, 95% CIs

**When Conventions Useful**: Shared baseline, reduce justification burden, efficient communication

**When to Depart**: Can justify better values, study requires higher informational value, field consensus differs

**Examples of Justified Departures**: 95% power for Registered Reports, high-stakes decisions, sequential designs, exploratory with mandatory decisions

**Transparency**: Always state convention vs. justified choice

### 8.5 Sample Size Justification in Qualitative Research

**Core Principle**: Same value-of-information logic applies

**Saturation**: New data replicates earlier observations without adding information

**Fugard & Potts (2015)**: Based on number of codes (K), probability code appears (p), desired observations per code (m)

**Sampling Strategies**: Purposeful most efficient, theoretical very efficient, random least efficient

**Required Elements**: Population ID, sub-population structure, expected codes, code probability, sampling strategy, saturation definition

**Red Flags**: Arbitrary numbers without justification, "sample until saturation" without defining it, no sub-population consideration

---

## 9. CRITICAL WARNINGS FOR AI AGENTS

### 9.1 Post-hoc Power: Never Accept It

**Mathematical Fact**: p = 0.05 → post-hoc power ≈ 50%; p > 0.05 → power < 50%

**Why Doesn't Work**: Already know p-value; adds nothing

**Response Template**:
```
"Post-hoc power is mathematically determined by p-value and provides no additional
information (Hoenig & Heisey, 2001; Lenth, 2007). To address informativeness of
non-significant result, we performed [sensitivity power analysis/equivalence test]."
```

### 9.2 Default Values: Always Question

**Common Unjustified Defaults**: d = 0.5, Power = 80%, α = 0.05, Same N as previous

**Verification**: Check if acknowledged, justified, not circular, trace citation chain

**Red Flag Phrases**: "Following Cohen (1988)", "Standard power of 80%", "Conventional alpha", "Similar to [citation], N = 50"

**Correct Handling**: Default α may be acceptable if convention justified; default power should be justified or increased; default effect size NEVER acceptable

### 9.3 Similarity Assessment: Be Skeptical

**Common Errors**: Assuming "similar topic" = "similar effect size"; ignoring population, measurement, design differences

**Strict Verification**: Exact design type, same construct/reliability/population, match on factors affecting SD, similar manipulation, same effect type

**When in Doubt**: Flag as potentially dissimilar; request justification

### 9.4 Bias Assessment: Assume Bias Unless Proven Otherwise

**Presumption**: Published literature biased upward

**Acceptable Evidence of Low Bias**: Pre-registration, Registered Report, replication project, large N (>200), rigorous bias-corrected meta-analysis

**Unacceptable Evidence**: "No evidence detected", prestigious journal, recent publication, large effect

**Require**: State-of-the-art bias detection, bias-corrected estimates, sensitivity to bias, conservative approaches

### 9.5 Multiple Comparisons: Check Alpha Correction

**Common Error**: Power analysis uses α = 0.05 but analysis will use Bonferroni

**Verification**: Count comparisons, check if correction mentioned, verify power uses corrected α

**Example**: 4 comparisons, Bonferroni → α_each = 0.0125 must be used in power analysis

### 9.6 Reproducibility: Demand It

**Unacceptable**: "We performed power analysis" with no details

**Acceptable**: R script with versions, G*Power protocol PDF, screenshot with all inputs/outputs, detailed description

**Verification**: Can you reproduce? All parameters visible? All assumptions stated?

---

## 10. SUMMARY DECISION MATRIX

### Sample Size Justification Quality Assessment

| Quality | Criteria | Action |
|---------|----------|--------|
| **Excellent** | SESOI justified + a-priori power for NHST & equivalence + reproducible + all assumptions justified | Accept |
| **Good** | Expected effect from rigorous meta-analysis + a-priori power + reproducible + similarity/homogeneity/bias addressed | Accept |
| **Acceptable** | Expected effect from single study + safeguard power + reproducible + similarity/bias/uncertainty addressed | Accept with minor revisions |
| **Acceptable** | Resource constraints + informativeness fully evaluated (MSDE, CI, sensitivity) + honest about limitations | Accept with minor revisions |
| **Marginal** | Resource constraints + partial informativeness | Request additional evaluation |
| **Marginal** | A-priori power with concerning effect justification | Request better justification or safeguards |
| **Inadequate** | Heuristic without justification | Request proper justification |
| **Inadequate** | Cohen's benchmarks without strong justification | Request SESOI or expected effect |
| **Inadequate** | No justification and not acknowledged | Request justification or acknowledgment + evaluation |
| **Unacceptable** | Post-hoc power analysis | Request sensitivity analysis |
| **Unacceptable** | Multiple comparisons without corrected α | Request corrected power analysis |
| **Unacceptable** | Not reproducible | Request code/protocol/screenshot |

---

## 11. QUICK REFERENCE FORMULAS

### Sample Size for t-test (A-priori Power)
```
N_per_group = 2 × [(z_α/2 + z_β) / d]²

z_α/2 = 1.96 for α = 0.05 (two-sided)
z_β = 0.84 for power = 0.80
d = Cohen's d effect size
```

### Sample Size for Precision (CI width)
```
N = (z × SD / error)²

z = 1.96 for 95% CI
SD = standard deviation
error = desired half-width
```

### Minimal Statistically Detectable Effect
```
MSDE = critical_t / √(N/2)

critical_t = qt(1 - α/2, df = 2N - 2)
```

### Within-Subjects N Reduction
```
N_within = N_between × (1 - ρ) / 2

ρ = correlation between repeated measures
If ρ = 0: N_within = N_between / 2
If ρ = 0.5: N_within = N_between / 4
```

### Confidence Interval for SD
```
Lower = √[(N-1)s² / χ²_{N-1, α/2}]
Upper = √[(N-1)s² / χ²_{N-1, 1-α/2}]
```

---

## 12. ESSENTIAL REFERENCES

### Foundational Papers
- Cohen, J. (1988). *Statistical Power Analysis for the Behavioral Sciences* (2nd ed.)
- Lakens, D. (2022). Sample size justification. *Collabra: Psychology*, 8(1), 33267.
- Lenth, R. V. (2001). Some practical guidelines for effective sample size determination. *The American Statistician*, 55(3), 187-193.

### Power Analysis Guidance
- Aberson, C. L. (2019). *Applied Power Analysis for the Behavioral Sciences* (2nd ed.)
- Maxwell, S. E., Kelley, K., & Rausch, J. R. (2008). Sample size planning for statistical power and accuracy in parameter estimation. *Annual Review of Psychology*, 59, 537-563.
- Perugini, M., Gallucci, M., & Costantini, G. (2018). A practical primer to power analysis for simple experimental designs. *International Review of Social Psychology*, 31(1).

### Post-hoc Power Critiques
- Hoenig, J. M., & Heisey, D. M. (2001). The abuse of power: The pervasive fallacy of power calculations for data analysis. *The American Statistician*, 55(1), 19-24.
- Lenth, R. V. (2007). Post hoc power: Tables and commentary. *Iowa State University Department of Statistics Technical Report*, 378.

### Effect Size Justification
- Lakens, D., Scheel, A. M., & Isager, P. M. (2018). Equivalence testing for psychological research: A tutorial. *Advances in Methods and Practices in Psychological Science*, 1(2), 259-269.
- Cook, J. A., et al. (2014). Assessing methods to specify the target difference for a randomised controlled trial: DELTA review. *Health Technology Assessment*, 18(28).

### Meta-Analysis Effect Sizes
- Carter, E. C., Schönbrodt, F. D., Gervais, W. M., & Hilgard, J. (2019). Correcting for bias in psychology: A comparison of meta-analytic methods. *Advances in Methods and Practices in Psychological Science*, 2(2), 115-144.

### Sequential Designs
- Lakens, D. (2014). Performing high-powered studies efficiently with sequential analyses. *European Journal of Social Psychology*, 44(7), 701-710.
- Schönbrodt, F. D., Wagenmakers, E. J., Zehetleitner, M., & Perugini, M. (2017). Sequential hypothesis testing with Bayes factors. *Psychological Methods*, 22(2), 322.

### Qualitative Research
- Fugard, A. J., & Potts, H. W. (2015). Supporting thinking on sample sizes for thematic analyses: A quantitative tool. *International Journal of Social Research Methodology*, 18(6), 669-684.

---

## APPENDIX: Interactive Tools

### Online Calculators & Apps
- **Sample Size Justification App**: https://shiny.ieis.tue.nl/sample_size_justification/
- **G*Power**: Free standalone software
- **rpact Shiny**: https://rpact.shinyapps.io/public/ (sequential)
- **gsDesign Shiny**: https://gsdesign.shinyapps.io/prod/ (group sequential)
- **MOTE**: https://www.aggieerin.com/shiny-server/ (CIs for effect sizes)
- **Within/Between Design**: http://shiny.ieis.tue.nl/within_between/
- **Power and p-value**: http://shiny.ieis.tue.nl/d_p_power/

### R Packages
- `pwr`: Basic power analysis
- `BUCSS`: Bias-corrected power analysis
- `TOSTER`: Equivalence testing and power
- `gsDesign`: Group sequential designs
- `rpact`: Advanced sequential designs
- `MBESS`: Precision-based sample size
- `simr`: Power analysis for mixed models

---

**Document Version**: 1.0
**Based on**: Lakens (2022) and associated course materials
**Last Updated**: 2025
**Purpose**: AI agent verification of sample size justifications in scientific research
