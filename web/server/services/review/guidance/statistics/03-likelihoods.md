# Likelihood-Based Inference: AI Verification Guidance

## 1. Key Concepts

### 1.1 Core Definitions

**Likelihood vs. Probability**
- **Probability**: Parameters are fixed, compute probability of different data outcomes
  - Formula: Pr(data | parameters)
  - Example: Given p=0.5 (fair coin), what's probability of 8 heads in 10 flips?
- **Likelihood**: Data is fixed, estimate which parameter values make data most likely
  - Formula: L(parameters | data)
  - Example: Given 8 heads in 10 flips, which p value maximizes likelihood?

**Maximum Likelihood Estimation (MLE)**
- The parameter value that maximizes the likelihood function
- For binomial data with k successes in n trials, MLE = k/n
- One of the most important developments in 20th century statistics (Fisher, 1912)

**Likelihood Function**
- The (joint) density function evaluated at the observed data
- Plot of likelihood values across all possible parameter values
- **Critical**: Individual likelihood values have no meaning in isolation
- Only meaningful when comparing likelihoods across different parameter values

**Likelihood Ratio (LR)**
- Quantifies relative evidence between two specified hypotheses
- Formula: LR = L(H₁) / L(H₀)
- Expresses how many times more likely data are under one hypothesis vs. another
- Can be expressed either way: LR(H₁/H₀) or LR(H₀/H₁) = 1/LR(H₁/H₀)

### 1.2 Philosophical Position

**Likelihoodism as Third Approach**
- Distinct from frequentist and Bayesian statistics
- Focus: Quantify relative evidence between models/hypotheses
- Unlike Bayesians: Reject incorporation of prior information
- Key principle: "We do not care what you believe...what we are interested in is what you can show" (Taper & Lele, 2011)

**Relationship to Other Approaches**
- Neyman-Pearson: Likelihood ratio test is most powerful test (Neyman-Pearson lemma)
- Bayesian: Likelihood combined with prior yields posterior
- Fisherian: Both use p-values, but likelihoodists specify H₀ AND H₁

### 1.3 Mathematical Foundations

**Binomial Likelihood**
```
Pr(k; n, p) = [n! / (k!(n-k)!)] × p^k × (1-p)^(n-k)
```
- k = observed successes
- n = number of trials
- p = probability of success

**Likelihood Properties**
- Likelihoods can be combined by multiplication: L(combined) = L₁ × L₂
- Standardization: Divide by maximum to get relative likelihoods (max = 1)
- With larger samples, likelihood curves become narrower (more precision)

## 2. Guidelines & Recommendations

### 2.1 When to Use Likelihood-Based Inference

**Appropriate Scenarios**
- Comparing two or more specific, well-defined hypotheses
- When you want to quantify strength of evidence (not make binary decisions)
- Evaluating mixed results across multiple studies
- When prior probabilities are unknown or controversial
- Assessing relative support for parameter values

**When NOT to Use**
- Need for decision-making with error rate control (use Neyman-Pearson)
- Want to incorporate prior knowledge formally (use Bayesian)
- Only one hypothesis specified without alternative (use Fisherian p-values)

### 2.2 How to Compute Likelihood Ratios

**Binomial Data (e.g., success/failure outcomes)**
```R
# For k successes in n trials
LR <- dbinom(k, n, p_H1) / dbinom(k, n, p_H0)
```

**t-tests and Normal Data**
- Compute likelihood under null (ncp = 0) and alternative (ncp ≠ 0)
- Compare densities at observed t-value
- Can be computed for any statistical model (not just binomial)

**Standardizing Likelihood Curves**
- Divide by maximum likelihood: lik_standardized = lik / max(lik)
- Enables comparison across different datasets
- All standardized curves have maximum of 1

### 2.3 Combining Evidence from Multiple Studies

**Key Principle**: Multiply individual likelihoods
- Independent studies: L(combined) = L₁ × L₂ × ... × Lₙ
- Equivalent to analyzing pooled data
- Example: 8/10 heads + 4/10 heads = same as 12/20 heads

**Mixed Results in Study Sets**
- Mixed results are EXPECTED and normal (unless power ≈ 100%)
- Can still provide strong evidence for H₁
- Use binomial probability to calculate likelihood of observed pattern

## 3. Common Mistakes & Pitfalls

### 3.1 Critical Misconceptions

