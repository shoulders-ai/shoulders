# Bayesian Statistics - AI Agent Guidance for Verification

## Overview
This document provides actionable knowledge for verifying Bayesian statistical analyses in scientific research. Bayesian inference allows updating prior beliefs about hypotheses based on observed data in a logically consistent manner.

---

## 1. KEY CONCEPTS

### 1.1 Core Terminology

**Prior Odds**: P(H₁)/P(H₀)
- The belief in hypothesis H₁ relative to H₀ before collecting data

**Posterior Odds**: P(H₁|D)/P(H₀|D)
- The belief in hypothesis H₁ relative to H₀ after observing data D

**Bayes Factor (BF)**: The ratio of marginal likelihoods
- BF₁₀: How much more likely H₁ has become given the data compared to H₀
- BF₀₁: How much more likely H₀ has become given the data compared to H₁
- Relationship: BF₁₀ = 1/BF₀₁

**Formula**: Posterior Probability = Bayes Factor × Prior Probability

**Marginal Likelihood**: P(D|H)
- Also called "absolute evidence"
- Averages the likelihood across the parameter space using prior probabilities
- For continuous parameters: calculated via integration over the parameter space

### 1.2 Priors

**Beta Distribution** (for binomial probabilities):
- Parameters: α and β (NOT error rates - different usage)
- Shape function: f(x; α, β) = (1/B(α,β)) × x^(α-1) × (1-x)^(β-1)
- Values lie between 0 and 1

