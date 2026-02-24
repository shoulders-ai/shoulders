# Sequential Analysis Verification Guide for AI Agents

## Purpose
This guide helps AI agents verify that scientists correctly designed, conducted, and reported sequential statistical analyses. Sequential analysis allows data analysis at multiple interim points while maintaining Type I error control.

---

## 1. KEY CONCEPTS

### Sequential Analysis vs. Optional Stopping
- **Sequential Analysis**: Planned interim analyses with corrected alpha levels maintaining Type I error control
- **Optional Stopping**: Repeatedly analyzing at unadjusted alpha (e.g., 5%), inflating Type I error to:
  - 0.142 after 5 looks
  - 0.374 after 100 looks
  - 0.530 after 1000 looks

### Core Terminology
- **Look (Stage)**: Analyzing all data collected up to a specific point
- **Interim Analysis**: Analysis before the final look
- **Final Analysis**: Last planned analysis after which data collection always stops
- **Overall Alpha Level**: Desired Type I error rate for entire study (e.g., 0.05)
- **Stage-wise Alpha**: Corrected alpha level at each individual look
- **Information Rate**: Percentage of total planned data collected at each look
- **Inflation Factor**: Ratio of maximum sample size for sequential design to fixed design sample size

### Stopping Types
- **Stop to reject H0**: Evidence for effect of interest
- **Stop for Futility**: Evidence against effect of interest (reject H1)
- **Stop for Curtailment**: Impossible or unlikely for final analysis to yield p < alpha
- **Conditional Power**: Probability of significant result given data observed at interim
- **Predictive Power**: Conditional power using Bayesian updating of expected effect size

### Alpha Spending
- Multiple looks create dependency (data from look 1 included in look 2)
- Alpha spending function: Pre-specifies cumulative Type I error rate across looks
- Beta spending function: Controls Type II error rate across looks for futility stopping
- Binding vs. Non-binding: Whether stopping rules must be followed

---

## 2. ALPHA SPENDING APPROACHES

### Pocock Correction
- **Characteristic**: Equal (or nearly equal) alpha at each look
- **Alpha values** (2 looks, two-sided, alpha=0.05): 0.0294 per look
- **Critical Z-values**: Constant across looks (e.g., ±2.178 for 2 looks)
- **Use when**: High uncertainty about effect; want higher early stopping probability
- **Trade-off**: Larger maximum sample size increase; lower final alpha reduces power

### O'Brien-Fleming Correction
- **Characteristic**: Very conservative early, close to uncorrected alpha at final look
- **Critical Z-values**: Decrease across looks (e.g., ±3.471 at look 1, ±2.454 at look 2, ±2.014 at look 3)
- **Use when**: Primarily monitoring; want minimal sample size increase
- **Benefit**: Maximum sample size nearly identical to fixed design; essentially a "free look"
- **Trade-off**: Lower early stopping probability

### Haybittle-Peto Correction
- **Characteristic**: Same conservative value at interim looks, normal alpha at final
- **Critical Z-values**: Constant at interims (typically ±3), then drops to ±1.96 at final
- **Use when**: Monitor but unlikely to stop early
- **Benefit**: Very simple; minimal sample size inflation