**MISTAKE 1: Interpreting Individual Likelihood Values**
- ❌ Wrong: "Likelihood of 0.30 means there's 30% probability"
- ✓ Correct: Individual likelihoods are meaningless in isolation
- Only compare likelihoods across parameter values

**MISTAKE 2: Assuming Winning Hypothesis is Correct**
- ❌ Wrong: "LR = 803,462 proves H₁ is true"
- ✓ Correct: LR only shows relative evidence between TWO specified hypotheses
- A third hypothesis might have even higher likelihood
- Example: Comparing p=0.3 vs p=0.8 when true p=0.5

**MISTAKE 3: Expecting All Significant Results**
- ❌ Wrong: "Mixed results = no effect or poor research"
- ✓ Correct: With 80% power, expect non-significant results ≈20% of time
- Example: 3 studies at 80% power
  - P(3 significant) = 51.2%
  - P(≥1 non-significant) = 48.8%

**MISTAKE 4: Treating LR Like p-value**
- ❌ Wrong: "LR > threshold → reject null"
- ✓ Correct: LR quantifies evidence strength, not binary decision
- Likelihoodism ≠ hypothesis testing with error control

**MISTAKE 5: Ignoring Type I Error Rate Inflation**
- ❌ Wrong: Apply formulas when p-hacking occurred
- ✓ Correct: Mixed results formulas assume controlled α (e.g., 5%)
- p-hacking destroys evidential value rapidly
- Example: α=20% → max LR ≈ 4.63 vs α=5% → LR ≈ 54

### 3.2 Interpretation Errors

**Relative vs. Absolute Evidence**
- LR compares ONLY the two hypotheses specified
- High LR doesn't prove either hypothesis is correct
- Always consider possibility of unspecified alternatives

**Sample Size Effects**
- Larger samples → narrower likelihood curves
- Stronger evidence against parameters far from observed value
- BUT: Don't confuse precision with correctness of hypothesis

**Direction of Ratio**
- LR can be expressed either way: H₁/H₀ or H₀/H₁
- Must specify which hypothesis is in numerator
- LR = 37 for H₀/H₁ is same as LR = 0.027 for H₁/H₀

## 4. Verification Checklists

### 4.1 Single Study Analysis

**Pre-Analysis Checks**
- [ ] Both H₀ AND H₁ are explicitly specified
- [ ] Hypotheses are stated as specific parameter values
- [ ] Appropriate statistical model identified (binomial, normal, etc.)
- [ ] Sample size and observed data clearly reported

**Computation Checks**
- [ ] Correct formula used for data type
- [ ] Parameters correctly specified (k, n, p for binomial)
- [ ] Both likelihoods calculated at same observed data
- [ ] Ratio expressed with clear numerator/denominator

**Interpretation Checks**
- [ ] LR interpreted as relative evidence (not probability)
- [ ] Direction of comparison clearly stated
- [ ] Benchmark values applied appropriately
- [ ] Possibility of alternative hypotheses acknowledged

### 4.2 Multiple Study Analysis (Mixed Results)

**Setup Verification**
- [ ] Number of studies (n) correctly specified
- [ ] Number of significant results (k) accurately counted
- [ ] Alpha level used in studies verified (typically 0.05)
- [ ] Alpha was controlled (no p-hacking/flexible analysis)
- [ ] Power assumption justified or sensitivity analysis performed

**Calculation Verification**
- [ ] Binomial probability under H₀: Pr(k; n, α)
- [ ] Binomial probability under H₁: Pr(k; n, power)
- [ ] LR = Pr(H₁) / Pr(H₀) computed correctly
- [ ] Results make intuitive sense (sanity check)

**Critical Assumptions**
- [ ] Type I error rate actually controlled at stated α
- [ ] Studies are independent
- [ ] Pre-registration or other evidence of no p-hacking
- [ ] Power estimate reasonable (check sensitivity)

**Red Flags**
- [ ] ALL studies significant with claimed power < 90%
- [ ] Publication venue requires only significant results
- [ ] No discussion of file drawer or selective reporting
- [ ] Unrealistic power assumptions (e.g., claiming 95% power)

### 4.3 t-test Likelihood Analysis

**Model Specification**
- [ ] Sample size per group specified
- [ ] Observed t-value reported
- [ ] Degrees of freedom correct: df = (N₁ + N₂) - 2
- [ ] Alternative hypothesis specified (effect size or ncp)

**Computation**
- [ ] Null distribution: dt(t, df, ncp = 0)
- [ ] Alternative distribution: dt(t, df, ncp = calculated)
- [ ] Non-centrality parameter computed correctly
- [ ] LR shows data more likely under alternative when t is large