**Common Prior Types**:
- **Uniform Prior**: Beta(1, 1) - all values equally likely (newborn's prior)
- **Skeptical Prior**: Beta(4, 4) or Beta(100, 100) - centered on 0.5 with varying strength
- **Believer Prior**: Beta(1, 0.5) - expects extreme values
- **Subjective Priors**: Based on researcher's belief/previous knowledge
- **Objective Priors**: Attempt to be non-informative

### 1.3 Posterior Distributions

**Calculation for Beta Distribution**:
- α* = α_prior + α_likelihood - 1
- β* = β_prior + β_likelihood - 1

**For binomial data** (x successes out of n trials):
- α* = α + x
- β* = β + n - x

**Key Property**: With uniform prior Beta(1,1), posterior equals the likelihood function

### 1.4 Credible Intervals

**Definition**: The Bayesian equivalent of confidence intervals
- Represents degree of belief that the parameter falls within the interval
- Interpretation: "I believe it is 95% probable (given my prior and data) that the true parameter falls within this credible interval"

**95% Credible Interval**: Area of posterior distribution between 0.025 and 0.975 quantiles

**Highest Density Interval (HDI)**:
- Alternative to standard credible intervals
- Better for skewed posterior distributions
- Identical to credible interval when posterior is symmetrical

**Key Difference from Confidence Intervals**:
- **Credible Interval**: Parameter varies, data is fixed; probability statement about parameter
- **Confidence Interval**: Parameter is fixed (unknown), intervals vary; only in long run do 95% of CIs contain true parameter
- When uniform prior is used: numerically identical, only interpretation differs
- With informed priors: credible and confidence intervals differ

### 1.5 Bayesian Estimation

**Posterior Mean**: α/(α + β) for Beta distribution
- Expected value based on prior beliefs and data
- Equals frequentist mean ONLY when mean of prior equals mean of likelihood
- With informed priors: posterior mean is pulled toward prior mean

---

## 2. GUIDELINES & RECOMMENDATIONS

### 2.1 When to Use Bayesian Approaches

**Appropriate Situations**:
- Unique events where frequentist "long-run" probability is not meaningful
- When prior information should be formally incorporated
- When updating beliefs based on accumulating evidence
- When interested in probability of hypotheses given data (with appropriate caveats)

**Complementary to Frequentist**:
- Bayesian and frequentist approaches can coexist
- Bayes factors and equivalence tests typically lead to same conclusions
- Neither approach is inherently superior; each has strengths and weaknesses

### 2.2 Model Comparison Approach

**Bayes Factors for Hypothesis Testing**:
- Compare two models by dividing their marginal likelihoods
- Represents how much beliefs should be updated based on observing data
- BF = 1: No change in belief
- Large BF for H₁: Increases belief in H₁ relative to H₀
- BF close to 0: Increases belief in H₀ relative to H₁

**Important Distinction from Likelihood Ratios**:
- Likelihood inference: Compare different parameter values for same likelihood curve
- Bayesian inference: Compare prior vs. posterior for same parameter value

### 2.3 Prior Selection

**Critical Requirements**:
- Priors MUST be specified and justified
- Do NOT blindly use "default" priors
- Default priors are heuristics that often answer nonsensical questions
- Consider goals and expectations when specifying priors
- Different priors represent different degrees of skepticism/belief

**Transparency**:
- Always report the priors used
- Justify why specific priors were chosen
- Consider sensitivity analysis with different reasonable priors

---

## 3. COMMON MISTAKES & PITFALLS

### 3.1 Misunderstanding 1: Confusing Bayes Factors with Posterior Odds

**THE ERROR**: Believing BF tells you the probability that a hypothesis is true

**THE TRUTH**:
- BF only quantifies how much to UPDATE belief
- BF ≠ probability hypothesis is true
- Posterior belief depends on both BF AND prior belief
- BF of 10 with extremely low prior (e.g., telepathy at 0.1% likely) still results in low posterior belief
- BF = posterior odds ONLY if prior odds were 1:1 (perfect uncertainty)

**Correct Interpretation**: "The evidence updates my belief by a factor of X" NOT "The hypothesis is X times more likely to be true"

### 3.2 Misunderstanding 2: Failing to Interpret Bayes Factors as Relative Evidence

**THE ERROR**: Treating BF as absolute support (e.g., "BF of 0.09 proves the null hypothesis")

**THE TRUTH**:
- BF quantifies support for one hypothesis RELATIVE to another
- Both hypotheses being compared could be false
- Different alternative model specification = different BF
- BF supporting H₀ does NOT mean no effect exists; could be small effect

**Example**: Bem's precognition studies - different alternative specifications led to opposite conclusions about evidence direction

**Correct Interpretation**: "BF provides relative support for H₀ compared to this specific H₁" NOT "BF proves H₀"

### 3.3 Misunderstanding 3: Not Specifying the Null and/or Alternative Model

**THE ERROR**: Reporting BF without specifying the models/priors used

**PREVALENCE**: 31.1% of articles don't discuss implemented priors

**THE PROBLEM**:
- NHST has implicit models (point null, any non-zero alternative)
- Bayesian analysis requires explicit model specification
- Alternative model is typically one of many possible alternatives
- Results are meaningless without knowing what was compared

**Required Practice**: Always specify and justify both null and alternative models

### 3.4 Misunderstanding 4: Claims Based on Bayes Factors Do Not Require Error Control

**THE ERROR**: Believing "optional stopping is no problem for Bayesians" applies to all uses

**THE TRUTH**:
- Optional stopping is NOT a problem ONLY when:
  - a) Making no dichotomous claims about presence/absence of effects, AND
  - b) Making no claims about predictions being supported/falsified
- BF only tells how much to update personal beliefs
- If BF is used with thresholds to make claims, error control becomes relevant

**Critical Distinction**:
- **Updating beliefs**: No error control needed
- **Making claims** (e.g., "effect did not differ, BF = 0.17"): Error control IS relevant

**Reality Check**:
- BF and p-values can be computed from same statistics (sample size, t-value)
- Common priors with BF > 3 threshold: Lower Type I error, but considerably higher Type II error
- Bayesians disagree among themselves about using BF thresholds for claims

**Consequence**: If using BF to make dichotomous claims, must accept that claims can be erroneous; if wanting no error control, must refrain from ALL ordinal claims in Results/Discussion

### 3.5 Misunderstanding 5: Interpreting Bayes Factors as Effect Sizes