### Wang-Tsiatis Correction
- **Characteristic**: Flexible parameter Δ controls spending rate
- **Range**: Δ = 0 (O'Brien-Fleming) to Δ = 0.5 (Pocock)
- **Use when**: Need intermediate spending pattern

### Alpha Spending Functions (Lan-DeMets)
- **Key Innovation**: Number and timing of looks need not be pre-specified
- **Variants**:
  - asP: Pocock-like spending
  - asOF: O'Brien-Fleming-like spending
  - asUser: User-defined spending
- **Requirement**: Decision to perform interim analysis must NOT be based on collected data
- **Benefit**: Can update alpha levels during study if timing changes

---

## 3. VERIFICATION GUIDELINES & CHECKLISTS

### Pre-Study Design Verification

**Check 1: Is Sequential Analysis Appropriate?**
- [ ] Study involves ongoing data collection
- [ ] Early stopping for efficacy or futility is ethically/scientifically justified
- [ ] Logistical capacity exists to perform interim analyses
- [ ] Data collection can be stopped if criteria are met

**Check 2: Design Specification**
- [ ] Number of planned looks (kMax) is specified
- [ ] Information rates (timing) for each look are specified
- [ ] Overall alpha level is specified (typical: 0.05)
- [ ] Overall beta level is specified (typical: 0.10 or 0.20)
- [ ] Sidedness is specified (one-sided or two-sided)
- [ ] Alpha spending function is chosen and justified
- [ ] If futility stopping: Beta spending function is specified
- [ ] If futility stopping: Binding vs. non-binding is declared

**Check 3: Sample Size Justification**
- [ ] Maximum sample size per group is calculated
- [ ] Sample size at each look is specified
- [ ] Expected sample size under H1 is reported
- [ ] Comparison to fixed design sample size is provided
- [ ] Inflation factor is documented
- [ ] Power curve across effect sizes is considered

**Check 4: Stopping Rules**
- [ ] Criteria for rejecting H0 at each look are explicit
- [ ] If futility: Criteria for rejecting H1 at each look are explicit
- [ ] Boundary values (critical Z or t values) are specified
- [ ] Whether stopping is mandatory or optional is stated

### During-Study Verification

**Check 5: Timing Deviations**
- [ ] If timing differs from plan: Alpha levels have been recalculated
- [ ] New information rates are documented
- [ ] Updated alpha spending is calculated correctly
- [ ] Justification for timing change is unrelated to observed data

**Check 6: Sample Size Deviations**
- [ ] If final N exceeds planned: User-defined spending function is used
- [ ] Cumulative alpha spent at previous looks is correctly carried forward
- [ ] Final alpha level is adjusted appropriately
- [ ] If final N is less than planned: Adjustment is documented

**Check 7: Interim Analysis Execution**
- [ ] Test statistic is computed using ALL data up to that look
- [ ] Observed p-value is compared to corrected alpha for that look
- [ ] Decision (continue/stop) follows pre-specified rules
- [ ] Data from interim analysis is not used to modify design (unless adaptive design)

**Check 8: Multiple Comparisons**
- [ ] If multiple outcomes: Alpha is corrected for BOTH multiple comparisons AND multiple looks
- [ ] Correction order is appropriate (e.g., first for comparisons, then for looks)

### Post-Study Reporting Verification

**Check 9: Transparency Requirements**
- [ ] Sequential design is explicitly declared in methods
- [ ] Number of planned looks is reported
- [ ] Number of looks actually conducted is reported
- [ ] Alpha spending function is specified
- [ ] Overall and stage-wise alpha levels are reported
- [ ] At which look the study stopped is reported
- [ ] Reason for stopping is stated (reject H0, reject H1, reached final look)

**Check 10: Statistical Results**
- [ ] Test statistic at stopping look is reported
- [ ] Critical value for that look is reported
- [ ] Both unadjusted AND adjusted p-values are reported (if available)
- [ ] Effect size estimate: Unadjusted is always reported
- [ ] Effect size estimate: Adjusted (median unbiased) is reported if available
- [ ] Confidence intervals: Both unadjusted and adjusted reported if available

**Check 11: Sample Size Reporting**
- [ ] Sample size at each look is reported
- [ ] Final sample size is reported
- [ ] Expected vs. actual sample size is discussed
- [ ] If stopped early: Savings in sample size is quantified

---

## 4. COMMON MISTAKES & PITFALLS

### Design Phase Errors

**Error 1: Confusing Sequential Analysis with Optional Stopping**
- Mistake: Using unadjusted alpha (0.05) at each look
- Consequence: Type I error rate inflates dramatically
- Verification: Check that alpha levels are explicitly corrected

**Error 2: Using Bonferroni When Alpha Spending Is More Appropriate**
- Mistake: Dividing alpha equally (0.05/k looks) without accounting for dependency
- Consequence: Unnecessarily conservative; loss of power
- Verification: Check if more efficient spending function could be used

**Error 3: Inadequate Sample Size Planning**
- Mistake: Forgetting sequential designs require larger maximum N
- Consequence: Underpowered final analysis
- Verification: Compare maximum N to fixed design N; check inflation factor

**Error 4: Inappropriate Spending Function Choice**
- Mistake: Using Pocock when early stopping is unlikely
- Consequence: Unnecessarily large maximum sample size
- Verification: Check if spending function matches study goals

**Error 5: Not Planning for Futility**
- Mistake: Only specifying stopping for efficacy when H0 is plausible
- Consequence: Waste of resources if no effect exists
- Verification: Check if beta spending function should be included

### Execution Phase Errors

**Error 6: Data-Dependent Interim Timing**
- Mistake: Deciding when to look based on observed trends
- Consequence: Type I error inflation; alpha spending functions invalid
- Verification: Check that interim timing is pre-specified or based on external factors

**Error 7: Not Recalculating Alpha After Timing Deviations**
- Mistake: Using original alpha levels when information rates change
- Consequence: Type I error rate no longer controlled
- Verification: Confirm updated alpha calculations when timing deviates

**Error 8: Incorrect Test Statistic Calculation**
- Mistake: Only analyzing new data at each look (not cumulative)
- Consequence: Incorrect test statistics; invalid conclusions
- Verification: Verify analysis includes ALL data collected to that point

**Error 9: Continuing After Meeting Futility Boundary (Binding Rule)**
- Mistake: Not stopping when futility boundary is crossed and rule is binding
- Consequence: Type II error inflation
- Verification: Check if futility rule was binding and was followed

**Error 10: Modifying Design Based on Interim Data**
- Mistake: Changing number of looks, alpha spending, or final N based on observed effects
- Consequence: Type I error inflation; invalidates design
- Verification: Check that design modifications are pre-planned or based on external factors

### Reporting Phase Errors

**Error 11: Reporting Only Adjusted OR Only Unadjusted Estimates**
- Mistake: Omitting unadjusted effect size and p-value
- Consequence: Cannot be included in future meta-analyses
- Verification: Both versions should be reported

**Error 12: Not Disclosing Sequential Nature**
- Mistake: Reporting as if fixed design was used
- Consequence: Readers cannot evaluate evidence; meta-analysts may misuse p-values
- Verification: Methods must explicitly state sequential design was used

**Error 13: Over-Interpreting Adjusted P-Values**
- Mistake: Treating adjusted p-values as definitive evidence measures
- Note: Adjusted p-values have philosophical issues; likelihood ratios or Bayes factors preferred

**Error 14: Ignoring Early Stop in Effect Size Interpretation**
- Mistake: Not acknowledging early stopping tends to overestimate effect size
- Consequence: Inflated effect size estimates in literature
- Verification: Check if adjusted effect size is reported or caveat is mentioned

**Error 15: Incorrect Confidence Interval Interpretation**
- Mistake: Using unadjusted CIs without noting they don't account for sequential nature
- Consequence: Miscalibrated uncertainty
- Verification: Adjusted CIs should be reported when available

---

## 5. STATISTICAL FORMULAS & DECISION RULES

### Core Formula for Sequential Testing
For a directional test with k looks:
```
Pr{Z_n ≥ c_1} + Pr{Z_n < c_1, Z_N ≥ c_2} + ... = α
```
Where:
- Z_n = Z-score at look n
- c_k = critical value at look k
- α = overall Type I error rate

### Decision Rules at Each Look

**At Look k:**
1. Calculate test statistic (Z or t) using all data collected to that point
2. Compare to critical value c_k (or compare p-value to α_k)
3. Decision:
   - If |Z| ≥ c_k: Reject H0, stop data collection
   - If Z ≤ futility_bound_k: Reject H1 (stop for futility)
   - Otherwise: Continue to next look

### Sample Size Calculations

**Maximum Sample Size:**
- Calculate as for fixed design
- Multiply by inflation factor for chosen spending function
- Round up to complete observations

**Expected Sample Size Under H1:**
```
E[N|H1] = Σ(Pr(stop at look k) × N_k)
```

**Inflation Factor:**
```
Inflation Factor = N_max_sequential / N_fixed
```

Common inflation factors:
- O'Brien-Fleming, 2 looks: ~1.00 (essentially no inflation)
- O'Brien-Fleming, 5 looks: ~1.03
- Pocock, 5 looks: ~1.23

### Updating Alpha During Study

**When information rate changes:**
1. Specify actual information rates: (n_1/N_actual, n_2/N_actual, ..., 1)
2. Recalculate stage-wise alpha levels using spending function
3. Use updated alpha for current and future looks

**When final N exceeds planned:**
1. Use user-defined spending function (typeOfDesign = "asUser")
2. Specify cumulative alpha spent at each completed look
3. Calculate final alpha as: α_final = α_overall - α_spent

### Adjusted Effect Size Estimation

**Median Unbiased Estimate:**
- Accounts for early stopping bias
- Available in software for mean comparisons, survival analysis
- Generally smaller than unadjusted estimate when stopped early

**Adjusted Confidence Intervals:**
- Use stagewise ordering: earlier stopping is more extreme
- Wider than unadjusted CIs to account for sequential testing
- Available in limited contexts (mean comparisons, proportions)

---

## 6. SOFTWARE-SPECIFIC VERIFICATION (rpact)

### Design Specification Checks

**Required Parameters:**
```r
design <- getDesignGroupSequential(
  kMax = [number of looks],
  typeOfDesign = ["P", "OF", "HP", "WT", "asP", "asOF", "asUser"],
  sided = [1 or 2],
  alpha = [overall alpha],
  beta = [overall beta]
)
```

**Optional Parameters:**
```r
informationRates = [vector of fractions]  # If non-equal spacing
futilityBounds = [vector]                 # Manual futility boundaries
typeBetaSpending = ["bsP", "bsOF", etc.]  # Futility beta spending
bindingFutility = [TRUE/FALSE]            # Futility rule type
deltaWT = [value]                          # For Wang-Tsiatis only
userAlphaSpending = [vector]               # For asUser only
```

**Verification Checks:**
- [ ] `design$stageLevels` gives ONE-sided alpha levels (multiply by 2 for two-sided)
- [ ] `design$criticalValues` gives Z-score boundaries
- [ ] `design$alphaSpent` shows cumulative alpha spent at each look
- [ ] For two-sided tests, boundaries apply to both tails

### Sample Size Calculation Checks

**Required Parameters:**
```r
power_res <- getSampleSizeMeans(
  design = design,
  groups = [1 or 2],
  alternative = [effect size],
  stDev = [standard deviation],
  allocationRatioPlanned = [ratio],
  normalApproximation = [TRUE/FALSE]
)
```

**Key Outputs to Verify:**
- [ ] `numberOfSubjects1[k]`: Sample size per group at look k
- [ ] `numberOfSubjects[k]`: Total sample size at look k
- [ ] `expectedNumberOfSubjectsH1`: Expected N if H1 true
- [ ] `rejectPerStage[k]`: Probability of stopping at look k
- [ ] `criticalValuesEffectScale`: Critical effect sizes

### Analysis Results Checks

**Data Input:**
```r
dataMeans <- getDataset(
  n1 = [vector of n per stage],
  n2 = [vector of n per stage],
  means1 = [vector of means per stage],
  means2 = [vector of means per stage],
  stDevs1 = [vector of SDs per stage],
  stDevs2 = [vector of SDs per stage]
)
```

**Critical Verification:**
- [ ] Data for each stage includes ONLY new participants (not cumulative)
- [ ] Number of stages matches design
- [ ] Sample sizes are reasonable

**Analysis Function:**
```r
res <- getAnalysisResults(
  design = design,
  equalVariances = [TRUE/FALSE],
  dataInput = dataMeans
)
```

**Key Outputs to Verify:**
- [ ] `finalStage`: Which look study stopped at
- [ ] `effectSizes[k]`: Unadjusted effect size at look k
- [ ] `overallPValues[k]`: Unadjusted one-sided p-values (×2 for two-sided)
- [ ] `testStatistics[k]`: Observed Z or t statistics
- [ ] `medianUnbiasedEstimates[k]`: Adjusted effect sizes
- [ ] `finalPValues[k]`: Adjusted p-value at stopping look
- [ ] `finalConfidenceIntervalLowerBounds[k]`: Adjusted CI lower
- [ ] `finalConfidenceIntervalUpperBounds[k]`: Adjusted CI upper

### Common rpact Gotchas

1. **One-sided default**: rpact defaults to one-sided tests; always check `sided` parameter
2. **Alpha levels**: `stageLevels` are one-sided; multiply by 2 for two-sided interpretation
3. **Stage data**: Data input requires per-stage data, not cumulative
4. **Rounding**: rpact doesn't round sample sizes; you must round up
5. **P-values**: Output p-values are one-sided; multiply by 2 for two-sided tests

---

## 7. DECISION TREES FOR VERIFICATION

### Decision Tree 1: Is Error Control Adequate?

```
START: Researcher claims to use sequential analysis
│
├─ Are alpha levels corrected at each look?
│  ├─ NO → ERROR: Optional stopping, not sequential analysis
│  └─ YES → Continue
│
├─ Is correction method specified?
│  ├─ NO → ERROR: Inadequate documentation
│  └─ YES → Continue
│
├─ Does correction maintain overall alpha?
│  ├─ NO → ERROR: Incorrect implementation
│  └─ YES → Continue
│
└─ Are boundary values or corrected alphas reported?
   ├─ NO → WARNING: Incomplete reporting
   └─ YES → PASS: Error control adequate
```

### Decision Tree 2: Should Futility Stopping Be Included?

```
START: Evaluating sequential design
│
├─ Is H0 plausible (effect might be absent)?
│  ├─ NO → Futility stopping optional
│  └─ YES → Continue
│
├─ Is there a well-defined SESOI or H1?
│  ├─ NO → Futility stopping difficult to implement
│  └─ YES → Continue
│
├─ Are resources limited (want to minimize waste if H0 true)?
│  ├─ NO → Futility stopping optional
│  └─ YES → Continue
│
└─ RECOMMENDATION: Include beta-spending function for futility
```

### Decision Tree 3: Which Spending Function to Use?

```
START: Choosing alpha spending function
│
├─ Is early stopping highly desirable/likely?
│  ├─ YES → Consider Pocock or Pocock-like (asP)
│  │  ├─ Can afford larger maximum N?
│  │  │  ├─ YES → Use Pocock/asP
│  │  │  └─ NO → Consider Wang-Tsiatis with moderate Δ
│  │  └─
│  └─ NO → Continue
│
├─ Is primary goal monitoring (early stopping unlikely)?
│  ├─ YES → Consider O'Brien-Fleming or OF-like (asOF)
│  └─ NO → Continue
│
├─ Is minimizing maximum N critical?
│  ├─ YES → Use O'Brien-Fleming/asOF
│  └─ NO → Consider intermediate (Wang-Tsiatis)
│
└─ Is flexibility in timing essential?
   ├─ YES → Use alpha spending function (asP, asOF)
   └─ NO → Either correction or spending function acceptable
```

### Decision Tree 4: Verifying Interim Analysis Execution

```
START: Interim analysis performed
│
├─ Was timing pre-specified or externally determined?
│  ├─ NO → ERROR: Data-dependent timing
│  └─ YES → Continue
│
├─ Does timing match plan?
│  ├─ YES → Use original alpha for this look
│  └─ NO → Must recalculate alpha levels
│
├─ Were all data up to this point analyzed?
│  ├─ NO → ERROR: Incorrect test statistic
│  └─ YES → Continue
│
├─ Was test statistic compared to correct boundary?
│  ├─ NO → ERROR: Wrong critical value used
│  └─ YES → Continue
│
└─ Was decision rule followed?
   ├─ NO → Determine if binding or non-binding
   │  ├─ Binding → ERROR: Rule violation
   │  └─ Non-binding → WARNING: Document deviation
   └─ YES → PASS: Correct execution
```

---

## 8. REPORTING REQUIREMENTS CHECKLIST

### Minimum Reporting Standards

**Pre-specification (Methods):**
- [ ] Explicit statement that sequential design was used
- [ ] Number of planned looks
- [ ] Timing of looks (information rates or sample sizes)
- [ ] Alpha spending function chosen (Pocock, OF, asP, asOF, etc.)
- [ ] Overall alpha level (e.g., 0.05 two-sided)
- [ ] Overall beta level (e.g., 0.10 for 90% power)
- [ ] If futility: Beta spending function
- [ ] If futility: Binding vs. non-binding
- [ ] Maximum sample size
- [ ] Critical values or alpha levels at each look
- [ ] Stopping rules (when to stop for efficacy/futility)
- [ ] Software and version used (e.g., rpact 3.x)

**Execution (Results):**
- [ ] Number of looks actually conducted
- [ ] Sample size at each look performed
- [ ] Which look the study stopped at
- [ ] Reason for stopping (reject H0, reject H1, reached final, logistical)
- [ ] Test statistic at stopping look
- [ ] Critical value at stopping look
- [ ] Any deviations from plan (timing, sample size, etc.)
- [ ] If deviations: How alpha was adjusted

**Statistical Results:**
- [ ] Unadjusted p-value (always)
- [ ] Adjusted p-value (if available)
- [ ] Unadjusted effect size estimate (always)
- [ ] Adjusted effect size estimate (if available, e.g., median unbiased)
- [ ] Unadjusted confidence interval (always)
- [ ] Adjusted confidence interval (if available)
- [ ] Note that effect sizes may be overestimated if stopped early

**Interpretation:**
- [ ] Conclusion stated relative to pre-specified stopping rules
- [ ] Acknowledgment of limitations (if stopped early: uncertainty, potential overestimation)
- [ ] Expected vs. actual efficiency gains discussed
- [ ] For meta-analysis: Guidance on which estimates to use

### Enhanced Reporting (Recommended)

**Design Justification:**
- [ ] Why sequential design was chosen
- [ ] Rationale for alpha spending function choice
- [ ] Rationale for number and timing of looks
- [ ] Justification for including/excluding futility stopping
- [ ] Discussion of inflation factor and maximum N increase
- [ ] Expected sample size under different scenarios

**Transparency Artifacts:**
- [ ] Pre-registration or protocol with full design specification
- [ ] Analysis code for design and sample size calculations
- [ ] Analysis code for interim and final analyses
- [ ] Boundary plots (Z-scores or effect sizes vs. information rate)
- [ ] Power curves showing expected N across effect sizes

**Sensitivity Analyses:**
- [ ] Effect size estimates under different assumptions
- [ ] Impact of any protocol deviations
- [ ] Comparison to what would have been found with fixed design

---

## 9. VERIFICATION ALGORITHMS

### Algorithm 1: Verify Type I Error Control

```
INPUT: Study design specifications
OUTPUT: Pass/Fail on error control

1. Extract parameters:
   - k = number of looks
   - alpha_overall = desired Type I error
   - alpha_k = alpha at look k (for all k)
   - Spending_function = chosen function

2. Check specified spending function:
   IF Spending_function is valid (Pocock, OF, HP, WT, asP, asOF, asUser):
       PASS_FUNCTION = TRUE
   ELSE:
       RETURN FAIL: "Invalid spending function"

3. Verify alpha levels sum correctly:
   IF sum(alpha_k) ≈ alpha_overall (accounting for dependency):
       PASS_SUM = TRUE
   ELSE:
       RETURN FAIL: "Alpha levels don't sum to overall alpha"

4. Check boundary values:
   FOR each look k:
       Calculate expected critical value c_k from spending function
       IF reported c_k ≈ expected c_k:
           PASS_BOUNDARY_k = TRUE
       ELSE:
           RETURN FAIL: "Boundary value at look k is incorrect"

5. IF all checks pass:
   RETURN PASS: "Type I error control verified"
```

### Algorithm 2: Verify Sample Size Calculations

```
INPUT: Design parameters, effect size assumptions
OUTPUT: Pass/Fail on sample size adequacy

1. Extract parameters:
   - alpha_overall, beta_overall
   - delta = effect size of interest
   - k = number of looks
   - Spending_function
   - N_max_reported = reported maximum sample size

2. Calculate fixed design sample size:
   N_fixed = SampleSize(alpha_overall, beta_overall, delta)

3. Calculate inflation factor for design:
   Inflation = getDesignCharacteristics(design)$inflationFactor

4. Calculate required maximum N:
   N_max_expected = N_fixed × Inflation

5. Compare to reported:
   IF N_max_reported ≥ N_max_expected:
       PASS_SIZE = TRUE
   ELSE:
       RETURN FAIL: "Maximum sample size insufficient"

6. Check expected N under H1:
   IF E[N|H1] < N_fixed:
       NOTE: "Sequential design more efficient on average"
   ELSE:
       WARNING: "Efficiency gain unclear for this design"

7. IF PASS_SIZE:
   RETURN PASS: "Sample size adequate"
```

### Algorithm 3: Verify Interim Analysis Execution

```
INPUT: Interim analysis results, design specifications
OUTPUT: Pass/Fail on correct execution

1. Extract:
   - k_current = current look number
   - n_observed = actual sample size at this look
   - n_planned_k = planned sample size at look k
   - Z_observed = observed test statistic
   - c_k = critical value for look k

2. Check timing:
   IF |n_observed - n_planned_k| is substantial:
       alpha_k_updated = RecalculateAlpha(design, actual_info_rates)
       c_k = alpha_k_updated
       NOTE: "Alpha recalculated due to timing deviation"

3. Check test statistic calculation:
   IF Z_observed is computed on ALL data to this point:
       PASS_STAT = TRUE
   ELSE:
       RETURN FAIL: "Test statistic should be cumulative"

4. Check decision:
   IF |Z_observed| ≥ c_k:
       Decision_expected = "Reject H0"
   ELSE IF futility_bounds exist AND Z_observed ≤ futility_bound_k:
       Decision_expected = "Reject H1 (futility)"
   ELSE:
       Decision_expected = "Continue"

5. Verify decision matches:
   IF Decision_actual == Decision_expected:
       RETURN PASS: "Interim analysis correctly executed"
   ELSE IF futility is non-binding:
       RETURN WARNING: "Deviation from non-binding futility rule"
   ELSE:
       RETURN FAIL: "Decision does not match stopping rules"
```

### Algorithm 4: Verify Reporting Completeness

```
INPUT: Manuscript reporting of sequential analysis
OUTPUT: Completeness score and missing elements

1. Initialize checklist:
   Required_items = [
       "Sequential design declared",
       "Number of planned looks",
       "Alpha spending function",
       "Overall alpha",
       "Maximum N",
       "Critical values or stage alphas",
       "Actual number of looks",
       "Which look stopped",
       "Unadjusted p-value",
       "Unadjusted effect size"
   ]

   Recommended_items = [
       "Adjusted p-value",
       "Adjusted effect size",
       "Software used",
       "Rationale for design",
       "Protocol deviations",
       "Expected vs actual N"
   ]

2. FOR each item in Required_items:
   IF item is reported in manuscript:
       Score_required += 1
   ELSE:
       Missing_required.append(item)

3. FOR each item in Recommended_items:
   IF item is reported in manuscript:
       Score_recommended += 1
   ELSE:
       Missing_recommended.append(item)

4. Calculate scores:
   Completeness_required = Score_required / length(Required_items)
   Completeness_recommended = Score_recommended / length(Recommended_items)

5. Return verdict:
   IF Completeness_required == 1.0:
       IF Completeness_recommended ≥ 0.8:
           RETURN "EXCELLENT: Complete reporting"
       ELSE:
           RETURN "GOOD: Minimum requirements met", Missing_recommended
   ELSE IF Completeness_required ≥ 0.8:
       RETURN "ACCEPTABLE with gaps", Missing_required
   ELSE:
       RETURN "INCOMPLETE: Major reporting deficiencies", Missing_required
```

---

## 10. CASE-BASED VERIFICATION EXAMPLES

### Case 1: Valid O'Brien-Fleming Design

**Reported Design:**
- 2 looks (one interim, one final)
- asOF alpha spending function
- Two-sided alpha = 0.05
- Beta = 0.10 (90% power)
- Expected d = 0.5
- Maximum N = 86 per group (172 total)

**Verification:**
1. Check inflation factor: Fixed N ≈ 85; Inflation ≈ 1.00; Expected max N ≈ 85 ✓
2. Check alpha levels: Look 1: 0.0052; Look 2: 0.0492; Cumulative ≈ 0.05 ✓
3. Check critical Z-values: Look 1: ±2.797; Look 2: ±1.977; Pattern matches OF ✓
4. Check expected efficiency: E[N|H1] ≈ 81 < Fixed (170) ✓

**Verdict:** PASS - Valid design with minimal inflation and efficiency gain

### Case 2: Invalid - Optional Stopping

**Reported:**
- "Data analyzed after every 20 participants"
- "Stopped when p < 0.05"
- Final N = 80, p = 0.042

**Red Flags:**
1. No alpha correction ✗
2. No spending function ✗
3. No critical values/boundaries ✗
4. Stopping rule is just "p < 0.05" ✗

**Verdict:** FAIL - Optional stopping with inflated Type I error, not valid sequential analysis

### Case 3: Valid with Protocol Deviation

**Reported:**
- 3 equally spaced looks (planned at n=50, 100, 150)
- Pocock-like alpha spending (asP)
- Two-sided alpha = 0.05
- Actual looks at n=57, 105, 150

**Verification:**
1. Alpha updated: Original rates: 0.333, 0.667, 1.0; Actual: 0.38, 0.70, 1.0
   Updated alphas: 0.0253, 0.0204, 0.0216 ✓
2. Justification: "Logistical delays"; not data-based ✓
3. Recalculation: Used `informationRates = c(57/150, 105/150, 1)` ✓

**Verdict:** PASS - Deviation handled correctly with alpha recalculation

### Case 4: Questionable - Stopped for Futility Without Pre-specification

**Reported:**
- Design specified stopping for efficacy only (no beta spending)
- At look 2, observed d = 0.05 (expected d = 0.5)
- Researchers stopped for futility

**Issue:** Post-hoc futility stopping without pre-specified beta spending or boundaries

**Verdict:** WARNING - Type II error may not be controlled; report as protocol deviation

### Case 5: Invalid - Modifying Design Based on Data

**Reported:**
- Original plan: 2 looks at n=75, 150
- At look 1 (n=75): p = 0.08, d = 0.3
- "Given smaller effect, we added a third look at n=112"

**Red Flags:**
1. Added look based on interim data ✗
2. No pre-specified adaptive design ✗
3. Invalidates alpha spending ✗

**Verdict:** FAIL - Invalid modification; Type I error no longer controlled

---

## 11. INTEGRATION WITH OTHER STATISTICAL CONCEPTS

### Sequential Analysis + Multiple Comparisons
- **Rule**: Correct alpha FIRST for multiple comparisons, THEN for multiple looks
- **Example**: 3 outcomes, 3 looks → Per-comparison alpha = 0.05/3 ≈ 0.0167 → Apply sequential correction to 0.0167

### Sequential Analysis + Equivalence Testing
- Stopping for futility = equivalence test for SESOI
- Beta-spending controls Type I error for equivalence conclusion
- Design should have low alpha AND low beta (e.g., both 0.05)

### Sequential Analysis + Bayesian Methods
- Bayes factors don't require error rate correction
- Provide evidence measure while sequential test provides decision framework
- Predictive power uses Bayesian updating for conditional power

### Sequential Analysis + Meta-Analysis
- Individual study: Use adjusted effect size
- Meta-analysis: Use UNADJUSTED effect sizes (weighting by N corrects for bias)
- Note that p-values are from sequential design

### Sequential Analysis + Pre-registration
- Full design must be pre-registered (looks, spending function, boundaries)
- Timing deviations acceptable if recalculated
- Any protocol changes must be transparently reported

---

## 12. ADVANCED TOPICS (Brief Overview)

### Adaptive Designs
- Allow modifications during study (e.g., re-estimating sample size)
- Require conditional error function approach
- Verify that adaptation rules were pre-specified

### Non-Binding Futility Rules
- Recommended over binding rules
- Allow continuation despite crossing futility boundary
- If not followed: Type II error may increase, but Type I error still controlled

### Conditional Power Analyses
- Calculate probability of significance given interim data
- Should NOT be used to modify pre-specified boundaries
- Check that conditional power was exploratory, not used to change design

---

## 13. QUICK REFERENCE TABLES

### Table 1: Common Spending Functions Comparison

| Function | Early Alpha | Final Alpha | Inflation Factor (3 looks) | Best For |
|----------|-------------|-------------|---------------------------|----------|
| Pocock | High (equal across looks) | Low | ~1.18 | High uncertainty; likely early effects |
| O'Brien-Fleming | Very Low | Near nominal | ~1.02 | Monitoring; unlikely early stop |
| Haybittle-Peto | Very Low (constant) | Nominal | ~1.00 | Safety monitoring only |
| Wang-Tsiatis (Δ=0.25) | Moderate | Moderate | ~1.10 | Intermediate flexibility |
| asP | ~Equal | ~Equal | ~1.18 | Flexible timing; uncertain effects |
| asOF | Very Low | Near nominal | ~1.02 | Flexible timing; unlikely early stop |

### Table 2: Inflation Factors by Design

| Looks | Pocock | O'Brien-Fleming |
|-------|--------|-----------------|
| 2 | 1.08 | 1.00 |
| 3 | 1.18 | 1.02 |
| 4 | 1.21 | 1.03 |
| 5 | 1.23 | 1.03 |

### Table 3: Two-Sided Alpha Levels (α = 0.05)

**Pocock Correction:**
| Looks | Look 1 | Look 2 | Look 3 | Look 4 | Look 5 |
|-------|--------|--------|--------|--------|--------|
| 2 | 0.0294 | 0.0294 | - | - | - |
| 3 | 0.0221 | 0.0221 | 0.0221 | - | - |
| 5 | 0.0158 | 0.0158 | 0.0158 | 0.0158 | 0.0158 |

**O'Brien-Fleming Correction:**
| Looks | Look 1 | Look 2 | Look 3 | Look 4 | Look 5 |
|-------|--------|--------|--------|--------|--------|
| 2 | 0.0052 | 0.0492 | - | - | - |
| 3 | 0.0011 | 0.0117 | 0.0451 | - | - |
| 5 | 0.0001 | 0.0024 | 0.0102 | 0.0235 | 0.0417 |

### Table 4: Reporting Checklist Summary

| Category | Essential Items | Count |
|----------|----------------|-------|
| Design | Sequential declared, k looks, spending function, overall α/β | 4 |
| Pre-specification | N_max, boundaries/alphas, timing, stopping rules | 4 |
| Execution | Actual looks, stop look, sample sizes, deviations | 4 |
| Results | Unadjusted p/ES/CI, test statistic, critical value | 3 |
| Recommended | Adjusted p/ES/CI, software, rationale | 3 |
| **Total** | **Minimum reporting items** | **15** |

### Table 5: Common Software Commands (rpact)

| Task | Command |
|------|---------|
| Design creation | `getDesignGroupSequential(kMax, typeOfDesign, sided, alpha, beta)` |
| Sample size for means | `getSampleSizeMeans(design, groups, alternative, stDev)` |
| Power analysis | `getPowerMeans(design, groups, alternative, stDev, maxNumberOfSubjects)` |
| Analyze results | `getAnalysisResults(design, dataInput)` |
| Get characteristics | `getDesignCharacteristics(design)` |
| Update alpha | Specify `informationRates` in design or use `typeOfDesign = "asUser"` |
| Plot boundaries | `plot(design)` or `plot(results)` |

---

## 14. ETHICAL CONSIDERATIONS

### When Sequential Analysis Is Ethically Required
1. Life-threatening conditions: Can't justify withholding effective treatment
2. Expensive interventions: Resources should not be wasted
3. Participant burden: Minimize unnecessary participation if conclusion is clear
4. Animal research: Minimize animal use when possible

### When Sequential Analysis May Be Inappropriate
1. Exploratory research: Multiple outcomes, undefined hypotheses
2. Observational studies: Data not collected prospectively in groups
3. Small samples: Inflation factor makes design impractical
4. Single-shot data: All data available simultaneously

### Transparency Requirements
- Pre-registration of full design is essential
- Deviations must be transparently reported
- Distinction between sequential analysis and optional stopping must be clear

### Stopping Decisions
- **For efficacy**: Generally should stop
- **For futility**: More nuanced; if binding and pre-specified: should stop; if non-binding: researcher discretion with transparent reporting

---

## 15. PRACTICAL VERIFICATION WORKFLOW

**Phase 1: Pre-Study Design Review (if available)**
1. Extract design parameters from protocol/pre-registration
2. Run Algorithm 1 (Type I error control)
3. Run Algorithm 2 (Sample size adequacy)
4. Check spending function choice is justified
5. Verify stopping rules are well-defined

**Phase 2: Interim Analysis Review (if accessible)**
1. For each interim: Run Algorithm 3 (Interim execution)
2. Check timing against plan
3. Verify alpha recalculation if needed
4. Confirm correct critical value used

**Phase 3: Final Manuscript Review**
1. Run Algorithm 4 (Reporting completeness)
2. Cross-check reported vs. expected statistics
3. Verify both adjusted and unadjusted estimates reported
4. Check for red flags
5. Evaluate transparency and reproducibility

**Phase 4: Meta-Analytic Considerations**
1. If for meta-analysis: Use UNADJUSTED effect size
2. Note study used sequential design
3. Weight by actual final N, not maximum N

**Phase 5: Generate Report**
1. Summarize verification results
2. List failures, warnings, or concerns
3. Provide specific recommendations

---

## 16. RED FLAGS SUMMARY

Immediate red flags indicating likely problems:

1. **"We analyzed after every participant until p < 0.05"** → Optional stopping
2. **No mention of alpha correction** → Optional stopping
3. **Unadjusted alpha used at each look (e.g., 0.05)** → Inflated Type I error
4. **Added/removed looks based on interim data** → Invalid design modification
5. **Stopped for futility without pre-specified beta spending** → Questionable error control
6. **Only adjusted OR only unadjusted estimates reported** → Incomplete reporting
7. **Sequential design not mentioned until results section** → Possible p-hacking
8. **Implausibly perfect timing (exactly at planned N)** → Possible misreporting
9. **Claimed "sequential" but no spending function specified** → Unclear methodology
10. **Changed spending function after seeing interim results** → Invalid

---

## CONCLUSION

Sequential analysis is powerful and efficient when properly designed and executed. Key verification principles:

1. **Type I error must be controlled** - Alpha spending functions or corrections are mandatory
2. **Pre-specification is critical** - Design must be planned before data collection
3. **Flexibility is allowed** - Timing can deviate if alpha is recalculated
4. **Transparency is essential** - Full design and deviations must be reported
5. **Both adjusted and unadjusted estimates** - Report for different purposes
6. **Sequential ≠ Optional** - Clear distinction must be maintained

Focus verification on:
- Was error control maintained?
- Were rules pre-specified and followed?
- Is reporting complete and transparent?