## 5. Reporting Requirements

### 5.1 Essential Elements

**For Single Study**
1. **Hypotheses**: Explicitly state both H₀ and H₁ with parameter values
2. **Data**: Report observed data (k, n for binomial; t, df for t-test)
3. **Likelihoods**: Report L(H₀) and L(H₁) separately
4. **Likelihood Ratio**: Report LR with clear numerator/denominator
5. **Interpretation**: State in plain language what LR means

**Example Report**:
> "We compared two hypotheses: a fair coin (p = 0.5) vs. an unfair coin (p = 0.8).
> Observed data: 8 heads in 10 flips.
> L(p=0.5) = 0.044; L(p=0.8) = 0.302
> LR = L(p=0.8)/L(p=0.5) = 6.87
> The observed data are 6.87 times more likely under the hypothesis of an unfair coin
> than under the hypothesis of a fair coin."

### 5.2 Multiple Studies Reporting

**Required Information**
1. **Study count**: Total number of studies conducted (not just reported)
2. **Results pattern**: Number of significant vs. non-significant results
3. **Alpha level**: Stated and actual Type I error rate
4. **Power assumption**: Either calculated or assumed, with justification
5. **Likelihood ratio**: For H₁ vs. H₀ given the pattern
6. **Sensitivity**: How LR changes across plausible power values

**Example Report**:
> "We conducted 3 studies (all pre-registered, α = 0.05), finding 2 significant results.
> Assuming 80% power, the binomial probability under H₁ is 0.384, and under H₀ is 0.007.
> LR = 0.384/0.007 = 53.89
> The observed pattern is 53.89 times more likely when H₁ is true with 80% power than
> when H₀ is true. This constitutes strong evidence for H₁ (Royall, 1997).
> Sensitivity analysis: LR > 8 (moderate evidence) for power as low as 60%."

### 5.3 What NOT to Report

**Avoid**
- ❌ "LR = 6.87, therefore p < 0.05" (mixing frameworks)
- ❌ "LR = 6.87 proves the coin is unfair" (not proof)
- ❌ "LR = 6.87, so we reject H₀" (not a decision rule)
- ❌ Reporting only LR without individual likelihoods
- ❌ Claiming evidence when Type I errors not controlled

## 6. Decision Rules & Interpretation

### 6.1 Royall's Benchmarks (1997)

**Strength of Evidence Thresholds**
- **LR < 8**: Weak evidence
- **8 ≤ LR < 32**: Moderately strong evidence
- **LR ≥ 32**: Strong evidence

**Important Caveats**
- These are subjective benchmarks, not rigid rules
- Context matters (consequences of errors, prior knowledge)
- Should not be treated like α = 0.05 threshold
- Consider practical/scientific significance alongside statistical evidence

### 6.2 Intuitive Interpretation Aid

**Bag of Marbles Analogy**
- LR = 7: Like distinguishing bag with 7 blue marbles vs. bag with 7 different colors after drawing one blue marble
- Helps calibrate subjective feeling for evidence strength
- Prevents over-reliance on arbitrary benchmarks

### 6.3 When to Prefer Likelihood Over Other Approaches

**Choose Likelihood When:**
- Goal is quantifying evidence strength (not making decisions)
- Two specific hypotheses need comparison
- Want to avoid subjectivity of priors (vs. Bayesian)
- Want to avoid arbitrary dichotomous decisions (vs. NHST)
- Evaluating cumulative evidence across studies

**Choose Alternative When:**
- Need error rate control for decisions → Neyman-Pearson
- Have meaningful prior information → Bayesian
- Exploratory testing of single hypothesis → Fisherian p-values
- Regulatory/policy decision required → Neyman-Pearson

### 6.4 Mixed Results Decision Framework

**For Sets of Studies, Evidence is Strong When:**
- LR > 32 in favor of H₁
- Type I error rate demonstrably controlled (pre-registration)
- Power assumption reasonable (30-80% range for psychology)
- Pattern consistent across sensitivity analysis

**Red Flags Indicating Weak Evidence:**
- All results significant with low assumed power (< 70%)
- LR sensitive to small changes in power assumption
- Evidence of selective reporting or p-hacking
- Publication venue requires only significant results
- α inflation suspected

**Probability Benchmarks for Mixed Results**
With α = 0.05 and power = 0.80:

| Studies (n) | Significant (k) | P(H₀) | P(H₁) | LR (H₁/H₀) | Evidence |
|-------------|----------------|-------|-------|-----------|----------|
| 3 | 2 | 0.007 | 0.384 | 54 | Strong |
| 3 | 3 | 0.0001 | 0.512 | 4096 | Very strong |
| 4 | 3 | 0.001 | 0.410 | 410 | Very strong |
| 6 | 3 | 0.002 | 0.082 | 38 | Strong |

**Key Insight**: Even 50% significant results (3/6) can be strong evidence for H₁!

## 7. Advanced Considerations

### 7.1 Sample Size and Precision

**Increasing Sample Size Effects**
- Likelihood curves become narrower
- Greater discrimination between nearby parameter values
- Stronger evidence against values far from observed
- Does NOT make incorrect hypotheses more likely

**Practical Implications**
- Small studies: Wide likelihood curves, weak discrimination
- Large studies: Narrow curves, strong evidence for/against specific values
- Same proportion (e.g., 50%) gives stronger evidence with more data

### 7.2 Combining Independent Studies

**Multiplicative Property**
- L(combined) = L₁ × L₂ × ... × Lₙ
- Assumes true independence
- Equivalent to analyzing pooled data
- Each study contributes evidence

**Non-Independence Issues**
- Same participants across studies → violation
- Shared methodological flaws → may inflate evidence
- Publication bias → undermines calculations
- Solution: Account for dependencies or analyze separately

### 7.3 Type I Error Rate Control

**Critical Importance**
- Mixed results formulas assume controlled α
- p-hacking rapidly destroys evidential value
- Even modest inflation (α = 0.20) makes studies uninformative

**Example Impact**:
- α = 0.05, power = 0.80, 2/3 significant → LR ≈ 54 (strong)
- α = 0.20, power = 0.80, 2/3 significant → LR ≈ 4.6 (weak)

**Verification Steps**
- Check for pre-registration
- Verify no selective reporting
- Assess multiple testing corrections
- Look for flexible analysis indicators

### 7.4 Publication Bias Implications

**Expected vs. Observed Patterns**
- With 50% power, P(4/4 significant) = 6.25%
- Most psychology papers show only significant results
- Mathematically impossible without publication bias or high power

**Reality Check**
- If power = 50% and 10 articles each have 5 studies all significant:
- P(all significant per article) = 0.5⁵ = 3.125%
- P(10 such articles) = (0.03125)¹⁰ ≈ 10⁻¹⁵
- Conclusion: Extreme publication bias or unrealistic power claims

**Implications for Evidence Evaluation**
- Distrust "too good to be true" patterns
- Value publications with mixed results
- Demand pre-registration and complete reporting

## 8. Quick Reference Formulas

### Binomial Likelihood Ratio
```R
n <- 10          # number of trials
k <- 8           # number of successes
H0 <- 0.5        # null hypothesis parameter
H1 <- 0.8        # alternative hypothesis parameter

LR <- dbinom(k, n, H1) / dbinom(k, n, H0)
```

### Mixed Results (Multiple Studies)
```R
n_studies <- 3         # total studies
k_sig <- 2             # significant results
alpha <- 0.05          # Type I error rate
power <- 0.80          # assumed power

prob_H0 <- dbinom(k_sig, n_studies, alpha)
prob_H1 <- dbinom(k_sig, n_studies, power)
LR <- prob_H1 / prob_H0
```

### t-test Likelihood
```R
N <- 100              # sample size per group
t_obs <- 2.1          # observed t-value
df <- (N * 2) - 2     # degrees of freedom
d <- [calculate Cohen's d from t]
ncp <- d * sqrt(N/2)  # non-centrality parameter

L_H0 <- dt(t_obs, df, ncp = 0)
L_H1 <- dt(t_obs, df, ncp = ncp)
LR <- L_H1 / L_H0
```

## 9. Common Verification Scenarios

### Scenario 1: Verifying Single Study Claim
**Researcher claims**: "Our data strongly support H₁ (p=0.8) over H₀ (p=0.5)"
**Observed**: 8/10 successes

**Verification Steps**:
1. Calculate L(H₀) = dbinom(8, 10, 0.5) = 0.044
2. Calculate L(H₁) = dbinom(8, 10, 0.8) = 0.302
3. Calculate LR = 0.302 / 0.044 = 6.87
4. Check benchmark: 6.87 < 8 → only weak evidence
5. **Verdict**: Claim of "strong support" is overstated; evidence is weak to moderate