**THE ERROR**: Concluding effect size is small/large based on BF alone

**THE TRUTH**:
- BF is NOT a statement about effect size
- Same BF can correspond to very different effect size estimates (depending on priors)
- Same effect size can correspond to BF supporting null OR alternative (depending on model specification)

**Required Practice**: Always report and interpret effect sizes SEPARATELY from test statistics; statements about effect size must be based on effect size measures, not BF

---

## 4. VERIFICATION CHECKLISTS

### 4.1 Pre-Analysis Verification

- [ ] Are the research questions/hypotheses suitable for Bayesian analysis?
- [ ] Have both null and alternative models been explicitly specified?
- [ ] Have priors been explicitly stated with parameters (e.g., Beta(α, β))?
- [ ] Have priors been justified based on theory, previous research, or rational argument?
- [ ] Is the choice between subjective vs. objective Bayesian analysis clear?
- [ ] If using "default" priors, has their appropriateness been examined?

### 4.2 Analysis Verification

- [ ] Are the prior distributions appropriate for the parameter type (e.g., Beta for binomial)?
- [ ] Have prior, likelihood, and posterior distributions been correctly calculated?
- [ ] For Beta distributions: Are α* and β* calculated correctly?
  - α* = α_prior + x (or α_prior + α_likelihood - 1)
  - β* = β_prior + (n-x) (or β_prior + β_likelihood - 1)
- [ ] Is the Bayes Factor calculated as the ratio of correct marginal likelihoods?
- [ ] If computing BF for specific hypothesis (e.g., p=0.5): Is it posterior/prior at that value?

### 4.3 Interpretation Verification

- [ ] Is BF interpreted as relative evidence, not absolute proof?
- [ ] Are claims about BF distinguished from claims about posterior odds?
- [ ] Are effect sizes reported and interpreted separately from BF?
- [ ] If dichotomous claims are made, is error control considered?
- [ ] Are credible intervals interpreted as degree of belief, not long-run frequency?
- [ ] Is it acknowledged that posterior mean can differ from frequentist mean with informed priors?

### 4.4 Reporting Verification

- [ ] Are all priors fully specified with parameters?
- [ ] Are both null and alternative models described?
- [ ] Are justifications for prior choices provided?
- [ ] Is the direction of BF clearly indicated (BF₁₀ vs. BF₀₁)?
- [ ] Are credible intervals or HDIs reported with posterior means?
- [ ] Are software/packages used for calculations reported?
- [ ] If sensitivity analyses with different priors were conducted, are they reported?

---

## 5. REPORTING REQUIREMENTS

### 5.1 Mandatory Elements

**Model Specification**:
- Null model (often point null, but not always)
- Alternative model with full specification
- All distributional assumptions

**Prior Specification**:
- Type of prior (uniform, informed, subjective, objective)
- Exact parameters (e.g., "Beta(4, 4)")
- Justification for prior choice
- Reference to source if based on previous research

**Results**:
- Bayes Factor with direction clearly indicated (BF₁₀ or BF₀₁)
- Posterior mean and credible interval (or HDI)
- Prior, likelihood, and posterior visualizations (recommended)

**Software**:
- Analysis software/package (e.g., JASP, R packages)
- Version numbers
- Code or analysis scripts (for reproducibility)

### 5.2 Correct Reporting Language

**CORRECT**:
- "The BF₁₀ of 8.5 indicates the data are 8.5 times more likely under H₁ than H₀"
- "The evidence updates belief in favor of H₁ by a factor of 8.5"
- "We believe it is 95% probable that the parameter falls within [X, Y]"
- "The BF provides relative support for H₀ compared to the specified H₁"

**INCORRECT**:
- "The BF of 8.5 indicates H₁ is true" (confuses BF with posterior odds)
- "The BF proves there is no effect" (treats BF as absolute)
- "The large BF indicates a large effect" (confuses BF with effect size)
- "There is 95% probability the credible interval contains the true value" (only true for that specific prior/data combination)

### 5.3 Additional Recommendations

**Transparency**:
- Report sensitivity analyses with different reasonable priors
- Acknowledge uncertainty in prior specification
- Discuss how results change with different priors

**Completeness**:
- Include both hypothesis testing (BF) and estimation (credible intervals) results
- Report both the test statistic and descriptive statistics
- Provide enough information for readers to reproduce analysis

---

## 6. DECISION RULES & THRESHOLDS

### 6.1 Jeffreys' Bayes Factor Thresholds (1939)

**Interpretation Guidelines** (with strong caveats):

| Bayes Factor (BF₁₀) | Inverse (BF₀₁) | Interpretation |
|---------------------|----------------|----------------|
| 1 to 3 | 1 to 1/3 | Not worth more than a bare mention |
| 3 to 10 | 1/3 to 1/10 | Substantial evidence |
| > 10 | < 1/10 | Strong evidence |

**CRITICAL CAVEATS**:
- These labels refer to belief UPDATE, not posterior belief
- Substantial evidence (BF=14) for implausible hypothesis (e.g., ESP) still leaves it implausible
- Benchmarks are subject to criticism (like effect size benchmarks)
- Should be starting point for developing intuition, not rigid rules

### 6.2 Journal Requirements (Example: Nature Human Behavior)

**Registered Reports Requirement**:
- Must guarantee data collection until BF ≥ 10 in favor of experimental hypothesis OR null hypothesis
- This creates error rates (Type I and II) that should be considered

### 6.3 Prior Selection Guidance

**Uniform Prior Beta(1,1)**:
- Use when: No prior knowledge; want to match frequentist analysis
- Characteristics: All values equally likely; posterior = likelihood

**Weak Informative Prior Beta(4,4)**:
- Use when: Expect centered distribution but allow wide range
- Characteristics: Centered on 0.5; accommodates 0.2 to 0.8 range

**Strong Informative Prior Beta(100,100)**:
- Use when: Strong belief in specific value based on extensive prior data
- Characteristics: Narrow distribution; requires strong data to shift

**Subjective Prior (e.g., Beta(1, 0.5))**:
- Use when: Specific theoretical expectations
- Characteristics: Reflects genuine prior belief; must be justified

**General Principle**: Stronger priors require stronger data to overcome; weaker priors allow data to dominate

### 6.4 Error Control Considerations

**If Making Dichotomous Claims**:
- With BF > 3 threshold: Expect somewhat lower Type I error but considerably higher Type II error than traditional p < 0.05
- Exact error rates depend on prior choice and threshold
- Consider pre-registering stopping rules and thresholds
- Acknowledge that claims can be erroneous

**If Not Making Claims**:
- Simply present BF as degree of belief update
- No error control needed
- But also cannot make definitive statements about presence/absence of effects

---

## 7. ADVANCED CONSIDERATIONS

### 7.1 Relationship to Frequentist Methods

**Equivalences**:
- BF can be calculated from same statistics as p-values (sample size, t-value)
- Bayes factors and equivalence tests typically reach same conclusions
- With uniform prior: credible interval = confidence interval (numerically)

**Complementarity**:
- Neither approach is superior in all situations
- Both have misconceptions and potential for misuse
- Statistical inference is hard regardless of framework
- Training needed for correct use of either approach

### 7.2 Philosophical Distinctions

**Frequentist View**:
- Parameter has one true (unknown) value
- Data varies; long-run probability statements
- Goal: Collect corpus of established claims

**Bayesian View**:
- Data is fixed; parameter varies (has distribution)
- Probability represents degree of belief
- Goal: Update beliefs about hypotheses (debated among Bayesians)

**No Universal Answer**: Philosophy of science determines which approach fits research goals

### 7.3 Software and Computation

**Common Tools**:
- JASP (free, open-source, user-friendly interface)
- R packages (binom, BayesFactor, brms, etc.)
- Python libraries (PyMC, Stan)

**Computational Notes**:
- Simple cases (binomial): Analytical solutions available
- Complex models: Often require MCMC sampling
- Report computational details for reproducibility