### Scenario 2: Evaluating Mixed Results
**Researcher claims**: "Only 2/3 studies showed significant effects, suggesting weak evidence"
**Context**: α = 0.05, power = 0.80

**Verification Steps**:
1. Calculate P(2/3 | H₀) = dbinom(2, 3, 0.05) = 0.007
2. Calculate P(2/3 | H₁) = dbinom(2, 3, 0.80) = 0.384
3. Calculate LR = 0.384 / 0.007 = 54
4. Check benchmark: 54 > 32 → strong evidence
5. **Verdict**: Claim is incorrect; this pattern actually shows strong evidence for H₁

### Scenario 3: Suspicious Perfect Results
**Researcher claims**: "All 5 studies showed p < 0.05, strongly supporting our theory"
**Context**: Power not stated, typical psychology study

**Verification Steps**:
1. If power = 0.50 (common): P(5/5 significant) = 0.5⁵ = 3.125%
2. If power = 0.80 (optimistic): P(5/5 significant) = 0.8⁵ = 32.8%
3. Check for pre-registration: None mentioned
4. Check journal: Requires only significant results
5. **Verdict**: Results are "too good to be true"; likely publication bias or inflated Type I errors

### Scenario 4: Comparing Wrong Hypotheses
**Researcher claims**: "LR = 803,462 for p=0.3 vs p=0.8 proves effect exists"
**Observed**: 50/100 heads

**Verification Steps**:
1. Calculate L(p=0.3) = dbinom(50, 100, 0.3)
2. Calculate L(p=0.8) = dbinom(50, 100, 0.8)
3. Verify LR calculation: Correct
4. BUT: Calculate L(p=0.5) = dbinom(50, 100, 0.5)
5. Compare: L(p=0.5) > L(p=0.3) >> L(p=0.8)
6. **Verdict**: Large LR is misleading; neither hypothesis is well-supported; p=0.5 is most likely

## 10. Integration with Other Statistical Frameworks

### Likelihood vs. p-values
- **p-value**: P(data or more extreme | H₀)
- **Likelihood**: L(data | H₀) compared to L(data | H₁)
- **Key difference**: p-values consider unobserved data; likelihoods do not
- **Do NOT mix**: Avoid statements like "LR = 8, so p < 0.05"

### Likelihood vs. Bayes Factors
- **Similarity**: Both are ratios of evidence for H₁ vs H₀
- **Difference**: Bayes Factors integrate over parameter distributions (use priors)
- **Likelihood Ratio**: Special case of Bayes Factor with point hypotheses
- **When likelihood → Bayes**: Need to compare composite hypotheses or incorporate priors

### Likelihood in Meta-Analysis
- Formal evidence synthesis should use meta-analysis
- Likelihood approaches provide intuition
- Mixed results calculations are educational, not substitutes for meta-analysis
- Use likelihood to set expectations; use meta-analysis for inference

## 11. Final Checklist for AI Agents

When reviewing likelihood-based analyses, systematically verify:

**Foundation**
- [ ] Two specific hypotheses are stated
- [ ] Observed data clearly reported
- [ ] Appropriate model selected

**Calculation**
- [ ] Likelihoods computed correctly for both hypotheses
- [ ] Ratio direction clearly specified
- [ ] Mathematics verified independently

**Assumptions**
- [ ] Type I error rate controlled (for mixed results)
- [ ] Independence assumptions met
- [ ] Power assumptions justified or sensitivity tested
- [ ] No evidence of p-hacking or selective reporting

**Interpretation**
- [ ] LR treated as relative evidence (not proof)
- [ ] Benchmarks applied appropriately (not rigidly)
- [ ] Possibility of alternatives acknowledged
- [ ] Claims match strength of evidence

**Reporting**
- [ ] All required elements included
- [ ] Plain language interpretation provided
- [ ] Sensitivity analysis conducted where appropriate
- [ ] Limitations acknowledged

**Red Flags**
- [ ] Perfect results (all significant) with modest power
- [ ] Claims mixing likelihood with p-values or confidence intervals
- [ ] Large LR claimed as "proof" without acknowledging relativity
- [ ] Suspect Type I error inflation
- [ ] "Too good to be true" patterns

---

**Document Version**: 1.0
**Source**: Chapter 3 - Likelihoods from Statistical Inferences course material
**Purpose**: Guide AI agents in verification of likelihood-based statistical analyses
**Key References**: Royall (1997), Pawitan (2001), Dienes (2008), Taper & Lele (2011)