---

## 8. QUALITY ASSURANCE CHECKLIST

### 8.1 Red Flags in Published Research

**Immediate Concerns**:
- [ ] No priors specified (31.1% of published papers)
- [ ] Claims about "proof" or "truth" of hypotheses
- [ ] BF interpreted as effect size
- [ ] Absolute (not relative) interpretation of BF
- [ ] No justification for prior choice
- [ ] Claims about error control while using optional stopping
- [ ] BF reported without specifying alternative model

### 8.2 Verification Decision Tree

1. **Are priors specified and justified?**
   - NO → Request specification before proceeding
   - YES → Continue

2. **Are both H₀ and H₁ models described?**
   - NO → Request full model specifications
   - YES → Continue

3. **Is BF interpreted as relative evidence (not absolute)?**
   - NO → Flag interpretation error
   - YES → Continue

4. **If dichotomous claims are made, is error control discussed?**
   - NO → Flag potential error control issue
   - YES → Continue

5. **Are effect sizes reported separately from BF?**
   - NO → Request effect size reporting
   - YES → Continue

6. **Is the interpretation of credible intervals correct?**
   - NO → Flag misinterpretation
   - YES → Analysis interpretation appears sound

---

## 9. COMPARISON WITH FREQUENTIST APPROACHES

### 9.1 Key Differences

| Aspect | Bayesian | Frequentist |
|--------|----------|-------------|
| Parameters | Random variables with distributions | Fixed unknown values |
| Probability | Degree of belief | Long-run frequency |
| Inference basis | Posterior distribution | Sampling distribution |
| Prior knowledge | Explicitly incorporated | Not formally incorporated |
| Intervals | Credible (probability statement about parameter) | Confidence (long-run coverage) |
| Null hypothesis | Can support or reject | Can only reject |

### 9.2 Practical Equivalences

- BF and equivalence tests → typically same conclusions
- Uniform prior → credible interval = confidence interval (numerically)
- Both susceptible to misinterpretation and misuse
- Both require careful training for correct application

---

## 10. SUMMARY PRINCIPLES

### 10.1 Core Verification Principles

1. **Transparency is Essential**: All priors and models must be specified and justified
2. **Relative Not Absolute**: BF is always relative evidence between two models
3. **Not a Magic Solution**: Bayesian methods don't eliminate need for careful statistical thinking
4. **Separate Components**: Keep test results, effect sizes, and interpretations distinct
5. **Error Control Matters**: If making claims, errors are possible regardless of framework
6. **Context Dependent**: Prior choice should reflect genuine knowledge/beliefs, not convenience

### 10.2 Final Verification Question

**Before accepting a Bayesian analysis, ask**:
"Could someone reproduce this analysis with the information provided, and would they reach the same interpretation?"

If NO → Analysis documentation is insufficient
If YES → Analysis meets minimum reporting standards

---

## REFERENCES & FURTHER READING

**Key Citations from Source Material**:
- Jeffreys (1939): Original BF interpretation guidelines
- Dienes (2008, 2014): Understanding and using Bayes factors
- Kass & Raftery (1995): Bayes factors theory
- Rouder et al. (2009): Bayesian t-tests
- Wagenmakers et al. (2011): Re-analysis of Bem's ESP studies
- van de Schoot et al. (2017): Systematic review of BF use in psychology
- Wong et al. (2022): Common misconceptions (92% of articles show at least one)
- Tendeiro & Kiers (2024): Diagnosing BF misuse
- Lakens et al. (2020): BF vs. equivalence tests comparison
- Kruschke (2014): Doing Bayesian Data Analysis

**Additional Resources**:
- Michael I. Jordan lecture (first 50 minutes): Balanced Bayesian vs. Frequentist comparison
- JASP software: https://jasp-stats.org/

---

**Document Version**: 1.0
**Last Updated**: 2025-12-23
**Source Chapter**: /Users/waqr/Desktop/statistical_inferences-master/04-bayes.qmd
